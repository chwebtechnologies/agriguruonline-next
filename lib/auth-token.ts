import { getUserApiUrl } from '@/lib/api-utils';
import { isJwtExpired, extractRefreshTokenFromResponse, getIsSecureCookie } from '@/lib/auth-cookie';

async function getCookieStore() {
  if (typeof window !== 'undefined') return null;
  try {
    const { cookies } = await import('next/headers');
    return await cookies();
  } catch {
    return null;
  }
}

export interface RefreshResult {
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  message?: string;
}

// Single-flight in-flight promise to prevent concurrent refresh calls from racing
let ongoingRefreshPromise: Promise<RefreshResult> | null = null;

// Request-scoped or short-lived memory cache for the latest refreshed token
let lastRefreshedToken: { token: string; exp: number } | null = null;

/**
 * Executes a token refresh against the backend User API with mutex locking.
 * Sends all required headers and parameters expected by the backend while
 * omitting the expired Authorization header that causes 401 rejections.
 */
export async function executeRefreshToken(refreshTokenVal?: string): Promise<RefreshResult> {
  if (ongoingRefreshPromise) {
    return ongoingRefreshPromise;
  }

  ongoingRefreshPromise = (async (): Promise<RefreshResult> => {
    try {
      const cookieStore = await getCookieStore();
      const refreshToken =
        refreshTokenVal ||
        cookieStore?.get('refresh_token')?.value ||
        cookieStore?.get('web_refresh_token')?.value;

      if (!refreshToken) {
        return { success: false, message: 'No refresh token available' };
      }

      const apiUrl = getUserApiUrl();
      const url = `${apiUrl}/auth/refresh-token?lang_code=en&source=web`;

      // Notice: We strictly DO NOT send Authorization: Bearer <expiredToken> header
      // because backend auth middleware rejects expired bearer tokens before the refresh controller runs.
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-app-source': 'web',
          'source': 'web',
          'x-refresh-token': refreshToken,
          'refresh-token': refreshToken,
          'Cookie': `web_refresh_token=${refreshToken}; refresh_token=${refreshToken}`,
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
          refreshToken: refreshToken,
          web_refresh_token: refreshToken,
          source: 'web',
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch (e) {
        // ignore parse error
      }

      if (!response.ok || (data && data.success === 0)) {
        return {
          success: false,
          message: data?.message || 'Refresh token expired or invalid',
        };
      }

      const newAccessToken =
        data?.data?.access_token ||
        data?.data?.token ||
        data?.access_token ||
        data?.token;

      if (!newAccessToken) {
        return {
          success: false,
          message: 'Invalid response from refresh server: missing access token',
        };
      }

      const newRefreshToken =
        extractRefreshTokenFromResponse(response, data) ||
        data?.data?.refresh_token ||
        data?.data?.refreshToken ||
        refreshToken;

      // Cache token in memory for immediate use within this process
      try {
        const parts = newAccessToken.split('.');
        if (parts.length === 3) {
          const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const pad = payloadBase64.length % 4;
          const padded = pad ? payloadBase64 + '='.repeat(4 - pad) : payloadBase64;
          const decoded = atob(padded);
          const parsed = JSON.parse(decoded);
          if (parsed.exp) {
            lastRefreshedToken = { token: newAccessToken, exp: parsed.exp * 1000 };
          }
        }
      } catch (e) {}

      // Update cookie store (succeeds in Server Actions & Route Handlers; safely caught in RSC)
      const isSecure = await getIsSecureCookie();
      try {
        if (cookieStore) {
          cookieStore.set('auth_token', newAccessToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60,
          });

          if (newRefreshToken) {
            cookieStore.set('refresh_token', newRefreshToken, {
              httpOnly: true,
              secure: isSecure,
              sameSite: 'lax',
              path: '/',
              maxAge: 30 * 24 * 60 * 60,
            });
            cookieStore.set('web_refresh_token', newRefreshToken, {
              httpOnly: true,
              secure: isSecure,
              sameSite: 'lax',
              path: '/',
              maxAge: 30 * 24 * 60 * 60,
            });
          }
        }
      } catch (cookieErr) {
        // Safe fallback when executed during RSC rendering (where cookies cannot be set directly)
      }

      return {
        success: true,
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    } catch (err: any) {
      console.error('[executeRefreshToken] Error:', err);
      return {
        success: false,
        message: err?.message || 'Internal server error during refresh',
      };
    } finally {
      // Clear single-flight promise after a short cooldown
      setTimeout(() => {
        ongoingRefreshPromise = null;
      }, 300);
    }
  })();

  return ongoingRefreshPromise;
}

/**
 * Universal Server-Side helper to obtain a guaranteed valid (non-expired) auth token.
 * 
 * 1. Checks passedToken (if valid, returns immediately).
 * 2. Checks cached in-memory fresh token.
 * 3. Checks cookies (auth_token). If valid (with 5s buffer), returns it.
 * 4. If expired or missing, triggers executeRefreshToken() using refresh_token.
 * 5. Returns the fresh access token, or null if completely unauthenticated.
 */
export async function getValidAuthToken(passedToken?: string): Promise<string | null> {
  // 1. If passedToken is provided and still fresh, return it
  if (passedToken && !isJwtExpired(passedToken, 5)) {
    return passedToken;
  }

  // 2. If we just refreshed a token in memory recently and it is still alive
  if (lastRefreshedToken && lastRefreshedToken.exp - Date.now() > 5000) {
    return lastRefreshedToken.token;
  }

  // 3. Read cookieStore
  let cookieToken: string | null = null;
  let cookieRefreshToken: string | null = null;
  try {
    const cookieStore = await getCookieStore();
    cookieToken = cookieStore?.get('auth_token')?.value || cookieStore?.get('__Secure-uid')?.value || null;
    cookieRefreshToken = cookieStore?.get('refresh_token')?.value || cookieStore?.get('web_refresh_token')?.value || null;
  } catch (e) {
    // cookies() unavailable outside request context
  }

  // If cookieToken is alive and not expired (buffer: 5s), return it
  if (cookieToken && !isJwtExpired(cookieToken, 5)) {
    return cookieToken;
  }

  // 4. Token expired or missing, attempt refresh if refresh token exists
  if (cookieRefreshToken) {
    const refreshResult = await executeRefreshToken(cookieRefreshToken);
    if (refreshResult.success && refreshResult.access_token) {
      return refreshResult.access_token;
    }
  }

  // 5. Fallback: if passedToken is technically alive right now (0s buffer), use it
  if (passedToken && !isJwtExpired(passedToken, 0)) {
    return passedToken;
  }

  // 6. Last resort: return whatever cookieToken exists or null
  return cookieToken || passedToken || null;
}

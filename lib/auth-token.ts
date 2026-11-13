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

// Single-flight mutex map by refresh_token to prevent concurrent duplicate refresh requests for the same session
const ongoingRefreshPromises = new Map<string, Promise<RefreshResult>>();

/**
 * Executes a token refresh against the backend User API with mutex locking.
 * Sends all required headers and parameters expected by the backend while
 * omitting the expired Authorization header that causes 401 rejections.
 */
export async function executeRefreshToken(refreshTokenVal?: string): Promise<RefreshResult> {
  const cookieStore = await getCookieStore();
  const refreshToken =
    refreshTokenVal ||
    cookieStore?.get('refresh_token')?.value ||
    cookieStore?.get('web_refresh_token')?.value;

  if (!refreshToken || refreshToken === 'deleted' || refreshToken.trim().length < 10) {
    return { success: false, message: 'No valid refresh token available' };
  }

  // Deduplicate concurrent refreshes for the exact same refresh token
  const existingPromise = ongoingRefreshPromises.get(refreshToken);
  if (existingPromise) {
    return existingPromise;
  }

  const refreshPromise = (async (): Promise<RefreshResult> => {
    try {
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
        ongoingRefreshPromises.delete(refreshToken);
      }, 300);
    }
  })();

  ongoingRefreshPromises.set(refreshToken, refreshPromise);
  return refreshPromise;
}

/**
 * Universal Server-Side helper to obtain a guaranteed valid (non-expired) auth token.
 * 
 * 1. Checks passedToken (if valid, returns immediately).
 * 2. Checks cookies (auth_token). If valid (with 5s buffer), returns it.
 * 3. If expired or missing, triggers executeRefreshToken() using refresh_token.
 * 4. Returns the fresh access token, or null if completely unauthenticated.
 */
export async function getValidAuthToken(passedToken?: string): Promise<string | null> {
  // 1. If passedToken is provided and still fresh, return it
  if (passedToken && passedToken !== 'deleted' && !isJwtExpired(passedToken, 5)) {
    return passedToken;
  }

  // 2. Read cookieStore for the current request
  let cookieToken: string | null = null;
  let cookieRefreshToken: string | null = null;
  try {
    const cookieStore = await getCookieStore();
    const rawToken = cookieStore?.get('auth_token')?.value || cookieStore?.get('__Secure-uid')?.value || null;
    const rawRefresh = cookieStore?.get('refresh_token')?.value || cookieStore?.get('web_refresh_token')?.value || null;

    if (rawToken && rawToken !== 'deleted' && rawToken.trim().length > 10) {
      cookieToken = rawToken.trim();
    }
    if (rawRefresh && rawRefresh !== 'deleted' && rawRefresh.trim().length > 10) {
      cookieRefreshToken = rawRefresh.trim();
    }
  } catch (e) {
    // cookies() unavailable outside request context
  }

  // 3. If cookieToken is alive and not expired (buffer: 5s), return it
  if (cookieToken && !isJwtExpired(cookieToken, 5)) {
    return cookieToken;
  }

  // 4. Token expired or missing, attempt refresh ONLY if refresh token exists in cookies
  if (cookieRefreshToken) {
    const refreshResult = await executeRefreshToken(cookieRefreshToken);
    if (refreshResult.success && refreshResult.access_token) {
      return refreshResult.access_token;
    }
  }

  // 5. Fallback: if passedToken is technically alive right now (0s buffer), use it
  if (passedToken && passedToken !== 'deleted' && !isJwtExpired(passedToken, 0)) {
    return passedToken;
  }

  // 6. Completely unauthenticated guest - return null (NEVER leak another session!)
  return null;
}

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

async function getHeaderStore() {
  if (typeof window !== 'undefined') return null;
  try {
    const { headers } = await import('next/headers');
    return await headers();
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

export interface TokenCacheEntry {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// Global cache and mutex map attached to globalThis to ensure single-flight deduplication
// and rotation grace periods are shared across all Next.js bundles (proxy, RSC, Route Handlers, Server Actions).
const g = globalThis as unknown as {
  __AGY_RECENT_REFRESH_CACHE__?: Map<string, TokenCacheEntry>;
  __AGY_ONGOING_REFRESH_PROMISES__?: Map<string, Promise<RefreshResult>>;
};

if (!g.__AGY_RECENT_REFRESH_CACHE__) {
  g.__AGY_RECENT_REFRESH_CACHE__ = new Map<string, TokenCacheEntry>();
}
if (!g.__AGY_ONGOING_REFRESH_PROMISES__) {
  g.__AGY_ONGOING_REFRESH_PROMISES__ = new Map<string, Promise<RefreshResult>>();
}

const recentRefreshCache = g.__AGY_RECENT_REFRESH_CACHE__;
const ongoingRefreshPromises = g.__AGY_ONGOING_REFRESH_PROMISES__;

/**
 * Checks if a recently refreshed token pair exists in the grace period cache for a given token key.
 * Used to prevent token rotation 401 collisions when multiple requests use an already-rotated token.
 */
export function getRecentlyRefreshedToken(tokenKey?: string | null): TokenCacheEntry | null {
  if (!tokenKey) return null;
  const cleanKey = tokenKey.trim();
  const entry = recentRefreshCache.get(cleanKey);
  if (!entry) return null;
  if (Date.now() > entry.expires_at) {
    recentRefreshCache.delete(cleanKey);
    return null;
  }
  return entry;
}

/**
 * Records a newly refreshed token pair into the rotation grace period cache for all associated keys.
 */
export function recordRefreshedToken(
  oldKeys: (string | undefined | null)[],
  newAccess: string,
  newRefresh: string,
  ttlMs = 90_000
) {
  const expires_at = Date.now() + ttlMs;
  const entry: TokenCacheEntry = {
    access_token: newAccess,
    refresh_token: newRefresh,
    expires_at,
  };

  const allKeys = [...oldKeys, newAccess, newRefresh];
  for (const k of allKeys) {
    if (k && k !== 'deleted' && k.trim().length > 5) {
      recentRefreshCache.set(k.trim(), entry);
    }
  }

  // Periodic pruning if cache grows
  if (recentRefreshCache.size > 300) {
    const now = Date.now();
    for (const [key, val] of recentRefreshCache.entries()) {
      if (now > val.expires_at) {
        recentRefreshCache.delete(key);
      }
    }
  }
}

/**
 * Executes a token refresh against the backend User API with mutex locking and grace period cache.
 * Sends all required headers and parameters expected by the backend while
 * omitting the expired Authorization header that causes 401 rejections.
 */
export async function executeRefreshToken(refreshTokenVal?: string, oldAccessToken?: string): Promise<RefreshResult> {
  const cookieStore = await getCookieStore();
  const refreshToken =
    refreshTokenVal ||
    cookieStore?.get('refresh_token')?.value ||
    cookieStore?.get('web_refresh_token')?.value;

  if (!refreshToken || refreshToken === 'deleted' || refreshToken.trim().length < 10) {
    return { success: false, message: 'No valid refresh token available' };
  }

  const cleanRefresh = refreshToken.trim();

  // 1. Check if this refresh token (or the old access token) was already refreshed recently within grace period
  const cached = getRecentlyRefreshedToken(cleanRefresh) || (oldAccessToken ? getRecentlyRefreshedToken(oldAccessToken) : null);
  if (cached && !isJwtExpired(cached.access_token, 5)) {
    return {
      success: true,
      access_token: cached.access_token,
      refresh_token: cached.refresh_token,
    };
  }

  // 2. Deduplicate concurrent refreshes for the exact same refresh token using single-flight mutex
  const existingPromise = ongoingRefreshPromises.get(cleanRefresh);
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
          'x-refresh-token': cleanRefresh,
          'refresh-token': cleanRefresh,
          'Cookie': `web_refresh_token=${cleanRefresh}; refresh_token=${cleanRefresh}`,
        },
        body: JSON.stringify({
          refresh_token: cleanRefresh,
          refreshToken: cleanRefresh,
          web_refresh_token: cleanRefresh,
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
        cleanRefresh;

      // Record in rotation grace cache for 90 seconds to prevent race condition 401s
      recordRefreshedToken([cleanRefresh, oldAccessToken], newAccessToken, newRefreshToken, 90_000);

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
        ongoingRefreshPromises.delete(cleanRefresh);
      }, 500);
    }
  })();

  ongoingRefreshPromises.set(cleanRefresh, refreshPromise);
  return refreshPromise;
}

/**
 * Universal Server-Side helper to obtain a guaranteed valid (non-expired) auth token.
 * 
 * 1. Checks passedToken (if valid, returns immediately).
 * 2. Checks request headers (x-new-auth-token / x-auth-token set by proxy.ts).
 * 3. Checks cookies (auth_token). If valid (with 5s buffer), returns it.
 * 4. Checks the rotation grace cache if the current cookie was already refreshed.
 * 5. If expired or missing, triggers executeRefreshToken() using refresh_token.
 * 6. Returns the fresh access token, or null if completely unauthenticated.
 */
export async function getValidAuthToken(passedToken?: string): Promise<string | null> {
  // 1. If passedToken is provided and still fresh, return it
  if (passedToken && passedToken !== 'deleted' && !isJwtExpired(passedToken, 5)) {
    return passedToken;
  }

  // 2. Check if proxy.ts already refreshed and set x-new-auth-token or x-auth-token in request headers
  try {
    const headerStore = await getHeaderStore();
    const headerNewAuth = headerStore?.get('x-new-auth-token') || headerStore?.get('x-auth-token');
    if (headerNewAuth && headerNewAuth !== 'deleted' && !isJwtExpired(headerNewAuth, 5)) {
      return headerNewAuth.trim();
    }
  } catch (e) {
    // headers() unavailable outside request context
  }

  // 3. Read cookieStore for the current request
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

  // 4. If cookieToken is alive and not expired (buffer: 5s), return it
  if (cookieToken && !isJwtExpired(cookieToken, 5)) {
    return cookieToken;
  }

  // 5. Check rotation grace cache: maybe proxy or another request already refreshed this session
  const cached =
    (cookieToken ? getRecentlyRefreshedToken(cookieToken) : null) ||
    (cookieRefreshToken ? getRecentlyRefreshedToken(cookieRefreshToken) : null) ||
    (passedToken ? getRecentlyRefreshedToken(passedToken) : null);

  if (cached && !isJwtExpired(cached.access_token, 5)) {
    return cached.access_token;
  }

  // 6. Token expired or missing, attempt refresh ONLY if refresh token exists in cookies
  if (cookieRefreshToken) {
    const refreshResult = await executeRefreshToken(cookieRefreshToken, cookieToken || passedToken);
    if (refreshResult.success && refreshResult.access_token) {
      return refreshResult.access_token;
    }
  }

  // 7. Fallback: if passedToken is technically alive right now (0s buffer), use it
  if (passedToken && passedToken !== 'deleted' && !isJwtExpired(passedToken, 0)) {
    return passedToken;
  }

  // 8. Completely unauthenticated guest - return null (NEVER leak another session!)
  return null;
}

export interface ApiFetchOptions extends RequestInit {
  token?: string;
  refreshToken?: string;
  params?: Record<string, string | number | boolean | undefined | null>;
  revalidate?: number | false;
  timeout?: number;
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
}

import { refreshTokensAction } from "@/app/actions/auth";
import { isJwtExpired } from "@/lib/auth-cookie";

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

/**
 * Universal high-performance fetcher for AgriGuru.
 * - Public GET requests default to Next.js Data Cache with Stale-While-Revalidate (default 60s).
 * - Authenticated requests (with token) and mutations (POST/PUT/PATCH/DELETE) default to { cache: 'no-store' } for 100% security.
 * - Automatically handles Query Parameters serialization.
 * - Injects Authorization Bearer token if provided.
 * - Safe for both Server and Client components.
 */
export async function customFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const {
    token,
    params,
    headers: customHeaders,
    cache,
    revalidate,
    timeout: customTimeout,
    next: customNext,
    method = 'GET',
    ...rest
  } = options;

  let finalUrl = url;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers = new Headers(customHeaders || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (!headers.has('x-app-source')) {
    headers.set('x-app-source', 'web');
  }
  if (!headers.has('source')) {
    headers.set('source', 'web');
  }
  if (token) {
    let cleanToken = token.trim().replace(/^Bearer\s+/i, '');

    // Server-side proactive refresh: If token is expired or expiring within 5s, refresh before calling API
    if (typeof window === 'undefined' && isJwtExpired(cleanToken, 5)) {
      try {
        const { executeRefreshToken } = await import('@/lib/auth-token');
        const refreshResult = await executeRefreshToken();
        if (refreshResult.success && refreshResult.access_token) {
          cleanToken = refreshResult.access_token.trim().replace(/^Bearer\s+/i, '');
        }
      } catch (e) {
        // Fall back to original token, letting 401 interceptor handle if needed
      }
    }

    headers.set('Authorization', `Bearer ${cleanToken}`);

    // Attach refresh token to all authenticated requests
    let activeRefreshToken = options.refreshToken;
    if (!activeRefreshToken && typeof window === 'undefined') {
      try {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        activeRefreshToken = cookieStore.get('refresh_token')?.value || cookieStore.get('web_refresh_token')?.value;
      } catch (e) {
        // cookies() may not be available outside request context (e.g. static generation)
      }
    }

    if (activeRefreshToken) {
      if (!headers.has('x-refresh-token')) headers.set('x-refresh-token', activeRefreshToken);
      if (!headers.has('refresh-token')) headers.set('refresh-token', activeRefreshToken);

      const existingCookie = headers.get('Cookie') || '';
      const cookieParts = existingCookie ? existingCookie.split(';').map(c => c.trim()).filter(Boolean) : [];
      if (!cookieParts.some(c => c.startsWith('web_refresh_token='))) {
        cookieParts.push(`web_refresh_token=${activeRefreshToken}`);
      }
      if (!cookieParts.some(c => c.startsWith('refresh_token='))) {
        cookieParts.push(`refresh_token=${activeRefreshToken}`);
      }
      if (!cookieParts.some(c => c.startsWith('auth_token='))) {
        cookieParts.push(`auth_token=${cleanToken}`);
      }
      headers.set('Cookie', cookieParts.join('; '));
    }
  }

  // Determine caching strategy:
  // 1. If explicit cache is passed, honor it.
  // 2. If token is present or HTTP method is mutation (POST, PUT, DELETE, PATCH), strictly no-store.
  // 3. For public GET requests, use Next.js Data Cache with revalidation (default 60s).
  const isMutation = method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD';
  const isAuthRequest = Boolean(token);

  const fetchInit: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
    ...rest,
    method,
    headers,
  };

  if (cache !== undefined) {
    fetchInit.cache = cache;
    if (customNext) {
      fetchInit.next = customNext;
    }
  } else if (isMutation || isAuthRequest) {
    fetchInit.cache = 'no-store';
  } else {
    // Public GET request — enable Next.js Data Cache (Stale-While-Revalidate)
    const revalidateSeconds = revalidate !== undefined ? revalidate : (customNext?.revalidate ?? 60);
    fetchInit.next = {
      ...(customNext || {}),
      revalidate: revalidateSeconds,
    };
  }

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  let attempt = 0;
  const maxRetries = 1; // Total 2 attempts (1 initial + 1 retry)

  // Payment/Mutations need enough time for 3rd-party gateways (PayPal/Razorpay server-to-server)
  const defaultTimeout = isMutation ? 30000 : 15000;
  const effectiveTimeout = customTimeout ?? defaultTimeout;

  while (attempt <= maxRetries) {
    // Add an explicit timeout to prevent hanging forever
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);
    
    fetchInit.signal = controller.signal;

    let slowTimer: NodeJS.Timeout | null = null;
    let didEmitSlow = false;
    if (typeof window !== 'undefined') {
      slowTimer = setTimeout(() => {
        didEmitSlow = true;
        window.dispatchEvent(new CustomEvent('app:slow-connection', { detail: { url: finalUrl } }));
      }, 3500);
    }

    const cleanupTimers = () => {
      clearTimeout(timeoutId);
      if (slowTimer) clearTimeout(slowTimer);
      if (didEmitSlow && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:slow-connection-resolved'));
      }
    };

    try {
      const res = await fetch(finalUrl, fetchInit);
      
      // Successful response proves connectivity is alive
      if (typeof window !== 'undefined' && res) {
        window.dispatchEvent(new CustomEvent('app:online'));
      }
      
      // Retry for 5xx Server Errors (Temporary backend issues)
      if (res.status >= 500 && res.status <= 599 && attempt < maxRetries) {
        cleanupTimers();
        attempt++;
        await delay(500); // 500ms retry delay (was 1.5s)
        continue;
      }

      // 401 Interceptor for both server-side and client-side fetches
      if (res.status === 401 && isAuthRequest && !finalUrl.includes('/auth/refresh-token')) {
        // Only core auth/user profile endpoints can determine if the overall user session is truly dead.
        // Secondary microservices (smart-docs-api, trading-api, cms-api) may return 401 due to feature permissions/plans
        // and MUST NEVER trigger a full-site logout or redirect to /login!
        const isCoreUserApi =
          finalUrl.includes('/profile') ||
          finalUrl.includes('/user/') ||
          finalUrl.includes('/auth/user') ||
          finalUrl.includes('/auth/me');

        if (typeof window !== 'undefined') {
          if (!isRefreshing) {
            isRefreshing = true;
            try {
              const result = await refreshTokensAction();
              if (result.success && result.access_token) {
                onRefreshed(result.access_token);
                window.dispatchEvent(
                  new CustomEvent('auth-token-refreshed', { detail: { token: result.access_token } })
                );
              } else {
                onRefreshed('');
              }
            } catch (error) {
              onRefreshed('');
            } finally {
              isRefreshing = false;
            }
          }

          // Wait for the token refresh to finish before retrying
          const retryPromise = new Promise((resolve) => {
            addRefreshSubscriber(async (newTokenStatus) => {
              if (newTokenStatus) {
                if (headers.has('Authorization')) {
                  headers.set('Authorization', `Bearer ${newTokenStatus}`);
                  fetchInit.headers = headers;
                }
                resolve(await fetch(finalUrl, fetchInit));
              } else {
                resolve(res); // Return original 401 if refresh failed
              }
            });
          });
          
          clearTimeout(timeoutId);
          return (await retryPromise) as Response;
        } else {
          // Server-side (Server Components and Server Actions)
          try {
            const { executeRefreshToken } = await import('@/lib/auth-token');
            const refreshRes = await executeRefreshToken();
            if (refreshRes.success && refreshRes.access_token) {
              const retryHeaders = new Headers(fetchInit.headers);
              retryHeaders.set('Authorization', `Bearer ${refreshRes.access_token}`);
              const existingCookie = retryHeaders.get('Cookie') || '';
              const cookieParts = existingCookie
                .split(';')
                .map(c => c.trim())
                .filter(c => c && !c.startsWith('auth_token='));
              cookieParts.push(`auth_token=${refreshRes.access_token}`);
              retryHeaders.set('Cookie', cookieParts.join('; '));
              fetchInit.headers = retryHeaders;
              clearTimeout(timeoutId);
              const retriedRes = await fetch(finalUrl, fetchInit);
              if (retriedRes.status !== 401) {
                return retriedRes;
              }
            }
          } catch (error) {
            console.error('[customFetch] Server-side token refresh error:', error);
          }

          // If token refresh failed or retried 401, but this endpoint supports guest access (favourite-port or favorite-product)
          if (finalUrl.includes('/favourite-port') || finalUrl.includes('/favorite-product')) {
            const guestHeaders = new Headers(fetchInit.headers);
            guestHeaders.delete('Authorization');
            fetchInit.headers = guestHeaders;
            cleanupTimers();
            const guestRes = await fetch(finalUrl, fetchInit);
            if (guestRes.ok) {
              return guestRes;
            }
          }
        }
      }
      
      cleanupTimers();
      return res;
    } catch (error: any) {
      cleanupTimers();
      
      // Only retry on pure network failures, NOT timeouts (AbortError) — retrying a timed-out request wastes more time
      if (attempt < maxRetries && error.name !== 'AbortError' && (error.message?.includes('fetch') || error.message?.includes('network'))) {
        attempt++;
        await delay(500);
        continue;
      }
      
      console.error(`[customFetch] Network error for ${finalUrl} after ${attempt + 1} attempts:`, error);
      throw error;
    }
  }

  throw new Error('Network error: Max retries exceeded');
}

/**
 * Convenience helper to fetch and parse JSON response safely.
 */
export async function customFetchJSON<T>(url: string, options: ApiFetchOptions = {}): Promise<T | null> {
  try {
    const res = await customFetch(url, options);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.error(`[customFetchJSON] Error fetching JSON for ${url}:`, error);
    return null;
  }
}

export interface ApiFetchOptions extends RequestInit {
  token?: string;
  params?: Record<string, string | number | boolean | undefined | null>;
  revalidate?: number | false;
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
}

import { refreshTokensAction } from "@/app/actions/auth";

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
    headers.set('Authorization', `Bearer ${token}`);
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

  while (attempt <= maxRetries) {
    // Add an explicit timeout to prevent hanging forever
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout (was 10s)
    
    fetchInit.signal = controller.signal;

    try {
      const res = await fetch(finalUrl, fetchInit);
      
      // Retry for 5xx Server Errors (Temporary backend issues)
      if (res.status >= 500 && res.status <= 599 && attempt < maxRetries) {
        clearTimeout(timeoutId);
        attempt++;
        await delay(500); // 500ms retry delay (was 1.5s)
        continue;
      }

      // 401 Interceptor for client-side fetches
      if (res.status === 401 && typeof window !== 'undefined' && isAuthRequest && !finalUrl.includes('/auth/refresh-token')) {
        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const result = await refreshTokensAction();
            if (result.success && result.access_token) {
              onRefreshed(result.access_token);
            } else {
              onRefreshed('');
              window.location.href = '/en/login';
            }
          } catch (error) {
            onRefreshed('');
            window.location.href = '/en/login';
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
      }
      
      clearTimeout(timeoutId);
      return res;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
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

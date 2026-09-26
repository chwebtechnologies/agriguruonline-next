import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['en', 'ar', 'zh', 'fr']
const defaultLocale = 'en'

// Basic in-memory rate limiter for Edge Runtime
// Note: This is per-isolate. For a distributed edge, use Redis/Upstash.
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();

function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count += 1;
  return true;
}

function getLocale(request: NextRequest): string {
  const acceptLanguage = request.headers.get('accept-language')
  if (!acceptLanguage) return defaultLocale

  const parsedLanguages = acceptLanguage
    .split(',')
    .map((langStr) => {
      const parts = langStr.split(';')
      const code = parts[0].trim().split('-')[0].toLowerCase()
      let quality = 1.0
      if (parts[1]) {
        const qParts = parts[1].split('=')
        if (qParts[0].trim() === 'q' && qParts[1]) {
          quality = parseFloat(qParts[1]) || 1.0
        }
      }
      return { code, quality }
    })
    .sort((a, b) => b.quality - a.quality)

  for (const lang of parsedLanguages) {
    if (locales.includes(lang.code)) {
      return lang.code
    }
  }

  return defaultLocale
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // 1. Basic Rate Limiting for API routes
  if (pathname.startsWith('/api/')) {
    // Limit to 60 requests per minute per IP
    const isAllowed = rateLimit(ip, 60, 60 * 1000);
    if (!isAllowed) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
  }

  // 2. Auth Guards
  let token = request.cookies.get('auth_token')?.value;
  let isTokenValid = false;

  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        // Standard JWT
        // Fix base64 string to be properly parseable by atob
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        // Pad the string with '=' to make its length a multiple of 4
        const pad = payloadBase64.length % 4;
        const paddedBase64 = pad ? payloadBase64 + '='.repeat(4 - pad) : payloadBase64;
        
        const decodedJson = atob(paddedBase64);
        const payload = JSON.parse(decodedJson);
        
        // Expiration is typically in seconds
        const nowMs = Date.now();
        const expMs = payload.exp ? payload.exp * 1000 : 0;
        
        // Refresh if within 25 seconds of expiry (to ensure we refresh before it dies)
        if (payload.exp && nowMs >= expMs - 25 * 1000) {
          isTokenValid = false; // Assume invalid until refreshed, UNLESS it's not actually expired yet
          
          const refreshToken = request.cookies.get('refresh_token')?.value;
          const oldToken = request.cookies.get('auth_token')?.value;
          const tokenToRefresh = refreshToken || oldToken;
          
          if (tokenToRefresh) {
            try {
              const backendUrl = process.env.NEXT_PUBLIC_USER_API_URL || 'https://user-api.agriguruonline.cloud';
                const bodyPayload = { refresh_token: tokenToRefresh, source: 'WEB' };
                const refreshRes = await fetch(`${backendUrl}/auth/refresh-token?lang_code=en&source=web`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'x-app-source': 'web',
                    'source': 'web',
                    'Cookie': `web_refresh_token=${tokenToRefresh}`
                  },
                  body: JSON.stringify(bodyPayload)
                });
                
                if (refreshRes.ok) {
                  const refreshData = await refreshRes.json();
                  if (refreshData?.data?.access_token) {
                  token = refreshData.data.access_token;
                  isTokenValid = true;
                  
                  // Signal downstream that we have new tokens
                  request.headers.set('x-new-auth-token', refreshData.data.access_token);
                  request.cookies.set('auth_token', refreshData.data.access_token);
                  
                  // Check if backend returned a new web_refresh_token via Set-Cookie
                  const setCookieHeader = refreshRes.headers.get("set-cookie");
                  let newRefreshToken = refreshData.data.refresh_token || null;
                  
                  if (setCookieHeader) {
                    const match = setCookieHeader.match(/web_refresh_token=([^;]+)/);
                    if (match) {
                      newRefreshToken = match[1];
                    }
                  } else {
                    const cookiesArr = refreshRes.headers.getSetCookie ? refreshRes.headers.getSetCookie() : [];
                    for (const c of cookiesArr) {
                      const match = c.match(/web_refresh_token=([^;]+)/);
                      if (match) {
                        newRefreshToken = match[1];
                        break;
                      }
                    }
                  }

                  if (newRefreshToken) {
                    request.headers.set('x-new-refresh-token', newRefreshToken);
                    request.cookies.set('refresh_token', newRefreshToken);
                  }

                  // CRITICAL FIX: Next.js Server Components read from the raw 'cookie' header.
                  // We must override the raw cookie header so they see the newly refreshed token!
                  const currentCookies = request.headers.get('cookie') || '';
                  const updatedCookies = currentCookies
                    .split(';')
                    .map(c => c.trim())
                    .filter(c => !c.startsWith('auth_token=') && !c.startsWith('refresh_token='))
                    .join('; ');
                  
                  const newCookieStr = [
                    updatedCookies,
                    `auth_token=${refreshData.data.access_token}`
                  ];
                  
                  if (newRefreshToken) {
                    newCookieStr.push(`refresh_token=${newRefreshToken}`);
                  }
                  
                  request.headers.set('cookie', newCookieStr.join('; '));
                }
              } else {
                // Refresh failed
              }
            } catch (err) {
              console.error('Middleware proactive refresh failed:', err);
            }
          }
          
          // If refresh failed or didn't happen, but the token is still technically alive, let it through
          if (!isTokenValid && nowMs < expMs) {
             isTokenValid = true;
          }
        } else {
          isTokenValid = true;
        }
      } else {
        // Non-JWT token format, assume valid
        isTokenValid = true;
      }
    } catch (e) {
      console.error('Error decoding JWT token in middleware:', e);
      isTokenValid = false; // Safe fallback for security
    }
  }
  
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  let locale = defaultLocale;
  if (pathnameHasLocale) {
    locale = pathname.split('/')[1];
  } else {
    locale = getLocale(request);
  }

  // Define protected routes (require auth)
  const isProtectedRoute = pathname.match(/^\/[a-z]{2}\/(profile|my-inquiries|my-offers|alerts-setups)/);
  
  if (isProtectedRoute && (!token || !isTokenValid)) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirectUrl', pathname);
    const response = NextResponse.redirect(loginUrl);
    
    // Clear expired auth token
    response.cookies.delete('auth_token');
    response.cookies.delete('refresh_token');
    response.cookies.delete('user_info');
    
    return response;
  }

  // Define guest-only routes (redirect if logged in)
  const isGuestRoute = pathname.match(/^\/[a-z]{2}\/(login|register)/);
  
  if (isGuestRoute && token && isTokenValid) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  // Helper to apply new cookies to any NextResponse
  const applyNewCookies = (res: NextResponse) => {
    const newAuthToken = request.headers.get('x-new-auth-token');
    if (newAuthToken) {
      res.cookies.set('auth_token', newAuthToken, {
        httpOnly: true,
        secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https') ?? process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    const newRefreshToken = request.headers.get('x-new-refresh-token');
    if (newRefreshToken) {
      res.cookies.set('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https') ?? process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    return res;
  };

  // 3. Locale Redirect Logic
  if (pathnameHasLocale) return applyNewCookies(NextResponse.next({ request: { headers: request.headers } }));

  // Avoid redirecting static files, api endpoints, images, and next internal files
  const isInternalOrStatic = 
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'

  if (isInternalOrStatic) return applyNewCookies(NextResponse.next({ request: { headers: request.headers } }));

  // Redirect to correct locale
  request.nextUrl.pathname = `/${locale}${pathname}`
  return applyNewCookies(NextResponse.redirect(request.nextUrl));
}

export const config = {
  matcher: [
    // Match all paths except internal paths, static files, and metadata routes
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js)$).*)',
  ],
}

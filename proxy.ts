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

function isSecureRequest(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '');
  if (proto === 'https') return true;
  if (proto === 'http') return false;

  const referer = req.headers.get('referer');
  if (referer?.startsWith('https://')) return true;
  if (referer?.startsWith('http://')) return false;

  const host = req.headers.get('host') || req.nextUrl.host;
  if (
    host.includes('localhost') ||
    host.includes('127.0.0.1') ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.startsWith('172.')
  ) {
    return false;
  }

  return process.env.NODE_ENV === 'production';
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // Pass current pathname to downstream server components
  request.headers.set('x-pathname', pathname);

  // 1. Basic Rate Limiting for API routes
  if (pathname.startsWith('/api/')) {
    // Limit to 60 requests per minute per IP
    const isAllowed = rateLimit(ip, 60, 60 * 1000);
    if (!isAllowed) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
  }

  // Detect Server Actions or Flight RPC requests
  const isServerAction =
    request.headers.has('next-action') ||
    request.headers.get('accept')?.includes('text/x-component');

  // 2. Auth Guards - Support both auth_token and __Secure-uid cookies
  let token =
    request.cookies.get('auth_token')?.value ||
    request.cookies.get('__Secure-uid')?.value;
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
        const isExpired = payload.exp ? nowMs >= expMs : false;

        // Default validity: valid if not expired
        isTokenValid = !isExpired;
        
        // Refresh if within 5 seconds of expiry or already expired
        if (payload.exp && nowMs >= expMs - 5 * 1000) {
          
          const refreshToken = request.cookies.get('refresh_token')?.value || request.cookies.get('web_refresh_token')?.value;
          
          if (refreshToken) {
            try {
              const backendUrl = process.env.NEXT_PUBLIC_USER_API_URL || 'https://user-api.agriguruonline.cloud';
              const bodyPayload = { 
                refresh_token: refreshToken, 
                refreshToken: refreshToken, 
                web_refresh_token: refreshToken,
                source: 'web' 
              };
              const cookieHeaderParts = [
                `web_refresh_token=${refreshToken}`,
                `refresh_token=${refreshToken}`
              ];
              const refreshRes = await fetch(`${backendUrl}/auth/refresh-token?lang_code=en&source=web`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'x-app-source': 'web',
                  'source': 'web',
                  'x-refresh-token': refreshToken,
                  'refresh-token': refreshToken,
                  'Cookie': cookieHeaderParts.join('; ')
                },
                body: JSON.stringify(bodyPayload)
              });
              
              if (refreshRes.ok) {
                const refreshData = await refreshRes.json();
                const newAccess = refreshData?.data?.access_token || refreshData?.data?.token || refreshData?.access_token;
                if (newAccess) {
                  token = newAccess;
                  isTokenValid = true;
                  
                  // Signal downstream that we have new tokens
                  request.headers.set('x-new-auth-token', newAccess);
                  request.cookies.set('auth_token', newAccess);
                  
                  // Check if backend returned a new web_refresh_token via Set-Cookie or JSON
                  let newRefreshToken = refreshData?.data?.refresh_token || refreshData?.data?.refreshToken || refreshData?.data?.web_refresh_token || null;
                  const setCookieHeader = refreshRes.headers.get("set-cookie");
                  if (setCookieHeader) {
                    const match = setCookieHeader.match(/(?:web_refresh_token|refresh_token|refreshToken)=([^;,\s]+)/i);
                    if (match && match[1] && match[1] !== 'deleted') {
                      newRefreshToken = match[1];
                    }
                  } else if (typeof (refreshRes.headers as any).getSetCookie === 'function') {
                    const cookiesArr = (refreshRes.headers as any).getSetCookie();
                    for (const c of cookiesArr) {
                      const match = c.match(/(?:web_refresh_token|refresh_token|refreshToken)=([^;,\s]+)/i);
                      if (match && match[1] && match[1] !== 'deleted') {
                        newRefreshToken = match[1];
                        break;
                      }
                    }
                  }

                  if (newRefreshToken) {
                    request.headers.set('x-new-refresh-token', newRefreshToken);
                    request.cookies.set('refresh_token', newRefreshToken);
                    request.cookies.set('web_refresh_token', newRefreshToken);
                  }

                  // CRITICAL FIX: Next.js Server Components read from the raw 'cookie' header.
                  // Avoid leading semicolon if updatedCookies is empty!
                  const currentCookies = request.headers.get('cookie') || '';
                  const updatedCookies = currentCookies
                    .split(';')
                    .map(c => c.trim())
                    .filter(c => c && !c.startsWith('auth_token=') && !c.startsWith('refresh_token=') && !c.startsWith('web_refresh_token='))
                    .join('; ');
                  
                  const cookieParts = updatedCookies ? [updatedCookies] : [];
                  cookieParts.push(`auth_token=${newAccess}`);
                  if (newRefreshToken) {
                    cookieParts.push(`refresh_token=${newRefreshToken}`);
                    cookieParts.push(`web_refresh_token=${newRefreshToken}`);
                  }
                  
                  request.headers.set('cookie', cookieParts.join('; '));
                }
              }
            } catch (err) {
              console.error('Middleware proactive refresh failed:', err);
            }
          }
          
          // If refresh failed or had a network blip, but token is not yet past expMs, allow it through
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
      isTokenValid = false;
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

  // Helper to apply new cookies to any NextResponse
  const applyNewCookies = (res: NextResponse) => {
    const isSecure = isSecureRequest(request);
    const newAuthToken = request.headers.get('x-new-auth-token');
    if (newAuthToken) {
      res.cookies.set('auth_token', newAuthToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    const newRefreshToken = request.headers.get('x-new-refresh-token');
    if (newRefreshToken) {
      res.cookies.set('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
      res.cookies.set('web_refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    return res;
  };

  // Define protected routes (require auth)
  const isProtectedRoute = pathname.match(/^\/[a-z]{2}\/(dashboard|profile|my-inquiries|my-offers|alerts-setups|become-member|smart-docs)/);
  
  if (isProtectedRoute && (!token || !isTokenValid)) {
    // CRITICAL: Server Actions MUST NEVER be redirected via HTTP 307.
    // Next.js client runtime expects RSC Flight data (text/x-component).
    // An HTTP 307 redirect to an HTML login page triggers "An unexpected response was received from the server."
    // Let Server Actions proceed to the Server Action handler, which securely verifies auth and returns a typed error.
    if (isServerAction) {
      return applyNewCookies(NextResponse.next({ request: { headers: request.headers } }));
    }

    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirectUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Define guest-only routes (redirect if logged in)
  const isGuestRoute = pathname.match(/^\/[a-z]{2}\/(login|register)/);
  
  if (isGuestRoute && token && isTokenValid && !isServerAction) {
    const storedPlan = request.cookies.get('selected-plan')?.value;
    if (storedPlan) {
      return NextResponse.redirect(new URL(`/${locale}/become-member`, request.url));
    }
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

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
    pathname.startsWith('/sitemap') ||
    pathname === '/image-sitemap.xml' ||
    pathname === '/video-sitemap.xml' ||
    pathname.endsWith('.xml') ||
    pathname === '/llms.txt'

  if (isInternalOrStatic) return applyNewCookies(NextResponse.next({ request: { headers: request.headers } }));

  // Redirect to correct locale
  request.nextUrl.pathname = `/${locale}${pathname}`
  return applyNewCookies(NextResponse.redirect(request.nextUrl));
}

export const config = {
  matcher: [
    // Match all paths except internal paths, static files, and metadata routes
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|robots.txt|sitemap.xml|image-sitemap.xml|llms.txt|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|xml|txt|json)$).*)',
  ],
}

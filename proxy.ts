import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { executeRefreshToken } from '@/lib/auth-token';
import { isJwtExpired, parseJwtPayload } from '@/lib/auth-cookie';

const locales = ['en', 'ar', 'zh', 'fr'];
const defaultLocale = 'en';

// Basic in-memory rate limiter for Edge Runtime
// Note: This is per-isolate. For a distributed edge, use Redis/Upstash.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

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
  const acceptLanguage = request.headers.get('accept-language');
  if (!acceptLanguage) return defaultLocale;

  const parsedLanguages = acceptLanguage
    .split(',')
    .map((langStr) => {
      const parts = langStr.split(';');
      const code = parts[0].trim().split('-')[0].toLowerCase();
      let quality = 1.0;
      if (parts[1]) {
        const qParts = parts[1].split('=');
        if (qParts[0].trim() === 'q' && qParts[1]) {
          quality = parseFloat(qParts[1]) || 1.0;
        }
      }
      return { code, quality };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const lang of parsedLanguages) {
    if (locales.includes(lang.code)) {
      return lang.code;
    }
  }

  return defaultLocale;
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
    (request.method === 'POST' && request.headers.get('accept')?.includes('text/x-component'));

  // 2. Auth Guards - Support both auth_token and __Secure-uid cookies
  const rawToken =
    request.cookies.get('auth_token')?.value ||
    request.cookies.get('__Secure-uid')?.value;
  let token = (rawToken && rawToken !== 'deleted' && rawToken.trim().length > 10) ? rawToken.trim() : null;
  let isTokenValid = false;

  if (token) {
    const payload = parseJwtPayload(token);
    if (payload) {
      const nowMs = Date.now();
      const expMs = payload.exp ? payload.exp * 1000 : 0;
      const isExpired = payload.exp ? nowMs >= expMs : false;

      // Default validity: valid if not expired
      isTokenValid = !isExpired;

      // Proactive refresh if within 10 seconds of expiry or already expired
      if (payload.exp && nowMs >= expMs - 10 * 1000) {
        const refreshToken =
          request.cookies.get('refresh_token')?.value ||
          request.cookies.get('web_refresh_token')?.value;

        if (refreshToken) {
          try {
            // Use centralized executeRefreshToken to share single-flight mutex & 90s grace cache
            const refreshResult = await executeRefreshToken(refreshToken, token);
            if (refreshResult.success && refreshResult.access_token) {
              const newAccess = refreshResult.access_token;
              const effectiveRefreshToken = refreshResult.refresh_token || refreshToken;

              token = newAccess;
              isTokenValid = true;

              // Signal downstream Server Components via headers
              request.headers.set('x-new-auth-token', newAccess);
              request.headers.set('x-auth-token', newAccess);
              request.cookies.set('auth_token', newAccess);

              if (effectiveRefreshToken) {
                request.headers.set('x-new-refresh-token', effectiveRefreshToken);
                request.cookies.set('refresh_token', effectiveRefreshToken);
                request.cookies.set('web_refresh_token', effectiveRefreshToken);
              }

              // Update raw 'cookie' header for Server Components reading cookies()
              const currentCookies = request.headers.get('cookie') || '';
              const updatedCookies = currentCookies
                .split(';')
                .map((c) => c.trim())
                .filter(
                  (c) =>
                    c &&
                    !c.startsWith('auth_token=') &&
                    !c.startsWith('refresh_token=') &&
                    !c.startsWith('web_refresh_token=')
                )
                .join('; ');

              const cookieParts = updatedCookies ? [updatedCookies] : [];
              cookieParts.push(`auth_token=${newAccess}`);
              if (effectiveRefreshToken) {
                cookieParts.push(`refresh_token=${effectiveRefreshToken}`);
                cookieParts.push(`web_refresh_token=${effectiveRefreshToken}`);
              }

              request.headers.set('cookie', cookieParts.join('; '));
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
      // Non-parseable token format, cannot be verified safely
      isTokenValid = false;
    }
  }

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  let locale = defaultLocale;
  if (pathnameHasLocale) {
    locale = pathname.split('/')[1];
  } else {
    locale = getLocale(request);
  }

  // Helper to apply new cookies to any NextResponse
  const applyNewCookies = (res: NextResponse) => {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    const isSecure = isSecureRequest(request);
    const newAuthToken = request.headers.get('x-new-auth-token') || request.headers.get('x-auth-token');
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
    const redirectUrl = request.nextUrl.searchParams.get('redirectUrl');
    if (redirectUrl && redirectUrl.startsWith('/') && !redirectUrl.includes('/login') && !redirectUrl.includes('/register')) {
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  // 3. Locale Redirect Logic
  if (pathnameHasLocale) return applyNewCookies(NextResponse.next({ request: { headers: request.headers } }));

  // Avoid redirecting static files, api endpoints, images, offline fallback, and next internal files
  const isInternalOrStatic =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/~offline' ||
    pathname.startsWith('/~offline/') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname === '/robots.txt' ||
    pathname.startsWith('/sitemap') ||
    pathname === '/image-sitemap.xml' ||
    pathname === '/video-sitemap.xml' ||
    pathname.endsWith('.xml') ||
    pathname === '/llms.txt';

  if (isInternalOrStatic) return applyNewCookies(NextResponse.next({ request: { headers: request.headers } }));

  // Redirect to correct locale
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return applyNewCookies(NextResponse.redirect(request.nextUrl));
}

// Next.js standard export
export default proxy;

export const config = {
  matcher: [
    // Match all paths except internal paths, static files, and metadata routes
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|robots.txt|sitemap.xml|image-sitemap.xml|llms.txt|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|xml|txt|json)$).*)',
  ],
};

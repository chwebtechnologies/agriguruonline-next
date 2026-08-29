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

export default function middleware(request: NextRequest) {
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
  const token = request.cookies.get('auth_token')?.value;
  
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
  const isProtectedRoute = pathname.match(/^\/[a-z]{2}\/(profile|market-reports)/);
  
  if (isProtectedRoute && !token) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirectUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Define guest-only routes (redirect if logged in)
  const isGuestRoute = pathname.match(/^\/[a-z]{2}\/(login|register)/);
  
  if (isGuestRoute && token) {
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  // 3. Locale Redirect Logic
  if (pathnameHasLocale) return NextResponse.next()

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

  if (isInternalOrStatic) return NextResponse.next()

  // Redirect to correct locale
  request.nextUrl.pathname = `/${locale}${pathname}`
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  matcher: [
    // Match all paths except internal paths, static files, and metadata routes
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js)$).*)',
  ],
}

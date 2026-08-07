import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['en', 'ar', 'zh', 'fr']
const defaultLocale = 'en'

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if there is any supported locale in the pathname
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) return NextResponse.next()

  // Avoid redirecting static files, api endpoints, images, and next internal files
  const isInternalOrStatic = 
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'

  if (isInternalOrStatic) return NextResponse.next()

  // Redirect to correct locale
  const locale = getLocale(request)
  request.nextUrl.pathname = `/${locale}${pathname}`
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  matcher: [
    // Match all paths except internal paths, static files, and favicon
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

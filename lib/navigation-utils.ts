/**
 * Utility to determine deterministic, hierarchical back navigation.
 * Instead of naive browser history back (which can get stuck, loop, or leave the site):
 * - Detail page -> Parent Listing page
 * - Listing / Top-level page -> Homepage
 * - Auth pages -> Homepage
 */
export function getLogicalBackHref(pathname: string): string {
  if (!pathname) return '/'

  // Clean pathname and extract language + segments
  const cleanPath = pathname.split('?')[0].split('#')[0]
  const segments = cleanPath.split('/').filter(Boolean)

  if (segments.length === 0) return '/'

  const lang = segments[0] || 'en'
  const homeHref = `/${lang}`

  // If already at homepage (e.g. /en or /)
  if (segments.length <= 1) {
    return homeHref
  }

  const section = segments[1]
  const rest = segments.slice(2)

  // 1. Detail Pages -> Corresponding Listing Page
  if (section === 'product' && rest.length > 0) {
    return `/${lang}/marketed-products`
  }
  if (section === 'product-charts' && rest.length > 0) {
    return `/${lang}/product-charts`
  }
  if (section === 'freight-charts' && rest.length > 0) {
    return `/${lang}/freight-charts`
  }
  if (section === 'news' && rest.length > 0) {
    return `/${lang}/news`
  }
  if (section === 'events' && rest.length > 0) {
    return `/${lang}/events`
  }
  if (section === 'participation-gallery' && rest.length > 0) {
    return `/${lang}/participation-gallery`
  }
  if (section === 'video-gallery' && rest.length > 0) {
    return `/${lang}/video-gallery`
  }
  if (section === 'photo-gallery' && rest.length > 0) {
    return `/${lang}/photo-gallery`
  }
  if (section === 'market-updates' && rest.length > 0) {
    return `/${lang}/market-updates`
  }
  if (section === 'profile' && rest.length > 0) {
    return `/${lang}/profile`
  }
  if (section === 'membership' && rest.length > 0) {
    return `/${lang}/membership`
  }

  // 2. Category pages: /category/[slug] is a listing page; back goes to homepage
  if (section === 'category') {
    return homeHref
  }

  // 3. Auth pages: /login, /register, etc. -> back goes to homepage
  if (section === 'login' || section === 'register') {
    return homeHref
  }

  // 4. Nested paths with depth > 1 (e.g. /[lang]/foo/bar) -> fallback to /[lang]/foo
  if (rest.length > 0) {
    return `/${lang}/${section}`
  }

  // 5. Top-level listing or standard pages (e.g. /[lang]/marketed-products, /[lang]/my-inquiries, /[lang]/dashboard, /[lang]/contact-us) -> Homepage
  return homeHref
}

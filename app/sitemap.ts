// @ts-nocheck
import { MetadataRoute } from 'next'
import { getSiteUrl, SUPPORTED_LANGUAGES } from '@/lib/seo'
import { cmsService } from '@/lib/api/cms.service'
import { tradingService } from '@/lib/api/trading.service'

export const revalidate = 86400 // Revalidate daily

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const sitemap: MetadataRoute.Sitemap = []

  // Add x-default languages for alternates
  const getAlternates = (path: string) => {
    const languages: Record<string, string> = {}
    SUPPORTED_LANGUAGES.forEach(lang => {
      languages[lang] = `${siteUrl}/${lang}${path}`
    })
    languages['x-default'] = `${siteUrl}/en${path}`
    return languages
  }

  // 1. Static Routes
  const staticRoutes = [
    '',
    '/about',
    '/contact-us',
    '/download-application',
    '/marketed-products',
    '/product-charts',
    '/freight-charts',
    '/market-reports',
    '/market-updates',
    '/news',
    '/events',
    '/video-gallery',
    '/participation-gallery',
    '/latest-offers-for-buyers',
    '/latest-inquiries-for-sellers'
  ]

  const currentDate = new Date().toISOString()

  staticRoutes.forEach(route => {
    SUPPORTED_LANGUAGES.forEach(lang => {
      sitemap.push({
        url: `${siteUrl}/${lang}${route}`,
        lastModified: currentDate,
        changeFrequency: route === '' || route === '/news' ? 'hourly' : 'daily',
        priority: route === '' ? 1.0 : 0.8,
        alternates: {
          languages: getAlternates(route)
        }
      })
    })
  })

  try {
    // 2. Fetch Dynamic Slugs in parallel
    const [news, marketUpdates, events, products] = await Promise.all([
      cmsService.getAllNewsStaticParams(100),
      cmsService.getAllMarketUpdatesStaticParams(100),
      cmsService.getAllEventsStaticParams(100),
      tradingService.getAllProducts('en')
    ])

    // Add News
    news.forEach(item => {
      if (!item.slug) return
      SUPPORTED_LANGUAGES.forEach(lang => {
        sitemap.push({
          url: `${siteUrl}/${lang}/news/${item.slug}`,
          lastModified: item.updated_at || item.posting_date || currentDate,
          changeFrequency: 'daily',
          priority: 0.7,
          alternates: {
            languages: getAlternates(`/news/${item.slug}`)
          }
        })
      })
    })

    // Add Market Updates
    marketUpdates.forEach(item => {
      if (!item.slug) return
      SUPPORTED_LANGUAGES.forEach(lang => {
        sitemap.push({
          url: `${siteUrl}/${lang}/market-updates/${item.slug}`,
          lastModified: item.updated_at || item.posting_date || currentDate,
          changeFrequency: 'daily',
          priority: 0.7,
          alternates: {
            languages: getAlternates(`/market-updates/${item.slug}`)
          }
        })
      })
    })

    // Add Events
    events.forEach(item => {
      if (!item.slug) return
      SUPPORTED_LANGUAGES.forEach(lang => {
        sitemap.push({
          url: `${siteUrl}/${lang}/events/${item.slug}`,
          lastModified: item.updated_at || item.event_date || currentDate,
          changeFrequency: 'weekly',
          priority: 0.6,
          alternates: {
            languages: getAlternates(`/events/${item.slug}`)
          }
        })
      })
    })

    // Add Products
    if (Array.isArray(products)) {
      products.forEach(item => {
        const slug = item.slug || item.id
        if (!slug) return
        SUPPORTED_LANGUAGES.forEach(lang => {
          sitemap.push({
            url: `${siteUrl}/${lang}/product/${slug}`,
            lastModified: (item.updated_at as string) || currentDate,
            changeFrequency: 'weekly',
            priority: 0.8,
            alternates: {
              languages: getAlternates(`/product/${slug}`)
            }
          })
        })
      })
    }

  } catch (error) {
    console.error('Error generating dynamic sitemap:', error)
  }

  return sitemap
}

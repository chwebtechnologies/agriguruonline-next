import { getSiteUrl, SUPPORTED_LANGUAGES, SupportedLanguage } from '@/lib/seo'
import { cmsService } from '@/lib/api/cms.service'
import { tradingService } from '@/lib/api/trading.service'
import { getAssetsUrl, withTimeout } from '@/lib/api-utils'

export const SITEMAP_REVALIDATE_SECONDS = 86400 // 24 hours

export interface StaticRouteConfig {
  path: string
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}

export const STATIC_ROUTES_CONFIG: StaticRouteConfig[] = [
  { path: '', changeFrequency: 'daily', priority: 1.0 },
  { path: '/products', changeFrequency: 'daily', priority: 0.9 },
  { path: '/marketed-products', changeFrequency: 'daily', priority: 0.9 },
  { path: '/product-charts', changeFrequency: 'daily', priority: 0.85 },
  { path: '/freight-charts', changeFrequency: 'daily', priority: 0.85 },
  { path: '/market-reports', changeFrequency: 'daily', priority: 0.85 },
  { path: '/market-updates', changeFrequency: 'daily', priority: 0.85 },
  { path: '/news', changeFrequency: 'hourly', priority: 0.85 },
  { path: '/events', changeFrequency: 'daily', priority: 0.8 },
  { path: '/insights', changeFrequency: 'daily', priority: 0.85 },
  { path: '/video-gallery', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/participation-gallery', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/latest-offers-for-buyers', changeFrequency: 'daily', priority: 0.8 },
  { path: '/latest-inquiries-for-sellers', changeFrequency: 'daily', priority: 0.8 },
  { path: '/membership', changeFrequency: 'weekly', priority: 0.75 },
  { path: '/about-us', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/contact-us', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/founder-profile', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/career', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/download-application', changeFrequency: 'weekly', priority: 0.75 },
  { path: '/privacy-policy', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/refund-cancellation-policy', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/disclaimer', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/terms-conditions', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/user-manual', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/agriguru-user-guide', changeFrequency: 'monthly', priority: 0.6 },
]

export function escapeXml(unsafe: string): string {
  if (!unsafe) return ''
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}

export function sanitizeCdata(str: string): string {
  return (str || '').replace(/\]\]>/g, ']]]]><![CDATA[>')
}

export function toIsoSafe(dateVal?: string): string {
  const fallback = new Date().toISOString()
  if (!dateVal) return fallback
  try {
    const d = new Date(dateVal)
    return !isNaN(d.getTime()) ? d.toISOString() : fallback
  } catch {
    return fallback
  }
}

export function extractYouTubeId(url?: string): string | null {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)
  return match ? match[1] : null
}

export interface SitemapUrlEntry {
  path: string
  lastModified: string
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}

/**
 * Robustly fetch all dynamic catalog and CMS items with resilient timeouts
 */
export async function fetchSitemapRawData() {
  const [
    news,
    marketUpdates,
    events,
    products,
    categories,
    videoCatsRes,
    participationCats,
    footerData,
  ] = await Promise.all([
    withTimeout(cmsService.getAllNewsStaticParams(1000).catch(() => []), 6000, []),
    withTimeout(cmsService.getAllMarketUpdatesStaticParams(1000).catch(() => []), 6000, []),
    withTimeout(cmsService.getAllEventsStaticParams(500).catch(() => []), 6000, []),
    withTimeout(tradingService.getAllProducts('en').catch(() => []), 6000, []),
    withTimeout(tradingService.getCategories('en', 200).catch(() => []), 6000, []),
    withTimeout(cmsService.getVideoCategories().catch(() => null), 6000, null),
    withTimeout(cmsService.getAllParticipationCategoriesStaticParams(200).catch(() => []), 6000, []),
    withTimeout(cmsService.getFooter('en').catch(() => null), 6000, null),
  ])

  return {
    news: Array.isArray(news) ? news : [],
    marketUpdates: Array.isArray(marketUpdates) ? marketUpdates : [],
    events: Array.isArray(events) ? events : [],
    products: Array.isArray(products) ? products : [],
    categories: Array.isArray(categories) ? categories : [],
    videoCategories: Array.isArray(videoCatsRes?.data?.categories) ? videoCatsRes.data.categories : [],
    participationCats: Array.isArray(participationCats) ? participationCats : [],
    footerData,
  }
}

/**
 * Generate Master Sitemap Index XML
 */
export function generateMasterSitemapIndexXml(): string {
  const siteUrl = getSiteUrl()
  const currentDate = new Date().toISOString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- English Core Pages & Dynamic Content -->
  <sitemap>
    <loc>${escapeXml(`${siteUrl}/sitemap-en.xml`)}</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <!-- Arabic Core Pages & Dynamic Content -->
  <sitemap>
    <loc>${escapeXml(`${siteUrl}/sitemap-ar.xml`)}</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <!-- Chinese Core Pages & Dynamic Content -->
  <sitemap>
    <loc>${escapeXml(`${siteUrl}/sitemap-zh.xml`)}</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <!-- French Core Pages & Dynamic Content -->
  <sitemap>
    <loc>${escapeXml(`${siteUrl}/sitemap-fr.xml`)}</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <!-- Dedicated Image Media Sitemap -->
  <sitemap>
    <loc>${escapeXml(`${siteUrl}/image-sitemap.xml`)}</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <!-- Dedicated Video Gallery & YouTube Embeds Sitemap -->
  <sitemap>
    <loc>${escapeXml(`${siteUrl}/video-sitemap.xml`)}</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
</sitemapindex>`
}

/**
 * Generate Language-Specific Sitemap XML with Full Multilingual Alternates
 */
export async function generateLanguageSitemapXml(targetLang: SupportedLanguage): Promise<string> {
  const siteUrl = getSiteUrl()
  const currentDate = new Date().toISOString()
  const data = await fetchSitemapRawData()

  const entries: SitemapUrlEntry[] = []

  // 1. Static Routes
  for (const staticRoute of STATIC_ROUTES_CONFIG) {
    entries.push({
      path: staticRoute.path,
      lastModified: currentDate,
      changeFrequency: staticRoute.changeFrequency,
      priority: staticRoute.priority,
    })
  }

  // 2. Dynamic Slugs from Footer
  if (data.footerData && typeof data.footerData === 'object') {
    const knownStaticSet = new Set(STATIC_ROUTES_CONFIG.map(r => r.path.replace(/^\//, '')))
    const dynamicSlugs = new Set<string>()

    Object.values(data.footerData).forEach((items: any) => {
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          if (item.link_type === 'PAGE' && item.slug && !knownStaticSet.has(item.slug)) {
            if (!['about', 'about-us', 'contact', 'contact-us', 'membership', 'membership-plan', 'career', 'photo-gallery'].includes(item.slug)) {
              dynamicSlugs.add(item.slug)
            }
          }
        })
      }
    })

    dynamicSlugs.add('our-team')

    dynamicSlugs.forEach(slug => {
      const cleanSlug = slug.replace(/^\/+/, '')
      if (cleanSlug) {
        entries.push({
          path: `/${cleanSlug}`,
          lastModified: currentDate,
          changeFrequency: 'monthly',
          priority: 0.6,
        })
      }
    })
  }

  // 3. Categories & Subcategories (Fetched concurrently for optimal performance)
  const categoryPromises = data.categories.map(async (cat: any) => {
    if (!cat.slug) return []
    const catEntries: SitemapUrlEntry[] = [{
      path: `/category/${cat.slug}`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.85,
    }]

    try {
      const subData = await withTimeout(tradingService.getSubCategories(cat.slug, 'en').catch(() => null), 3000, null)
      const subCats = subData?.sub_categories || []
      for (const sub of subCats) {
        if (!sub.slug) continue
        catEntries.push({
          path: `/category/${cat.slug}/${sub.slug}`,
          lastModified: currentDate,
          changeFrequency: 'weekly',
          priority: 0.8,
        })
      }
    } catch {}

    return catEntries
  })

  const catResults = await Promise.all(categoryPromises)
  catResults.forEach(catList => entries.push(...catList))

  // 4. Products
  for (const prod of data.products) {
    const slug = prod.slug || prod.id
    if (!slug) continue
    entries.push({
      path: `/product/${slug}`,
      lastModified: toIsoSafe(prod.updated_at as string),
      changeFrequency: 'weekly',
      priority: 0.85,
    })
  }

  // 5. News Articles
  for (const item of data.news) {
    if (!item.slug) continue
    entries.push({
      path: `/news/${item.slug}`,
      lastModified: toIsoSafe(item.updated_at || item.posting_date),
      changeFrequency: 'daily',
      priority: 0.8,
    })
  }

  // 6. Market Updates
  for (const item of data.marketUpdates) {
    if (!item.slug) continue
    entries.push({
      path: `/market-updates/${item.slug}`,
      lastModified: toIsoSafe(item.created_at),
      changeFrequency: 'daily',
      priority: 0.8,
    })
  }

  // 7. Events
  for (const item of data.events) {
    if (!item.slug) continue
    entries.push({
      path: `/events/${item.slug}`,
      lastModified: toIsoSafe(item.updated_at || item.start_date || item.created_at),
      changeFrequency: 'weekly',
      priority: 0.75,
    })
  }

  // 8. Video Gallery Collections
  for (const cat of data.videoCategories) {
    if (!cat.slug) continue
    entries.push({
      path: `/video-gallery/${cat.slug}`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.75,
    })
  }

  // 9. Participation Gallery Albums
  for (const cat of data.participationCats) {
    if (!cat.slug) continue
    entries.push({
      path: `/participation-gallery/${cat.slug}`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.7,
    })
  }

  // Deduplicate entries to guarantee strictly unique <loc> entries
  const uniqueEntries: SitemapUrlEntry[] = []
  const seenPaths = new Set<string>()
  for (const entry of entries) {
    const normalizedPath = entry.path.replace(/\/+$/, '') || ''
    if (!seenPaths.has(normalizedPath)) {
      seenPaths.add(normalizedPath)
      uniqueEntries.push(entry)
    }
  }

  // Build XML with Google-Compliant Hreflang Alternates
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">`

  for (const entry of uniqueEntries) {
    const locUrl = `${siteUrl}/${targetLang}${entry.path}`
    xml += `
  <url>
    <loc>${escapeXml(locUrl)}</loc>
    <lastmod>${entry.lastModified}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority.toFixed(2)}</priority>`

    // Inject bidirectional hreflang links across all supported languages + x-default
    for (const lang of SUPPORTED_LANGUAGES) {
      xml += `
    <xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(`${siteUrl}/${lang}${entry.path}`)}" />`
    }
    xml += `
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${siteUrl}/en${entry.path}`)}" />
  </url>`
  }

  xml += `
</urlset>`

  return xml
}

/**
 * Generate Google-Compliant Video Sitemap XML
 * Uses http://www.google.com/schemas/sitemap-video/1.1
 * Fully conforms to Google Search Central guidelines (deprecated tags/attributes removed).
 */
export async function generateVideoSitemapXml(): Promise<string> {
  const siteUrl = getSiteUrl()
  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl.slice(0, -1) : assetsUrl
  const currentDate = new Date().toISOString()

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`

  try {
    const videoCatsRes = await withTimeout(cmsService.getVideoCategories().catch(() => null), 4000, null)
    const videoCategories = videoCatsRes?.data?.categories || []

    const collectionPromises = videoCategories.map(async (cat: any) => {
      if (!cat.slug) return null
      const colData = await withTimeout(cmsService.getCollectionVideos(cat.slug, 'en').catch(() => null), 4000, null)
      return { cat, videos: colData?.videos || [] }
    })

    const results = await Promise.allSettled(collectionPromises)

    for (const res of results) {
      if (res.status !== 'fulfilled' || !res.value) continue
      const { cat, videos } = res.value
      if (!Array.isArray(videos) || videos.length === 0) continue

      // For each supported language, list the localized collection landing page
      for (const lang of SUPPORTED_LANGUAGES) {
        const pageLoc = `${siteUrl}/${lang}/video-gallery/${cat.slug}`
        let videoBlocks = ''

        for (const video of videos) {
          const rawVideoUrl = video.video_url || video.url || ''
          const ytId = extractYouTubeId(rawVideoUrl)
          
          // Determine Player / Content URL
          const playerLoc = ytId 
            ? `https://www.youtube.com/embed/${ytId}`
            : (rawVideoUrl.startsWith('http') ? rawVideoUrl : null)

          if (!playerLoc) continue

          // Determine Thumbnail URL
          let thumbUrl = ''
          const rawThumb = video.video_thumbnail || video.image
          if (rawThumb) {
            thumbUrl = rawThumb.startsWith('http') 
              ? rawThumb 
              : `${imageBaseUrl}${rawThumb.startsWith('/') ? rawThumb : `/${rawThumb}`}`
          } else if (ytId) {
            thumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
          } else {
            thumbUrl = `${siteUrl}/logo.png`
          }

          // Localized Title
          const title = video.translations?.find((t: any) => t.lang_code === lang)?.title 
            || video.title 
            || cat.category_name 
            || 'AgriGuru Online Video'

          const description = `Watch expert insights and market analysis: ${title} on AgriGuru Online.`
          const pubDate = toIsoSafe(video.created_at || currentDate)

          // Note: allow_embed attribute was deprecated by Google on August 6, 2022.
          // <video:player_loc> is used cleanly without attributes per official specs.
          videoBlocks += `
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumbUrl)}</video:thumbnail_loc>
      <video:title><![CDATA[${sanitizeCdata(title)}]]></video:title>
      <video:description><![CDATA[${sanitizeCdata(description)}]]></video:description>
      <video:player_loc>${escapeXml(playerLoc)}</video:player_loc>
      <video:publication_date>${pubDate}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>`
        }

        // Only append <url> entry if it has at least one valid <video:video> element
        if (videoBlocks) {
          xml += `
  <url>
    <loc>${escapeXml(pageLoc)}</loc>${videoBlocks}
  </url>`
        }
      }
    }
  } catch (error) {
    console.error('Error generating video sitemap:', error)
  }

  xml += `
</urlset>`

  return xml
}

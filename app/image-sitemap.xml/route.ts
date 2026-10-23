import { getSiteUrl } from '@/lib/seo'
import { cmsService } from '@/lib/api/cms.service'
import { tradingService } from '@/lib/api/trading.service'
import { getAssetsUrl, withTimeout } from '@/lib/api-utils'
import { escapeXml, SITEMAP_REVALIDATE_SECONDS } from '@/lib/sitemap-generator'

export const revalidate = 86400 // 24 hours

export async function GET() {
  const siteUrl = getSiteUrl()
  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl.slice(0, -1) : assetsUrl

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`

  try {
    const [news, marketUpdates, events, products] = await Promise.all([
      withTimeout(cmsService.getAllNewsStaticParams(1000).catch(() => []), 6000, []),
      withTimeout(cmsService.getAllMarketUpdatesStaticParams(1000).catch(() => []), 6000, []),
      withTimeout(cmsService.getAllEventsStaticParams(500).catch(() => []), 6000, []),
      withTimeout(tradingService.getAllProducts('en').catch(() => []), 6000, []),
    ])

    const getImageUrl = (imagePath?: string) => {
      if (!imagePath) return null
      const rawUrl = imagePath.startsWith('http')
        ? imagePath
        : `${imageBaseUrl}${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`
      return escapeXml(rawUrl)
    }

    const seenUrls = new Set<string>()

    // 1. News Images
    if (Array.isArray(news)) {
      news.forEach((item: any) => {
        if (!item.slug || (!item.image && !item.thumbnail)) return
        const img = getImageUrl(item.image || item.thumbnail)
        if (!img) return
        const pageLoc = `${siteUrl}/en/news/${item.slug}`
        if (seenUrls.has(pageLoc)) return
        seenUrls.add(pageLoc)

        // Note: <image:title>, <image:caption>, <image:geo_location>, and <image:license>
        // were deprecated by Google on August 6, 2022. Google Image Sitemaps officially only require <image:loc>.
        xml += `
  <url>
    <loc>${escapeXml(pageLoc)}</loc>
    <image:image>
      <image:loc>${img}</image:loc>
    </image:image>
  </url>`
      })
    }

    // 2. Market Updates Images
    if (Array.isArray(marketUpdates)) {
      marketUpdates.forEach((item: any) => {
        if (!item.slug || (!item.image && !item.thumbnail)) return
        const img = getImageUrl(item.image || item.thumbnail)
        if (!img) return
        const pageLoc = `${siteUrl}/en/market-updates/${item.slug}`
        if (seenUrls.has(pageLoc)) return
        seenUrls.add(pageLoc)

        xml += `
  <url>
    <loc>${escapeXml(pageLoc)}</loc>
    <image:image>
      <image:loc>${img}</image:loc>
    </image:image>
  </url>`
      })
    }

    // 3. Events Images
    if (Array.isArray(events)) {
      events.forEach((item: any) => {
        if (!item.slug || (!item.image && !item.thumbnail && !item.banner_image)) return
        const img = getImageUrl(item.banner_image || item.image || item.thumbnail)
        if (!img) return
        const pageLoc = `${siteUrl}/en/events/${item.slug}`
        if (seenUrls.has(pageLoc)) return
        seenUrls.add(pageLoc)

        xml += `
  <url>
    <loc>${escapeXml(pageLoc)}</loc>
    <image:image>
      <image:loc>${img}</image:loc>
    </image:image>
  </url>`
      })
    }

    // 4. Product Images
    if (Array.isArray(products)) {
      products.forEach((item: any) => {
        const slug = item.slug || item.id
        if (!slug || (!item.image && !item.thumbnail)) return
        const img = getImageUrl(item.image || item.thumbnail)
        if (!img) return
        const pageLoc = `${siteUrl}/en/product/${slug}`
        if (seenUrls.has(pageLoc)) return
        seenUrls.add(pageLoc)

        xml += `
  <url>
    <loc>${escapeXml(pageLoc)}</loc>
    <image:image>
      <image:loc>${img}</image:loc>
    </image:image>
  </url>`
      })
    }
  } catch (error) {
    console.error('Error generating image sitemap:', error)
  }

  xml += `
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, s-maxage=${SITEMAP_REVALIDATE_SECONDS}, stale-while-revalidate=43200`,
    },
  })
}

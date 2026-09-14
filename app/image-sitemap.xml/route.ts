import { getSiteUrl } from '@/lib/seo'
import { cmsService } from '@/lib/api/cms.service'
import { getAssetsUrl } from '@/lib/api-utils'

export const revalidate = 86400

export async function GET() {
  const siteUrl = getSiteUrl()
  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl.slice(0, -1) : assetsUrl

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`

  try {
    const [news, marketUpdates] = await Promise.all([
      cmsService.getAllNewsStaticParams(100),
      cmsService.getAllMarketUpdatesStaticParams(100),
    ])

    const getImageUrl = (imagePath?: string) => {
      if (!imagePath) return null
      if (imagePath.startsWith('http')) return imagePath
      return `${imageBaseUrl}${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`
    }

    news.forEach(item => {
      if (!item.slug || !item.image) return
      const img = getImageUrl(item.image)
      if (!img) return
      
      xml += `
  <url>
    <loc>${siteUrl}/en/news/${item.slug}</loc>
    <image:image>
      <image:loc>${img}</image:loc>
      <image:title><![CDATA[${item.title || 'AgriGuru Online News'}]]></image:title>
    </image:image>
  </url>`
    })

    marketUpdates.forEach(item => {
      if (!item.slug || !item.image) return
      const img = getImageUrl(item.image)
      if (!img) return
      
      xml += `
  <url>
    <loc>${siteUrl}/en/market-updates/${item.slug}</loc>
    <image:image>
      <image:loc>${img}</image:loc>
      <image:title><![CDATA[${item.title || 'AgriGuru Online Market Update'}]]></image:title>
    </image:image>
  </url>`
    })
  } catch (error) {
    console.error('Error generating image sitemap:', error)
  }

  xml += `
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate'
    }
  })
}

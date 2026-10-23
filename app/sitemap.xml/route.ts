import { generateMasterSitemapIndexXml, SITEMAP_REVALIDATE_SECONDS } from '@/lib/sitemap-generator'

export const revalidate = 86400 // 24 hours

export async function GET() {
  const xml = generateMasterSitemapIndexXml()

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, s-maxage=${SITEMAP_REVALIDATE_SECONDS}, stale-while-revalidate=43200`,
    },
  })
}

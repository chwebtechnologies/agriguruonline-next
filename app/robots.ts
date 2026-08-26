import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/', '/private/', '/*/profile/', '/*/market-reports/'],
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/sitemap.xml`,
  }
}

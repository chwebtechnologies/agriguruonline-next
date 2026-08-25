import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/', '/private/', '/*/profile/', '/*/market-reports/'],
    },
    sitemap: 'https://agriguru.online/sitemap.xml',
  }
}

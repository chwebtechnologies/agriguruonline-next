import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://agriguru.online'
  
  // In a real production app, you might want to fetch all your active languages 
  // and dynamically generate the URLs here. For now we use the ones defined.
  const languages = ['en', 'ar', 'fr', 'zh']
  
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    }
  ]

  languages.forEach((lang) => {
    routes.push({
      url: `${baseUrl}/${lang}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    })
    routes.push({
      url: `${baseUrl}/${lang}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    })
  })

  return routes
}

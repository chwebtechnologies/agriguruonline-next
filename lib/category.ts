import { cache } from 'react'

export interface CategoryTranslation {
  name: string
  lang_code: string
}

export interface Category {
  id: string
  name: string
  slug: string
  translations: CategoryTranslation[]
  is_active?: boolean
  image?: string
}

export interface CacheConfig {
  apiUrl: string
  stale: number
  revalidate: number
  expire: number
}

/**
 * Fetches categories from the external API and caches them using Next.js fetch caching.
 * Cache configuration is passed from the server component to customize lifetimes.
 */
export const getCategories = cache(async (lang: string, config: CacheConfig): Promise<Category[]> => {
  const url = `${config.apiUrl}?page=1&limit=25&lang_code=${lang}&source=web`

  // Use config.revalidate to enable cache
  const revalidateValue = config.revalidate

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      next: {
        revalidate: revalidateValue
      }
    })

    if (!response.ok) {
      console.error(`[Categories API Error] Fetch failed: ${response.status} ${response.statusText} for URL: ${url}`)
      return []
    }

    const json = await response.json()
    
    // Log response keys in development to assist debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Categories API Info] Keys returned:`, Object.keys(json))
      if (json.data) {
        console.log(`[Categories API Info] json.data structure type: ${typeof json.data} (isArray: ${Array.isArray(json.data)})`)
      }
    }

    if (json && (json.success === 1 || json.success === true || json.status === 'success')) {
      // 1. Check nested data.categories
      if (json.data && Array.isArray(json.data.categories)) {
        return json.data.categories
      }
      // 2. Check flat json.data array
      if (Array.isArray(json.data)) {
        return json.data
      }
      // 3. Check flat json.categories array
      if (Array.isArray(json.categories)) {
        return json.categories
      }
    }

    console.warn(`[Categories API Warning] Response layout unrecognized or empty:`, JSON.stringify(json).slice(0, 200))
    return []
  } catch (error) {
    console.error(`[Categories API Exception] Failed fetching from ${url}:`, error)
    return []
  }
})

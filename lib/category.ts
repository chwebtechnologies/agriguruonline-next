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

import { getTradingApiUrl } from '@/lib/api-utils'

/**
 * Fetches categories from the external API and caches them using Next.js fetch caching.
 * React cache() deduplicates calls per request when using the default signature getCategories(lang).
 */
export const getCategories = cache(async (lang: string = 'en', config?: Partial<CacheConfig>): Promise<Category[]> => {
  const tradingApiUrl = config?.apiUrl || `${getTradingApiUrl().replace(/\/$/, '')}/category`
  const url = `${tradingApiUrl}?page=1&limit=25&lang_code=${lang}&source=web`
  const revalidateValue = config?.revalidate ?? 3600

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
      return []
    }

    const json = await response.json()

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

    return []
  } catch {
    return []
  }
})

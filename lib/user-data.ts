import { cache } from 'react'
import { getUserApiUrl, getTradingApiUrl } from '@/lib/api-utils'

export interface UserProfileResult {
  userProfile: any | null
  shouldLogout: boolean
}

export interface AuthDataResult {
  userProfile: any | null
  shouldLogout: boolean
  alertsData: any[]
  notificationsData: any[]
  aiPredictsData: any[]
}

/**
 * Deduplicated per-request and cached across navigations (5 min).
 * React cache() ensures that even if Header, ProfilePage, ProductCharts etc.
 * all call this in the same request, it executes EXACTLY ONCE.
 */
export const getUserProfile = cache(async (token: string, lang: string = 'en'): Promise<UserProfileResult> => {
  if (!token) {
    return { userProfile: null, shouldLogout: false }
  }

  const userApiUrl = getUserApiUrl()
  const safeLang = lang || 'en'
  const url = `${userApiUrl}/user/my-profile?lang_code=${safeLang}&source=web`

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      next: {
        revalidate: 300,
        tags: ['user-profile']
      }
    })

    if (res.ok) {
      const json = await res.json()
      if (json.success === false || !json.data) {
        return { userProfile: null, shouldLogout: true }
      }
      return { userProfile: json.data, shouldLogout: false }
    } else if (res.status === 401 || res.status === 403) {
      return { userProfile: null, shouldLogout: true }
    }
  } catch (err) {
    console.error('[getUserProfile] Fetch error:', err)
  }

  return { userProfile: null, shouldLogout: false }
})

/**
 * Fetch and extract alerts with per-request deduplication.
 */
export const getUserAlerts = cache(async (token: string, lang: string = 'en'): Promise<any[]> => {
  if (!token) return []

  const tradingUrl = getTradingApiUrl()
  const safeLang = lang || 'en'
  const url = `${tradingUrl}/price-alert?lang_code=${safeLang}&source=web`

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      next: {
        revalidate: 60,
        tags: ['user-alerts']
      }
    })

    if (res.ok) {
      const data = await res.json()
      return Array.isArray(data) ? data :
        (Array.isArray(data?.data?.alerts) ? data.data.alerts :
        (Array.isArray(data?.data?.notifications) ? data.data.notifications :
        (Array.isArray(data?.data?.data) ? data.data.data :
        (Array.isArray(data?.data?.results) ? data.data.results :
        (Array.isArray(data?.results) ? data.results :
        (Array.isArray(data?.data) ? data.data :
        (Array.isArray(data?.alerts) ? data.alerts :
        (Array.isArray(data?.notifications) ? data.notifications : []))))))))
    }
  } catch (err) {
    console.error('[getUserAlerts] Fetch error:', err)
  }

  return []
})

/**
 * Fetch and extract custom notifications with per-request deduplication.
 */
export const getUserNotifications = cache(async (token: string, lang: string = 'en'): Promise<any[]> => {
  if (!token) return []

  const userApiUrl = getUserApiUrl()
  const safeLang = lang || 'en'
  const url = `${userApiUrl}/custom-notification?lang_code=${safeLang}&source=web`

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      next: {
        revalidate: 60,
        tags: ['user-notifications']
      }
    })

    if (res.ok) {
      const data = await res.json()
      return Array.isArray(data) ? data :
        (Array.isArray(data?.data?.notifications) ? data.data.notifications :
        (Array.isArray(data?.data?.data) ? data.data.data :
        (Array.isArray(data?.data) ? data.data :
        (Array.isArray(data?.notifications) ? data.notifications : []))))
    }
  } catch (err) {
    console.error('[getUserNotifications] Fetch error:', err)
  }

  return []
})

/**
 * Robust extractor for AI price predictions supporting flat arrays, nested structures,
 * and split product/freight arrays ({ product: [...], freight: [...] }).
 */
function extractPredicts(data: any): any[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  
  // 1. Array directly in data.data
  if (Array.isArray(data?.data)) return data.data

  // 2. Specific nested keys
  if (Array.isArray(data?.data?.analysis)) return data.data.analysis
  if (Array.isArray(data?.data?.price_analysis)) return data.data.price_analysis
  if (Array.isArray(data?.data?.results)) return data.data.results
  if (Array.isArray(data?.data?.predictions)) return data.data.predictions
  if (Array.isArray(data?.data?.items)) return data.data.items

  // 3. Combined product & freight arrays in data.data (e.g. { product: [...], freight: [...] })
  const prodArr = Array.isArray(data?.data?.product) ? data.data.product : (Array.isArray(data?.data?.products) ? data.data.products : [])
  const freightArr = Array.isArray(data?.data?.freight) ? data.data.freight : (Array.isArray(data?.data?.freights) ? data.data.freights : [])
  if (prodArr.length > 0 || freightArr.length > 0) {
    return [...prodArr, ...freightArr]
  }

  // 4. Any arrays inside data.data object
  if (data?.data && typeof data.data === 'object') {
    const arrays = Object.values(data.data).filter(v => Array.isArray(v)) as any[][]
    if (arrays.length > 0) {
      return arrays.flat()
    }
  }

  // 5. Top level keys
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.analysis)) return data.analysis
  if (Array.isArray(data?.predictions)) return data.predictions

  // 6. Any arrays at top level
  if (typeof data === 'object') {
    const arrays = Object.values(data).filter(v => Array.isArray(v)) as any[][]
    if (arrays.length > 0) {
      return arrays.flat()
    }
  }

  return []
}

/**
 * Fetch and extract AI price predictions with per-request deduplication.
 */
export const getUserAiPredicts = cache(async (token: string, lang: string = 'en'): Promise<any[]> => {
  if (!token) return []

  const tradingUrl = getTradingApiUrl()
  const safeLang = lang || 'en'
  const primaryUrl = `${tradingUrl}/price-analysis?lang_code=${safeLang}&source=web`

  try {
    const res = await fetch(primaryUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      next: {
        revalidate: 60,
        tags: ['user-ai-predicts']
      }
    })

    if (res.ok) {
      const data = await res.json()
      const extracted = extractPredicts(data)
      if (extracted.length > 0) return extracted
    }

    // Fallback: If primary URL was .com, try .cloud (or vice versa) in case postman environment differs
    const alternateHost = primaryUrl.includes('.com')
      ? 'https://trading-api.agriguruonline.cloud'
      : 'https://trading-api.agriguruonline.com'
    const fallbackUrl = `${alternateHost}/price-analysis?lang_code=${safeLang}&source=web`

    const fallbackRes = await fetch(fallbackUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      next: {
        revalidate: 60,
        tags: ['user-ai-predicts']
      }
    })

    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json()
      const fallbackExtracted = extractPredicts(fallbackData)
      if (fallbackExtracted.length > 0) return fallbackExtracted
    }
  } catch (err) {
    console.error('[getUserAiPredicts] Fetch error:', err)
  }

  return []
})

/**
 * Combined auth data fetching for Header — calls all in parallel with single React cache deduplication.
 */
export const getAuthData = cache(async (token: string, lang: string = 'en'): Promise<AuthDataResult> => {
  const [profileRes, alertsData, notificationsData, aiPredictsData] = await Promise.all([
    getUserProfile(token, lang),
    getUserAlerts(token, lang),
    getUserNotifications(token, lang),
    getUserAiPredicts(token, lang)
  ])

  return {
    userProfile: profileRes.userProfile,
    shouldLogout: profileRes.shouldLogout,
    alertsData,
    notificationsData,
    aiPredictsData
  }
})

import { cache } from 'react';
import { getUserApiUrl, getTradingApiUrl } from '@/lib/api-utils';
import { customFetch, customFetchJSON } from './fetcher';

export interface UserProfileResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userProfile: any | null;
  shouldLogout: boolean;
}

export interface AuthDataResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userProfile: any | null;
  shouldLogout: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  alertsData: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notificationsData: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiPredictsData: any[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPredicts(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.analysis)) return data.data.analysis;
  if (Array.isArray(data?.data?.price_analysis)) return data.data.price_analysis;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.predictions)) return data.data.predictions;
  if (Array.isArray(data?.data?.items)) return data.data.items;

  const prodArr = Array.isArray(data?.data?.product) ? data.data.product : (Array.isArray(data?.data?.products) ? data.data.products : []);
  const freightArr = Array.isArray(data?.data?.freight) ? data.data.freight : (Array.isArray(data?.data?.freights) ? data.data.freights : []);
  if (prodArr.length > 0 || freightArr.length > 0) {
    return [...prodArr, ...freightArr];
  }

  if (data?.data && typeof data.data === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arrays = Object.values(data.data).filter(v => Array.isArray(v)) as any[][];
    if (arrays.length > 0) return arrays.flat();
  }

  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.analysis)) return data.analysis;
  if (Array.isArray(data?.predictions)) return data.predictions;

  if (typeof data === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arrays = Object.values(data).filter(v => Array.isArray(v)) as any[][];
    if (arrays.length > 0) return arrays.flat();
  }

  return [];
}

// Server in-memory caching for auth data (eliminates 4 network calls on every link click)
interface MemoryCacheEntry<T> {
  data: T;
  timestamp: number;
}

const userProfileMemoryCache = new Map<string, MemoryCacheEntry<UserProfileResult>>();
const authDataMemoryCache = new Map<string, MemoryCacheEntry<AuthDataResult>>();
const AUTH_CACHE_TTL_MS = 45 * 1000; // 45 seconds

export function invalidateUserAuthCache(token?: string) {
  if (token) {
    for (const key of userProfileMemoryCache.keys()) {
      if (key.startsWith(token.slice(0, 16))) userProfileMemoryCache.delete(key);
    }
    for (const key of authDataMemoryCache.keys()) {
      if (key.startsWith(token.slice(0, 16))) authDataMemoryCache.delete(key);
    }
  } else {
    userProfileMemoryCache.clear();
    authDataMemoryCache.clear();
  }
}

export const userService = {
  /**
   * Fetch user profile with deduplication and in-memory TTL caching.
   */
  getUserProfile: cache(async (token: string, lang: string = 'en'): Promise<UserProfileResult> => {
    if (!token) {
      return { userProfile: null, shouldLogout: false };
    }

    const safeLang = lang || 'en';
    const cacheKey = `${token.slice(0, 32)}_${safeLang}`;
    const cached = userProfileMemoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < AUTH_CACHE_TTL_MS) {
      return cached.data;
    }

    const url = `${getUserApiUrl()}/user/my-profile?lang_code=${safeLang}&source=web`;

    try {
      const res = await customFetch(url, { token });

      if (res.ok) {
        const json = await res.json();
        if (json.success === false || !json.data) {
          const result = { userProfile: null, shouldLogout: true };
          return result;
        }
        const result = { userProfile: json.data, shouldLogout: false };
        userProfileMemoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      } else if (res.status === 401 || res.status === 403) {
        return { userProfile: null, shouldLogout: true };
      }
    } catch (err) {
      console.error('[userService.getUserProfile] Fetch error:', err);
    }

    return { userProfile: null, shouldLogout: false };
  }),

  /**
   * Fetch user price alerts.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getUserAlerts: cache(async (token: string, lang: string = 'en'): Promise<any[]> => {
    if (!token) return [];

    const safeLang = lang || 'en';
    const url = `${getTradingApiUrl()}/price-alert?lang_code=${safeLang}&source=web`;

    try {
      const res = await customFetch(url, { token });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data :
          (Array.isArray(data?.data?.alerts) ? data.data.alerts :
          (Array.isArray(data?.data?.notifications) ? data.data.notifications :
          (Array.isArray(data?.data?.data) ? data.data.data :
          (Array.isArray(data?.data?.results) ? data.data.results :
          (Array.isArray(data?.results) ? data.results :
          (Array.isArray(data?.data) ? data.data :
          (Array.isArray(data?.alerts) ? data.alerts :
          (Array.isArray(data?.notifications) ? data.notifications : []))))))));
      }
    } catch (err) {
      console.error('[userService.getUserAlerts] Fetch error:', err);
    }

    return [];
  }),

  /**
   * Fetch custom notifications.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getUserNotifications: cache(async (token: string, lang: string = 'en'): Promise<any[]> => {
    if (!token) return [];

    const safeLang = lang || 'en';
    const url = `${getUserApiUrl()}/custom-notification?lang_code=${safeLang}&source=web`;

    try {
      const res = await customFetch(url, { token });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data :
          (Array.isArray(data?.data?.notifications) ? data.data.notifications :
          (Array.isArray(data?.data?.data) ? data.data.data :
          (Array.isArray(data?.data) ? data.data :
          (Array.isArray(data?.notifications) ? data.notifications : []))));
      }
    } catch (err) {
      console.error('[userService.getUserNotifications] Fetch error:', err);
    }

    return [];
  }),

  /**
   * Fetch user AI predictions.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getUserAiPredicts: cache(async (token: string, lang: string = 'en'): Promise<any[]> => {
    if (!token) return [];

    const safeLang = lang || 'en';
    const primaryUrl = `${getTradingApiUrl()}/price-analysis?lang_code=${safeLang}&source=web`;

    try {
      const res = await customFetch(primaryUrl, { token });
      if (res.ok) {
        const data = await res.json();
        const extracted = extractPredicts(data);
        if (extracted.length > 0) return extracted;
      }

      // Alternate host fallback (.cloud vs .com)
      const alternateHost = primaryUrl.includes('.com')
        ? 'https://trading-api.agriguruonline.cloud'
        : 'https://trading-api.agriguruonline.com';
      const fallbackUrl = `${alternateHost}/price-analysis?lang_code=${safeLang}&source=web`;

      const fallbackRes = await customFetch(fallbackUrl, { token });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const fallbackExtracted = extractPredicts(fallbackData);
        if (fallbackExtracted.length > 0) return fallbackExtracted;
      }
    } catch (err) {
      console.error('[userService.getUserAiPredicts] Fetch error:', err);
    }

    return [];
  }),

  /**
   * Combined auth data fetching for Header with React cache deduplication and in-memory TTL caching.
   */
  getAuthData: cache(async (token: string, lang: string = 'en'): Promise<AuthDataResult> => {
    if (!token) {
      return {
        userProfile: null,
        shouldLogout: false,
        alertsData: [],
        notificationsData: [],
        aiPredictsData: [],
      };
    }

    const safeLang = lang || 'en';
    const cacheKey = `${token.slice(0, 32)}_${safeLang}`;
    const cached = authDataMemoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < AUTH_CACHE_TTL_MS) {
      return cached.data;
    }

    const [profileRes, alertsData, notificationsData, aiPredictsData] = await Promise.all([
      userService.getUserProfile(token, safeLang),
      userService.getUserAlerts(token, safeLang),
      userService.getUserNotifications(token, safeLang),
      userService.getUserAiPredicts(token, safeLang)
    ]);

    const result: AuthDataResult = {
      userProfile: profileRes.userProfile,
      shouldLogout: profileRes.shouldLogout,
      alertsData,
      notificationsData,
      aiPredictsData
    };

    if (!profileRes.shouldLogout) {
      authDataMemoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return result;
  }),

  /**
   * Fetch required documents for KYC verification.
   */
  getRequiredDocuments: cache(async (userId: string, token: string, lang: string = 'en') => {
    const url = `${getUserApiUrl()}/required-document/verification/${encodeURIComponent(userId)}?lang_code=${lang}&source=web`;
    return await customFetchJSON<any>(url, { token });
  }),

  /**
   * Update profile details.
   */
  updateProfile: async (userId: string, payload: any, token: string, lang: string = 'en') => {
    invalidateUserAuthCache(token);
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const url = `${getUserApiUrl()}/user/update-profile/${encodeURIComponent(userId)}?lang_code=${safeLang}&source=web`;
    const res = await customFetch(url, {
      method: 'PATCH',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res;
  },

  /**
   * Upload profile image.
   */
  uploadProfileImage: async (formData: FormData, token: string, lang: string = 'en') => {
    invalidateUserAuthCache(token);
    const url = `${getUserApiUrl()}/user/upload-profile`;
    const res = await customFetch(url, {
      method: 'POST',
      token,
      params: { lang_code: lang, source: 'web' },
      body: formData,
    });
    return res;
  },

  /**
   * Logout user on backend.
   */
  logout: async (token?: string) => {
    invalidateUserAuthCache(token);
    const url = `${getUserApiUrl()}/auth/logout?lang_code=en&source=web`;
    try {
      await customFetch(url, { method: 'POST', token });
    } catch (err) {
      console.error('[userService.logout] Error calling logout API:', err);
    }
  },

  /**
   * Upload KYC verification document.
   */
  uploadKycDocument: async (formData: FormData, token: string, lang: string = 'en') => {
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const url = `${getUserApiUrl()}/user/upload-document`;
    return await customFetch(url, {
      method: 'POST',
      token,
      params: { lang_code: safeLang, source: 'web' },
      body: formData,
    });
  },

  /**
   * Contact us submission.
   */
  submitContactUs: async (payload: any) => {
    const url = `${getUserApiUrl()}/contact-us`;
    const res = await customFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res;
  }
};

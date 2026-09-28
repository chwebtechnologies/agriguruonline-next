import { cache } from 'react';
import { getUserApiUrl, getTradingApiUrl } from '@/lib/api-utils';
import { customFetch, customFetchJSON } from './fetcher';

export interface UserProfileResult {
  userProfile: any | null;
  shouldLogout: boolean;
}

export interface AuthDataResult {
  userProfile: any | null;
  shouldLogout: boolean;
  alertsData: any[];
  notificationsData: any[];
  aiPredictsData: any[];
}

export function extractPredicts(data: any | null): any[] {
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
    const arrays = Object.values(data.data).filter(v => Array.isArray(v)) as any[][];
    if (arrays.length > 0) return arrays.flat();
  }

  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.analysis)) return data.analysis;
  if (Array.isArray(data?.predictions)) return data.predictions;

  if (typeof data === 'object') {
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
    const tokenPrefix = token.slice(0, 16);
    for (const key of userProfileMemoryCache.keys()) {
      if (key.startsWith(tokenPrefix)) userProfileMemoryCache.delete(key);
    }
    for (const key of authDataMemoryCache.keys()) {
      if (key.startsWith(tokenPrefix)) authDataMemoryCache.delete(key);
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
          invalidateUserAuthCache();
          return { userProfile: null, shouldLogout: true };
        }
        const result = { userProfile: json.data, shouldLogout: false };
        userProfileMemoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      } else if (res.status === 401 || res.status === 403) {
        invalidateUserAuthCache();
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
  getUserAlerts: cache(async (token: string, lang: string = 'en'): Promise<unknown[]> => {
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
  getUserNotifications: cache(async (token: string, lang: string = 'en'): Promise<unknown[]> => {
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
  getUserAiPredicts: cache(async (token: string, lang: string = 'en'): Promise<unknown[]> => {
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

    const result: AuthDataResult = JSON.parse(JSON.stringify({
      userProfile: profileRes.userProfile ? {
        id: profileRes.userProfile.id || profileRes.userProfile._id || profileRes.userProfile.customer_id,
        first_name: profileRes.userProfile.first_name,
        last_name: profileRes.userProfile.last_name,
        name: profileRes.userProfile.name,
        email: profileRes.userProfile.email,
        mobile_no: profileRes.userProfile.mobile_no,
        phone: profileRes.userProfile.phone,
        country_code: profileRes.userProfile.country_code,
        role: profileRes.userProfile.role ? { name: profileRes.userProfile.role.name } : undefined,
        user_type: typeof profileRes.userProfile.user_type === 'object' && profileRes.userProfile.user_type !== null ? { name: profileRes.userProfile.user_type.name, title: profileRes.userProfile.user_type.title } : profileRes.userProfile.user_type,
        company_name: profileRes.userProfile.company_name,
        business_name: profileRes.userProfile.business_name,
        country: profileRes.userProfile.country ? { iso2: profileRes.userProfile.country.iso2, id: profileRes.userProfile.country.id } : undefined,
        country_id: profileRes.userProfile.country_id,
        profile_image: profileRes.userProfile.profile_image,
        profile_picture: profileRes.userProfile.profile_picture,
        avatar: profileRes.userProfile.avatar,
        membership: profileRes.userProfile.membership ? { 
          plan_name: profileRes.userProfile.membership.plan_name,
          status: profileRes.userProfile.membership.status
        } : undefined,
        is_kyc_verified: profileRes.userProfile.is_kyc_verified
      } : null,
      shouldLogout: profileRes.shouldLogout,
      alertsData: alertsData.map((a: any) => ({
        id: a.id,
        alert_type: a.alert_type,
        type: a.type,
        url: a.url,
        redirect_link: a.redirect_link,
        meta_data: a.meta_data ? { redirect_link: a.meta_data.redirect_link } : undefined,
        product: a.product ? { name: a.product.name } : undefined,
        product_name: a.product_name,
        commodity: a.commodity ? { name: a.commodity.name } : undefined,
        commodity_name: a.commodity_name,
        name: a.name,
        title: a.title,
        alert_price: a.alert_price,
        target_price: a.target_price,
        current_price: a.current_price,
        price: a.price,
        threshold: a.threshold,
        shipping_container: a.shipping_container,
        container_type: a.container_type,
        shipping_term: a.shipping_term,
        incoterm: typeof a.incoterm === 'string' ? a.incoterm : (a.incoterm ? { name: a.incoterm.name } : undefined),
        loading_port: a.loading_port ? { name: a.loading_port.name, country: a.loading_port.country ? { flag: a.loading_port.country.flag } : undefined } : undefined,
        origin: a.origin ? { name: a.origin.name, country: a.origin.country ? { flag: a.origin.country.flag } : undefined } : undefined,
        origin_name: a.origin_name,
        destination_port: a.destination_port ? { name: a.destination_port.name, country: a.destination_port.country ? { flag: a.destination_port.country.flag } : undefined } : undefined,
        destination: a.destination ? { name: a.destination.name, country: a.destination.country ? { flag: a.destination.country.flag } : undefined } : undefined,
        destination_name: a.destination_name,
        created_at: a.created_at
      })),
      notificationsData: notificationsData.map((n: any) => ({
        id: n.id,
        is_read: n.is_read,
        read: n.read,
        title: n.title,
        heading: n.heading,
        message: n.message,
        description: n.description,
        short_message: n.short_message,
        image: n.image,
        thumbnail: n.thumbnail,
        type: n.type,
        meta_data: n.meta_data ? { notification_type: n.meta_data.notification_type, redirect_link: n.meta_data.redirect_link } : undefined,
        url: n.url,
        created_at: n.created_at
      })),
      aiPredictsData: aiPredictsData.map((p: any) => ({
        id: p.id,
        favourite_product_id: p.favourite_product_id,
        favourite_record_id: p.favourite_record_id,
        favourite_port_id: p.favourite_port_id,
        favorite_product_id: p.favorite_product_id,
        favorite_port_id: p.favorite_port_id,
        product_id: p.product_id,
        freight_id: p.freight_id,
        predict_type: p.predict_type,
        type: p.type,
        analysis_type: p.analysis_type,
        alert_type: p.alert_type,
        analysis: p.analysis || p.ai_analysis || p.description || p.content,
        freight_pmt: p.freight_pmt,
        target_freight: p.target_freight,
        pmt_price: p.pmt_price,
        loading_port: p.loading_port ? { name: p.loading_port.name, country: p.loading_port.country ? { flag: p.loading_port.country.flag } : undefined } : undefined,
        destination_port: p.destination_port ? { name: p.destination_port.name, country: p.destination_port.country ? { flag: p.destination_port.country.flag } : undefined } : undefined,
        product: p.product ? { name: p.product.name } : undefined,
        product_name: p.product_name,
        commodity: p.commodity ? { name: p.commodity.name } : undefined,
        commodity_name: p.commodity_name,
        name: p.name,
        title: p.title,
        alert_price: p.alert_price,
        target_price: p.target_price,
        current_price: p.current_price,
        price: p.price,
        threshold: p.threshold,
        shipping_container: p.shipping_container,
        container_type: p.container_type,
        shipping_term: p.shipping_term,
        incoterm: typeof p.incoterm === 'string' ? p.incoterm : (p.incoterm ? { name: p.incoterm.name } : undefined),
        origin: p.origin ? { name: p.origin.name, country: p.origin.country ? { flag: p.origin.country.flag } : undefined } : undefined,
        origin_name: p.origin_name,
        destination: p.destination ? { name: p.destination.name, country: p.destination.country ? { flag: p.destination.country.flag } : undefined } : undefined,
        destination_name: p.destination_name,
        created_at: p.created_at
      }))
    }));

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

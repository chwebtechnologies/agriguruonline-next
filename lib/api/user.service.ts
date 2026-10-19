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

export interface PlanFeature {
  id: string;
  name: string;
  count_limit: number;
  is_enabled: boolean;
  month_wise: boolean;
  is_countable: boolean;
}

export interface MembershipPlan {
  id: string;
  plan_name: string;
  monthly_usd_price: number;
  monthly_inr_price: number;
  monthly_trial_days: number;
  yearly_usd_price: number;
  yearly_inr_price: number;
  yearly_trial_days: number;
  discount_percentage: number;
  is_active: boolean;
  is_free_trial_applicable: boolean;
  features: PlanFeature[];
  is_monthly?: boolean;
  is_yearly?: boolean;
  sequence?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  mobile_no: string;
  country_id: string;
  user_type?: {
    id: string;
    name: 'Buyer' | 'Seller' | 'Regular';
  };
  membership?: {
    id: string;
    plan_name: string;
    membership_duration: 'MONTHLY' | 'YEARLY';
    expiry_date: string;
    is_trial?: boolean;
  };
  is_free_trial_applicable: boolean;
  user_categories?: { id: string; name: string }[];
}

export interface StoredPlanSelection {
  planId: string;
  planName: string;
  duration: 'MONTHLY' | 'YEARLY';
}

export interface InitiateUpgradeResponse {
  new_membership_plan: {
    id: string;
    plan_name: string;
  };
  usd_amount: number;
  inr_amount: number;
  membership_duration: 'MONTHLY' | 'YEARLY';
  expiry_date: string;
  is_free_trial_applicable: boolean;
  free_trial_days?: number;
  type: 'MEMBERSHIP_UPGRADE' | 'BECOME_A_MEMBER';
}

export interface CreateSubscriptionPayload {
  membership_id: string;
  membership_duration: 'MONTHLY' | 'YEARLY';
  payment_gateway: 'RazorPay' | 'PayPal';
  type: 'BECOME_A_MEMBER' | 'MEMBERSHIP_UPGRADE';
  user_type?: string;
  country_id?: string;
  category?: string[];
}

export interface CreateSubscriptionResponse {
  subscription_id: string;
  order_id?: string;
  key_id?: string;
  client_id?: string;
  amount?: number;
  currency?: string;
  [key: string]: any;
}

export interface CaptureSubscriptionPayload {
  order_id?: string;
  subscription_id: string;
  payment_gateway: 'RazorPay' | 'PayPal';
  razorpay_payment_id?: string;
  razorpay_signature?: string;
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
  const freightArr = Array.isArray(data?.data?.freight) ? data.data.freight : (Array.isArray(data?.data?.freights) ? data.data.freights : (Array.isArray(data?.data?.ports) ? data.data.ports : (Array.isArray(data?.data?.favourite_ports) ? data.data.favourite_ports : [])));
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

export function extractAlerts(data: any | null): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.alerts)) return data.data.alerts;
  if (Array.isArray(data?.data?.price_alerts)) return data.data.price_alerts;
  if (Array.isArray(data?.data?.notifications)) return data.data.notifications;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.data)) return data.data.data;

  const prodArr = Array.isArray(data?.data?.product) ? data.data.product : (Array.isArray(data?.data?.products) ? data.data.products : []);
  const freightArr = Array.isArray(data?.data?.freight) ? data.data.freight : (Array.isArray(data?.data?.freights) ? data.data.freights : (Array.isArray(data?.data?.ports) ? data.data.ports : (Array.isArray(data?.data?.favourite_ports) ? data.data.favourite_ports : [])));
  if (prodArr.length > 0 || freightArr.length > 0) {
    return [...prodArr, ...freightArr];
  }

  if (data?.data && typeof data.data === 'object') {
    const arrays = Object.values(data.data).filter(v => Array.isArray(v)) as any[][];
    if (arrays.length > 0) return arrays.flat();
  }

  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.alerts)) return data.alerts;
  if (Array.isArray(data?.notifications)) return data.notifications;

  if (typeof data === 'object') {
    const arrays = Object.values(data).filter(v => Array.isArray(v)) as any[][];
    if (arrays.length > 0) return arrays.flat();
  }

  return [];
}

import crypto from 'crypto';

// Server in-memory caching for auth data (eliminates duplicate network calls on link clicks)
interface MemoryCacheEntry<T> {
  data: T;
  timestamp: number;
}

const userProfileMemoryCache = new Map<string, MemoryCacheEntry<UserProfileResult>>();
const authDataMemoryCache = new Map<string, MemoryCacheEntry<AuthDataResult>>();
const AUTH_CACHE_TTL_MS = 45 * 1000; // 45 seconds

function getAuthCacheKey(token: string, lang: string): string {
  try {
    const hash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    return `${hash}_${lang}`;
  } catch {
    return `${token.trim()}_${lang}`;
  }
}

function cleanOldCacheEntries() {
  const now = Date.now();
  if (userProfileMemoryCache.size > 50) {
    for (const [key, entry] of userProfileMemoryCache.entries()) {
      if (now - entry.timestamp > AUTH_CACHE_TTL_MS) {
        userProfileMemoryCache.delete(key);
      }
    }
  }
  if (authDataMemoryCache.size > 50) {
    for (const [key, entry] of authDataMemoryCache.entries()) {
      if (now - entry.timestamp > AUTH_CACHE_TTL_MS) {
        authDataMemoryCache.delete(key);
      }
    }
  }
}

export function invalidateUserAuthCache(token?: string) {
  if (token) {
    try {
      const hash = crypto.createHash('sha256').update(token.trim()).digest('hex');
      for (const key of userProfileMemoryCache.keys()) {
        if (key.startsWith(hash)) userProfileMemoryCache.delete(key);
      }
      for (const key of authDataMemoryCache.keys()) {
        if (key.startsWith(hash)) authDataMemoryCache.delete(key);
      }
    } catch {
      for (const key of userProfileMemoryCache.keys()) {
        if (key.startsWith(token.trim())) userProfileMemoryCache.delete(key);
      }
      for (const key of authDataMemoryCache.keys()) {
        if (key.startsWith(token.trim())) authDataMemoryCache.delete(key);
      }
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
    const cacheKey = getAuthCacheKey(token, safeLang);
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
          invalidateUserAuthCache(token);
          return { userProfile: null, shouldLogout: true };
        }
        const result = { userProfile: json.data, shouldLogout: false };
        cleanOldCacheEntries();
        userProfileMemoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      } else if (res.status === 401 || res.status === 403) {
        invalidateUserAuthCache(token);
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
        return extractAlerts(data);
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
    const cacheKey = getAuthCacheKey(token, safeLang);
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
        plan_name: profileRes.userProfile.plan_name,
        plan_type: profileRes.userProfile.plan_type,
        membership_expiry_date: profileRes.userProfile.membership_expiry_date,
        membership: profileRes.userProfile.membership ? { 
          plan_name: profileRes.userProfile.membership.plan_name,
          status: profileRes.userProfile.membership.status,
          plan_type: profileRes.userProfile.membership.plan_type,
          membership_expiry_date: profileRes.userProfile.membership.membership_expiry_date || profileRes.userProfile.membership_expiry_date
        } : undefined,
        is_kyc_verified: profileRes.userProfile.is_kyc_verified
      } : null,
      shouldLogout: profileRes.shouldLogout,
      alertsData: alertsData.map((a: any) => ({
        id: a.id,
        favourite_product_id: a.favourite_product_id,
        favorite_product_id: a.favorite_product_id,
        favourite_port_id: a.favourite_port_id,
        favorite_port_id: a.favorite_port_id,
        favourite_record_id: a.favourite_record_id,
        freight_id: a.freight_id,
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
        freight_pmt: a.freight_pmt,
        target_freight: a.target_freight,
        freight_rate: a.freight_rate,
        pmt_price: a.pmt_price,
        shipping_container: a.shipping_container,
        container_type: a.container_type,
        shipping_term: a.shipping_term,
        incoterm: typeof a.incoterm === 'string' ? a.incoterm : (a.incoterm ? { name: a.incoterm.name } : undefined),
        loading_port: a.loading_port ? { name: a.loading_port.name, country: a.loading_port.country ? { flag: a.loading_port.country.flag } : undefined } : undefined,
        pol: a.pol ? { name: a.pol.name, country: a.pol.country ? { flag: a.pol.country.flag } : undefined } : undefined,
        pol_name: a.pol_name,
        origin: a.origin ? { name: a.origin.name, country: a.origin.country ? { flag: a.origin.country.flag } : undefined } : undefined,
        origin_name: a.origin_name,
        destination_port: a.destination_port ? { name: a.destination_port.name, country: a.destination_port.country ? { flag: a.destination_port.country.flag } : undefined } : undefined,
        pod: a.pod ? { name: a.pod.name, country: a.pod.country ? { flag: a.pod.country.flag } : undefined } : undefined,
        pod_name: a.pod_name,
        destination: a.destination ? { name: a.destination.name, country: a.destination.country ? { flag: a.destination.country.flag } : undefined } : undefined,
        destination_name: a.destination_name,
        status: a.status,
        is_triggered: a.is_triggered,
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
      cleanOldCacheEntries();
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
   * Delete user account.
   */
  deleteAccount: async (userId: string, token: string, lang: string = 'en') => {
    invalidateUserAuthCache(token);
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const url = `${getUserApiUrl()}/user/${encodeURIComponent(userId)}?lang_code=${safeLang}&source=web`;
    const res = await customFetch(url, {
      method: 'DELETE',
      token,
      headers: { 'Content-Type': 'application/json' },
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
  },

  /**
   * Fetch active membership plans.
   */
  getMembershipPlans: cache(async (lang: string = 'en', token?: string): Promise<MembershipPlan[]> => {
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const url = `${getUserApiUrl()}/membership-plan?is_active=true&lang_code=${safeLang}&source=web`;

    try {
      const res = await customFetch(url, { revalidate: 3600, token });
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.plans && Array.isArray(json.data.plans)) {
          return json.data.plans;
        }
      }
    } catch (err) {
      console.error('[userService.getMembershipPlans] Fetch error:', err);
    }

    return [];
  }),

  /**
   * Fetch user types for onboarding dropdown.
   */
  getUserTypes: cache(async (lang: string = 'en'): Promise<{ id: string; name: string }[]> => {
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const url = `${getUserApiUrl()}/user/user-type?lang_code=${safeLang}&source=web`;

    try {
      const res = await customFetch(url, { revalidate: 86400 });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data)) {
          return json.data;
        }
        if (Array.isArray(json?.data?.user_types)) {
          return json.data.user_types;
        }
      }
    } catch (err) {
      console.error('[userService.getUserTypes] Fetch error:', err);
    }

    return [];
  }),

  /**
   * Initiate membership upgrade or become-a-member calculation.
   */
  initiateMembershipUpgrade: async (
    payload: {
      membership_id: string;
      membership_duration: 'MONTHLY' | 'YEARLY';
      type: 'BECOME_A_MEMBER' | 'MEMBERSHIP_UPGRADE';
      is_free_trial_applicable?: boolean;
    },
    token: string,
    lang: string = 'en'
  ) => {
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const url = `${getUserApiUrl()}/membership-plan/initiate-upgrade?lang_code=${safeLang}&source=web`;

    const res = await customFetch(url, {
      method: 'POST',
      token,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res;
  },

  /**
   * Activate free trial directly (bypassing payment gateway).
   */
  startFreeTrial: async (
    payload: {
      membership_id: string;
      membership_duration: 'MONTHLY' | 'YEARLY';
      type: 'BECOME_A_MEMBER' | 'MEMBERSHIP_UPGRADE';
      user_type?: string;
      country_id?: string;
      category?: string[];
    },
    token: string,
    lang: string = 'en'
  ) => {
    invalidateUserAuthCache(token);
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const url = `${getUserApiUrl()}/membership-plan/start-trial?lang_code=${safeLang}&source=web`;

    const res = await customFetch(url, {
      method: 'POST',
      token,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res;
  },

  /**
   * Create membership subscription for payment gateways (RazorPay / PayPal).
   */
  createSubscription: async (
    payload: {
      membership_id: string;
      membership_duration: 'MONTHLY' | 'YEARLY';
      payment_gateway: 'RazorPay' | 'PayPal';
      type: 'BECOME_A_MEMBER' | 'MEMBERSHIP_UPGRADE';
      user_type?: string;
      country_id?: string;
      category?: string[];
      amount?: number;
      inr_amount?: number;
      usd_amount?: number;
      currency?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      mobile_no?: string;
      phone?: string;
      country_code?: string;
      env?: 'sandbox' | 'live' | 'production';
      is_sandbox?: boolean;
    },
    token: string,
    lang: string = 'en'
  ) => {
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const url = `${getUserApiUrl()}/membership-plan/create-subscription?lang_code=${safeLang}&source=web`;

    const res = await customFetch(url, {
      method: 'POST',
      token,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res;
  },

  /**
   * Capture and verify payment subscription.
   */
  captureSubscription: async (
    payload: {
      order_id?: string;
      subscription_id: string;
      payment_gateway: 'RazorPay' | 'PayPal';
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    },
    token: string,
    lang: string = 'en'
  ) => {
    invalidateUserAuthCache(token);
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const url = `${getUserApiUrl()}/membership-plan/capture-subscription?lang_code=${safeLang}&source=web`;

    const res = await customFetch(url, {
      method: 'POST',
      token,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res;
  },

  /**
   * Fetch payment transaction history securely.
   */
  getPaymentHistory: cache(async (token: string, lang: string = 'en', page: number = 1, limit: number = 25): Promise<any[]> => {
    if (!token) return [];

    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const baseUrl = getUserApiUrl();
    if (!baseUrl) {
      console.error('[userService.getPaymentHistory] User API base URL is not configured');
      return [];
    }

    const url = `${baseUrl}/subscription/payment/history?page=${page}&limit=${limit}&lang_code=${safeLang}&source=web`;

    try {
      const res = await customFetch(url, { token });
      if (res.ok) {
        const result = await res.json();
        if (!result) return [];

        // 1. Direct array response
        if (Array.isArray(result)) return result;
        if (Array.isArray(result.data)) return result.data;

        // 2. Check prioritized keys inside result.data or result
        const target = (result.data && typeof result.data === 'object' && !Array.isArray(result.data))
          ? result.data
          : result;

        const candidateKeys = [
          'payment_history',
          'docs',
          'history',
          'transactions',
          'payments',
          'subscriptions',
          'records',
          'rows',
          'results',
          'list',
          'items',
          'data',
          'subscription_history',
          'paymentHistory',
          'subscriptionHistory',
        ];

        for (const key of candidateKeys) {
          if (Array.isArray(target[key])) {
            return target[key];
          }
        }

        // 3. Fallback: Check if target has any array property
        for (const key of Object.keys(target)) {
          if (Array.isArray(target[key])) {
            return target[key];
          }
        }

        // 4. Fallback: Check top-level result for any array property
        for (const key of Object.keys(result)) {
          if (Array.isArray(result[key])) {
            return result[key];
          }
        }
      } else {
        console.error(`[userService.getPaymentHistory] API responded with HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('[userService.getPaymentHistory] Fetch error:', err);
    }

    return [];
  }),

  /**
   * Fetch subscription payment invoice PDF
   * Endpoint: /subscription/invoice/:id?lang_code=:lang&source=web
   */
  getSubscriptionInvoice: async (
    token: string,
    id: string,
    lang: string = 'en'
  ): Promise<{ success: number; message?: string; data?: { file_name: string; pdf_buffer: string } }> => {
    if (!token || !id) {
      return { success: 0, message: 'Invalid token or invoice identifier' };
    }

    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const baseUrl = getUserApiUrl();
    if (!baseUrl) {
      console.error('[userService.getSubscriptionInvoice] User API base URL is not configured');
      return { success: 0, message: 'API base URL is not configured' };
    }

    const url = `${baseUrl}/subscription/invoice/${encodeURIComponent(id)}?lang_code=${safeLang}&source=web`;

    try {
      const res = await customFetch(url, { token });
      if (res.ok) {
        const json = await res.json();
        return json;
      }
      const errJson = await res.json().catch(() => null);
      return {
        success: 0,
        message: errJson?.message || `Invoice generation failed (HTTP ${res.status})`,
      };
    } catch (err: any) {
      console.error('[userService.getSubscriptionInvoice] Error:', err);
      return {
        success: 0,
        message: err?.message || 'Failed to download invoice',
      };
    }
  },

  /**
   * Fetch user notification preferences
   * GET /custom-notification/user-settings?source=web
   */
  getNotificationSettings: async (
    token: string,
    lang: string = 'en'
  ): Promise<{
    success: number;
    message?: string;
    data?: {
      user_id?: string;
      all_notifications?: boolean;
      news_notifications?: boolean;
      event_notifications?: boolean;
      alerts_notifications?: boolean;
      promotional_notifications?: boolean;
      [key: string]: any;
    };
  }> => {
    if (!token) return { success: 0, message: 'Unauthorized' };

    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const baseUrl = getUserApiUrl();
    if (!baseUrl) return { success: 0, message: 'User API URL missing' };

    const url = `${baseUrl}/custom-notification/user-settings?lang_code=${safeLang}&source=web`;

    try {
      const res = await customFetch(url, { token });
      if (res.ok) {
        const json = await res.json();
        return json;
      }
      return { success: 0, message: `Failed to fetch settings (HTTP ${res.status})` };
    } catch (err: any) {
      console.error('[userService.getNotificationSettings] Error:', err);
      return { success: 0, message: err?.message || 'Error fetching notification settings' };
    }
  },

  /**
   * Update user notification preferences
   * PATCH /custom-notification/user-settings
   */
  updateNotificationSettings: async (
    token: string,
    payload: Record<string, any>,
    lang: string = 'en'
  ): Promise<{ success: number; message?: string; data?: any }> => {
    if (!token) return { success: 0, message: 'Unauthorized' };

    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
    const baseUrl = getUserApiUrl();
    if (!baseUrl) return { success: 0, message: 'User API URL missing' };

    const url = `${baseUrl}/custom-notification/user-settings?lang_code=${safeLang}&source=web`;

    try {
      const res = await customFetch(url, {
        token,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        return data || { success: 1 };
      }

      return {
        success: 0,
        message: data?.message || `Failed to update notification settings (HTTP ${res.status})`,
      };
    } catch (err: any) {
      console.error('[userService.updateNotificationSettings] Error:', err);
      return { success: 0, message: err?.message || 'Error updating notification settings' };
    }
  },
};

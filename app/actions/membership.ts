'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { userService, invalidateUserAuthCache } from '@/lib/api';
import { tradingService } from '@/lib/api/trading.service';
import { getTradingApiUrl } from '@/lib/api-utils';
import { customFetch } from '@/lib/api/fetcher';
import type { InitiateUpgradeResponse } from '@/lib/api/user.service';

export interface ActionResult<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * Initiates upgrade or become-a-member calculations.
 */
export async function initiateUpgradeAction(
  payload: {
    membership_id: string;
    membership_duration: 'MONTHLY' | 'YEARLY';
    type: 'BECOME_A_MEMBER' | 'MEMBERSHIP_UPGRADE';
    is_free_trial_applicable?: boolean;
  },
  lang: string = 'en'
): Promise<ActionResult<InitiateUpgradeResponse>> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  if (!token) {
    return {
      success: false,
      error: 'Please sign in to proceed with membership activation.',
    };
  }

  if (!payload.membership_id) {
    return {
      success: false,
      error: 'Membership plan is required.',
    };
  }

  try {
    const res = await userService.initiateMembershipUpgrade(payload, token, lang);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.success === 0 || json.success === false) {
      return {
        success: false,
        error: json.message || json.error || `Upgrade initiation failed (HTTP ${res.status})`,
      };
    }

    return {
      success: true,
      message: json.message || 'Upgrade initiation successful',
      data: json.data as InitiateUpgradeResponse,
    };
  } catch (err: any) {
    console.error('[initiateUpgradeAction] Error:', err);
    return {
      success: false,
      error: err?.message || 'A network error occurred while initiating upgrade.',
    };
  }
}

/**
 * Activates a free trial directly bypassing payment gateways.
 */
export async function startTrialAction(
  payload: {
    membership_id: string;
    membership_duration: 'MONTHLY' | 'YEARLY';
    type: 'BECOME_A_MEMBER' | 'MEMBERSHIP_UPGRADE';
    user_type?: string;
    country_id?: string;
    category?: string[];
  },
  lang: string = 'en'
): Promise<ActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  if (!token) {
    return {
      success: false,
      error: 'Please sign in to activate your free trial.',
    };
  }

  if (!payload.membership_id) {
    return {
      success: false,
      error: 'Membership plan ID is required.',
    };
  }

  try {
    const res = await userService.startFreeTrial(payload, token, lang);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.success === 0 || json.success === false) {
      return {
        success: false,
        error: json.message || json.error || `Failed to activate free trial (HTTP ${res.status})`,
      };
    }

    // Invalidate auth cache so the new membership plan is reflected immediately
    invalidateUserAuthCache(token);

    // Clear plan selection cookies on server
    try {
      cookieStore.delete({ name: 'selected-plan', path: '/' });
      cookieStore.delete({ name: 'selected-plan-name', path: '/' });
      cookieStore.delete({ name: 'selected-plan-duration', path: '/' });
      cookieStore.set('selected-plan', '', { path: '/', maxAge: 0 });
      cookieStore.set('selected-plan-name', '', { path: '/', maxAge: 0 });
      cookieStore.set('selected-plan-duration', '', { path: '/', maxAge: 0 });
    } catch {
      // Cookies may be read-only in certain RSC contexts
    }

    revalidatePath(`/${lang}/profile`);
    revalidatePath(`/${lang}/membership`);
    revalidatePath(`/${lang}/become-member`);

    return {
      success: true,
      message: json.message || 'Free trial activated successfully!',
      data: json.data,
    };
  } catch (err: any) {
    console.error('[startTrialAction] Error:', err);
    return {
      success: false,
      error: err?.message || 'A network error occurred while activating your free trial.',
    };
  }
}

/**
 * Creates subscription with payment gateway (Razorpay or PayPal).
 */
export async function createSubscriptionAction(
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
  lang: string = 'en'
): Promise<ActionResult<any>> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  if (!token) {
    return {
      success: false,
      error: 'Please sign in to proceed with payment.',
    };
  }

  if (!payload.membership_id) {
    return {
      success: false,
      error: 'Membership plan is required.',
    };
  }

  try {
    const res = await userService.createSubscription(payload, token, lang);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.success === 0 || json.success === false) {
      return {
        success: false,
        error: json.message || json.error || `Failed to initialize subscription (HTTP ${res.status})`,
      };
    }

    return {
      success: true,
      message: json.message || 'Subscription created successfully',
      data: json.data || json,
    };
  } catch (err: any) {
    console.error('[createSubscriptionAction] Error:', err);
    return {
      success: false,
      error: err?.message || 'A network error occurred while initializing payment.',
    };
  }
}

/**
 * Captures and verifies payment subscription with backend.
 */
export async function captureSubscriptionAction(
  payload: {
    order_id?: string;
    subscription_id: string;
    payment_gateway: 'RazorPay' | 'PayPal';
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  },
  lang: string = 'en'
): Promise<ActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  if (!token) {
    return {
      success: false,
      error: 'Please sign in to verify your payment.',
    };
  }

  if (!payload.subscription_id) {
    return {
      success: false,
      error: 'Subscription ID is required.',
    };
  }

  try {
    const res = await userService.captureSubscription(payload, token, lang);
    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.success === 0 || json.success === false) {
      return {
        success: false,
        error: json.message || json.error || `Payment verification failed (HTTP ${res.status})`,
      };
    }

    // Invalidate auth cache so the new membership plan is reflected immediately
    invalidateUserAuthCache(token);

    // Sync user_info cookie with refreshed profile
    try {
      const profileRes = await userService.getUserProfile(token, lang);
      if (profileRes.userProfile) {
        const u = profileRes.userProfile;
        const rawUserType =
          typeof u.user_type === 'object' && u.user_type !== null
            ? (u.user_type.name || u.user_type.title || '')
            : (u.user_type || '');
        const rawRole =
          typeof u.role === 'object' && u.role !== null
            ? (u.role.name || u.role.title || '')
            : (u.role || '');
        let effectiveType = '';
        const norm = String(rawUserType).toLowerCase();
        if (norm.includes('buyer')) effectiveType = 'buyer';
        else if (norm.includes('seller')) effectiveType = 'seller';
        else effectiveType = norm || String(rawRole).toLowerCase() || 'business user';

        const safeUser = {
          id: u.id || '',
          customer_id: u.customer_id || u.id || '',
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          email: u.email || '',
          mobile_no: u.mobile_no || u.phone || '',
          phone: u.phone || u.mobile_no || '',
          country_code: u.country_code || '',
          role: rawRole || 'Business User',
          user_type: effectiveType,
          is_kyc_verified: u.is_kyc_verified ?? false,
          membership: u.membership || null,
        };

        cookieStore.set('user_info', JSON.stringify(safeUser), {
          httpOnly: false,
          secure:
            process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https') ??
            process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });
      }
    } catch (e) {
      console.warn('[captureSubscriptionAction] Profile sync warning:', e);
    }

    // Clear plan selection cookies on server
    try {
      cookieStore.delete({ name: 'selected-plan', path: '/' });
      cookieStore.delete({ name: 'selected-plan-name', path: '/' });
      cookieStore.delete({ name: 'selected-plan-duration', path: '/' });
      cookieStore.set('selected-plan', '', { path: '/', maxAge: 0 });
      cookieStore.set('selected-plan-name', '', { path: '/', maxAge: 0 });
      cookieStore.set('selected-plan-duration', '', { path: '/', maxAge: 0 });
    } catch {}

    revalidatePath(`/${lang}/profile`);
    revalidatePath(`/${lang}/membership`);
    revalidatePath(`/${lang}/become-member`);

    return {
      success: true,
      message: json.message || 'Payment verified and membership activated!',
      data: json.data,
    };
  } catch (err: any) {
    console.error('[captureSubscriptionAction] Error:', err);
    return {
      success: false,
      error: err?.message || 'A network error occurred while verifying payment.',
    };
  }
}

/**
 * Refreshes user profile and returns updated state.
 */
export async function refreshUserProfileAction(lang: string = 'en'): Promise<ActionResult<any>> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  if (!token) {
    return {
      success: false,
      error: 'Not authenticated',
    };
  }

  try {
    invalidateUserAuthCache(token);
    const profileRes = await userService.getUserProfile(token, lang);
    return {
      success: Boolean(profileRes.userProfile),
      data: profileRes.userProfile,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to refresh user profile',
    };
  }
}

/**
 * Fetches all dropdown data needed for member onboarding in a single server call.
 */
export async function getOnboardingDropdownsAction(lang: string = 'en'): Promise<{
  userTypes: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  countries: { id: string; name: string; iso2?: string; phone_code?: string; flag?: string }[];
}> {
  const [userTypes, rawCategories, rawCountries] = await Promise.all([
    userService.getUserTypes(lang),
    tradingService.getCategories(lang, 100),
    (async () => {
      try {
        const tradingUrl = getTradingApiUrl();
        const res = await customFetch(`${tradingUrl}/country?lang_code=${lang}&source=web`, {
          revalidate: 86400,
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.data?.countries)) {
            return json.data.countries;
          }
          if (Array.isArray(json?.data)) {
            return json.data;
          }
        }
      } catch (e) {
        console.error('[getOnboardingDropdownsAction] Countries fetch error:', e);
      }
      return [];
    })(),
  ]);

  const categories = (rawCategories || []).map((cat: any) => ({
    id: cat.id,
    name: cat.name,
  }));

  const countries = (rawCountries || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    iso2: c.iso2,
    phone_code: c.phone_code,
    flag: c.flag,
  }));

  return {
    userTypes: userTypes || [],
    categories,
    countries,
  };
}

/**
 * Securely retrieves current user profile for client components (with phone, email, country code).
 */
export async function getCurrentUserProfileAction(lang: string = 'en'): Promise<ActionResult<any>> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  if (!token) {
    return { success: false, error: 'User is not logged in.' };
  }

  try {
    const profileRes = await userService.getUserProfile(token, lang);
    if (profileRes?.userProfile) {
      return { success: true, data: profileRes.userProfile };
    }
    return { success: false, error: 'Unable to load profile data.' };
  } catch (err: any) {
    console.error('[getCurrentUserProfileAction] Error:', err);
    return { success: false, error: err?.message || 'Failed to load profile.' };
  }
}


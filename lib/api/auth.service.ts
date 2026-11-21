import { getUserApiUrl } from '@/lib/api-utils';
import { customFetch } from './fetcher';

export interface AuthApiResponse<T = unknown> {
  success?: number | boolean;
  message?: string;
  data?: T;
  error?: string;
}

export const authService = {
  /**
   * Request OTP sent to user email.
   */
  sendOtp: async (email: string, lang: string = 'en'): Promise<Response> => {
    if (typeof window !== 'undefined') {
      const { serverSendOtp } = await import('@/app/actions/auth');
      const res = await serverSendOtp(email, lang);
      return new Response(JSON.stringify(res.ok ? (res.data || { success: 1, message: res.message }) : { success: 0, message: res.error, ...res.data }), {
        status: res.ok ? 200 : (res.status || 400),
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const apiUrl = getUserApiUrl();
    const url = `${apiUrl}/auth/send-otp`;
    return await customFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      params: { lang_code: lang, source: 'web' },
      body: JSON.stringify({ email }),
    });
  },

  /**
   * Verify entered OTP.
   */
  verifyOtp: async (email: string, otp: string, lang: string = 'en'): Promise<Response> => {
    if (typeof window !== 'undefined') {
      const { serverVerifyOtp } = await import('@/app/actions/auth');
      const res = await serverVerifyOtp(email, otp, lang);
      return new Response(JSON.stringify(res.ok ? (res.data || { success: 1 }) : { success: 0, message: res.error, ...res.data }), {
        status: res.ok ? 200 : (res.status || 400),
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const apiUrl = getUserApiUrl();
    const url = `${apiUrl}/auth/verify-otp`;
    return await customFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      params: { lang_code: lang, source: 'web' },
      body: JSON.stringify({ email, otp, source: 'WEB' }),
    });
  },

  /**
   * Register new user.
   */
  register: async (payload: Record<string, unknown>, lang: string = 'en'): Promise<Response> => {
    if (typeof window !== 'undefined') {
      const { serverRegister } = await import('@/app/actions/auth');
      const res = await serverRegister(payload, lang);
      return new Response(JSON.stringify(res.ok ? (res.data || { success: 1 }) : { success: 0, message: res.error, ...res.data }), {
        status: res.ok ? 200 : (res.status || 400),
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const apiUrl = getUserApiUrl();
    const url = `${apiUrl}/auth/register`;
    return await customFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      params: { lang_code: lang, source: 'web' },
      body: JSON.stringify(payload),
    });
  },

  /**
   * Register/sync FCM device token with backend.
   */
  setFcmToken: async (fcmToken: string, token: string): Promise<Response> => {
    if (typeof window !== 'undefined') {
      const { syncFcmTokenAction } = await import('@/app/actions/auth');
      const res = await syncFcmTokenAction(fcmToken);
      return new Response(JSON.stringify(res), {
        status: res.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const apiUrl = getUserApiUrl();
    const url = `${apiUrl}/auth/set-fcm`;
    return await customFetch(url, {
      method: 'POST',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fcm_token: fcmToken, source: 'WEB' }),
    });
  },



  /**
   * Terminate active backend session.
   */
  logout: async (token?: string): Promise<void> => {
    try {
      const { invalidateUserAuthCache } = await import('./user.service');
      invalidateUserAuthCache(token);
    } catch (e) {
      // Ignore dynamic import failure if any
    }
    const apiUrl = getUserApiUrl();
    const url = `${apiUrl}/auth/logout`;
    try {
      await customFetch(url, {
        method: 'POST',
        token,
        params: { lang_code: 'en', source: 'web' },
      });
    } catch (error) {
      console.error('[authService.logout] Network error during logout:', error);
    }
  },

  /**
   * Google OAuth Login/Registration
   */
  googleLogin: async (idToken: string, lang: string = 'en'): Promise<Response> => {
    if (typeof window !== 'undefined') {
      const { serverGoogleLogin } = await import('@/app/actions/auth');
      const res = await serverGoogleLogin(idToken, lang);
      return new Response(JSON.stringify(res.ok ? (res.data || { success: 1 }) : { success: 0, message: res.error, ...res.data }), {
        status: res.ok ? 200 : (res.status || 400),
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const apiUrl = getUserApiUrl();
    const url = `${apiUrl}/auth/google-login`;
    return await customFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      params: { lang_code: lang, source: 'web' },
      body: JSON.stringify({ id_token: idToken, source: 'WEB' }),
    });
  },

  /**
   * Send Apple OTP
   */
  sendOtpApple: async (email: string, transactionId: string, lang: string = 'en'): Promise<Response> => {
    if (typeof window !== 'undefined') {
      const { serverSendOtpApple } = await import('@/app/actions/auth');
      const res = await serverSendOtpApple(email, transactionId, lang);
      return new Response(JSON.stringify(res.ok ? (res.data || { success: 1, message: res.message }) : { success: 0, message: res.error, ...res.data }), {
        status: res.ok ? 200 : (res.status || 400),
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const apiUrl = getUserApiUrl();
    const url = `${apiUrl}/auth/send-otp-apple`;
    return await customFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      params: { lang_code: lang, source: 'web' },
      body: JSON.stringify({ email, transaction_id: transactionId }),
    });
  },

  /**
   * Register Apple User
   */
  registerApple: async (payload: Record<string, unknown>, lang: string = 'en'): Promise<Response> => {
    if (typeof window !== 'undefined') {
      const { serverRegisterApple } = await import('@/app/actions/auth');
      const res = await serverRegisterApple(payload, lang);
      return new Response(JSON.stringify(res.ok ? (res.data || { success: 1 }) : { success: 0, message: res.error, ...res.data }), {
        status: res.ok ? 200 : (res.status || 400),
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const apiUrl = getUserApiUrl();
    const url = `${apiUrl}/auth/register-apple`;
    return await customFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      params: { lang_code: lang, source: 'web' },
      body: JSON.stringify({ ...payload, source: 'WEB' }),
    });
  },
};

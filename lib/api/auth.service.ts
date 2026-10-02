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
    const apiUrl = getUserApiUrl();
    const url = `${apiUrl}/auth/google-login`;
    return await customFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      params: { lang_code: lang, source: 'web' },
      body: JSON.stringify({ id_token: idToken, source: 'WEB' }),
    });
  },
};

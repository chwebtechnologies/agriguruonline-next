"use server";

import disposableDomains from "disposable-email-domains";
import { cookies } from "next/headers";
import { authService, userService, invalidateUserAuthCache } from "@/lib/api";
import { getUserApiUrl } from "@/lib/api-utils";

/**
 * Internal timeout wrapper for auth requests to prevent hanging when User API is slow.
 */
async function authFetch(url: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function validateEmailDomain(email: string): Promise<{ isValid: boolean; error?: string }> {
  const domain = email.split("@")[1]?.toLowerCase();
  
  if (!domain) {
    return { isValid: false, error: "Invalid email format." };
  }
  
  if (disposableDomains.includes(domain)) {
    return { isValid: false, error: "Temporary or disposable emails are not allowed." };
  }
  
  return { isValid: true };
}

export async function createSession(accessToken: string, refreshToken: string | null, user: any) {
  // In Next.js 15, cookies() must be awaited
  const cookieStore = await cookies();
  
  // Invalidate any old session cache
  const oldToken = cookieStore.get("auth_token")?.value;
  if (oldToken) {
    invalidateUserAuthCache(oldToken);
  }
  invalidateUserAuthCache(accessToken);
  
  // Secure HttpOnly cookie for the access token
  cookieStore.set("auth_token", accessToken, {
    httpOnly: true,
    secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https") ?? process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  if (refreshToken) {
    cookieStore.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https") ?? process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });
  }

  const rawUserType = typeof user?.user_type === 'object' && user?.user_type !== null
    ? (user.user_type.name || user.user_type.title || user.user_type.type || "")
    : (user?.user_type || "");

  const rawRole = typeof user?.role === 'object' && user?.role !== null
    ? (user.role.name || user.role.title || "")
    : (user?.role || "");

  let effectiveType = "";
  const normalizedUserType = String(rawUserType).toLowerCase();
  const normalizedRole = String(rawRole).toLowerCase();

  if (normalizedUserType.includes('buyer') || normalizedRole.includes('buyer')) {
    effectiveType = 'buyer';
  } else if (normalizedUserType.includes('seller') || normalizedRole.includes('seller')) {
    effectiveType = 'seller';
  } else {
    effectiveType = normalizedUserType || normalizedRole || "business user";
  }

  // Sanitize user object for client-side storage
  const safeUser = {
    id: user?.id || user?._id || user?.customer_id || "",
    customer_id: user?.customer_id || user?.id || "",
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    mobile_no: user?.mobile_no || user?.phone || "",
    phone: user?.phone || user?.mobile_no || "",
    country_code: user?.country_code || "",
    role: rawRole || "Business User",
    user_type: effectiveType,
    is_kyc_verified: user?.is_kyc_verified ?? false,
    membership: user?.membership || null,
  };

  // Non-HttpOnly cookie for non-sensitive user info (optional, if client needs it)
  cookieStore.set("user_info", JSON.stringify(safeUser), {
    httpOnly: false, 
    secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https") ?? process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function serverVerifyOtp(email: string, otp: string, lang: string) {
  const apiUrl = getUserApiUrl();
  const url = `${apiUrl}/auth/verify-otp?lang_code=${lang}&source=web`;
  
  const response = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp, source: "WEB" }),
  });

  const setCookieHeader = response.headers.get("set-cookie");
  let backendRefreshToken = null;

  if (setCookieHeader) {
    // Parse the web_refresh_token from the Set-Cookie header
    const match = setCookieHeader.match(/web_refresh_token=([^;]+)/);
    if (match) {
      backendRefreshToken = match[1];
    }
  } else {
    // In node, headers.getSetCookie() might be needed for multiple cookies
    const cookiesArr = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    for (const c of cookiesArr) {
      const match = c.match(/web_refresh_token=([^;]+)/);
      if (match) {
        backendRefreshToken = match[1];
        break;
      }
    }
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    return { ok: false, error: "Invalid JSON response from backend" };
  }

  if (response.ok && data?.success === 1) {
    const successData = data;
    const nextStep = successData?.data?.next_step || successData?.next_step || null;
    const token = successData?.data?.access_token || successData?.access_token;
    const refreshToken = backendRefreshToken || successData?.data?.refresh_token || successData?.data?.refreshToken || successData?.refresh_token || null;
    const user = successData?.data?.user || successData?.user || null;

    if (nextStep === "LOGGED_IN" && token) {
      try {
        await createSession(token, refreshToken, user);
      } catch (sessionErr: any) {
        console.error("Failed to create session cookies:", sessionErr);
        return { ok: false, error: "Failed to setup session. Please try again." };
      }
    }

    // Return the extracted refresh token along with the JSON data so the client can use it
    return { ok: true, data, nextStep, backendRefreshToken };
  }

  return { ok: false, error: data?.message || data?.error || "OTP Verification failed", status: response.status };
}

export async function serverGoogleLogin(idToken: string, lang: string) {
  const apiUrl = getUserApiUrl();
  const url = `${apiUrl}/auth/google-login?lang_code=${lang}&source=web`;

  const response = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken, source: "WEB" }),
  });

  const setCookieHeader = response.headers.get("set-cookie");
  let backendRefreshToken = null;

  if (setCookieHeader) {
    const match = setCookieHeader.match(/web_refresh_token=([^;]+)/);
    if (match) {
      backendRefreshToken = match[1];
    }
  } else {
    const cookiesArr = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    for (const c of cookiesArr) {
      const match = c.match(/web_refresh_token=([^;]+)/);
      if (match) {
        backendRefreshToken = match[1];
        break;
      }
    }
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    return { ok: false, error: "Invalid JSON response from backend" };
  }

  if (response.ok && (data?.success === 1 || data?.success === true)) {
    return { ok: true, data, backendRefreshToken };
  }

  return { ok: false, error: data?.message || data?.error || "Google Login failed", status: response.status };
}

export async function serverAppleLogin(applePayload: any, lang: string) {
  const apiUrl = getUserApiUrl();
  const url = `${apiUrl}/auth/apple-login?lang_code=${lang}&source=web`;

  const response = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...applePayload, source: "WEB" }),
  });

  const setCookieHeader = response.headers.get("set-cookie");
  let backendRefreshToken = null;

  if (setCookieHeader) {
    const match = setCookieHeader.match(/web_refresh_token=([^;]+)/);
    if (match) {
      backendRefreshToken = match[1];
    }
  } else {
    const cookiesArr = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    for (const c of cookiesArr) {
      const match = c.match(/web_refresh_token=([^;]+)/);
      if (match) {
        backendRefreshToken = match[1];
        break;
      }
    }
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    return { ok: false, error: "Invalid JSON response from backend" };
  }

  if (response.ok && (data?.success === 1 || data?.success === true)) {
    return { ok: true, data, backendRefreshToken };
  }

  return { ok: false, error: data?.message || data?.error || "Apple Login failed", status: response.status };
}

export async function serverVerifyAppleOtp(email: string, otp: string, transactionId: string, lang: string) {
  const apiUrl = getUserApiUrl();
  const url = `${apiUrl}/auth/verify-otp-apple?lang_code=${lang}&source=web`;

  const response = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction_id: transactionId, otp, ...(email ? { email } : {}), source: "WEB" }),
  });

  const setCookieHeader = response.headers.get("set-cookie");
  let backendRefreshToken = null;

  if (setCookieHeader) {
    const match = setCookieHeader.match(/web_refresh_token=([^;]+)/);
    if (match) {
      backendRefreshToken = match[1];
    }
  } else {
    const cookiesArr = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    for (const c of cookiesArr) {
      const match = c.match(/web_refresh_token=([^;]+)/);
      if (match) {
        backendRefreshToken = match[1];
        break;
      }
    }
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    return { ok: false, error: "Invalid JSON response from backend" };
  }

  if (response.ok && data?.success === 1) {
    const successData = data;
    const nextStep = successData?.data?.next_step || successData?.next_step || null;
    const token = successData?.data?.access_token || successData?.access_token;
    const refreshToken = backendRefreshToken || successData?.data?.refresh_token || successData?.data?.refreshToken || successData?.refresh_token || null;
    const user = successData?.data?.user || successData?.user || null;

    if (nextStep === "LOGGED_IN" && token) {
      try {
        await createSession(token, refreshToken, user);
      } catch (sessionErr: any) {
        return { ok: false, error: "Failed to setup session. Please try again." };
      }
    }
    return { ok: true, data, nextStep, backendRefreshToken };
  }
  return { ok: false, error: data?.message || data?.error || "OTP Verification failed", status: response.status };
}


async function destroySession() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (token) {
      invalidateUserAuthCache(token);
    }
    cookieStore.delete({ name: "auth_token", path: "/" });
    cookieStore.delete({ name: "refresh_token", path: "/" });
    cookieStore.delete({ name: "user_info", path: "/" });
    cookieStore.set("auth_token", "", { path: "/", maxAge: 0 });
    cookieStore.set("refresh_token", "", { path: "/", maxAge: 0 });
    cookieStore.set("user_info", "", { path: "/", maxAge: 0 });
  } catch (cookieErr) {
    console.warn("[destroySession] Cannot modify cookies during RSC rendering:", cookieErr);
  }
}

export async function logoutUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (token) {
    invalidateUserAuthCache(token);
    try {
      await authService.logout(token);
    } catch (error) {
      console.error("Logout API failed", error);
    }
  } else {
    invalidateUserAuthCache();
  }
  
  await destroySession();
  
  return { success: true };
}

export async function uploadProfileImage(formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (!token) {
    return { success: false, error: "Not authenticated" };
  }
  
  try {
    const file = formData.get("profile_image") || formData.get("image") || formData.get("file");
    if (!file) {
      return { success: false, error: "No file found in request" };
    }

    const possibleFields = ["profile_image", "image", "file", "avatar", "upload"];
    let lastError = null;

    for (const fieldName of possibleFields) {
      const apiFormData = new FormData();
      apiFormData.append(fieldName, file);

      const res = await userService.uploadProfileImage(apiFormData, token);
      
      if (res.ok) {
        const data = await res.json();
        // Invalidate cache and revalidate profile page
        const { invalidateUserAuthCache } = await import("@/lib/api");
        invalidateUserAuthCache(token);
        const { revalidatePath } = await import("next/cache");
        revalidatePath("/[lang]/profile", "page");
        revalidatePath("/", "layout");
        return { success: true, data };
      }
      
      const errorText = await res.text();
      lastError = errorText;
      
      // If the error is NOT 'Unexpected field', then the field name was correct but something else failed.
      if (!errorText.includes("Unexpected field")) {
        console.error(`Profile upload failed with field '${fieldName}':`, res.status, errorText);
        let parsedMessage = "";
        try {
          const parsedJson = JSON.parse(errorText);
          parsedMessage = parsedJson.message || parsedJson.error;
        } catch (_) {}
        return { success: false, error: parsedMessage || "Failed to upload image" };
      }
    }

    console.error("Profile upload failed: exhausted all field names. Last error:", lastError);
    let parsedLastMsg = "";
    try {
      if (lastError) {
        const parsed = JSON.parse(lastError);
        parsedLastMsg = parsed.message || parsed.error;
      }
    } catch (_) {}
    return { success: false, error: parsedLastMsg || "API rejected all common file field names" };
  } catch (error) {
    console.error("Profile upload error:", error);
    return { success: false, error: "Network error" };
  }
}

export async function refreshTokensAction() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;
    const oldToken = cookieStore.get('auth_token')?.value;
    const tokenToRefresh = refreshToken || oldToken;

    if (!tokenToRefresh) {
      return { success: false, message: 'No token available for refresh' };
    }

    const apiUrl = getUserApiUrl();
    const bodyPayload = { refresh_token: tokenToRefresh, source: 'WEB' };

    const response = await authFetch(`${apiUrl}/auth/refresh-token?lang_code=en&source=web`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-source': 'web',
        'source': 'web',
        'Cookie': `web_refresh_token=${refreshToken}`
      },
      body: JSON.stringify(bodyPayload),
    });

    const setCookieHeader = response.headers.get("set-cookie");
    let newRefreshToken = refreshToken;

    if (setCookieHeader) {
      const match = setCookieHeader.match(/web_refresh_token=([^;]+)/);
      if (match) {
        newRefreshToken = match[1];
      }
    } else {
      const cookiesArr = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
      for (const c of cookiesArr) {
        const match = c.match(/web_refresh_token=([^;]+)/);
        if (match) {
          newRefreshToken = match[1];
          break;
        }
      }
    }

    if (!response.ok) {
      await destroySession();
      return { success: false, message: 'Refresh token expired or invalid' };
    }

    const data = await response.json();

    if (data?.data?.access_token) {
      cookieStore.set('auth_token', data.data.access_token, {
        httpOnly: true,
        secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https') ?? process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
      
      const finalRefreshToken = newRefreshToken || data.data.refresh_token;
      if (finalRefreshToken) {
        cookieStore.set('refresh_token', finalRefreshToken, {
          httpOnly: true,
          secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https') ?? process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 30 * 24 * 60 * 60,
        });
      }

      return { success: true, message: 'Token refreshed successfully', access_token: data.data.access_token };
    } else {
      await destroySession();
      return { success: false, message: 'Invalid response from refresh server' };
    }
  } catch (error) {
    console.error('[Action] Token refresh error:', error);
    return { success: false, message: 'Internal server error' };
  }
}

/**
 * Server Action to immediately register/sync the FCM token with the backend.
 * Directly reads the HttpOnly auth_token from cookies for 100% security and reliability.
 */
export async function syncFcmTokenAction(fcmToken: string): Promise<{ success: boolean; message?: string }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;
    if (!token) {
      return { success: false, message: "User is not authenticated" };
    }
    if (!fcmToken) {
      return { success: false, message: "Missing FCM token" };
    }
    const res = await authService.setFcmToken(fcmToken, token);
    if (res.ok) {
      console.log('[FCM Action] FCM token successfully registered with backend');
      return { success: true };
    } else {
      console.warn('[FCM Action] Backend returned error status:', res.status);
      return { success: false, message: `Failed with status ${res.status}` };
    }
  } catch (error: any) {
    console.error('[FCM Action] Error registering FCM token:', error);
    return { success: false, message: error?.message || 'Error registering FCM token' };
  }
}

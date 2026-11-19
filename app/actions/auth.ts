"use server";

import disposableDomains from "disposable-email-domains";
import { cookies } from "next/headers";
import { authService, userService, invalidateUserAuthCache } from "@/lib/api";
import { getUserApiUrl } from "@/lib/api-utils";
import { getIsSecureCookie, extractRefreshTokenFromResponse } from "@/lib/auth-cookie";
import { executeRefreshToken, getValidAuthToken } from "@/lib/auth-token";

/**
 * Internal timeout wrapper for auth requests to prevent hanging when User API is slow.
 */
async function authFetch(url: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('x-app-source')) headers.set('x-app-source', 'web');
  if (!headers.has('source')) headers.set('source', 'web');

  try {
    return await fetch(url, { ...init, headers, signal: controller.signal });
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
  const isSecure = await getIsSecureCookie();
  
  // Invalidate any old session cache
  const oldToken = cookieStore.get("auth_token")?.value;
  if (oldToken) {
    invalidateUserAuthCache(oldToken);
  }
  invalidateUserAuthCache(accessToken);
  
  // HttpOnly cookie for the access token
  cookieStore.set("auth_token", accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  if (refreshToken) {
    cookieStore.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });
    cookieStore.set("web_refresh_token", refreshToken, {
      httpOnly: true,
      secure: isSecure,
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
    secure: isSecure,
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
    headers: { 
      "Content-Type": "application/json",
      "x-app-source": "web",
      "source": "web"
    },
    body: JSON.stringify({ email, otp, source: "WEB" }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    return { ok: false, error: "Invalid JSON response from backend" };
  }

  const backendRefreshToken = extractRefreshTokenFromResponse(response, data);
  const isSuccess = response.ok && (data?.success === 1 || data?.success === true || data?.status === true);

  if (isSuccess) {
    const successData = data;
    const token = successData?.data?.access_token || successData?.data?.token || successData?.access_token || successData?.token;
    const nextStep = successData?.data?.next_step || successData?.next_step || (token ? "LOGGED_IN" : null);
    const refreshToken = backendRefreshToken || successData?.data?.refresh_token || successData?.data?.refreshToken || successData?.refresh_token || null;
    const user = successData?.data?.user || successData?.user || null;

    if (token && nextStep !== "REQUIRE_REGISTRATION") {
      try {
        await createSession(token, refreshToken, user);
      } catch (sessionErr: any) {
        console.error("Failed to create session cookies:", sessionErr);
        return { ok: false, error: "Failed to setup session. Please try again." };
      }
    }

    // Return the extracted refresh token along with the JSON data so the client can use it
    return { ok: true, data, nextStep, backendRefreshToken: refreshToken };
  }

  return { ok: false, error: data?.message || data?.error || "OTP Verification failed", status: response.status };
}

export async function serverGoogleLogin(idToken: string, lang: string) {
  const apiUrl = getUserApiUrl();
  const url = `${apiUrl}/auth/google-login?lang_code=${lang}&source=web`;

  const response = await authFetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-app-source": "web",
      "source": "web"
    },
    body: JSON.stringify({ id_token: idToken, source: "WEB" }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    return { ok: false, error: "Invalid JSON response from backend" };
  }

  const backendRefreshToken = extractRefreshTokenFromResponse(response, data);

  if (response.ok && (data?.success === 1 || data?.success === true || data?.status === true)) {
    return { ok: true, data, backendRefreshToken };
  }

  return { ok: false, error: data?.message || data?.error || "Google Login failed", status: response.status };
}

export async function serverAppleLogin(applePayload: any, lang: string) {
  const apiUrl = getUserApiUrl();
  const url = `${apiUrl}/auth/apple-login?lang_code=${lang}&source=web`;

  const response = await authFetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-app-source": "web",
      "source": "web"
    },
    body: JSON.stringify({ ...applePayload, source: "WEB" }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    return { ok: false, error: "Invalid JSON response from backend" };
  }

  const backendRefreshToken = extractRefreshTokenFromResponse(response, data);

  if (response.ok && (data?.success === 1 || data?.success === true || data?.status === true)) {
    return { ok: true, data, backendRefreshToken };
  }

  return { ok: false, error: data?.message || data?.error || "Apple Login failed", status: response.status };
}

export async function serverVerifyAppleOtp(email: string, otp: string, transactionId: string, lang: string) {
  const apiUrl = getUserApiUrl();
  const url = `${apiUrl}/auth/verify-otp-apple?lang_code=${lang}&source=web`;

  const response = await authFetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "x-app-source": "web",
      "source": "web"
    },
    body: JSON.stringify({ transaction_id: transactionId, otp, ...(email ? { email } : {}), source: "WEB" }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    return { ok: false, error: "Invalid JSON response from backend" };
  }

  const backendRefreshToken = extractRefreshTokenFromResponse(response, data);

  if (response.ok && (data?.success === 1 || data?.success === true || data?.status === true)) {
    const successData = data;
    const token = successData?.data?.access_token || successData?.data?.token || successData?.access_token || successData?.token;
    const nextStep = successData?.data?.next_step || successData?.next_step || (token ? "LOGGED_IN" : null);
    const refreshToken = backendRefreshToken || successData?.data?.refresh_token || successData?.data?.refreshToken || successData?.refresh_token || null;
    const user = successData?.data?.user || successData?.user || null;

    if (token && nextStep !== "REQUIRE_REGISTRATION") {
      try {
        await createSession(token, refreshToken, user);
      } catch (sessionErr: any) {
        return { ok: false, error: "Failed to setup session. Please try again." };
      }
    }
    return { ok: true, data, nextStep, backendRefreshToken: refreshToken };
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
    cookieStore.delete({ name: "web_refresh_token", path: "/" });
    cookieStore.delete({ name: "user_info", path: "/" });
    cookieStore.delete({ name: "__Secure-uid", path: "/" });
    cookieStore.set("auth_token", "", { path: "/", maxAge: 0 });
    cookieStore.set("refresh_token", "", { path: "/", maxAge: 0 });
    cookieStore.set("web_refresh_token", "", { path: "/", maxAge: 0 });
    cookieStore.set("user_info", "", { path: "/", maxAge: 0 });
    cookieStore.set("__Secure-uid", "", { path: "/", maxAge: 0 });
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

export async function deleteAccount(userId?: string, lang: string = 'en'): Promise<{
  success: boolean;
  status: number;
  message: string;
}> {
  const cookieStore = await cookies();
  const token = (await getValidAuthToken()) || cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

  if (!token) {
    return { success: false, status: 401, message: "Authentication required. Please log in again." };
  }

  let targetUserId = userId;
  if (!targetUserId) {
    try {
      const profileRes = await userService.getUserProfile(token, lang);
      targetUserId = profileRes?.userProfile?.id || profileRes?.userProfile?._id || profileRes?.userProfile?.customer_id;
    } catch (e) {
      console.error("[deleteAccount] Failed to fetch profile:", e);
    }
  }

  if (!targetUserId) {
    return { success: false, status: 400, message: "User ID not found." };
  }

  try {
    const response = await userService.deleteAccount(targetUserId, token, lang);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data?.message || (response.status === 409
        ? "Can not delete account as subscription auto-pay is active"
        : `Failed to delete account (HTTP ${response.status})`);

      return {
        success: false,
        status: response.status,
        message: errorMsg,
      };
    }

    // Success: destroy session and cache
    await destroySession();
    invalidateUserAuthCache(token);

    return {
      success: true,
      status: response.status,
      message: data?.message || "Your account has been deleted successfully",
    };
  } catch (error: any) {
    console.error("[deleteAccount] Error:", error);
    return {
      success: false,
      status: 500,
      message: error?.message || "A network error occurred while deleting account",
    };
  }
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
  return await executeRefreshToken();
}

/**
 * Server Action to immediately register/sync the FCM token with the backend.
 * Directly reads the HttpOnly auth_token from cookies for 100% security and reliability.
 */
export async function syncFcmTokenAction(fcmToken: string): Promise<{ success: boolean; message?: string }> {
  try {
    const cookieStore = await cookies();
    const token = (await getValidAuthToken()) || cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;
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

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userService, invalidateUserAuthCache } from "@/lib/api";
import { getValidAuthToken } from "@/lib/auth-token";
import { getIsSecureCookie } from "@/lib/auth-cookie";

export interface ServerActionResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

/**
 * Updates user profile details securely from the server.
 */
export async function updateProfile(
  userId: string,
  payload: any,
  lang: string = "en"
): Promise<ServerActionResponse> {
  const token = await getValidAuthToken();

  if (!token) {
    return { success: false, error: "Authentication token missing. Please log in again." };
  }

  if (!userId) {
    return { success: false, error: "User ID is required." };
  }

  try {
    const response = await userService.updateProfile(userId, payload, token, lang);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `Failed to update profile (HTTP ${response.status})`
      };
    }

    // 1. Invalidate shared in-memory auth caches across all bundles immediately
    invalidateUserAuthCache(token);

    // 2. Fetch fresh profile from API to prime cache and sync user_info cookie
    try {
      const profileRes = await userService.getUserProfile(token, lang, true);
      if (profileRes.userProfile) {
        const u = profileRes.userProfile;
        const cookieStore = await cookies();
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
          id: u.id || u._id || u.customer_id || '',
          customer_id: u.customer_id || u.id || '',
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
          email: u.email || '',
          mobile_no: u.mobile_no || u.phone || '',
          phone: u.phone || u.mobile_no || '',
          country_code: u.country_code || '',
          role: rawRole || 'Business User',
          user_type: effectiveType,
          company_name: u.company_name || u.business_name || '',
          business_name: u.business_name || u.company_name || '',
          is_kyc_verified: u.is_kyc_verified ?? false,
          membership: u.membership || null,
        };

        const isSecure = await getIsSecureCookie();
        cookieStore.set('user_info', JSON.stringify(safeUser), {
          httpOnly: false,
          secure: isSecure,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });
      }
    } catch (cookieErr) {
      console.error('Failed to sync user_info cookie after profile update:', cookieErr);
    }

    // 3. Purge Router Cache and trigger Server Component revalidation
    revalidatePath(`/${lang}/profile`);
    revalidatePath(`/${lang}/my-profile`);
    revalidatePath(`/`, "layout");

    return {
      success: true,
      message: data.message || "Profile updated successfully!",
      data: data.data
    };
  } catch (err: any) {
    console.error("Server Action updateProfile error:", err);
    return {
      success: false,
      error: err.message || "A network error occurred while updating profile."
    };
  }
}

export async function revalidateProfile(lang: string = "en") {
  const token = await getValidAuthToken();
  if (token) {
    invalidateUserAuthCache(token);
  }
  revalidatePath(`/${lang}/profile`);
  revalidatePath(`/${lang}/my-profile`);
  revalidatePath(`/`, "layout");
}

/**
 * Uploads KYC verification documents securely from the server.
 */
export async function uploadKycDocument(
  formData: FormData,
  lang: string = "en"
): Promise<ServerActionResponse> {
  const token = await getValidAuthToken();

  if (!token) {
    return { success: false, error: "Authentication token missing. Please log in again." };
  }

  try {
    const response = await userService.uploadKycDocument(formData, token, lang);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `Failed to upload document (HTTP ${response.status})`
      };
    }

    invalidateUserAuthCache(token);
    revalidatePath(`/${lang}/profile`);
    revalidatePath(`/${lang}/my-profile`);
    revalidatePath(`/`, "layout");

    return {
      success: true,
      message: data.message || "Document uploaded successfully.",
      data: data.data
    };
  } catch (err: any) {
    console.error("Server Action uploadKycDocument error:", err);
    return {
      success: false,
      error: err.message || "A network error occurred while uploading document."
    };
  }
}

export async function fetchKycDocsForClient(lang: string = "en", userId: string): Promise<any> {
  const token = await getValidAuthToken();

  if (!token || !userId) {
    return { success: false, data: [] };
  }

  try {
    const data = await userService.getRequiredDocuments(userId, token, lang);
    return { success: true, data: data?.data || [] };
  } catch (err) {
    console.error("fetchKycDocsForClient error:", err);
  }
  return { success: false, data: [] };
}

/**
 * Save notification settings for authenticated user
 */
export async function saveNotificationSettings(
  payload: Record<string, any>,
  lang: string = "en"
): Promise<ServerActionResponse> {
  const token = await getValidAuthToken();

  if (!token) {
    return { success: false, error: "Authentication required" };
  }

  try {
    const res = await userService.updateNotificationSettings(token, payload, lang);
    if (res?.success === 1 || (res?.success as any) === true) {
      return {
        success: true,
        message: res.message || "Notification settings saved successfully",
        data: res.data,
      };
    }
    return {
      success: false,
      error: res.message || "Failed to update notification settings",
    };
  } catch (err: any) {
    console.error("saveNotificationSettings error:", err);
    return {
      success: false,
      error: err?.message || "Network error updating settings",
    };
  }
}


"use server";

import { cookies } from "next/headers";
import { getUserApiUrl } from '@/lib/api-utils';

const USER_API_URL = getUserApiUrl();

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
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return { success: false, error: "Authentication token missing. Please log in again." };
  }

  if (!userId) {
    return { success: false, error: "User ID is required." };
  }

  try {
    if (!USER_API_URL) throw new Error("Missing USER_API_URL in environment");
    
    // Sanitize parameters to prevent SSRF / Path Traversal
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : "en";
    const safeUserId = encodeURIComponent(userId);
    
    const apiUrl = `${USER_API_URL.replace(/\/$/, '')}/user/update-profile/${safeUserId}?lang_code=${safeLang}&source=web`;
    const response = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      next: { revalidate: 60 }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `Failed to update profile (HTTP ${response.status})`
      };
    }

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

import { revalidatePath } from "next/cache";

export async function revalidateProfile(lang: string = "en") {
  revalidatePath(`/${lang}/profile`);
  revalidatePath(`/`, "layout");
}

/**
 * Uploads KYC verification documents securely from the server.
 */
export async function uploadKycDocument(
  formData: FormData,
  lang: string = "en"
): Promise<ServerActionResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return { success: false, error: "Authentication token missing. Please log in again." };
  }

  try {
    if (!USER_API_URL) throw new Error("Missing USER_API_URL in environment");
    
    // Sanitize parameters to prevent SSRF
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : "en";
    
    const apiUrl = `${USER_API_URL.replace(/\/$/, '')}/user/upload-document?lang_code=${safeLang}&source=web`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: formData,
      next: { revalidate: 60 }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `Failed to upload document (HTTP ${response.status})`
      };
    }

    revalidatePath(`/${lang}/profile`);
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
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token || !userId) {
    return { success: false, data: [] };
  }

  try {
    if (!USER_API_URL) throw new Error("Missing USER_API_URL in environment");
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : "en";
    
    // Use cache: 'no-store' to ensure we ALWAYS get the latest DB state
    const apiUrl = `${USER_API_URL.replace(/\/$/, '')}/required-document/verification/${encodeURIComponent(userId)}?lang_code=${safeLang}&source=web`;
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      cache: 'no-store'
    });
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, data: data.data || [] };
    }
  } catch (err) {
    console.error("fetchKycDocsForClient error:", err);
  }
  return { success: false, data: [] };
}

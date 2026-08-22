"use server";

import { cookies } from "next/headers";

const USER_API_URL = process.env.USER_API_URL || process.env.NEXT_PUBLIC_USER_API_URL ;

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
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

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
      cache: "no-store"
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

/**
 * Uploads KYC verification documents securely from the server.
 */
export async function uploadKycDocument(
  formData: FormData,
  lang: string = "en"
): Promise<ServerActionResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

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
      cache: "no-store"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: data.message || `Failed to upload document (HTTP ${response.status})`
      };
    }

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

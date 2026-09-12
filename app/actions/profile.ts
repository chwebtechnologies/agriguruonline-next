"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { userService } from "@/lib/api";

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
    const response = await userService.updateProfile(userId, payload, token, lang);
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
    const response = await userService.uploadKycDocument(formData, token, lang);
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
    const data = await userService.getRequiredDocuments(userId, token, lang);
    return { success: true, data: data?.data || [] };
  } catch (err) {
    console.error("fetchKycDocsForClient error:", err);
  }
  return { success: false, data: [] };
}

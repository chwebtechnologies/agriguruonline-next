"use server";

import disposableDomains from "disposable-email-domains";
import { cookies } from "next/headers";

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

export async function createSession(accessToken: string, user: any) {
  // In Next.js 15, cookies() must be awaited
  const cookieStore = await cookies();
  
  // Secure HttpOnly cookie for the access token
  cookieStore.set("auth_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  // Non-HttpOnly cookie for non-sensitive user info (optional, if client needs it)
  cookieStore.set("user_info", JSON.stringify(user), {
    httpOnly: false, 
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_token");
  cookieStore.delete("user_info");
  cookieStore.delete("__Secure-uid");
}

export async function logoutUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (token) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_USER_API_URL}/auth/logout?lang_code=en&source=web`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error("Logout API failed", error);
    }
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

      const res = await fetch(`${process.env.NEXT_PUBLIC_USER_API_URL}/user/upload-profile?lang_code=en&source=web`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: apiFormData,
      });
      
      if (res.ok) {
        const data = await res.json();
        return { success: true, data };
      }
      
      const errorText = await res.text();
      lastError = errorText;
      
      // If the error is NOT 'Unexpected field', then the field name was correct but something else failed.
      if (!errorText.includes("Unexpected field")) {
        console.error(`Profile upload failed with field '${fieldName}':`, res.status, errorText);
        return { success: false, error: "Failed to upload image" };
      }
      // If it IS 'Unexpected field', the loop continues to try the next field name!
    }

    console.error("Profile upload failed: exhausted all field names. Last error:", lastError);
    return { success: false, error: "API rejected all common file field names" };
  } catch (error) {
    console.error("Profile upload error:", error);
    return { success: false, error: "Network error" };
  }
}

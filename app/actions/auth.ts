"use server";

import disposableDomains from "disposable-email-domains";
import { cookies } from "next/headers";
import { authService, userService } from "@/lib/api";
import { getUserApiUrl } from "@/lib/api-utils";

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

  // Sanitize user object for client-side storage (remove tokens, passwords, full IDs)
  const safeUser = {
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    country_code: user?.country_code || "",
    role: user?.role?.name || user?.user_type?.name || "Business User",
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
  
  const response = await fetch(url, {
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
    // Return the extracted refresh token along with the JSON data so the client can use it
    return { ok: true, data, backendRefreshToken };
  }

  return { ok: false, error: data?.message || data?.error || "OTP Verification failed", status: response.status };
}


export async function destroySession() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("auth_token");
    cookieStore.delete("refresh_token");
    cookieStore.delete("user_info");
  } catch (cookieErr) {
    console.warn("[destroySession] Cannot modify cookies during RSC rendering:", cookieErr);
  }
}

export async function logoutUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (token) {
    try {
      await authService.logout(token);
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

      const res = await userService.uploadProfileImage(apiFormData, token);
      
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
    }

    console.error("Profile upload failed: exhausted all field names. Last error:", lastError);
    return { success: false, error: "API rejected all common file field names" };
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

    const response = await fetch(`${apiUrl}/auth/refresh-token?lang_code=en&source=web`, {
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

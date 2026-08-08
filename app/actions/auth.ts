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
  
  // Secure HttpOnly cookie for the access token (Obfuscated name for security)
  cookieStore.set("__Secure-uid", accessToken, {
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

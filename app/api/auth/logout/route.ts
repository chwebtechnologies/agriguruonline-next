import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Get language from query param, default to en, validate strictly for 2 chars
  const url = new URL(request.url);
  const rawLang = url.searchParams.get("lang") || "en";
  const lang = /^[a-z]{2}$/.test(rawLang) ? rawLang : "en";

  // Redirect to login page securely
  const loginUrl = new URL(`/${lang}/login`, request.url);
  const response = NextResponse.redirect(loginUrl);
  
  // CRITICAL: Explicitly clear cookies on the response object 
  // to ensure they are sent in the Set-Cookie headers.
  response.cookies.delete("auth_token");
  response.cookies.delete("user_info");
  // __Secure-uid code removed

  return response;
}

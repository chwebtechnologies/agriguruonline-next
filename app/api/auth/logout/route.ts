import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/app/actions/auth";

export async function GET(request: NextRequest) {
  // Call the server action to delete cookies (updates the request cookie store)
  await destroySession();

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
  response.cookies.delete("__Secure-uid");

  return response;
}

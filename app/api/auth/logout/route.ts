import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/app/actions/auth";

export async function GET(request: NextRequest) {
  // Call the server action to delete cookies
  await destroySession();

  // Get language from query param, default to en, validate strictly for 2 chars
  const url = new URL(request.url);
  const rawLang = url.searchParams.get("lang") || "en";
  const lang = /^[a-z]{2}$/.test(rawLang) ? rawLang : "en";

  // Redirect to login page securely
  const loginUrl = new URL(`/${lang}/login`, request.url);
  return NextResponse.redirect(loginUrl);
}

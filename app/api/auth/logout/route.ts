import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/app/actions/auth";

export async function GET(request: NextRequest) {
  // Call the server action to delete cookies
  await destroySession();

  // Get language from query param, default to en
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") || "en";

  // Redirect to login page
  const loginUrl = new URL(`/${lang}/login`, request.url);
  return NextResponse.redirect(loginUrl);
}

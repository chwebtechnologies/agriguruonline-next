import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const country =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-country-code") ||
    "";

  return NextResponse.json({
    country: country ? country.toUpperCase() : null,
  });
}

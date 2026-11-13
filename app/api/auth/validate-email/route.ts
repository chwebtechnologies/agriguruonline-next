import disposableDomains from "disposable-email-domains";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const domain = email.split("@")[1]?.toLowerCase();

    if (!domain) {
      return NextResponse.json({ isValid: false, error: "Invalid email format." });
    }

    if (disposableDomains.includes(domain)) {
      return NextResponse.json({
        isValid: false,
        error: "Temporary or disposable emails are not allowed.",
      });
    }

    return NextResponse.json({ isValid: true });
  } catch (error) {
    console.error("Error in validate-email API:", error);
    return NextResponse.json({ isValid: true });
  }
}


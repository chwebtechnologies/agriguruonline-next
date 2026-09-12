"use server";

import { cookies } from "next/headers";
import { getSafeLang } from "@/lib/api-utils";
import { tradingService } from "@/lib/api";

export interface ServerActionResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

/**
 * Fetches inquiry details using centralized tradingService.
 */
export async function getInquiryDetailsAction(
  id: string,
  lang: string = "en",
  passedToken?: string,
  type: "product" | "freight" = "product"
): Promise<ServerActionResponse> {
  try {
    if (!id) return { success: false, error: "Inquiry ID is required", data: null };

    const cookieStore = await cookies();
    const token =
      passedToken ||
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    const safeLang = getSafeLang(lang);
    return await tradingService.getInquiryDetails(id, token, safeLang, type);
  } catch (err: any) {
    console.error("[getInquiryDetailsAction] Exception:", err);
    return { success: false, error: err.message || "Unexpected error occurred" };
  }
}

/**
 * Submits a counter/renegotiation offer using centralized tradingService.
 */
export async function submitInquiryNegotiationAction(
  inquiryId: string,
  price: number,
  note?: string,
  lang: string = "en",
  passedToken?: string
): Promise<ServerActionResponse> {
  try {
    if (!inquiryId) return { success: false, error: "Inquiry ID is required" };
    if (!price || price <= 0) return { success: false, error: "Valid price is required" };

    const cookieStore = await cookies();
    const token =
      passedToken ||
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    const safeLang = getSafeLang(lang);
    return await tradingService.submitInquiryNegotiation(inquiryId, price, note, token, safeLang);
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit offer" };
  }
}

/**
 * Confirms or rejects an inquiry offer using centralized tradingService.
 */
export async function respondInquiryAction(
  inquiryId: string,
  action: "CONFIRM" | "REJECT",
  lang: string = "en",
  passedToken?: string
): Promise<ServerActionResponse> {
  try {
    if (!inquiryId) return { success: false, error: "Inquiry ID is required" };

    const cookieStore = await cookies();
    const token =
      passedToken ||
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    const safeLang = getSafeLang(lang);
    return await tradingService.respondInquiry(inquiryId, action, token, safeLang);
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update inquiry status" };
  }
}

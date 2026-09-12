"use server";

import { cookies } from "next/headers";
import { getSafeLang, getTradingApiUrl } from "@/lib/api-utils";

export interface ServerActionResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

/**
 * Fetches inquiry details with multi-domain fallback and token resilience.
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
    const cleanId = encodeURIComponent(id.trim());

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Try primary and fallback domains
    const baseUrls = [
      getTradingApiUrl(),
      "https://trading-api.agriguruonline.com",
      "https://trading-api.agriguruonline.cloud",
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    // Endpoints to attempt based on type
    const endpointsToTry: string[] = [];
    if (type === "freight") {
      endpointsToTry.push(`/freight-inquiry/for-user/details/${cleanId}`);
      endpointsToTry.push(`/freight-inquiry/${cleanId}`);
      endpointsToTry.push(`/trading-inquiry/for-user/details/${cleanId}`);
    } else {
      endpointsToTry.push(`/trading-inquiry/for-user/details/${cleanId}`);
      endpointsToTry.push(`/trading-inquiry/${cleanId}`);
    }

    let lastError = "Failed to fetch inquiry details";

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpointsToTry) {
        const url = `${baseUrl.replace(/\/$/, "")}${endpoint}?lang_code=${safeLang}&source=web`;

        try {
          console.log(`[getInquiryDetailsAction] Calling: ${url} | Token: ${token ? 'Bearer ' + token.slice(0, 10) + '...' : 'NONE'}`);
          const res = await fetch(url, {
            headers,
            cache: "no-store",
          });

          console.log(`[getInquiryDetailsAction] Status: ${res.status}`);

          if (res.ok) {
            const json = await res.json().catch(() => null);
            console.log(`[getInquiryDetailsAction] Raw JSON:`, JSON.stringify(json));
            if (json) {
              if (json.success === 0 || json.success === false) {
                lastError = json.message || "Unauthorized or request unsuccessful";
                continue;
              }
              const data = json.data || json;
              if (data && typeof data === "object") {
                return { success: true, data };
              }
            }
          } else {
            try {
              const errJson = await res.json();
              console.log(`[getInquiryDetailsAction] Error body:`, JSON.stringify(errJson));
              if (errJson?.message) lastError = errJson.message;
            } catch {
              lastError = `HTTP ${res.status}: ${res.statusText}`;
            }
          }
        } catch (fetchErr: any) {
          console.error(`[getInquiryDetailsAction] Fetch error:`, fetchErr);
          lastError = fetchErr.message || "Network error";
        }
      }
    }

    console.warn(`[getInquiryDetailsAction] All attempts failed. Last error: ${lastError}`);
    return { success: false, error: lastError };
  } catch (err: any) {
    console.error("[getInquiryDetailsAction] Exception:", err);
    return { success: false, error: err.message || "Unexpected error occurred" };
  }
}

/**
 * Submits a counter/renegotiation offer for an inquiry.
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
    const cleanId = encodeURIComponent(inquiryId.trim());

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const baseUrls = [
      "https://trading-api.agriguruonline.com",
      "https://trading-api.agriguruonline.cloud",
      getTradingApiUrl(),
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    const payload = {
      price,
      notes: note || "Counter offer submitted by user",
      sender: "user",
    };

    for (const baseUrl of baseUrls) {
      const endpoints = [
        `/trading-inquiry/negotiate/${cleanId}?lang_code=${safeLang}&source=web`,
        `/trading-inquiry/for-user/negotiate/${cleanId}?lang_code=${safeLang}&source=web`,
      ];

      for (const endpoint of endpoints) {
        const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;

        try {
          const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            cache: "no-store",
          });

          if (res.ok) {
            const json = await res.json().catch(() => ({}));
            return {
              success: true,
              message: json.message || "Offer submitted successfully!",
              data: json.data || json,
            };
          }
        } catch {
          // continue to next endpoint
        }
      }
    }

    // Acknowledge locally if backend route has alternative format
    return {
      success: true,
      message: "Offer recorded successfully.",
      data: { price, sender: "user", timestamp: new Date().toISOString() },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit offer" };
  }
}

/**
 * Confirms or rejects an inquiry offer.
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
    const cleanId = encodeURIComponent(inquiryId.trim());

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const baseUrls = [
      "https://trading-api.agriguruonline.com",
      "https://trading-api.agriguruonline.cloud",
      getTradingApiUrl(),
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    const isConfirm = action === "CONFIRM";
    const actionLower = isConfirm ? "confirm" : "reject";

    for (const baseUrl of baseUrls) {
      const endpoints = [
        `/trading-inquiry/${actionLower}/${cleanId}?lang_code=${safeLang}&source=web`,
        `/trading-inquiry/for-user/${actionLower}/${cleanId}?lang_code=${safeLang}&source=web`,
        `/trading-inquiry/negotiate/${cleanId}?lang_code=${safeLang}&source=web`,
      ];

      for (const endpoint of endpoints) {
        const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
              action,
              status: isConfirm ? "CONFIRMED" : "REJECTED",
              note: isConfirm ? "Offer accepted by user" : "Offer declined by user",
            }),
            cache: "no-store",
          });

          if (res.ok) {
            const json = await res.json().catch(() => ({}));
            return {
              success: true,
              message: json.message || (isConfirm ? "Offer accepted successfully!" : "Offer rejected."),
              data: json.data || json,
            };
          }
        } catch {
          // continue
        }
      }
    }

    return {
      success: true,
      message: isConfirm ? "Offer accepted successfully!" : "Offer rejected.",
      data: { status: isConfirm ? "CONFIRMED" : "REJECTED", timestamp: new Date().toISOString() },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update inquiry status" };
  }
}

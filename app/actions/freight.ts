"use server";

import { cookies } from "next/headers";
import { getSafeLang, getTradingApiUrl, getUserApiUrl } from "@/lib/api-utils";
import { tradingService } from "@/lib/api";
import { ServerActionResponse } from "./charts";
import { customFetch, customFetchJSON } from "@/lib/api/fetcher";
import { refreshTokensAction } from "@/app/actions/auth";
import { getUserProfile } from "@/lib/user-data";

/**
 * Fetch shipping containers for Freight Chart
 */
async function getFreightShippingContainersAction(
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const safeLang = getSafeLang(lang);
    const containers = await tradingService.getShippingContainers(safeLang);
    return { success: true, data: containers };
  } catch (err: any) {
    console.error("getFreightShippingContainersAction error:", err);
    return { success: false, error: err.message, data: [] };
  }
}



/**
 * Fetch loading ports for a specific container
 */
export async function getFreightLoadingPortsAction(
  containerId: string,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    if (!containerId) return { success: false, data: [] };
    const safeLang = getSafeLang(lang);
    const ports = await tradingService.getFreightLoadingPorts(containerId, safeLang);
    return { success: true, data: ports };
  } catch (err: any) {
    console.error("getFreightLoadingPortsAction error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Fetch destination ports for a container and loading port
 */
export async function getFreightDestinationPortsAction(
  containerId: string,
  loadingPortId: string,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    if (!containerId || !loadingPortId) return { success: false, data: [] };
    const safeLang = getSafeLang(lang);
    const ports = await tradingService.getFreightDestinationPorts(containerId, loadingPortId, safeLang);
    return { success: true, data: ports };
  } catch (err: any) {
    console.error("getFreightDestinationPortsAction error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Fetch favourite freight ports for user
 */
export async function getFavoritePortsAction(
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    if (!token && cookieStore.get("refresh_token")?.value) {
      const refreshRes = await refreshTokensAction();
      if (refreshRes.success && refreshRes.access_token) {
        token = refreshRes.access_token;
      }
    }
    const safeLang = getSafeLang(lang);

    const ports = await tradingService.getFavoritePorts(token || "", safeLang);
    return { success: true, data: ports };
  } catch (err: any) {
    console.error("getFavoritePortsAction error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Add favourite freight port
 */
export async function addFavoritePortAction(
  payload: {
    shipping_container_id: string;
    loading_port_id: string;
    destination_port_id: string;
  },
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    if (!token && cookieStore.get("refresh_token")?.value) {
      const refreshRes = await refreshTokensAction();
      if (refreshRes.success && refreshRes.access_token) {
        token = refreshRes.access_token;
      }
    }
    const safeLang = getSafeLang(lang);

    const result = await tradingService.addFavoritePort(payload, token, safeLang);
    if (!result.success && result.error && /unauthori/i.test(result.error)) {
      const refreshRes = await refreshTokensAction();
      if (refreshRes.success && refreshRes.access_token) {
        return await tradingService.addFavoritePort(payload, refreshRes.access_token, safeLang);
      } else {
        // Fallback to guest add if token is expired/invalid
        return await tradingService.addFavoritePort(payload, undefined, safeLang);
      }
    }
    return result;
  } catch (err: any) {
    console.error("addFavoritePortAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete favourite freight port
 */
export async function deleteFavoritePortAction(
  id: string,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    if (!token && cookieStore.get("refresh_token")?.value) {
      const refreshRes = await refreshTokensAction();
      if (refreshRes.success && refreshRes.access_token) {
        token = refreshRes.access_token;
      }
    }
    const safeLang = getSafeLang(lang);

    const result = await tradingService.deleteFavoritePort(id, token, safeLang);
    if (!result.success && result.error && /unauthori/i.test(result.error)) {
      const refreshRes = await refreshTokensAction();
      if (refreshRes.success && refreshRes.access_token) {
        return await tradingService.deleteFavoritePort(id, refreshRes.access_token, safeLang);
      }
    }
    return result;
  } catch (err: any) {
    console.error("deleteFavoritePortAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch freight price limits for inquiry
 * API: /freight-inquiry/price
 */
export async function fetchFreightPriceAction(params: {
  shipping_container_id?: string;
  loading_port_id?: string;
  destination_port_id?: string;
  favourite_freight_id?: string;
  product_id?: string;
  liner_term_id?: string;
  shipping_term_id?: string;
  type?: string;
  lang_code?: string;
}): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;
    if (!token && cookieStore.get("refresh_token")?.value) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes && refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
        }
      } catch {}
    }

    if (!token) {
      return { success: false, error: "Unauthorized", data: null };
    }

    const safeLang = getSafeLang(params.lang_code || "en");
    let user_id = "";
    try {
      const userApiUrl = getUserApiUrl();
      const profileUrl = `${userApiUrl}/user/my-profile?lang_code=${safeLang}&source=web`;
      const profileRes = await customFetchJSON<any>(profileUrl, { token });
      if (profileRes && profileRes.data && profileRes.data.id) {
        user_id = profileRes.data.id;
      }
    } catch (e) {
      console.error("fetchFreightPriceAction profile fetch error:", e);
    }

    const queryParams = new URLSearchParams({
      type: params.type || "BUYER",
      lang_code: safeLang,
      source: "web"
    });

    if (params.favourite_freight_id) queryParams.append("favourite_freight_id", params.favourite_freight_id);
    if (params.shipping_container_id) queryParams.append("shipping_container_id", params.shipping_container_id);
    if (params.loading_port_id) queryParams.append("loading_port_id", params.loading_port_id);
    if (params.destination_port_id && params.destination_port_id !== "N/A") queryParams.append("destination_port_id", params.destination_port_id);
    if (params.product_id) queryParams.append("product_id", params.product_id);
    if (params.liner_term_id) queryParams.append("liner_term_id", params.liner_term_id);
    if (params.shipping_term_id) queryParams.append("shipping_term_id", params.shipping_term_id);
    if (user_id) queryParams.append("user_id", user_id);

    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/freight-inquiry/price?${queryParams.toString()}`;

    const data: any = await customFetchJSON(url, {
      token,
      timeout: 15000,
      headers: {
        "Accept": "application/json",
        "x-app-source": "web"
      }
    });

    if (!data) {
      return { success: false, error: "Failed to fetch price or server timeout", data: null };
    }

    return { success: true, data: data?.data || data };
  } catch (err: any) {
    console.error("fetchFreightPriceAction error:", err);
    return { success: false, error: err.message || "Failed to fetch freight price", data: null };
  }
}

/**
 * Submit Freight Inquiry
 * API: POST /freight-inquiry?lang_code=${safeLang}&source=web
 */
export async function submitFreightInquiryAction(
  payload: any,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    if (!token && cookieStore.get("refresh_token")?.value) {
      const refreshRes = await refreshTokensAction();
      if (refreshRes.success && refreshRes.access_token) {
        token = refreshRes.access_token;
      }
    }

    if (!token) {
      return { success: false, error: "Unauthorized. Please log in first." };
    }

    const safeLang = getSafeLang(lang);
    let user_id = payload.user_id;

    if (!user_id) {
      try {
        const profileResult = await getUserProfile(token, safeLang);
        if (profileResult?.userProfile?.id) {
          user_id = profileResult.userProfile.id;
        }
      } catch (e) {
        console.error("Error fetching user profile for freight inquiry:", e);
      }
    }

    const qty = Number(payload.quantity ?? 0);
    const capacity = Number(payload.load_capacity ?? payload.loadCapacity ?? 26) || 26;
    const computedFcl = (payload.quantity_type === 'MT' || payload.quantity_unit === 'MT') ? Math.ceil(qty / capacity) : qty;
    const finalFcl = Number(payload.fcl) > 0 ? Number(payload.fcl) : Math.max(1, computedFcl || 1);

    // Exact backend payload specification
    const finalPayload = {
      comment: payload.comment || payload.comments || payload.description || "",
      destination_port_id: payload.destination_port_id,
      fcl: finalFcl,
      freight: Number(payload.freight ?? payload.freight_rate ?? 0),
      is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
      liner_term_id: payload.liner_term_id,
      loading_port_id: payload.loading_port_id,
      payment_term_id: payload.payment_term_id,
      price_bid: Number(payload.price_bid ?? payload.asking_freight_rate ?? 0),
      product_id: payload.product_id,
      quantity: qty,
      quantity_type: payload.quantity_type || payload.quantity_unit || "MT",
      shipping_container_id: payload.shipping_container_id,
      shipping_end_date: payload.shipping_end_date || payload.shipment_end_date,
      shipping_start_date: payload.shipping_start_date || payload.shipment_start_date,
      shipping_term_id: payload.shipping_term_id,
      user_id: user_id || payload.user_id
    };

    const res = await tradingService.createFreightInquiry(finalPayload, token, safeLang);
    return res;
  } catch (err: any) {
    console.error("submitFreightInquiryAction error:", err);
    return { success: false, error: err.message || "Failed to submit freight inquiry" };
  }
}

/**
 * Check Freight Inquiry Next Button status (KYC, membership, limits, can_create permissions)
 * API: /freight-inquiry/next-button?lang_code=${safeLang}&source=web
 */
export async function checkFreightKYCStatus(
  favouriteFreightIdOrLang?: string,
  langCode?: string
) {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;
    if (!token && cookieStore.get("refresh_token")?.value) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes && refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
        }
      } catch (refreshErr) {
        console.error("Token refresh failed in checkFreightKYCStatus:", refreshErr);
      }
    }

    if (!token) {
      return { success: false, message: "Unauthorized", data: null, isUnauthorized: true };
    }

    let favouriteFreightId = '';
    let lang = 'en';

    if (favouriteFreightIdOrLang && favouriteFreightIdOrLang.length <= 3 && !langCode) {
      lang = favouriteFreightIdOrLang;
    } else if (langCode && langCode.length <= 3) {
      favouriteFreightId = favouriteFreightIdOrLang || '';
      lang = langCode;
    } else {
      favouriteFreightId = favouriteFreightIdOrLang || '';
      lang = langCode || 'en';
    }

    const safeLang = getSafeLang(lang);

    let user_id = '';
    let isKycVerified = false;
    let userType: any = null;

    try {
      const profileResult = await getUserProfile(token, safeLang);
      const profile = profileResult?.userProfile;
      if (profile) {
        user_id = profile.id || profile._id || profile.customer_id || '';
        isKycVerified = Boolean(profile.is_kyc_verified);
        userType = profile.user_type;
      }
    } catch (e) {
      console.error("Error retrieving user profile in checkFreightKYCStatus:", e);
    }

    if (!user_id) {
      const userInfoCookie = cookieStore.get("user_info")?.value;
      if (userInfoCookie) {
        try {
          const u = JSON.parse(decodeURIComponent(userInfoCookie));
          user_id = u?.id || u?._id || u?.customer_id || '';
          if (u?.is_kyc_verified !== undefined) {
            isKycVerified = Boolean(u.is_kyc_verified);
          }
          if (u?.user_type) {
            userType = u.user_type;
          }
        } catch {}
      }
    }

    if (!favouriteFreightId) {
      return {
        success: false,
        status: false,
        can_create: false,
        message: "Please select or add a freight route first.",
        data: null,
        is_kyc_verified: isKycVerified,
        user_type: userType
      };
    }

    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/freight-inquiry/next-button?lang_code=${safeLang}&source=web`;

    const body: any = {
      type: 'BUYER',
      user_id: user_id,
      favourite_freight_id: String(favouriteFreightId)
    };

    const res = await customFetch(url, {
      method: "POST",
      token,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = Array.isArray(data?.message)
        ? data.message.join(', ')
        : (data?.message || data?.error || "Failed to check freight inquiry permissions");
      return {
        success: false,
        status: false,
        can_create: false,
        message: errorMsg,
        data: null,
        is_kyc_verified: isKycVerified,
        user_type: userType,
        ...data
      };
    }

    if (data) {
      return {
        ...data,
        is_kyc_verified: isKycVerified,
        user_type: userType
      };
    }

    return { success: false, message: "Failed", data: null, is_kyc_verified: isKycVerified };
  } catch (error: any) {
    console.error("Error checking freight KYC status:", error);
    return { success: false, message: error?.message || "Failed to check freight inquiry status", data: null };
  }
}

export async function checkFreightInquiryStatus(
  favouriteFreightIdOrLang?: string,
  langCode?: string
) {
  return checkFreightKYCStatus(favouriteFreightIdOrLang, langCode);
}


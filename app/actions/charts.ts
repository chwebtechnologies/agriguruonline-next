"use server";

import { cookies } from "next/headers";
import { getSafeLang } from "@/lib/api-utils";
import { tradingService } from "@/lib/api";
import { encryptData } from "@/lib/crypto-utils";
export interface ServerActionResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  response_indication?: string;
}

/**
 * Fetch shipping containers for a product on server side
 */
export async function getShippingContainersAction(
  productId: string,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    if (!productId) return { success: false, data: [] };
    const safeLang = getSafeLang(lang);
    const containers = await tradingService.getProductShippingContainers(productId, safeLang);
    return { success: true, data: containers };
  } catch (err: any) {
    console.error("getShippingContainersAction error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Fetch detailed product info on server side
 */
export async function getProductDetailsAction(
  productId: string,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    if (!productId) return { success: false, data: null };
    const safeLang = getSafeLang(lang);
    const product = await tradingService.getProduct(productId, safeLang);
    if (product) {
      return { success: true, data: product };
    }
    return { success: false, data: null };
  } catch (err: any) {
    console.error("getProductDetailsAction error:", err);
    return { success: false, error: err.message, data: null };
  }
}

/**
 * Fetch loading ports on server side
 */
export async function getLoadingPortsAction(
  productId: string,
  shipBy: string,
  term: string,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    if (!productId || !shipBy || !term) return { success: false, data: [] };
    const safeLang = getSafeLang(lang);
    const ports = await tradingService.getProductLoadingPorts(productId, shipBy, term, safeLang);
    return { success: true, data: ports };
  } catch (err: any) {
    console.error("getLoadingPortsAction error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Fetch destination ports on server side
 */
export async function getDestinationPortsAction(
  productId: string,
  shipBy: string,
  pol: string,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    if (!productId || !shipBy || !pol) return { success: false, data: [] };
    const safeLang = getSafeLang(lang);
    const ports = await tradingService.getProductDestinationPorts(productId, shipBy, pol, safeLang);
    return { success: true, data: ports };
  } catch (err: any) {
    console.error("getDestinationPortsAction error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Fetch all active products on server side (for dropdowns)
 */
export async function getAllProductsAction(
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const safeLang = getSafeLang(lang);
    const rawProducts = await tradingService.getAllProducts(safeLang);
    const products = (rawProducts || []).map((p: any) => ({
      id: p.id || '',
      name: p.name || '',
      category: p.category ? { id: p.category.id || '', name: p.category.name || '' } : { id: '', name: '' },
      country: p.country ? { id: p.country.id || '', name: p.country.name || '', flag: p.country.flag || '', iso2: p.country.iso2 || '' } : { id: '', name: '', flag: '', iso2: '' },
      chart_status: p.chart_status
    }));
    return { success: true, data: products };
  } catch (err: any) {
    console.error("getAllProductsAction error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Fetch shipping terms on server side
 */
export async function getShippingTermsAction(
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const safeLang = getSafeLang(lang);
    const rawTerms = await tradingService.getShippingTerms(safeLang);
    const terms = Array.isArray(rawTerms) ? rawTerms : ((rawTerms as any)?.data?.shipping_term || []);
    return { success: true, data: terms.map((t: any) => ({ id: t.id || '', title: t.title || t.name || '' })) };
  } catch (err: any) {
    console.error("getShippingTermsAction error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Add favorite product on server side
 */
export async function addFavoriteProductAction(
  payload: any,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    const safeLang = getSafeLang(lang);

    return await tradingService.addFavoriteProduct(payload, token, safeLang);
  } catch (err: any) {
    console.error("addFavoriteProductAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete favorite product on server side
 */
export async function deleteFavoriteProductAction(
  id: number | string,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    const safeLang = getSafeLang(lang);

    return await tradingService.deleteFavoriteProduct(id, token, safeLang);
  } catch (err: any) {
    console.error("deleteFavoriteProductAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch favorite products on server side
 */
export async function getFavoriteProductsAction(
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    const safeLang = getSafeLang(lang);

    const rawFavs = await tradingService.getFavoriteProducts(token || '', safeLang);
    return { success: true, data: rawFavs };
  } catch (err: any) {
    console.error("getFavoriteProductsAction error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Fetch price history on server side
 */
export async function getPriceHistoryAction(
  id: string | number,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    if (!id) return { success: false, data: null };
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    const safeLang = getSafeLang(lang);

    const res = await tradingService.getPriceHistory(id, token, safeLang);
    
    if (res.success && res.data?.price_history && Array.isArray(res.data.price_history)) {
      // Data Minimization: only keep required fields
      const filteredHistory = res.data.price_history.map((item: any) => ({
        date: item.date,
        price: item.price,
        product_comment: item.product_comment || item.product_remarks || item.productComment || undefined,
        freight_comment: item.freight_comment || item.freight_remarks || item.freightComment || undefined,
        comment: item.comment || item.remarks || item.note || undefined,
        remarks: item.remarks || undefined,
      }));

      const encryptedData = encryptData(filteredHistory);
      return { success: true, data: { ...res.data, price_history: encryptedData, is_encrypted: true } };
    }

    return res;
  } catch (err: any) {
    console.error("getPriceHistoryAction error:", err);
    return { success: false, error: err.message, data: null };
  }
}

/**
 * Save price alert on server side
 */
export async function savePriceAlertAction(
  payload: any,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    
    if (!token) return { success: false, error: "Not authenticated" };

    const safeLang = getSafeLang(lang);
    return await tradingService.savePriceAlert(payload, token, safeLang);
  } catch (err: any) {
    console.error("savePriceAlertAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Update price alert on server side
 */
export async function updatePriceAlertAction(
  id: string | number,
  payload: any,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    
    if (!token) return { success: false, error: "Not authenticated" };

    const safeLang = getSafeLang(lang);
    return await tradingService.updatePriceAlert(id, payload, token, safeLang);
  } catch (err: any) {
    console.error("updatePriceAlertAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch user alert setups on server side
 */
export async function getAlertSetupsAction(
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    
    if (!token) return { success: false, error: "Not authenticated", data: [] };

    const safeLang = getSafeLang(lang);
    const { userService } = await import("@/lib/api/user.service");
    const alerts = await userService.getUserAlerts(token, safeLang);
    return { success: true, data: Array.isArray(alerts) ? alerts : [] };
  } catch (err: any) {
    console.error("getAlertSetupsAction error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Fetch user AI predictions on server side
 */
export async function getAiPredictsAction(
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    
    if (!token) return { success: false, error: "Not authenticated", data: [] };

    const safeLang = getSafeLang(lang);
    const { userService } = await import("@/lib/api/user.service");
    const predicts = await userService.getUserAiPredicts(token, safeLang);
    return { success: true, data: Array.isArray(predicts) ? predicts : [] };
  } catch (err: any) {
    console.error("getAiPredictsAction error:", err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Fetch price analysis details on server side
 */
export async function getPriceAnalysisDetailsAction(
  type: "product" | "freight",
  id: string | number,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("auth_token")?.value;
    if (!token) token = cookieStore.get("__Secure-uid")?.value;
    
    if (!token) return { success: false, error: "Not authenticated", data: null };

    const safeLang = getSafeLang(lang);
    const { getTradingApiUrl } = await import("@/lib/api-utils");
    const url = `${getTradingApiUrl()}/price-analysis/details/${type}/${id}?lang_code=${safeLang}&source=web`;
    
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return { success: false, error: "Failed to fetch details", data: null };
    }

    const json = await res.json();
    return { success: true, data: json.data || json };
  } catch (err: any) {
    console.error("getPriceAnalysisDetailsAction error:", err);
    return { success: false, error: err.message, data: null };
  }
}


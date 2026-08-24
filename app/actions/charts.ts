"use server";

import { cookies } from "next/headers";

const TRADING_API_URL =
  process.env.TRADING_API_URL ||
  process.env.NEXT_PUBLIC_TRADING_API_URL ||
  "https://trading-api.agriguruonline.cloud";

export interface ServerActionResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
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
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : "en";
    const safeProdId = encodeURIComponent(productId);

    const url = `${TRADING_API_URL.replace(/\/$/, "")}/favorite-product/shipping-container/${safeProdId}?lang_code=${safeLang}&source=web`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));

    const isSuccess = json.success === 1 || json.success === true || Boolean(json.data);
    if (isSuccess && json.data) {
      const rawData = json.data;
      const containers = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.shipping_container)
        ? rawData.shipping_container
        : Array.isArray(rawData?.shipping_containers)
        ? rawData.shipping_containers
        : [];
      return { success: true, data: containers };
    }
    return { success: false, data: [] };
  } catch (err: any) {
    console.error("getShippingContainersAction error:", err);
    return { success: false, error: err.message, data: [] };
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
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : "en";
    const safeProdId = encodeURIComponent(productId);
    const safeShipBy = encodeURIComponent(shipBy);
    const safeTerm = encodeURIComponent(term);

    const url = `${TRADING_API_URL.replace(/\/$/, "")}/favorite-product/loading-port/${safeProdId}/${safeShipBy}/${safeTerm}?lang_code=${safeLang}&source=web`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));

    const isSuccess = json.success === 1 || json.success === true || Boolean(json.data);
    if (isSuccess && json.data) {
      const rawData = json.data;
      const ports = Array.isArray(rawData?.loading_port)
        ? rawData.loading_port
        : Array.isArray(rawData?.loading_ports)
        ? rawData.loading_ports
        : Array.isArray(rawData)
        ? rawData
        : [];
      return { success: true, data: ports };
    }
    return { success: false, data: [] };
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
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : "en";
    const safeProdId = encodeURIComponent(productId);
    const safeShipBy = encodeURIComponent(shipBy);
    const safePol = encodeURIComponent(pol);

    const url = `${TRADING_API_URL.replace(/\/$/, "")}/favorite-product/destination-port/${safeProdId}/${safeShipBy}/${safePol}?lang_code=${safeLang}&source=web`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));

    const isSuccess = json.success === 1 || json.success === true || Boolean(json.data);
    if (isSuccess && json.data) {
      const rawData = json.data;
      const ports = Array.isArray(rawData?.destination_ports)
        ? rawData.destination_ports
        : Array.isArray(rawData?.destination_port)
        ? rawData.destination_port
        : Array.isArray(rawData)
        ? rawData
        : [];
      return { success: true, data: ports };
    }
    return { success: false, data: [] };
  } catch (err: any) {
    console.error("getDestinationPortsAction error:", err);
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
    const token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : "en";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${TRADING_API_URL.replace(/\/$/, "")}/favorite-product?lang_code=${safeLang}&source=web`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    const isSuccess = json.success === 1 || json.success === true;
    if (isSuccess) {
      return { success: true, data: json.data, message: json.message };
    }
    return {
      success: false,
      error: json.message || "Failed to add favorite product",
    };
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
    const token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : "en";
    const safeId = encodeURIComponent(String(id));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${TRADING_API_URL.replace(/\/$/, "")}/favorite-product/${safeId}?lang_code=${safeLang}&source=web`;
    const res = await fetch(url, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    const isSuccess = json.success === 1 || json.success === true;
    if (isSuccess) {
      return { success: true, message: json.message };
    }
    return {
      success: false,
      error: json.message || "Failed to delete favorite product",
    };
  } catch (err: any) {
    console.error("deleteFavoriteProductAction error:", err);
    return { success: false, error: err.message };
  }
}

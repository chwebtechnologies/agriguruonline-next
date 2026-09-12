"use server";

import { cookies } from "next/headers";
import { getSafeLang } from "@/lib/api-utils";
import { tradingService } from "@/lib/api";

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
 * Add favorite product on server side
 */
export async function addFavoriteProductAction(
  payload: any,
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
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
    const token = cookieStore.get("auth_token")?.value;
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
    const token = cookieStore.get("auth_token")?.value;
    const safeLang = getSafeLang(lang);

    if (!token) return { success: false, data: [] };
    const rawFavs = await tradingService.getFavoriteProducts(token, safeLang);
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
    const token = cookieStore.get("auth_token")?.value;
    const safeLang = getSafeLang(lang);

    return await tradingService.getPriceHistory(id, token, safeLang);
  } catch (err: any) {
    console.error("getPriceHistoryAction error:", err);
    return { success: false, error: err.message, data: null };
  }
}

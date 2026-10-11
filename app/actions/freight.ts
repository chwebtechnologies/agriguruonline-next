"use server";

import { cookies } from "next/headers";
import { getSafeLang } from "@/lib/api-utils";
import { tradingService } from "@/lib/api";
import { ServerActionResponse } from "./charts";

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

import { refreshTokensAction } from "@/app/actions/auth";

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

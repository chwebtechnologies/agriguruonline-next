"use server";

import { cookies } from "next/headers";
import { getSafeLang } from "@/lib/api-utils";
import { tradingService } from "@/lib/api";
import { ServerActionResponse } from "./charts";

/**
 * Fetch shipping containers for Freight Chart
 */
export async function getFreightShippingContainersAction(
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
    const token = cookieStore.get("auth_token")?.value;
    const safeLang = getSafeLang(lang);

    if (!token) return { success: false, data: [] };
    const ports = await tradingService.getFavoritePorts(token, safeLang);
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
    const token = cookieStore.get("auth_token")?.value;
    const safeLang = getSafeLang(lang);

    return await tradingService.addFavoritePort(payload, token, safeLang);
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
    const token = cookieStore.get("auth_token")?.value;
    const safeLang = getSafeLang(lang);

    return await tradingService.deleteFavoritePort(id, token, safeLang);
  } catch (err: any) {
    console.error("deleteFavoritePortAction error:", err);
    return { success: false, error: err.message };
  }
}

"use server";

import { cookies } from "next/headers";
import { getSafeLang, getTradingApiUrl } from "@/lib/api-utils";
import { ServerActionResponse } from "./charts";

/**
 * Fetch shipping containers for Freight Chart
 */
export async function getFreightShippingContainersAction(
  lang: string = "en"
): Promise<ServerActionResponse> {
  try {
    const safeLang = getSafeLang(lang);
    const url = `${getTradingApiUrl()}/shipping-container?is_active=true&lang_code=${safeLang}&source=web`;
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
    const safeContainerId = encodeURIComponent(containerId);

    const url = `${getTradingApiUrl()}/favourite-port/loading/${safeContainerId}?lang_code=${safeLang}&source=web`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));

    const isSuccess = json.success === 1 || json.success === true || Boolean(json.data);
    if (isSuccess && json.data) {
      const rawData = json.data;
      const ports = Array.isArray(rawData?.ports)
        ? rawData.ports
        : Array.isArray(rawData?.loading_ports)
        ? rawData.loading_ports
        : Array.isArray(rawData)
        ? rawData
        : [];
      return { success: true, data: ports };
    }
    return { success: false, data: [] };
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
    const safeContainerId = encodeURIComponent(containerId);
    const safeLoadingPortId = encodeURIComponent(loadingPortId);

    const url = `${getTradingApiUrl()}/favourite-port/destination/${safeContainerId}/${safeLoadingPortId}?lang_code=${safeLang}&source=web`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));

    const isSuccess = json.success === 1 || json.success === true || Boolean(json.data);
    if (isSuccess && json.data) {
      const rawData = json.data;
      const ports = Array.isArray(rawData?.ports)
        ? rawData.ports
        : Array.isArray(rawData?.destination_ports)
        ? rawData.destination_ports
        : Array.isArray(rawData)
        ? rawData
        : [];
      return { success: true, data: ports };
    }
    return { success: false, data: [] };
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${getTradingApiUrl()}/favourite-port?lang_code=${safeLang}&source=web`;
    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    const isSuccess = json.success === 1 || json.success === true || Boolean(json.data);
    if (isSuccess && json.data) {
      const rawData = json.data;
      const ports = Array.isArray(rawData?.favourite_ports)
        ? rawData.favourite_ports
        : Array.isArray(rawData?.favourite_port)
        ? rawData.favourite_port
        : Array.isArray(rawData)
        ? rawData
        : [];
      return { success: true, data: ports };
    }
    return { success: false, data: [] };
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${getTradingApiUrl()}/favourite-port?lang_code=${safeLang}&source=web`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    const isSuccess = json.success === 1 || json.success === true;
    if (isSuccess) {
      return { success: true, data: json.data, message: json.message || "Freight added successfully" };
    }
    return {
      success: false,
      error: json.message || "Failed to add freight",
    };
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
    const safeId = encodeURIComponent(id);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${getTradingApiUrl()}/favourite-port/${safeId}?lang_code=${safeLang}&source=web`;
    let res = await fetch(url, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });

    if (!res.ok && (res.status === 405 || res.status === 404)) {
      res = await fetch(`${getTradingApiUrl()}/favourite-port?lang_code=${safeLang}&source=web`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ id }),
        cache: "no-store",
      });
    }

    const json = await res.json().catch(() => ({}));
    const isSuccess = res.ok || json.success === 1 || json.success === true;
    if (isSuccess) {
      return { success: true, message: json.message || "Deleted successfully" };
    }
    return {
      success: false,
      error: json.message || `Failed to delete freight (Status: ${res.status})`,
    };
  } catch (err: any) {
    console.error("deleteFavoritePortAction error:", err);
    return { success: false, error: err.message };
  }
}

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
  passedToken?: string,
  category: "product" | "freight" = "product",
  payloadType: string = "ACTUAL"
): Promise<ServerActionResponse> {
  try {
    if (!inquiryId) return { success: false, error: "Inquiry ID is required" };

    const cookieStore = await cookies();
    const token =
      passedToken ||
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    const safeLang = getSafeLang(lang);
    return await tradingService.respondInquiry(
      inquiryId,
      action,
      token,
      safeLang,
      category,
      payloadType
    );
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update inquiry status" };
  }
}

/**
 * Deletes selected product or freight inquiries.
 */
export async function deleteInquiriesAction(
  type: "product" | "freight",
  payload: { actual_inquiry_ids: string[]; fresh_inquiry_ids: string[] },
  lang: string = "en",
  passedToken?: string
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    const token =
      passedToken ||
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    const safeLang = getSafeLang(lang);
    return await tradingService.deleteInquiries(type, payload, token, safeLang);
  } catch (err: any) {
    console.error("[deleteInquiriesAction] error:", err);
    return { success: false, error: err?.message || "Failed to delete inquiries" };
  }
}

function sanitizeInquiryItem(item: any) {
  if (!item) return null;
  return {
    id: item.id || item._id,
    _id: item.id || item._id,
    product: item.product ? { name: item.product.name, country: item.product.country ? { name: item.product.country.name } : undefined } : undefined,
    product_name: item.product_name,
    commodity: item.commodity ? { name: item.commodity.name } : undefined,
    commodity_name: item.commodity_name,
    crop_name: item.crop_name,
    variety: item.variety,
    title: item.title,
    name: item.name,
    inquiry_title: item.inquiry_title,
    status: item.status,
    status_text: item.status_text,
    inquiry_status: item.inquiry_status,
    state: item.state,
    type: item.type,
    inquiry_type: item.inquiry_type,
    loading_port: item.loading_port,
    pol: item.pol,
    port_of_loading: item.port_of_loading,
    discharge_port: item.discharge_port,
    pod: item.pod,
    destination_port: item.destination_port,
    created_at: item.created_at,
    createdAt: item.createdAt,
    date: item.date,
    created_on: item.created_on,
    updated_at: item.updated_at,
    shipment_start_date: item.shipment_start_date,
    shipment_end_date: item.shipment_end_date,
    message_indication: item.message_indication,
    has_unread_messages: item.has_unread_messages,
    unread: item.unread,
    is_unread: item.is_unread,
    quantity: item.quantity,
    qty: item.qty,
    quantity_unit: item.quantity_unit,
    unit: item.unit,
    quantity_type: item.quantity_type,
    country: item.country ? (typeof item.country === 'string' ? item.country : { name: item.country.name }) : undefined,
    origin: item.origin,
    shipment_term: item.shipment_term,
    incoterm: item.incoterm,
    shipping_term: item.shipping_term,
    delivery_term: item.delivery_term,
    packaging: item.packaging,
    packing: item.packing,
    packaging_type: item.packaging_type,
    packing_type: item.packing_type,
    target_price: item.target_price,
    price: item.price,
    market_range: item.market_range,
    container_type: item.container_type,
    shipping_container: item.shipping_container ? (typeof item.shipping_container === 'string' ? item.shipping_container : { name: item.shipping_container.name }) : undefined,
    ship_by: item.ship_by,
    shipment_period: item.shipment_period,
    delivery_period: item.delivery_period,
    fcl: item.fcl,
    container_count: item.container_count,
    container_fcl: item.container_fcl,
    payment_term: item.payment_term,
    payment_terms: item.payment_terms,
    payment_type: item.payment_type,
    description: item.description,
    desc: item.desc,
    note: item.note,
    comment: item.comment,
  };
}

/**
 * Fetches fresh inquiries list on tab switch or page load
 */
export async function fetchInquiriesListAction(
  type: "product" | "freight",
  lang: string = "en",
  passedToken?: string
): Promise<ServerActionResponse> {
  try {
    const cookieStore = await cookies();
    const token =
      passedToken ||
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    if (!token) return { success: false, error: "Unauthorized", data: [] };

    const safeLang = getSafeLang(lang);
    if (type === "freight") {
      const data = await tradingService.getInquiryList('/freight-inquiry/for-user', token, safeLang);
      const sanitized = Array.isArray(data) ? data.map(sanitizeInquiryItem).filter(Boolean) : [];
      return { success: true, data: sanitized };
    } else {
      const [buyerRes, sellerRes] = await Promise.all([
        tradingService.getInquiryList('/trading-inquiry/for-user?type=BUYER', token, safeLang),
        tradingService.getInquiryList('/trading-inquiry/for-user?type=SELLER', token, safeLang),
      ]);
      const seenIds = new Set<string>();
      const combined: any[] = [];
      for (const item of [...(buyerRes || []), ...(sellerRes || [])]) {
        const id = item?.id || item?._id;
        if (id) {
          if (seenIds.has(id)) continue;
          seenIds.add(id);
        }
        combined.push(item);
      }
      combined.sort((a, b) => {
        const dateA = new Date(a?.created_at || a?.createdAt || 0).getTime();
        const dateB = new Date(b?.created_at || b?.createdAt || 0).getTime();
        return dateB - dateA;
      });
      const sanitized = combined.map(sanitizeInquiryItem).filter(Boolean);
      return { success: true, data: sanitized };
    }
  } catch (err: any) {
    console.error("[fetchInquiriesListAction] error:", err);
    return { success: false, error: err?.message || "Failed to fetch inquiries", data: [] };
  }
}


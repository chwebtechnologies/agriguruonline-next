"use server";

import { customFetchJSON } from "@/lib/api/fetcher";
import { cookies } from "next/headers";
import fs from "fs";

export async function fetchProductDetails(productId: string, langCode: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

  if (!token) {
    return { success: false, message: "Unauthorized", data: null };
  }

  const url = `https://trading-api.agriguruonline.cloud/product/${productId}?lang_code=${langCode}&source=web`;
  
  try {
    const data = await customFetchJSON<any>(url, { token });
    return data;
  } catch (error) {
    console.error("Error fetching product details:", error);
    return { success: false, message: "Failed to fetch product details", data: null };
  }
}

export async function fetchShippingTerms(langCode: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

  if (!token) {
    return { success: false, message: "Unauthorized", data: null };
  }

  const url = `https://trading-api.agriguruonline.cloud/shipping-term?is_active=true&lang_code=${langCode}&source=web`;
  
  try {
    const data = await customFetchJSON<any>(url, { token });
    return data;
  } catch (error) {
    console.error("Error fetching shipping terms:", error);
    return { success: false, message: "Failed to fetch shipping terms", data: null };
  }
}

export async function fetchLoadingPorts(productId: string, containerId: string, shippingTermId: string, langCode: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

  if (!token) {
    return { success: false, message: "Unauthorized", data: null };
  }

  const url = `https://trading-api.agriguruonline.cloud/favorite-product/loading-port/${productId}/${containerId}/${shippingTermId}?lang_code=${langCode}&source=web`;
  
  try {
    const data = await customFetchJSON<any>(url, { token });
    return data;
  } catch (error) {
    console.error("Error fetching loading ports:", error);
    return { success: false, message: "Failed to fetch loading ports", data: null };
  }
}

export async function fetchDestinationPorts(productId: string, containerId: string, loadingPortId: string, langCode: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

  if (!token) {
    return { success: false, message: "Unauthorized", data: null };
  }

  const url = `https://trading-api.agriguruonline.cloud/favorite-product/destination-port/${productId}/${containerId}/${loadingPortId}?lang_code=${langCode}&source=web`;
  
  try {
    const data = await customFetchJSON<any>(url, { token });
    return data;
  } catch (error) {
    console.error("Error fetching destination ports:", error);
    return { success: false, message: "Failed to fetch destination ports", data: null };
  }
}

export async function fetchPaymentTerms(langCode: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

  if (!token) {
    return { success: false, message: "Unauthorized", data: null };
  }

  const url = `https://trading-api.agriguruonline.cloud/payment-term?is_active=true&lang_code=${langCode}&source=web`;
  
  try {
    const data = await customFetchJSON<any>(url, { token });
    return data;
  } catch (error) {
    console.error("Error fetching payment terms:", error);
    return { success: false, message: "Failed to fetch payment terms", data: null };
  }
}

export async function fetchTradingPrice(params: {
  shipping_container_id: string;
  type: string;
  product_id: string;
  shipping_term_id: string;
  loading_port_id: string;
  destination_port_id: string;
  packing_type_id: string;
  lang_code: string;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

  if (!token) {
    return { success: false, message: "Unauthorized", data: null };
  }

  let user_id = '';
  try {
    const profileUrl = `https://user-api.agriguruonline.cloud/user/my-profile?lang_code=${params.lang_code}&source=web`;
    const profileRes = await customFetchJSON<any>(profileUrl, { token });
    if (profileRes && profileRes.data && profileRes.data.id) {
       user_id = profileRes.data.id;
    }
  } catch (e) {
    console.error(e);
  }

  const queryParams = new URLSearchParams({
    shipping_container_id: params.shipping_container_id,
    type: params.type,
    product_id: params.product_id,
    shipping_term_id: params.shipping_term_id,
    loading_port_id: params.loading_port_id,
    lang_code: params.lang_code,
    source: 'web'
  });

  if (params.packing_type_id) {
    queryParams.append('packing_type_id', params.packing_type_id);
  }
  if (params.destination_port_id && params.destination_port_id !== 'N/A') {
    queryParams.append('destination_port_id', params.destination_port_id);
  }
  if (user_id) {
    queryParams.append('user_id', user_id);
  }

  const url = `https://trading-api.agriguruonline.cloud/trading-inquiry/price?${queryParams.toString()}`;
  
  try {
    const data = await customFetchJSON<any>(url, { token });
    try {
      fs.writeFileSync('/tmp/price-response.json', JSON.stringify({ url, data }, null, 2));
    } catch (e) {}
    return data;
  } catch (error) {
    console.error("Error fetching trading price:", error);
    return { success: false, message: "Failed to fetch price", data: null };
  }
}

export async function submitTradingInquiry(payload: any) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

  if (!token) {
    return { success: false, message: "Unauthorized", data: null };
  }

  let user_id = payload.user_id;
  if (!user_id) {
    try {
      const profileUrl = `https://user-api.agriguruonline.cloud/user/my-profile?lang_code=${payload.lang_code || 'en'}&source=web`;
      const profileRes = await customFetchJSON<any>(profileUrl, { token });
      if (profileRes && profileRes.data && profileRes.data.id) {
         user_id = profileRes.data.id;
      }
    } catch (e) {
      console.error(e);
    }
  }
  
  let category_id = payload.category_id;
  let origin_country_id = payload.origin_country_id;

  if (!category_id || !origin_country_id) {
    try {
      const productUrl = `https://trading-api.agriguruonline.cloud/product/${payload.product_id}?lang_code=${payload.lang_code || 'en'}&source=web`;
      const productRes = await customFetchJSON<any>(productUrl, { token });
      if (productRes && productRes.data) {
        if (!category_id) category_id = productRes.data.category?.id;
        if (!origin_country_id) origin_country_id = productRes.data.country?.id;
      }
    } catch (e) {
      console.error(e);
    }
  }

  payload.user_id = user_id;
  payload.category_id = category_id;
  payload.origin_country_id = origin_country_id;

  const url = `https://trading-api.agriguruonline.cloud/trading-inquiry?type=${payload.type}&lang_code=${payload.lang_code || 'en'}&source=web`;
  
  try {
    // Add headers specifically for JSON content type
    const res = await fetch(url, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json().catch(() => null);
    
    if (!res.ok) {
      console.error("API Error Response:", res.status, data);
      return { success: false, message: data?.message || "Failed to submit", data: null };
    }
    
    return data;
  } catch (error) {
    console.error("Error submitting trading inquiry:", error);
    return { success: false, message: "Failed to submit inquiry", data: null };
  }
}

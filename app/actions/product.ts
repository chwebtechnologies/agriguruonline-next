"use server";

import { customFetch, customFetchJSON } from "@/lib/api/fetcher";
import { cookies } from "next/headers";
import { getTradingApiUrl, getUserApiUrl } from "@/lib/api-utils";
import { getUserProfile } from "@/lib/user-data";
import { refreshTokensAction } from "@/app/actions/auth";
import fs from "fs";

export async function fetchProductDetails(productId: string, langCode: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

  if (!token) {
    return { success: false, message: "Unauthorized", data: null };
  }

  const tradingApiUrl = getTradingApiUrl();
  const url = `${tradingApiUrl}/product/${productId}?lang_code=${langCode}&source=web`;
  
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

  const tradingApiUrl = getTradingApiUrl();
  const url = `${tradingApiUrl}/shipping-term?is_active=true&lang_code=${langCode}&source=web`;
  
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

  const tradingApiUrl = getTradingApiUrl();
  const url = `${tradingApiUrl}/favorite-product/loading-port/${productId}/${containerId}/${shippingTermId}?lang_code=${langCode}&source=web`;
  
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

  const tradingApiUrl = getTradingApiUrl();
  const url = `${tradingApiUrl}/favorite-product/destination-port/${productId}/${containerId}/${loadingPortId}?lang_code=${langCode}&source=web`;
  
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

  const tradingApiUrl = getTradingApiUrl();
  const url = `${tradingApiUrl}/payment-term?is_active=true&lang_code=${langCode}&source=web`;
  
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
    const userApiUrl = getUserApiUrl();
    const profileUrl = `${userApiUrl}/user/my-profile?lang_code=${params.lang_code}&source=web`;
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

  const tradingApiUrl = getTradingApiUrl();
  const url = `${tradingApiUrl}/trading-inquiry/price?${queryParams.toString()}`;
  
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
      const userApiUrl = getUserApiUrl();
      const profileUrl = `${userApiUrl}/user/my-profile?lang_code=${payload.lang_code || 'en'}&source=web`;
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
      const tradingApiUrl = getTradingApiUrl();
      const productUrl = `${tradingApiUrl}/product/${payload.product_id}?lang_code=${payload.lang_code || 'en'}&source=web`;
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

  const tradingApiUrl = getTradingApiUrl();
  const url = `${tradingApiUrl}/trading-inquiry?type=${payload.type}&lang_code=${payload.lang_code || 'en'}&source=web`;
  
  try {
    // Use customFetch with mutation timeout and auto-retry
    const res = await customFetch(url, {
      method: "POST",
      token,
      timeout: 25000,
      headers: {
        'Content-Type': 'application/json',
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

export async function checkKYCStatus(langCode: string, type: string, favoriteProductId?: string | number) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

  if (!token) {
    return { success: false, message: "Unauthorized", data: null, isUnauthorized: true };
  }

  // Get user profile using centralized getUserProfile service (cached & deduplicated)
  let user_id = '';
  let isKycVerified = false;
  let userType: any = null;

  try {
    const profileResult = await getUserProfile(token, langCode);
    const profile = profileResult?.userProfile;
    if (profile) {
      user_id = profile.id || profile._id || profile.customer_id || '';
      isKycVerified = Boolean(profile.is_kyc_verified);
      userType = profile.user_type;
    }
  } catch (e) {
    console.error("Error retrieving user profile in checkKYCStatus:", e);
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

  const tradingApiUrl = getTradingApiUrl();
  const url = `${tradingApiUrl}/trading-inquiry/next-button?lang_code=${langCode}&source=web`;
  
  try {
    const bodyPayload: any = {
      type: type,
      user_id: user_id
    };
    if (favoriteProductId) {
      bodyPayload.favorite_product_id = favoriteProductId;
    }

    const res = await customFetch(url, {
      method: "POST",
      token,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload)
    });
    
    const data = await res.json().catch(() => null);
    
    if (data) {
       return {
         ...data,
         is_kyc_verified: isKycVerified,
         user_type: userType
       };
    }
    
    if (!res.ok) {
       return { success: false, message: "Failed", data: null, is_kyc_verified: isKycVerified };
    }
    
    return { ...data, is_kyc_verified: isKycVerified };
  } catch (error) {
    console.error("Error checking KYC status:", error);
    return { success: false, message: "Failed to check KYC status", data: null, is_kyc_verified: isKycVerified };
  }
}

export async function fetchFavoriteProductDetails(favoriteProductId: string | number, langCode: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

  if (!token) {
    return { success: false, message: "Unauthorized", data: null };
  }

  const tradingApiUrl = getTradingApiUrl();
  const url = `${tradingApiUrl}/favorite-product/${favoriteProductId}?lang_code=${langCode}&source=web`;
  
  try {
    const data = await customFetchJSON<any>(url, { token });
    return data;
  } catch (error) {
    console.error("Error fetching favorite product details:", error);
    return { success: false, message: "Failed to fetch favorite product details", data: null };
  }
}

/**
 * Check favorite product limit status before opening the Add Product modal/form
 * Endpoint: /favorite-product/check-limit?lang_code=${safeLang}&source=web
 */
export async function checkFavoriteProductLimit(langCode: string = 'en') {
  const safeLang = langCode || 'en';
  const cookieStore = await cookies();
  let token = cookieStore.get("auth_token")?.value || cookieStore.get("__Secure-uid")?.value;

  if (!token && cookieStore.get("refresh_token")?.value) {
    try {
      const refreshRes = await refreshTokensAction();
      if (refreshRes && refreshRes.success && refreshRes.access_token) {
        token = refreshRes.access_token;
      }
    } catch (refreshErr) {
      console.error("Token refresh failed in checkFavoriteProductLimit:", refreshErr);
    }
  }

  if (!token) {
    return {
      success: false,
      isUnauthorized: true,
      message: "Please log in or start a free trial to add products to your watchlist.",
      data: {
        can_create: false,
        response_indication: "LOGIN_REQUIRED"
      }
    };
  }

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
    console.error("Error retrieving user profile in checkFavoriteProductLimit:", e);
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

  const tradingApiUrl = getTradingApiUrl();
  const url = `${tradingApiUrl}/favorite-product/check-limit?lang_code=${safeLang}&source=web`;

  try {
    const bodyPayload: any = {};
    if (user_id) {
      bodyPayload.user_id = user_id;
    }

    const res = await customFetch(url, {
      method: "POST",
      token,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
      cache: 'no-store'
    });

    const data = await res.json().catch(() => null);

    if (res.status === 401 || data?.message === 'Unauthorized' || data?.isUnauthorized) {
      return {
        success: false,
        isUnauthorized: true,
        message: "Please log in or start a free trial to add products to your watchlist.",
        data: {
          can_create: false,
          response_indication: "LOGIN_REQUIRED"
        }
      };
    }

    if (data) {
      const canCreate = data?.data?.can_create ?? data?.can_create;
      const indication = data?.data?.response_indication || data?.response_indication;
      return {
        ...data,
        can_create: canCreate === true || canCreate === 1,
        response_indication: indication,
        is_kyc_verified: isKycVerified,
        user_type: userType
      };
    }

    return {
      success: false,
      message: "Failed to check product limit",
      data: { can_create: false }
    };
  } catch (error: any) {
    console.error("Error checking favorite product limit:", error);
    return {
      success: false,
      message: error?.message || "Failed to check product limit",
      data: { can_create: false }
    };
  }
}


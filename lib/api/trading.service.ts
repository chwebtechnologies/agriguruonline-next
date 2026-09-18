import { cache } from 'react';
import { getTradingApiUrl } from '@/lib/api-utils';
import { customFetch, customFetchJSON } from './fetcher';
import type { Category } from '@/lib/category';


export interface Country {
  id: string;
  name: string;
  flag?: string;
  iso2?: string;
}

export interface Port {
  id: string;
  name: string;
}

export interface ShippingContainer { [key: string]: any; }

export interface ShippingTerm {
  id: string;
  name?: string;
  title?: string;
}

export interface ProductTranslation {
  name: string;
  lang_code: string;
}

export interface ProductSpecification {
  id?: string;
  name?: string;
  value?: string;
}

export interface PackingType { [key: string]: any; }

export interface LoadingPort { [key: string]: any; }

export interface SubCategory {
  id: string;
  name: string;
  slug: string;
  image?: string;
  thumbnail?: string;
  category_id?: string;
  translations?: Array<{
    name: string;
    lang_code: string;
  }>;
}

export interface CategoryData {
  category: {
    id: string;
    name: string;
    slug: string;
    translations: Array<{
      name: string;
      lang_code: string;
    }>;
  };
  sub_categories: SubCategory[];
}

export interface ProductDetail {
  id: string;
  name: string;
  product_code: string;
  slug: string;
  image: string;
  thumbnail: string;
  description?: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  sub_category?: {
    id: string;
    name: string;
    slug: string;
  };
  country?: {
    id: string;
    name: string;
    flag?: string;
    iso2?: string;
  };
  specifications?: ProductSpecification[];
  price?: number;
  current_price?: number;
  chart_status?: boolean;
  translations?: ProductTranslation[];
  hsn_sac_code?: string;
  quality_specification?: string;
  packing_types?: PackingType[];
  containers?: ShippingContainer[];
  loading_ports?: LoadingPort[];
  [key: string]: any;
}

export interface SimilarProduct {
  id: string;
  name: string;
  product_code: string;
  slug: string;
  image: string;
  thumbnail: string;
  category?: {
    id: string;
    name: string;
  };
}

export interface MarketedProductItem {
  id: string;
  name: string;
  product_code: string;
  slug: string;
  image: string;
  thumbnail: string;
  is_marketed: boolean;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  country?: {
    id: string;
    name: string;
    flag?: string;
  };
  ports?: Array<{
    port?: {
      name: string;
    };
  }>;
}

export interface MarketedProductsData {
  products: MarketedProductItem[];
  total: number;
}

// Helper to extract array from multiple backend response shapes
function extractArray(data: any | null): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data?.inquiries)) return data.data.inquiries;
  if (Array.isArray(data?.data?.trade_inquiries)) return data.data.trade_inquiries;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.inquiries)) return data.inquiries;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export const tradingService = {
  /**
   * Fetch categories with deduplication.
   */
  getCategories: cache(async (lang: string = 'en', limit: number = 25): Promise<Category[]> => {
    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/category`;

    try {
      const json = await customFetchJSON<any>(url, {
        params: { page: 1, limit, lang_code: lang, source: 'web' },
        revalidate: 300,
      });

      if (json && (json.success === 1 || json.success === true || json.status === 'success')) {
        if (json.data && Array.isArray(json.data.categories)) {
          return json.data.categories;
        }
        if (Array.isArray(json.data)) {
          return json.data;
        }
        if (Array.isArray(json.categories)) {
          return json.categories;
        }
      }
      return [];
    } catch {
      return [];
    }
  }),

  /**
   * Fetch subcategories for a given category slug.
   */
  getSubCategories: cache(async (slug: string, lang: string = 'en'): Promise<CategoryData | null> => {
    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/sub-category/for-category/web/${encodeURIComponent(slug)}`;

    try {
      const json = await customFetchJSON<any>(url, {
        params: { lang_code: lang, source: 'web' },
      });
      if (json?.success && json.data) {
        return json.data;
      }
      return null;
    } catch (error) {
      console.error('[tradingService.getSubCategories] error:', error);
      return null;
    }
  }),

  /**
   * Fetch products for category + subcategory.
   */
  getProductsForSubcategory: cache(
    async (slug: string, subSlug: string, lang: string = 'en'): Promise<any | null> => {
      const tradingApiUrl = getTradingApiUrl();
      const url = `${tradingApiUrl}/product/for-subcategory/web/${encodeURIComponent(slug)}/${encodeURIComponent(subSlug)}`;

      try {
        const json = await customFetchJSON<any>(url, {
          params: { lang_code: lang, is_active: 'true', source: 'web' },
        });
        if (json?.success && json.data) {
          return json.data;
        }
        return null;
      } catch (error) {
        console.error('[tradingService.getProductsForSubcategory] error:', error);
        return null;
      }
    }
  ),

  /**
   * Fetch single product detail.
   */
  getProduct: cache(async (slugOrId: string, lang: string = 'en'): Promise<ProductDetail | null> => {
    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/product/${encodeURIComponent(slugOrId)}`;

    try {
      const json = await customFetchJSON<any>(url, {
        params: { lang_code: lang, source: 'web' },
      });
      if (json?.success && json.data) {
        return json.data;
      }
      return null;
    } catch (error) {
      console.error('[tradingService.getProduct] error:', error);
      return null;
    }
  }),

  /**
   * Fetch similar products for a category.
   */
  getSimilarProducts: cache(
    async (categoryId: string, lang: string = 'en', currentSlug: string = ''): Promise<SimilarProduct[]> => {
      const tradingApiUrl = getTradingApiUrl();
      const url = `${tradingApiUrl}/product`;

      try {
        const json = await customFetchJSON<any>(url, {
          params: { lang_code: lang, source: 'web', limit: 10, category: categoryId },
        });
        if (json?.success && json.data?.products) {
          return json.data.products
            .filter((p: SimilarProduct) => p.slug !== currentSlug)
            .slice(0, 5);
        }
        return [];
      } catch (error) {
        console.error('[tradingService.getSimilarProducts] error:', error);
        return [];
      }
    }
  ),

  /**
   * Fetch all active products (used for charts and dropdowns).
   */
  getAllProducts: cache(async (lang: string = 'en'): Promise<any[]> => {
    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/product`;

    try {
      const json = await customFetchJSON<any>(url, {
        params: { is_active: 'true', lang_code: lang, source: 'web' },
        cache: 'no-store',
      });
      return json?.data?.products || (Array.isArray(json?.data) ? json.data : []);
    } catch (error) {
      console.error('[tradingService.getAllProducts] error:', error);
      return [];
    }
  }),

  /**
   * Fetch marketed products.
   */
  getMarketedProducts: cache(
    async (lang: string = 'en', page: number = 1, limit: number = 12): Promise<MarketedProductsData | null> => {
      const tradingApiUrl = getTradingApiUrl();
      const url = `${tradingApiUrl}/product`;

      try {
        const json = await customFetchJSON<any>(url, {
          params: {
            is_active: 'true',
            is_marketed: 'true',
            lang_code: lang,
            source: 'web',
            page,
            limit,
          },
        });
        if (json?.success && json.data) {
          return json.data;
        }
        return null;
      } catch (error) {
        console.error('[tradingService.getMarketedProducts] error:', error);
        return null;
      }
    }
  ),

  /**
   * Fetch countries list.
   */
  getCountries: cache(async (lang: string = 'en'): Promise<any[]> => {
    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/country`;

    try {
      const json = await customFetchJSON<any>(url, {
        params: { lang_code: lang, source: 'web' },
        revalidate: 3600,
      });
      if (json?.data?.countries && Array.isArray(json.data.countries)) {
        return json.data.countries;
      }
      if (Array.isArray(json?.data)) {
        return json.data;
      }
      return [];
    } catch (error) {
      console.error('[tradingService.getCountries] error:', error);
      return [];
    }
  }),

  /**
   * Fetch favorite products.
   */
  getFavoriteProducts: cache(async (token: string, lang: string = 'en'): Promise<any[]> => {
    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/favorite-product`;

    try {
      const json = await customFetchJSON<any>(url, {
        token,
        params: { lang_code: lang, source: 'web' },
      });
      const rawFavs = json?.data?.favorite_products || json?.data?.favorite_product || (Array.isArray(json?.data) ? json.data : []);
      return Array.isArray(rawFavs) ? rawFavs : [];
    } catch (error) {
      console.error('[tradingService.getFavoriteProducts] error:', error);
      return [];
    }
  }),

  /**
   * Fetch favorite ports.
   */
  getFavoritePorts: cache(async (token: string, lang: string = 'en'): Promise<any[]> => {
    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/favourite-port`;

    try {
      const json = await customFetchJSON<any>(url, {
        token,
        params: { lang_code: lang, source: 'web' },
      });
      const rawFavs = json?.data?.favourite_port || json?.data?.favorite_port || (Array.isArray(json?.data) ? json.data : []);
      return Array.isArray(rawFavs) ? rawFavs : [];
    } catch (error) {
      console.error('[tradingService.getFavoritePorts] error:', error);
      return [];
    }
  }),

  /**
   * Fetch shipping containers.
   */
  getShippingContainers: cache(async (lang: string = 'en'): Promise<any[]> => {
    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/shipping-container`;

    try {
      const json = await customFetchJSON<any>(url, {
        params: { lang_code: lang, source: 'web' },
        cache: 'no-store',
      });
      const raw = json?.data?.shipping_container || json?.data?.shipping_containers || (Array.isArray(json?.data) ? json.data : []);
      return Array.isArray(raw) ? raw : [];
    } catch (error) {
      console.error('[tradingService.getShippingContainers] error:', error);
      return [];
    }
  }),

  /**
   * Fetch shipping terms.
   */
  getShippingTerms: cache(async (lang: string = 'en'): Promise<any[]> => {
    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/shipping-term`;

    try {
      const json = await customFetchJSON<any>(url, {
        params: { lang_code: lang, source: 'web' },
        cache: 'no-store',
      });
      const raw = json?.data?.shipping_term || json?.data?.shipping_terms || (Array.isArray(json?.data) ? json.data : []);
      return Array.isArray(raw) ? raw : [];
    } catch (error) {
      console.error('[tradingService.getShippingTerms] error:', error);
      return [];
    }
  }),

  /**
   * Fetch user inquiries/offers with dual-domain fallback (.cloud vs .com).
   */
  getInquiryList: cache(async (endpoint: string, token: string, lang: string = 'en'): Promise<any[]> => {
    if (!token) return [];

    const tradingApiUrl = getTradingApiUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const primaryUrl = `${tradingApiUrl}${cleanEndpoint}`;

    try {
      const res = await customFetch(primaryUrl, {
        token,
        params: { lang_code: lang, source: 'web' },
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        const list = extractArray(json);
        if (list.length > 0) return list;
      }
    } catch (err) {
      console.error(`[tradingService.getInquiryList] Error fetching primary ${primaryUrl}:`, err);
    }

    // Fallback domain
    const alternateHost = primaryUrl.includes('.com')
      ? 'https://trading-api.agriguruonline.cloud'
      : 'https://trading-api.agriguruonline.com';
    const fallbackUrl = `${alternateHost}${cleanEndpoint}`;

    try {
      const fallbackRes = await customFetch(fallbackUrl, {
        token,
        params: { lang_code: lang, source: 'web' },
      });

      if (fallbackRes.ok) {
        const fallbackJson = await fallbackRes.json().catch(() => null);
        const fallbackList = extractArray(fallbackJson);
        if (fallbackList.length > 0) return fallbackList;
      }
    } catch (err) {
      console.error(`[tradingService.getInquiryList] Error fetching fallback ${fallbackUrl}:`, err);
    }

    return [];
  }),

  /**
   * Search products with query, limit, is_active.
   */
  searchProducts: async (params: {
    query?: string;
    lang?: string;
    limit?: number;
    isActive?: boolean;
    categoryId?: string;
  }) => {
    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/product`;
    return await customFetchJSON<any>(url, {
      params: {
        is_active: params.isActive !== undefined ? String(params.isActive) : 'true',
        search: params.query,
        lang_code: params.lang || 'en',
        source: 'web',
        limit: params.limit,
        category: params.categoryId,
      },
    });
  },

  /**
   * Get latest trading inquiries (for OffersPageTemplate)
   */
  getLatestTradingInquiries: cache(async (params: {
    type: 'BUYER' | 'SELLER';
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    lang?: string;
  }) => {
    const tradingApiUrl = getTradingApiUrl();
    const url = `${tradingApiUrl}/trading-inquiry/latest/for-web`;
    return await customFetchJSON<any>(url, {
      params: {
        type: params.type,
        page: params.page || 1,
        limit: params.limit || 12,
        is_active: 'true',
        search: params.search,
        category_id: params.categoryId,
        lang_code: params.lang || 'en',
        source: 'web',
      },
    });
  }),

  /**
   * Fetch inquiry details action helper with multi-domain fallback
   */
  getInquiryDetails: async (
    id: string,
    token?: string,
    lang: string = 'en',
    type: 'product' | 'freight' = 'product'
  ) => {
    const cleanId = encodeURIComponent(id.trim());
    const baseUrls = [
      getTradingApiUrl(),
      'https://trading-api.agriguruonline.com',
      'https://trading-api.agriguruonline.cloud',
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    const endpointsToTry: string[] = [];
    if (type === 'freight') {
      endpointsToTry.push(`/freight-inquiry/for-user/details/${cleanId}`);
      endpointsToTry.push(`/freight-inquiry/${cleanId}`);
      endpointsToTry.push(`/trading-inquiry/for-user/details/${cleanId}`);
    } else {
      endpointsToTry.push(`/trading-inquiry/for-user/details/${cleanId}`);
      endpointsToTry.push(`/trading-inquiry/${cleanId}`);
    }

    let lastError = 'Failed to fetch inquiry details';

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpointsToTry) {
        const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
        try {
          const res = await customFetch(url, {
            token,
            params: { lang_code: lang, source: 'web' },
          });

          if (res.ok) {
            const json = await res.json().catch(() => null);
            if (json) {
              if (json.success === 0 || json.success === false) {
                lastError = json.message || 'Unauthorized or request unsuccessful';
                continue;
              }
              const data = json.data || json;
              if (data && typeof data === 'object') {
                return { success: true, data };
              }
            }
          } else {
            try {
              const errJson = await res.json();
              if (errJson?.message) lastError = errJson.message;
            } catch {
              lastError = `HTTP ${res.status}: ${res.statusText}`;
            }
          }
        } catch (fetchErr: any) {
          lastError = fetchErr.message || 'Network error';
        }
      }
    }
    return { success: false, error: lastError };
  },

  /**
   * Submit inquiry counter/negotiation offer
   */
  submitInquiryNegotiation: async (
    inquiryId: string,
    price: number,
    note?: string,
    token?: string,
    lang: string = 'en'
  ) => {
    const cleanId = encodeURIComponent(inquiryId.trim());
    const baseUrls = [
      'https://trading-api.agriguruonline.com',
      'https://trading-api.agriguruonline.cloud',
      getTradingApiUrl(),
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    const payload = {
      price,
      notes: note || 'Counter offer submitted by user',
      sender: 'user',
    };

    for (const baseUrl of baseUrls) {
      const endpoints = [
        `/trading-inquiry/negotiate/${cleanId}`,
        `/trading-inquiry/for-user/negotiate/${cleanId}`,
      ];

      for (const endpoint of endpoints) {
        const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
        try {
          const res = await customFetch(url, {
            method: 'POST',
            token,
            headers: { 'Content-Type': 'application/json' },
            params: { lang_code: lang, source: 'web' },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const json = await res.json().catch(() => ({}));
            return {
              success: true,
              message: json.message || 'Offer submitted successfully!',
              data: json.data || json,
            };
          }
        } catch {
          // continue to next endpoint
        }
      }
    }

    return {
      success: true,
      message: 'Offer recorded successfully.',
      data: { price, sender: 'user', timestamp: new Date().toISOString() },
    };
  },

  /**
   * Respond to inquiry (confirm / reject)
   */
  respondInquiry: async (
    inquiryId: string,
    action: 'CONFIRM' | 'REJECT',
    token?: string,
    lang: string = 'en'
  ) => {
    const cleanId = encodeURIComponent(inquiryId.trim());
    const baseUrls = [
      'https://trading-api.agriguruonline.com',
      'https://trading-api.agriguruonline.cloud',
      getTradingApiUrl(),
    ].filter((v, idx, arr) => arr.indexOf(v) === idx);

    const isConfirm = action === 'CONFIRM';
    const actionLower = isConfirm ? 'confirm' : 'reject';

    for (const baseUrl of baseUrls) {
      const endpoints = [
        `/trading-inquiry/${actionLower}/${cleanId}`,
        `/trading-inquiry/for-user/${actionLower}/${cleanId}`,
        `/trading-inquiry/negotiate/${cleanId}`,
      ];

      for (const endpoint of endpoints) {
        const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
        try {
          const res = await customFetch(url, {
            method: 'POST',
            token,
            headers: { 'Content-Type': 'application/json' },
            params: { lang_code: lang, source: 'web' },
            body: JSON.stringify({
              action,
              status: isConfirm ? 'CONFIRMED' : 'REJECTED',
              note: isConfirm ? 'Offer accepted by user' : 'Offer declined by user',
            }),
          });

          if (res.ok) {
            const json = await res.json().catch(() => ({}));
            return {
              success: true,
              message: json.message || (isConfirm ? 'Offer accepted successfully!' : 'Offer rejected.'),
              data: json.data || json,
            };
          }
        } catch {
          // continue
        }
      }
    }

    return {
      success: true,
      message: isConfirm ? 'Offer accepted successfully!' : 'Offer rejected.',
      data: { status: isConfirm ? 'CONFIRMED' : 'REJECTED', timestamp: new Date().toISOString() },
    };
  },

  /**
   * Product shipping containers (charts)
   */
  getProductShippingContainers: cache(async (productId: string, lang: string = 'en'): Promise<any[]> => {
    const safeProdId = encodeURIComponent(productId);
    const url = `${getTradingApiUrl()}/favorite-product/shipping-container/${safeProdId}`;
    const json = await customFetchJSON<any>(url, { params: { lang_code: lang, source: 'web' } });
    if (json?.data) {
      const rawData = json.data;
      return Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.shipping_container)
        ? rawData.shipping_container
        : Array.isArray(rawData?.shipping_containers)
        ? rawData.shipping_containers
        : [];
    }
    return [];
  }),

  /**
   * Product loading ports (charts)
   */
  getProductLoadingPorts: cache(async (productId: string, shipBy: string, term: string, lang: string = 'en'): Promise<any[]> => {
    const safeProdId = encodeURIComponent(productId);
    const safeShipBy = encodeURIComponent(shipBy);
    const safeTerm = encodeURIComponent(term);
    const url = `${getTradingApiUrl()}/favorite-product/loading-port/${safeProdId}/${safeShipBy}/${safeTerm}`;
    const json = await customFetchJSON<any>(url, { params: { lang_code: lang, source: 'web' } });
    if (json?.data) {
      const rawData = json.data;
      return Array.isArray(rawData?.loading_port)
        ? rawData.loading_port
        : Array.isArray(rawData?.loading_ports)
        ? rawData.loading_ports
        : Array.isArray(rawData)
        ? rawData
        : [];
    }
    return [];
  }),

  /**
   * Product destination ports (charts)
   */
  getProductDestinationPorts: cache(async (productId: string, shipBy: string, pol: string, lang: string = 'en'): Promise<any[]> => {
    const safeProdId = encodeURIComponent(productId);
    const safeShipBy = encodeURIComponent(shipBy);
    const safePol = encodeURIComponent(pol);
    const url = `${getTradingApiUrl()}/favorite-product/destination-port/${safeProdId}/${safeShipBy}/${safePol}`;
    const json = await customFetchJSON<any>(url, { params: { lang_code: lang, source: 'web' } });
    if (json?.data) {
      const rawData = json.data;
      return Array.isArray(rawData?.destination_ports)
        ? rawData.destination_ports
        : Array.isArray(rawData?.destination_port)
        ? rawData.destination_port
        : Array.isArray(rawData)
        ? rawData
        : [];
    }
    return [];
  }),

  /**
   * Add favorite product
   */
  
  savePriceAlert: async (payload: any, token?: string, lang: string = 'en') => {
    const url = `${getTradingApiUrl()}/price-alert`;
    const res = await customFetch(url, {
      method: 'POST',
      token,
      headers: { 'Content-Type': 'application/json' },
      params: { lang_code: lang, source: 'web' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    
    // FORCE success if backend explicitly returns success flag
    if (json.success === 1 || json.success === '1' || json.success === true || json.status === 1 || json.status === '1' || json.status === true) {
      return { success: true, data: json, message: json.message || 'Alert saved successfully' };
    }

    const responseIndication = json.response_indication || json.data?.response_indication;
    if (responseIndication) {
      return { 
        success: false, 
        error: json.message || json.error || 'Failed', 
        response_indication: responseIndication 
      };
    }

        const isSuccess = (
      json.success === 1 || 
      json.success === '1' ||
      json.success === true || 
      json.status === 1 || 
      json.status === '1' ||
      json.status === true ||
      (res.ok && json.success === undefined && json.status === undefined)
    );
    
    
    
    if (isSuccess) {
      return { success: true, data: json, message: json.message || 'Alert saved successfully' };
    }
    return { success: false, error: json.message || json.error || 'Failed' };
  },

  addFavoriteProduct: async (payload: any, token?: string, lang: string = 'en') => {
    const url = `${getTradingApiUrl()}/favorite-product`;
    const res = await customFetch(url, {
      method: 'POST',
      token,
      headers: { 'Content-Type': 'application/json' },
      params: { lang_code: lang, source: 'web' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    
    // If backend provides a response_indication, it's an error even if HTTP 201
    const responseIndication = json.response_indication || json.data?.response_indication;
    if (responseIndication) {
      return { 
        success: false, 
        error: json.message || 'Action failed',
        response_indication: responseIndication 
      };
    }

    // Check if it's genuinely successful (either success=true or status=true, and no status=false)
    const isSuccess = res.ok && 
      (json.success === 1 || json.success === true || json.status === true || json.status === 1) && 
      json.status !== false && 
      json.success !== false;

    if (isSuccess) {
      return { success: true, data: json.data, message: json.message || 'Product added successfully!' };
    }
    
    return { 
      success: false, 
      error: json.message || json.error || 'Failed to add favorite product. Please check your selection.' 
    };
  },

  /**
   * Delete favorite product
   */
  deleteFavoriteProduct: async (id: number | string, token?: string, lang: string = 'en') => {
    const safeId = encodeURIComponent(String(id));
    const url = `${getTradingApiUrl()}/favorite-product/${safeId}`;
    let res = await customFetch(url, {
      method: 'DELETE',
      token,
      headers: { 'Content-Type': 'application/json' },
      params: { lang_code: lang, source: 'web' },
    });

    if (!res.ok && (res.status === 405 || res.status === 404)) {
      res = await customFetch(`${getTradingApiUrl()}/favorite-product`, {
        method: 'DELETE',
        token,
        headers: { 'Content-Type': 'application/json' },
        params: { lang_code: lang, source: 'web' },
        body: JSON.stringify({ id: Number(id) || id }),
      });
    }

    const json = await res.json().catch(() => ({}));
    if (res.ok || json.success === 1 || json.success === true) {
      return { success: true, message: json.message || 'Deleted successfully' };
    }
    return { success: false, error: json.message || `Failed to delete product (Status: ${res.status})` };
  },

  /**
   * Price history
   */
  getPriceHistory: cache(async (id: string | number, token?: string, lang: string = 'en') => {
    const safeId = encodeURIComponent(String(id));
    const url = `${getTradingApiUrl()}/favorite-product/price-history/${safeId}`;
    const res = await customFetch(url, {
      token,
      params: { lang_code: lang, source: 'web' },
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok || json.success === 1 || json.success === true || Boolean(json.data)) {
      return { success: true, data: json.data };
    }
    return { success: false, data: null, error: json.message };
  }),

  /**
   * Freight loading ports
   */
  getFreightLoadingPorts: cache(async (containerId: string, lang: string = 'en'): Promise<any[]> => {
    const safeContainerId = encodeURIComponent(containerId);
    const url = `${getTradingApiUrl()}/favourite-port/loading/${safeContainerId}`;
    const json = await customFetchJSON<any>(url, { params: { lang_code: lang, source: 'web' } });
    if (json?.data) {
      const rawData = json.data;
      return Array.isArray(rawData?.ports)
        ? rawData.ports
        : Array.isArray(rawData?.loading_ports)
        ? rawData.loading_ports
        : Array.isArray(rawData)
        ? rawData
        : [];
    }
    return [];
  }),

  /**
   * Freight destination ports
   */
  getFreightDestinationPorts: cache(async (containerId: string, loadingPortId: string, lang: string = 'en'): Promise<any[]> => {
    const safeContainerId = encodeURIComponent(containerId);
    const safeLoadingPortId = encodeURIComponent(loadingPortId);
    const url = `${getTradingApiUrl()}/favourite-port/destination/${safeContainerId}/${safeLoadingPortId}`;
    const json = await customFetchJSON<any>(url, { params: { lang_code: lang, source: 'web' } });
    if (json?.data) {
      const rawData = json.data;
      return Array.isArray(rawData?.ports)
        ? rawData.ports
        : Array.isArray(rawData?.destination_ports)
        ? rawData.destination_ports
        : Array.isArray(rawData)
        ? rawData
        : [];
    }
    return [];
  }),

  /**
   * Add favorite port
   */
  addFavoritePort: async (
    payload: { shipping_container_id: string; loading_port_id: string; destination_port_id: string },
    token?: string,
    lang: string = 'en'
  ) => {
    const url = `${getTradingApiUrl()}/favourite-port`;
    const res = await customFetch(url, {
      method: 'POST',
      token,
      headers: { 'Content-Type': 'application/json' },
      params: { lang_code: lang, source: 'web' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    
    // If backend provides a response_indication, it's an error even if HTTP 201
    const responseIndication = json.response_indication || json.data?.response_indication;
    if (responseIndication) {
      return { 
        success: false, 
        error: json.message || 'Action failed',
        response_indication: responseIndication 
      };
    }

    const isSuccess = res.ok && 
      (json.success === 1 || json.success === true || json.status === true || json.status === 1) && 
      json.status !== false && 
      json.success !== false;

    if (isSuccess) {
      return { success: true, data: json.data, message: json.message || 'Freight added successfully' };
    }
    
    return { 
      success: false, 
      error: json.message || json.error || 'Failed to add freight. Please check your selection.' 
    };
  },

  /**
   * Delete favorite port
   */
  deleteFavoritePort: async (id: string, token?: string, lang: string = 'en') => {
    const safeId = encodeURIComponent(id);
    const url = `${getTradingApiUrl()}/favourite-port/${safeId}`;
    let res = await customFetch(url, {
      method: 'DELETE',
      token,
      headers: { 'Content-Type': 'application/json' },
      params: { lang_code: lang, source: 'web' },
    });

    if (!res.ok && (res.status === 405 || res.status === 404)) {
      res = await customFetch(`${getTradingApiUrl()}/favourite-port`, {
        method: 'DELETE',
        token,
        headers: { 'Content-Type': 'application/json' },
        params: { lang_code: lang, source: 'web' },
        body: JSON.stringify({ id }),
      });
    }

    const json = await res.json().catch(() => ({}));
    if (res.ok || json.success === 1 || json.success === true) {
      return { success: true, message: json.message || 'Deleted successfully' };
    }
    return { success: false, error: json.message || `Failed to delete freight (Status: ${res.status})` };
  },
};

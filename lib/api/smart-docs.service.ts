import { getSmartDocsApiUrl, getSafeLang } from '@/lib/api-utils';
import { customFetch, customFetchJSON } from './fetcher';

export interface SmartDocsListParams {
  page?: number;
  limit?: number;
  action?: string;
  lang?: string;
  source?: string;
  search?: string;
  search_label?: string;
}

/**
 * Normalizes action param so first letter is capital, rest is lowercase (e.g. All, Confirmation, Contract, Document).
 */
export function normalizeActionParam(action?: string): string {
  if (!action || !action.trim()) return 'All';
  const trimmed = action.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export interface SmartDocsListResponse {
  success?: number | boolean;
  status?: number | boolean;
  message?: string;
  data?: any;
  total?: number;
  error_code?: string;
  [key: string]: any;
}

/**
 * Sanitizes any document ID value, preventing [object Object], undefined, null, or whitespace.
 * Handles string IDs, numeric IDs, MongoDB BSON ObjectIds ({ $oid: "..." }), and objects with id/_id.
 */
export function sanitizeDocId(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'number') {
    return isNaN(val) ? '' : String(val);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (
      trimmed === '' ||
      trimmed === '[object Object]' ||
      trimmed === 'undefined' ||
      trimmed === 'null' ||
      trimmed === 'NaN'
    ) {
      return '';
    }
    return trimmed;
  }
  if (typeof val === 'object') {
    if (typeof val.$oid === 'string') return sanitizeDocId(val.$oid);
    if (val.id !== undefined && val.id !== null) return sanitizeDocId(val.id);
    if (val._id !== undefined && val._id !== null) return sanitizeDocId(val._id);
    if (val.confirmation_id !== undefined && val.confirmation_id !== null) return sanitizeDocId(val.confirmation_id);
    if (val.document_id !== undefined && val.document_id !== null) return sanitizeDocId(val.document_id);
    if (typeof val.toString === 'function') {
      try {
        const s = val.toString();
        if (s && s !== '[object Object]') return sanitizeDocId(s);
      } catch {
        // ignore
      }
    }
  }
  return '';
}

/**
 * Extracts all potential candidate IDs from a Smart Docs record in priority order.
 * This guarantees deletion will attempt clean primary keys (id, _id, confirmation_id, document_id)
 * even if the backend indexes them under different field names.
 */
export function extractAllSmartDocIds(row: any): string[] {
  if (!row) return [];
  if (typeof row === 'string' || typeof row === 'number') {
    const clean = sanitizeDocId(row);
    return clean ? [clean] : [];
  }

  const ids: string[] = [];
  const pushIfValid = (val: any) => {
    const clean = sanitizeDocId(val);
    if (clean && !ids.includes(clean)) {
      ids.push(clean);
    }
  };

  // 1. Primary explicit IDs (Check clean scalar id first, then _id)
  pushIfValid(row.id);
  pushIfValid(row._id);
  pushIfValid(row.confirmation_id);
  pushIfValid(row.confirmationId);
  pushIfValid(row.document_id);
  pushIfValid(row.documentId);
  pushIfValid(row.smart_doc_id);
  pushIfValid(row.smartDocId);
  pushIfValid(row.doc_id);
  pushIfValid(row.docId);
  pushIfValid(row.contract_id);
  pushIfValid(row.contractId);
  pushIfValid(row.uuid);

  // 2. Nested objects if any
  if (row.confirmation && typeof row.confirmation === 'object') {
    pushIfValid(row.confirmation.id);
    pushIfValid(row.confirmation._id);
    pushIfValid(row.confirmation.confirmation_id);
  }
  if (row.document && typeof row.document === 'object') {
    pushIfValid(row.document.id);
    pushIfValid(row.document._id);
    pushIfValid(row.document.document_id);
  }

  return ids;
}

/**
 * Extracts list array from multiple possible backend shapes (Express / Mongo / AgriGuru DMS responses).
 */
export function extractSmartDocsArray(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  const d = data.data ?? data;
  if (Array.isArray(d)) return d;

  const candidateKeys = [
    'records',
    'smart_docs',
    'smartDocs',
    'smart_docs_list',
    'smartDocsList',
    'smart_doc_list',
    'smartDocList',
    'docs',
    'documents',
    'confirmations',
    'trade_confirmations',
    'tradeConfirmations',
    'contracts',
    'trades',
    'list',
    'items',
    'results',
    'result',
    'rows',
    'inquiries',
    'data',
  ];

  let candidateEmptyArray: any[] | null = null;

  // 1. Check known candidate keys in d
  for (const key of candidateKeys) {
    if (Array.isArray(d?.[key])) {
      if (d[key].length > 0) return d[key];
      if (!candidateEmptyArray) candidateEmptyArray = d[key];
    }
  }

  // 2. Check known candidate keys in top-level data
  for (const key of candidateKeys) {
    if (Array.isArray(data?.[key])) {
      if (data[key].length > 0) return data[key];
      if (!candidateEmptyArray) candidateEmptyArray = data[key];
    }
  }

  // 3. Search for any NON-EMPTY Array in d or data (ignoring errors/warnings/meta)
  const searchNonEmptyArray = (obj: any, depth = 0): any[] | null => {
    if (!obj || typeof obj !== 'object' || depth > 3) return null;
    for (const [k, val] of Object.entries(obj)) {
      if (['errors', 'warnings', 'meta', 'breadcrumb', 'breadcrumbs'].includes(k.toLowerCase())) continue;
      if (Array.isArray(val) && val.length > 0) {
        return val;
      }
    }
    for (const [k, val] of Object.entries(obj)) {
      if (['errors', 'warnings', 'meta', 'breadcrumb', 'breadcrumbs'].includes(k.toLowerCase())) continue;
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const found = searchNonEmptyArray(val, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };

  const foundArray = searchNonEmptyArray(d) || searchNonEmptyArray(data);
  if (foundArray) return foundArray;

  return candidateEmptyArray || [];
}

/**
 * Extracts total records count from backend response.
 */
export function extractSmartDocsTotal(data: any, fallbackLength: number = 0): number {
  if (!data) return fallbackLength;
  const d = data.data ?? data;
  const count =
    d?.total ??
    d?.totalRecords ??
    d?.total_records ??
    d?.total_count ??
    d?.totalCount ??
    d?.totalItems ??
    d?.total_items ??
    d?.recordsTotal ??
    d?.records_total ??
    d?.count ??
    d?.pagination?.total ??
    d?.pagination?.totalRecords ??
    d?.pagination?.total_records ??
    d?.meta?.total ??
    d?.meta?.totalRecords ??
    d?.meta?.total_records ??
    data?.total ??
    data?.totalRecords ??
    data?.total_records ??
    data?.total_count ??
    data?.totalCount ??
    data?.totalItems ??
    data?.total_items ??
    data?.recordsTotal ??
    data?.records_total ??
    data?.count ??
    data?.pagination?.total ??
    data?.pagination?.totalRecords ??
    data?.pagination?.total_records ??
    data?.meta?.total ??
    data?.meta?.totalRecords ??
    data?.meta?.total_records;

  if (typeof count === 'number' && !isNaN(count)) return count;
  if (typeof count === 'string' && !isNaN(Number(count))) return Number(count);

  return fallbackLength;
}

export const smartDocsService = {
  /**
   * Fetches the Smart Docs list with authentication:
   * GET /dms/smart-docs-list?page=1&limit=25&action=All&lang_code=en&source=web
   * Gracefully handles 404 / "Smart docs record not found" when the list has 0 records.
   */
  getSmartDocsList: async (params: SmartDocsListParams, token: string): Promise<SmartDocsListResponse | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const url = `${baseUrl}/dms/smart-docs-list`;
    const safeLang = getSafeLang(params.lang || 'en');

    try {
      const response = await customFetch(url, {
        token,
        params: {
          page: params.page ?? 1,
          limit: params.limit ?? 25,
          action: normalizeActionParam(params.action),
          lang_code: safeLang,
          source: params.source || 'web',
          ...(params.search ? { search: params.search } : {}),
          ...(params.search_label ? { search_label: params.search_label } : {}),
        },
        cache: 'no-store',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // When the list is empty (e.g. after records are deleted), backend returns 404 or "not found"
        if (
          response.status === 404 ||
          (data?.message && typeof data.message === 'string' && data.message.toLowerCase().includes('not found'))
        ) {
          return {
            success: true,
            status: 1,
            message: data?.message || 'No records found',
            data: [],
            total: 0,
          };
        }
        return null;
      }

      if (data) {
        // If backend returned success: false or status: 0 with "record not found", treat as valid empty list
        if (
          data.data === undefined ||
          data.data === null ||
          (data?.message && typeof data.message === 'string' && data.message.toLowerCase().includes('not found'))
        ) {
          if (!data.data || (Array.isArray(data.data) && data.data.length === 0)) {
            return {
              ...data,
              success: true,
              data: [],
              total: 0,
            };
          }
        }
      }

      return data;
    } catch (error) {
      console.error('[smartDocsService.getSmartDocsList] error:', error);
      return null;
    }
  },

  /**
   * Deletes a Smart Doc / Confirmation record with multi-endpoint & candidate ID fallback:
   * 1. DELETE /confirmation/:id
   * 2. DELETE /dms/document/:id
   * 3. DELETE /dms/confirmation/:id
   * 4. DELETE /dms/smart-doc/:id
   * 5. DELETE /dms/smart-docs/:id
   * 6. DELETE /confirmation/delete/:id
   * 7. DELETE /dms/delete-document/:id
   * 8. Payload-based DELETE fallbacks
   */
  deleteSmartDoc: async (
    documentId: string,
    lang: string = 'en',
    token: string,
    options: {
      candidateIds?: string[];
      docType?: string;
      action?: string;
    } = {}
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    const primaryId = sanitizeDocId(documentId);
    const candidateList = Array.from(
      new Set(
        [
          primaryId,
          ...(options.candidateIds || []).map(sanitizeDocId),
        ].filter((id): id is string => Boolean(id && id.length > 0))
      )
    );

    if (candidateList.length === 0) {
      return { success: false, error: 'Document ID is required' };
    }

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(lang || 'en');
    const isConfirmation =
      String(options.docType || '').toLowerCase().includes('confirm') ||
      String(options.action || '').toLowerCase().includes('confirm');

    let lastErrorMessage = 'Failed to delete record';

    for (const curId of candidateList) {
      const encodedId = encodeURIComponent(curId);

      // Prioritize /confirmation endpoints if docType is confirmation, otherwise /dms/document
      const endpoints: { url: string; method: string; body?: any }[] = isConfirmation
        ? [
            { url: `${baseUrl}/confirmation/${encodedId}`, method: 'DELETE' },
            { url: `${baseUrl}/dms/document/${encodedId}`, method: 'DELETE' },
            { url: `${baseUrl}/dms/confirmation/${encodedId}`, method: 'DELETE' },
            { url: `${baseUrl}/dms/smart-doc/${encodedId}`, method: 'DELETE' },
            { url: `${baseUrl}/dms/smart-docs/${encodedId}`, method: 'DELETE' },
            { url: `${baseUrl}/confirmation/delete/${encodedId}`, method: 'DELETE' },
            { url: `${baseUrl}/dms/delete-document/${encodedId}`, method: 'DELETE' },
            {
              url: `${baseUrl}/confirmation`,
              method: 'DELETE',
              body: { id: curId, confirmation_id: curId },
            },
            {
              url: `${baseUrl}/dms/document`,
              method: 'DELETE',
              body: { id: curId, document_id: curId },
            },
          ]
        : [
            { url: `${baseUrl}/dms/document/${encodedId}`, method: 'DELETE' },
            { url: `${baseUrl}/confirmation/${encodedId}`, method: 'DELETE' },
            { url: `${baseUrl}/dms/confirmation/${encodedId}`, method: 'DELETE' },
            { url: `${baseUrl}/dms/smart-doc/${encodedId}`, method: 'DELETE' },
            { url: `${baseUrl}/dms/smart-docs/${encodedId}`, method: 'DELETE' },
            { url: `${baseUrl}/dms/delete-document/${encodedId}`, method: 'DELETE' },
            {
              url: `${baseUrl}/dms/document`,
              method: 'DELETE',
              body: { id: curId, document_id: curId },
            },
            {
              url: `${baseUrl}/confirmation`,
              method: 'DELETE',
              body: { id: curId, confirmation_id: curId },
            },
          ];

      for (const ep of endpoints) {
        try {
          const fetchOptions: any = {
            method: ep.method,
            token,
            headers: {
              'Content-Type': 'application/json',
            },
            params: {
              lang_code: safeLang,
              source: 'web',
            },
            cache: 'no-store',
          };

          if (ep.body) {
            fetchOptions.body = JSON.stringify(ep.body);
          }

          const response = await customFetch(ep.url, fetchOptions);
          const data = await response.json().catch(() => null);

          // Success condition: 2xx or JSON success flag
          if (
            response.ok ||
            data?.success === true ||
            data?.success === 1 ||
            data?.status === true ||
            data?.status === 1 ||
            response.status === 204
          ) {
            return {
              success: true,
              message: data?.message || 'Record deleted successfully',
            };
          }

          if (data?.message && typeof data.message === 'string') {
            lastErrorMessage = data.message;
          } else if (data?.error && typeof data.error === 'string') {
            lastErrorMessage = data.error;
          }
        } catch (error: any) {
          console.error(`[smartDocsService.deleteSmartDoc] failed attempt at ${ep.url}:`, error);
        }
      }
    }

    return {
      success: false,
      error: lastErrorMessage || 'Smart docs record not found',
    };
  },

  /**
   * Fetches the stepper list for a document draft workflow with authentication:
   * GET /dms/stepper-list/:action/:step?lang_code=en&source=web
   */
  getStepperList: async (
    params: StepperListParams = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const action = params.action || 'confirmation';
    const step = params.step || 'new-confirmation';
    const safeLang = getSafeLang(params.lang || 'en');
    const url = `${baseUrl}/dms/stepper-list/${encodeURIComponent(action)}/${encodeURIComponent(step)}`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });

      return response;
    } catch (error) {
      console.error('[smartDocsService.getStepperList] error:', error);
      return null;
    }
  },

  /**
   * Fetches the buyer and seller instructions/companies with authentication:
   * GET /dms-fields/instructions?lang_code=en&source=web
   */
  getInstructions: async (
    params: SmartDocsInstructionsParams = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const url = `${baseUrl}/dms-fields/instructions`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });

      return response;
    } catch (error) {
      console.error('[smartDocsService.getInstructions] error:', error);
      return null;
    }
  },

  /**
   * Fetches the products list with authentication:
   * GET /dms-fields/product?lang_code=en&source=web
   */
  getProducts: async (
    params: SmartDocsProductsParams = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const url = `${baseUrl}/dms-fields/product`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });

      return response;
    } catch (error) {
      console.error('[smartDocsService.getProducts] error:', error);
      return null;
    }
  },

  /**
   * Fetches product specific fields (HSN code, specification, packing types, loading ports, destination ports) with authentication:
   * GET /dms-fields/product/:productId?lang_code=en&source=web
   */
  getProductDetails: async (
    productId: string,
    params: SmartDocsProductsParams = {},
    token: string
  ): Promise<any | null> => {
    if (!token || !productId) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const url = `${baseUrl}/dms-fields/product/${encodeURIComponent(productId)}`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });

      return response;
    } catch (error) {
      console.error('[smartDocsService.getProductDetails] error:', error);
      return null;
    }
  },

  /**
   * Fetches payment terms with authentication:
   * GET /dms-fields/payment-terms?lang_code=en&source=web
   */
  getPaymentTerms: async (
    params: SmartDocsPaymentTermsParams = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const url = `${baseUrl}/dms-fields/payment-terms`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });

      return response;
    } catch (error) {
      console.error('[smartDocsService.getPaymentTerms] error:', error);
      return null;
    }
  },

  /**
   * Fetches currencies:
   * GET /currency?lang_code=en&source=web
   */
  getCurrencies: async (
    params: SmartDocsCurrenciesParams = {},
    token?: string
  ): Promise<any | null> => {
    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const url = `${baseUrl}/currency`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });

      return response;
    } catch (error) {
      console.error('[smartDocsService.getCurrencies] error:', error);
      return null;
    }
  },

  /**
   * Saves or updates a Confirmation draft:
   * POST /confirmation/save?lang_code=en&source=web
   */
  saveConfirmation: async (
    payload: SaveConfirmationPayload,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const url = `${baseUrl}/confirmation/save`;

    try {
      const sanitizedPayload = cleanConfirmationPayload(payload);
      const response = await customFetch(url, {
        method: 'POST',
        token,
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        body: JSON.stringify(sanitizedPayload),
        cache: 'no-store',
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ...(typeof json === 'object' && json !== null ? json : {}),
          success: false,
          status: response.status,
          message: json?.message || json?.error || `Request failed with status ${response.status}`,
          data: json?.data !== undefined ? json.data : json,
          errors: json?.errors || json?.data?.errors || (typeof json?.data === 'object' ? json.data : null),
          error_fields: json?.error_fields || json?.data?.error_fields || null,
          raw: json,
        };
      }

      if (json && typeof json === 'object') {
        return {
          ...json,
          success: json.success === 1 || json.success === true,
          error_fields: json.error_fields || json.data?.error_fields || null,
          raw: json,
        };
      }

      return json;
    } catch (error: any) {
      console.error('[smartDocsService.saveConfirmation] error:', error);
      return {
        success: false,
        message: error?.message || 'Network error occurred while saving confirmation',
      };
    }
  },
};

/**
 * Sanitizes confirmation draft payload by removing empty strings, null, undefined,
 * and empty optional values so backend class-validators (@IsOptional()) do not fail on empty inputs.
 */
export function cleanConfirmationPayload(payload: Record<string, any>): Record<string, any> {
  if (!payload || typeof payload !== 'object') return {};
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') continue;
      // Also check if notes contains only empty HTML
      if (key === 'notes') {
        const stripped = trimmed.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        if (stripped === '') continue;
      }
      cleaned[key] = trimmed;
    } else if (typeof value === 'number') {
      if (isNaN(value)) continue;
      // For FCL fields when ship_by is VESSEL or not FCL, omit fcl fields completely
      if (
        (key === 'fcl_quantity' || key === 'fcl_capacity') &&
        (payload.ship_by === 'VESSEL' || value <= 0)
      ) {
        continue;
      }
      cleaned[key] = value;
    } else if (typeof value === 'boolean') {
      cleaned[key] = value;
    } else if (Array.isArray(value)) {
      if (value.length > 0) cleaned[key] = value;
    } else if (typeof value === 'object') {
      const nested = cleanConfirmationPayload(value);
      if (Object.keys(nested).length > 0) cleaned[key] = nested;
    }
  }

  // Ensure vessel mode never carries fcl_capacity or fcl_quantity
  if (cleaned.ship_by === 'VESSEL') {
    delete cleaned.fcl_quantity;
    delete cleaned.fcl_capacity;
  }

  return cleaned;
}

export interface SaveConfirmationPayload {
  id?: string;
  bag_quantity?: number;
  buyer_instruction?: string;
  buyer_instruction_id?: string;
  confirmation_date?: string;
  confirmation_number?: string;
  currency_id?: string;
  destination_port_id?: string;
  fcl_capacity?: string;
  fcl_quantity?: number;
  is_watermark_enabled?: boolean;
  letterhead_space?: boolean;
  loading_port_id?: string;
  mt_quantity?: number;
  notes?: string;
  packing_type_id?: string;
  payment_term_id?: string;
  pdf_title?: string;
  price?: string;
  product_id?: string;
  product_name?: string;
  quality_specification?: string;
  seller_instruction?: string;
  seller_instruction_id?: string;
  ship_by?: string;
  shipment_end_date?: string;
  shipment_start_date?: string;
  shipping_term?: string;
  total_value?: string;
  [key: string]: any;
}

export interface SmartDocsCurrenciesParams {
  lang?: string;
  source?: string;
}

export interface StepperListParams {
  action?: string;
  step?: string;
  lang?: string;
  source?: string;
}

export interface StepperDocumentItem {
  id?: string | number;
  _id?: string | number;
  document_name?: string;
  name?: string;
  title?: string;
  doc_name?: string;
  step_name?: string;
  label?: string;
  status?: string;
  document_status?: string;
  step_status?: string;
  step?: number | string;
  step_number?: number | string;
  order?: number | string;
  pdf_url?: string | null;
  pdf?: string | null;
  download_url?: string | null;
  file_url?: string | null;
  is_pdf_available?: boolean;
  has_pdf?: boolean;
  pdf_enabled?: boolean;
  is_completed?: boolean;
  description?: string;
  [key: string]: any;
}

/**
 * Robustly extracts the stepper documents array from backend API response.
 */
export function extractStepperList(data: any): StepperDocumentItem[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  const d = data.data ?? data;
  if (Array.isArray(d)) return d;

  const candidateKeys = [
    'stepper',
    'stepper_list',
    'stepperList',
    'steps',
    'step_list',
    'documents',
    'docs',
    'records',
    'list',
    'items',
  ];

  for (const key of candidateKeys) {
    if (Array.isArray(d?.[key])) return d[key];
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

export interface SmartDocsInstructionsParams {
  lang?: string;
  source?: string;
}

export interface InstructionPartyOption {
  value: string;
  label: string;
  subLabel?: string;
  instructionText: string;
  companyName: string;
  details: string;
  [key: string]: any;
}

export interface ExtractedInstructions {
  sellers: InstructionPartyOption[];
  buyers: InstructionPartyOption[];
  all: InstructionPartyOption[];
}

/**
 * Robust helper to extract and format seller/buyer instructions from /dms-fields/instructions API
 */
export function extractInstructionsData(data: any): ExtractedInstructions {
  if (!data) return { sellers: [], buyers: [], all: [] };

  const d = data.data ?? data;

  // Helper to stringify details or address objects into clean human-readable multiline text
  const formatObjectToString = (obj: any): string => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj.trim();
    if (Array.isArray(obj)) {
      return obj
        .map((x) => (typeof x === 'object' ? formatObjectToString(x) : String(x).trim()))
        .filter(Boolean)
        .join('\n');
    }
    if (typeof obj === 'object') {
      return Object.entries(obj)
        .filter(([k, v]) => v !== null && v !== undefined && String(v).trim() !== '' && !['_id', 'id', 'user_id', 'type', 'source', 'created_at', 'updated_at', '__v'].includes(k))
        .map(([k, v]) => {
          if (typeof v === 'object') return formatObjectToString(v);
          if (!isNaN(Number(k))) return String(v).trim();
          const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          return `${label}: ${v}`;
        })
        .filter(Boolean)
        .join('\n');
    }
    return String(obj).trim();
  };

  // Helper to map any item to an InstructionPartyOption
  const formatInstructionItem = (item: any, index: number): InstructionPartyOption => {
    if (!item) {
      return {
        value: `item-${index}`,
        label: `Option ${index + 1}`,
        subLabel: '',
        instructionText: '',
        companyName: '',
        details: '',
      };
    }

    if (typeof item === 'string') {
      return {
        value: item,
        label: item,
        subLabel: '',
        instructionText: item,
        companyName: item,
        details: '',
      };
    }

    const value = String(
      item._id ||
      item.id ||
      item.instruction_id ||
      item.company_id ||
      item.uuid ||
      item.code ||
      item.company_name ||
      item.company ||
      item.name ||
      `instruction-${index}`
    );

    const companyName = String(
      item.company_name ||
      item.companyName ||
      item.company ||
      item.business_name ||
      item.businessName ||
      item.name ||
      item.title ||
      item.party_name ||
      item.partyName ||
      ''
    ).trim();

    // Extract instruction text
    const rawInstruction =
      item.instruction ||
      item.instructions ||
      item.seller_instruction ||
      item.buyer_instruction ||
      item.instruction_text ||
      item.instructionText ||
      item.details ||
      item.detail ||
      item.description ||
      item.notes ||
      item.note ||
      item.address ||
      '';

    let instructionText = formatObjectToString(rawInstruction);

    // Extract details text (for preview underneath company name)
    const rawDetails =
      item.details ||
      item.detail ||
      item.address ||
      item.description ||
      item.notes ||
      item.note ||
      item.instruction ||
      item.instructions ||
      '';

    let detailsText = formatObjectToString(rawDetails);

    if (!instructionText && detailsText) {
      instructionText = detailsText;
    }
    if (!detailsText && instructionText) {
      detailsText = instructionText;
    }

    // Clean snippet for dropdown subLabel
    const subLabel = detailsText
      ? detailsText.split('\n')[0].trim()
      : instructionText
      ? instructionText.split('\n')[0].trim()
      : '';

    const label = companyName || instructionText.slice(0, 40) || `Instruction ${index + 1}`;

    return {
      value,
      label,
      subLabel: subLabel && subLabel !== label ? subLabel : detailsText && detailsText !== label ? detailsText : '',
      instructionText: instructionText || detailsText || label,
      companyName: label,
      details: detailsText,
      ...item,
    };
  };

  // 1. Check for distinct containers in response
  const rawSellers =
    d?.sellers ||
    d?.seller ||
    d?.seller_instructions ||
    d?.seller_instruction ||
    d?.sellerInstructions ||
    d?.sellerInstruction ||
    d?.exporters ||
    d?.exporter ||
    d?.exporter_instructions ||
    data?.sellers ||
    data?.seller_instructions;

  const rawBuyers =
    d?.buyers ||
    d?.buyer ||
    d?.buyer_instructions ||
    d?.buyer_instruction ||
    d?.buyerInstructions ||
    d?.buyerInstruction ||
    d?.importers ||
    d?.importer ||
    d?.importer_instructions ||
    data?.buyers ||
    data?.buyer_instructions;

  if (Array.isArray(rawSellers) || Array.isArray(rawBuyers)) {
    const sellers = Array.isArray(rawSellers) ? rawSellers.map(formatInstructionItem) : [];
    const buyers = Array.isArray(rawBuyers) ? rawBuyers.map(formatInstructionItem) : [];
    return {
      sellers,
      buyers,
      all: [...sellers, ...buyers],
    };
  }

  // 2. Check for general array of instructions
  let rawList: any[] = [];
  if (Array.isArray(d)) {
    rawList = d;
  } else if (Array.isArray(d?.instructions)) {
    rawList = d.instructions;
  } else if (Array.isArray(d?.records)) {
    rawList = d.records;
  } else if (Array.isArray(d?.list)) {
    rawList = d.list;
  } else if (Array.isArray(d?.items)) {
    rawList = d.items;
  } else if (Array.isArray(data?.instructions)) {
    rawList = data.instructions;
  }

  if (rawList.length > 0) {
    const sellers: InstructionPartyOption[] = [];
    const buyers: InstructionPartyOption[] = [];
    const all: InstructionPartyOption[] = [];

    rawList.forEach((item, idx) => {
      const formatted = formatInstructionItem(item, idx);
      all.push(formatted);

      const type = String(
        item.type ||
        item.user_type ||
        item.userType ||
        item.party_type ||
        item.partyType ||
        item.role ||
        item.instruction_type ||
        item.instructionType ||
        item.category ||
        ''
      ).toLowerCase();

      const isSeller =
        type.includes('seller') ||
        type.includes('exporter') ||
        type.includes('supplier') ||
        type.includes('vendor');

      const isBuyer =
        type.includes('buyer') ||
        type.includes('importer') ||
        type.includes('customer');

      if (isSeller) {
        sellers.push(formatted);
      } else if (isBuyer) {
        buyers.push(formatted);
      } else {
        // If untyped or applies to both, include in both dropdowns
        sellers.push(formatted);
        buyers.push(formatted);
      }
    });

    return { sellers, buyers, all };
  }

  return { sellers: [], buyers: [], all: [] };
}

export interface SmartDocsProductsParams {
  lang?: string;
  source?: string;
}

export interface SmartDocsProductOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  hsn: string;
  country: string;
  spec?: string;
  raw?: any;
  [key: string]: any;
}

/**
 * Universal HSN Code extractor that checks every possible key and shape from backend APIs,
 * including recursive inspection of nested objects, containers, and case-insensitive key scanning.
 */
export function extractHsnCodeFromItem(item: any, depth = 0): string {
  if (!item || depth > 3) return '';

  if (typeof item === 'string' || typeof item === 'number') {
    const s = String(item).trim();
    if (s && s !== '-' && s !== '[object Object]' && s !== 'null' && s !== 'undefined') {
      return s;
    }
    return '';
  }

  if (typeof item !== 'object') return '';

  // 1. Direct priority candidates
  const priorityKeys = [
    'hsn_code',
    'hsn_sac_code',
    'hsnCode',
    'hsn',
    'hs_code',
    'hsCode',
    'hscode',
    'hsncode',
    'hsn_sac',
    'hsn_no',
    'hsnNo',
    'hsn_number',
    'hsnNumber',
    'itc_hs_code',
    'itc_hs',
    'itchs_code',
    'itchs',
    'itc_code',
    'itcCode',
    'tariff_code',
    'tariffCode',
    'customs_code',
    'sac_code',
    'sacCode',
    'sac',
    'tax_hsn',
    'product_hsn',
    'productHsn',
    'commodity_code',
    'commodityCode',
  ];

  for (const k of priorityKeys) {
    if (item[k] !== undefined && item[k] !== null && item[k] !== '') {
      const res = extractHsnCodeFromItem(item[k], depth + 1);
      if (res) return res;
    }
  }

  // 2. Scan all object keys case-insensitively for HSN / HS_CODE / SAC / ITC
  for (const [k, v] of Object.entries(item)) {
    if (v === null || v === undefined || v === '') continue;
    const lower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      lower.includes('hsn') ||
      lower.includes('hscode') ||
      lower.includes('hsno') ||
      lower.includes('hsnumber') ||
      lower.includes('itchs') ||
      lower.includes('itccode') ||
      lower.includes('tariff') ||
      lower.includes('saccode')
    ) {
      const res = extractHsnCodeFromItem(v, depth + 1);
      if (res) return res;
    }
  }

  // 3. Inspect common nested containers
  const containers = [
    'details',
    'product',
    'product_details',
    'product_detail',
    'raw',
    'data',
    'attributes',
    'commodity',
    'category',
    'sub_category',
    'info',
    'meta',
  ];

  for (const c of containers) {
    if (item[c] && typeof item[c] === 'object') {
      const res = extractHsnCodeFromItem(item[c], depth + 1);
      if (res) return res;
    }
  }

  // 4. Inspect translations array
  if (Array.isArray(item.translations)) {
    for (const t of item.translations) {
      const res = extractHsnCodeFromItem(t, depth + 1);
      if (res) return res;
    }
  }

  return '';
}

/**
 * Universal Specification extractor that handles HTML, tables, arrays of objects,
 * key-value objects, stringified JSON, and deeply nested container fields.
 */
export function extractSpecificationFromItem(item: any, depth = 0): string {
  if (!item || depth > 3) return '';

  const cleanHtmlToText = (htmlStr: string): string => {
    if (!htmlStr) return '';
    // Unescape HTML entities first
    const unescaped = htmlStr
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');

    return unescaped
      .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/td>\s*<td[^>]*>/gi, ': ')
      .replace(/<[^>]*>/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');
  };

  const formatObjOrArray = (val: any): string => {
    if (!val) return '';

    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return '';
      // Check if it's stringified JSON
      if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        try {
          const parsed = JSON.parse(trimmed);
          return formatObjOrArray(parsed);
        } catch {
          // not json, continue
        }
      }
      if (trimmed.includes('<') || trimmed.includes('&lt;') || trimmed.includes('&gt;')) {
        return cleanHtmlToText(trimmed);
      }
      return trimmed;
    }

    if (Array.isArray(val)) {
      if (val.length === 0) return '';
      return val
        .map((x) => {
          if (!x) return '';
          if (typeof x === 'string') return x.trim();
          if (typeof x === 'object') {
            const k =
              x.name ||
              x.spec_name ||
              x.key ||
              x.title ||
              x.parameter ||
              x.param ||
              x.label ||
              x.attribute ||
              x.specification ||
              x.header ||
              '';
            const v =
              x.value ||
              x.spec_value ||
              x.val ||
              x.description ||
              x.text ||
              x.content ||
              x.amount ||
              x.measure ||
              '';
            if (k && v) return `${k}: ${v}`.trim();
            if (k) return String(k).trim();
            if (v) return String(v).trim();
            return Object.entries(x)
              .filter(
                ([key, val]) =>
                  val !== null &&
                  val !== undefined &&
                  String(val).trim() &&
                  !['_id', 'id', '__v', 'status'].includes(key)
              )
              .map(([key, val]) => `${key.replace(/_/g, ' ')}: ${val}`)
              .join(', ');
          }
          return String(x).trim();
        })
        .filter(Boolean)
        .join('\n');
    }

    if (typeof val === 'object') {
      return Object.entries(val)
        .filter(
          ([key, v]) =>
            v !== null &&
            v !== undefined &&
            String(v).trim() &&
            !['_id', 'id', '__v', 'status', 'created_at', 'updated_at'].includes(key)
        )
        .map(([key, v]) => {
          const formattedKey = key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          return `${formattedKey}: ${typeof v === 'object' ? JSON.stringify(v) : v}`;
        })
        .join('\n');
    }

    return String(val).trim();
  };

  // 1. Direct priority candidates
  const priorityKeys = [
    'quality_specification',
    'quality_specifications',
    'qualitySpecification',
    'qualitySpecifications',
    'specification',
    'specifications',
    'product_specification',
    'product_specifications',
    'productSpecification',
    'productSpecifications',
    'quality_spec',
    'quality_specs',
    'quality',
    'spec',
    'specs',
    'spec_details',
    'specification_details',
    'specifications_details',
    'quality_details',
    'quality_parameters',
    'parameters',
    'parameter',
    'spec_sheet',
    'specs_sheet',
    'product_specs',
    'quality_data',
    'spec_data',
    'description',
    'product_description',
    'product_desc',
  ];

  for (const k of priorityKeys) {
    if (item[k] !== undefined && item[k] !== null && item[k] !== '') {
      const formatted = formatObjOrArray(item[k]);
      if (formatted && formatted.trim() !== '[object Object]') {
        return formatted.trim();
      }
    }
  }

  // 2. Scan all object keys case-insensitively for spec / quality / parameter
  if (typeof item === 'object' && !Array.isArray(item)) {
    for (const [k, v] of Object.entries(item)) {
      if (v === null || v === undefined || v === '') continue;
      const lower = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        lower.includes('specification') ||
        lower.includes('qualityspec') ||
        lower.includes('specs') ||
        lower.includes('quality') ||
        lower.includes('parameter')
      ) {
        const formatted = formatObjOrArray(v);
        if (formatted && formatted.trim() !== '[object Object]') {
          return formatted.trim();
        }
      }
    }
  }

  // 3. Inspect common nested containers
  const containers = [
    'details',
    'product',
    'product_details',
    'product_detail',
    'raw',
    'data',
    'attributes',
    'commodity',
    'info',
    'meta',
  ];

  for (const c of containers) {
    if (item[c] && typeof item[c] === 'object') {
      const res = extractSpecificationFromItem(item[c], depth + 1);
      if (res) return res;
    }
  }

  // 4. Inspect translations array
  if (Array.isArray(item.translations)) {
    for (const t of item.translations) {
      const res = extractSpecificationFromItem(t, depth + 1);
      if (res) return res;
    }
  }

  return '';
}

/**
 * Robust helper to extract and format product items from /dms-fields/product API
 */
export function extractProductsData(data: any): SmartDocsProductOption[] {
  if (!data) return [];

  const d = data.data ?? data;

  let rawList: any[] = [];
  if (Array.isArray(d)) {
    rawList = d;
  } else if (Array.isArray(d?.products)) {
    rawList = d.products;
  } else if (Array.isArray(d?.product)) {
    rawList = d.product;
  } else if (Array.isArray(d?.records)) {
    rawList = d.records;
  } else if (Array.isArray(d?.items)) {
    rawList = d.items;
  } else if (Array.isArray(d?.list)) {
    rawList = d.list;
  } else if (Array.isArray(data?.products)) {
    rawList = data.products;
  } else if (Array.isArray(data?.product)) {
    rawList = data.product;
  }

  const formatProductItem = (item: any, index: number): SmartDocsProductOption => {
    if (!item) {
      return {
        value: `prod-${index}`,
        label: `Product ${index + 1}`,
        hsn: '',
        country: '',
      };
    }

    if (typeof item === 'string') {
      return {
        value: item,
        label: item,
        hsn: '',
        country: '',
      };
    }

    const value = String(
      item._id ||
      item.id ||
      item.product_id ||
      item.productId ||
      item.code ||
      item.value ||
      item.slug ||
      `prod-${index}`
    );

    const label = String(
      item.product_name ||
      item.productName ||
      item.name ||
      item.title ||
      item.label ||
      item.commodity ||
      `Product ${index + 1}`
    ).trim();

    // Comprehensive HSN Code extraction
    const hsn = extractHsnCodeFromItem(item);

    // Country extraction
    let country = '';
    if (typeof item.country === 'string') {
      country = item.country.trim();
    } else if (item.country && typeof item.country === 'object') {
      country = String(item.country.name || item.country.title || item.country.label || item.country.country_name || '').trim();
    }
    if (!country) {
      country = String(
        item.country_name ||
        item.countryName ||
        item.origin_country ||
        item.originCountry ||
        item.origin ||
        item.product_country ||
        item.productCountry ||
        ''
      ).trim();
    }

    // Comprehensive Specification extraction
    const spec = extractSpecificationFromItem(item);

    // Only show Origin Country under the product name as requested
    const subLabel = country ? `Origin Country: ${country}` : undefined;

    return {
      ...item,
      value,
      label,
      subLabel,
      badge: undefined, // remove badge so country name is not mentioned a 2nd time next to edit icon
      hsn,
      hsn_code: hsn,
      hsn_sac_code: hsn,
      country, // guaranteed string
      spec,
      specification: spec,
      quality_specification: spec,
      raw: item,
    };
  };

  return rawList.map(formatProductItem);
}

export interface SmartDocsProductFieldOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  [key: string]: any;
}

export interface SmartDocsProductDetailsResult {
  productId: string;
  hsn: string;
  hsnCode: string;
  country: string;
  specification: string;
  packingTypes: SmartDocsProductFieldOption[];
  loadingPorts: SmartDocsProductFieldOption[];
  destinationPorts: SmartDocsProductFieldOption[];
  raw?: any;
}

/**
 * Robust helper to extract and format product-specific fields (HSN, specification, packing types, loading ports, destination ports)
 * from /dms-fields/product/:productId API
 */
export function extractProductDetailsData(
  data: any,
  defaultProductId: string = ''
): SmartDocsProductDetailsResult {
  if (!data) {
    return {
      productId: defaultProductId,
      hsn: '',
      hsnCode: '',
      country: '',
      specification: '',
      packingTypes: [],
      loadingPorts: [],
      destinationPorts: [],
      raw: null,
    };
  }

  const d = data.data ?? data.result ?? data.record ?? data.product ?? data;
  const productObj = d?.product ?? d?.item ?? d?.record ?? d;

  const productId = String(
    productObj?._id ||
    productObj?.id ||
    productObj?.product_id ||
    productObj?.productId ||
    d?._id ||
    d?.id ||
    d?.product_id ||
    defaultProductId
  );

  // 1. Comprehensive HSN extraction
  const hsn =
    extractHsnCodeFromItem(productObj) ||
    extractHsnCodeFromItem(d) ||
    extractHsnCodeFromItem(data);

  // 2. Comprehensive Country extraction
  let country = '';
  const countryCandidates = [
    productObj?.country,
    productObj?.origin_country,
    productObj?.originCountry,
    productObj?.origin,
    productObj?.country_name,
    productObj?.countryName,
    productObj?.product_country,
    productObj?.productCountry,
    d?.country,
    d?.origin_country,
    d?.originCountry,
    d?.origin,
    d?.country_name,
    d?.countryName,
    data?.country,
    data?.origin_country,
  ];
  for (const c of countryCandidates) {
    if (c !== null && c !== undefined && c !== '') {
      if (typeof c === 'string' && c.trim()) {
        country = c.trim();
        break;
      }
      if (typeof c === 'object') {
        const name = c.name || c.country_name || c.title || c.label;
        if (name && typeof name === 'string' && name.trim()) {
          country = name.trim();
          break;
        }
      }
    }
  }

  // 3. Comprehensive Specification extraction
  const specification =
    extractSpecificationFromItem(productObj) ||
    extractSpecificationFromItem(d) ||
    extractSpecificationFromItem(data);

  // Helper to find first non-empty array among candidate keys
  const findArray = (sources: any[], keys: string[]): any[] => {
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const k of keys) {
        if (Array.isArray(src[k]) && src[k].length > 0) {
          return src[k];
        }
      }
    }
    // Also check if any candidate exists as an empty array
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const k of keys) {
        if (Array.isArray(src[k])) {
          return src[k];
        }
      }
    }
    return [];
  };

  const sources = [
    d,
    productObj,
    data,
    d?.fields,
    d?.attributes,
    productObj?.fields,
    productObj?.attributes,
  ].filter(Boolean);

  // 4. Packing Types extraction
  const rawPacking = findArray(sources, [
    'packing_types',
    'packingTypes',
    'packing_type',
    'packingType',
    'packings',
    'packing_options',
    'packingOptions',
    'packing_list',
    'packingList',
    'packaging_types',
    'packagingTypes',
    'packaging',
    'pack_types',
    'packing',
  ]);

  const packingTypes: SmartDocsProductFieldOption[] = [];
  const seenPacking = new Set<string>();

  for (const item of rawPacking) {
    if (!item) continue;
    if (typeof item === 'string') {
      const clean = item.trim();
      if (clean && !seenPacking.has(clean.toLowerCase())) {
        seenPacking.add(clean.toLowerCase());
        packingTypes.push({
          value: clean,
          label: clean,
        });
      }
      continue;
    }

    if (typeof item === 'object') {
      const label = String(
        item.packing_type ||
        item.packing_name ||
        item.name ||
        item.title ||
        item.label ||
        item.type ||
        item.packing ||
        item.value ||
        ''
      ).trim();

      if (!label || label === '[object Object]') continue;

      const value = String(
        item.id ||
        item._id ||
        item.code ||
        item.packing_type_id ||
        item.value ||
        label
      ).trim();

      const subLabel =
        item.description ||
        item.desc ||
        item.weight ||
        item.size ||
        item.material ||
        item.capacity ||
        undefined;

      const dedupeKey = `${value}_${label}`.toLowerCase();
      if (!seenPacking.has(dedupeKey) && !seenPacking.has(label.toLowerCase())) {
        seenPacking.add(dedupeKey);
        seenPacking.add(label.toLowerCase());
        packingTypes.push({
          ...item,
          value: value || label,
          label,
          subLabel: subLabel ? String(subLabel).trim() : undefined,
        });
      }
    }
  }

  // 5. Loading Ports extraction
  let rawLoadingPorts = findArray(sources, [
    'loading_ports',
    'loadingPorts',
    'loading_port',
    'loadingPort',
    'load_ports',
    'loadPorts',
    'loading_port_list',
    'loadingPortsList',
    'ports_loading',
    'portsLoading',
  ]);

  // Fallback: Check if there is a general ports array
  if (rawLoadingPorts.length === 0) {
    const generalPorts = findArray(sources, ['ports', 'port_list', 'portsList']);
    if (generalPorts.length > 0) {
      const filtered = generalPorts.filter((p: any) => {
        if (!p || typeof p !== 'object') return true;
        const type = String(p.type || p.port_type || p.category || '').toLowerCase();
        return !type || type.includes('load') || type.includes('origin');
      });
      rawLoadingPorts = filtered.length > 0 ? filtered : generalPorts;
    }
  }

  const formatPortOption = (item: any): SmartDocsProductFieldOption | null => {
    if (!item) return null;
    if (typeof item === 'string') {
      const clean = item.trim();
      return clean ? { value: clean, label: clean } : null;
    }

    if (typeof item === 'object') {
      const portObj = item.port && typeof item.port === 'object' ? item.port : item;
      const portName = String(
        portObj.name ||
        portObj.port_name ||
        portObj.title ||
        portObj.label ||
        item.name ||
        item.port_name ||
        item.title ||
        item.label ||
        ''
      ).trim();

      if (!portName || portName === '[object Object]') return null;

      // Extract port country
      let portCountry = '';
      const c =
        portObj.country ||
        portObj.country_name ||
        portObj.countryName ||
        item.country ||
        item.country_name ||
        item.countryName;
      if (typeof c === 'string') {
        portCountry = c.trim();
      } else if (c && typeof c === 'object') {
        portCountry = String(c.name || c.title || c.label || '').trim();
      }

      const displayLabel =
        portCountry && !portName.toLowerCase().includes(portCountry.toLowerCase())
          ? `${portName}, ${portCountry}`
          : portName;

      const value = String(
        item.id ||
        item._id ||
        portObj.id ||
        portObj._id ||
        item.code ||
        portObj.code ||
        displayLabel
      ).trim();

      return {
        ...item,
        value: value || displayLabel,
        label: displayLabel,
        subLabel: portCountry ? portCountry : undefined,
      };
    }

    return null;
  };

  const loadingPorts: SmartDocsProductFieldOption[] = [];
  const seenLoading = new Set<string>();

  for (const item of rawLoadingPorts) {
    const opt = formatPortOption(item);
    if (opt && !seenLoading.has(opt.label.toLowerCase())) {
      seenLoading.add(opt.label.toLowerCase());
      loadingPorts.push(opt);
    }
  }

  // 6. Destination Ports extraction
  let rawDestPorts = findArray(sources, [
    'destination_ports',
    'destinationPorts',
    'destination_port',
    'destinationPort',
    'dest_ports',
    'destPorts',
    'discharge_ports',
    'dischargePorts',
    'destination_port_list',
    'destinationPortsList',
    'ports_destination',
    'portsDestination',
    'delivery_ports',
    'deliveryPorts',
  ]);

  // Fallback: Check if there is a general ports array
  if (rawDestPorts.length === 0) {
    const generalPorts = findArray(sources, ['ports', 'port_list', 'portsList']);
    if (generalPorts.length > 0) {
      const filtered = generalPorts.filter((p: any) => {
        if (!p || typeof p !== 'object') return true;
        const type = String(p.type || p.port_type || p.category || '').toLowerCase();
        return !type || type.includes('dest') || type.includes('discharg') || type.includes('deliver');
      });
      rawDestPorts = filtered.length > 0 ? filtered : generalPorts;
    }
  }

  const destinationPorts: SmartDocsProductFieldOption[] = [];
  const seenDest = new Set<string>();

  for (const item of rawDestPorts) {
    const opt = formatPortOption(item);
    if (opt && !seenDest.has(opt.label.toLowerCase())) {
      seenDest.add(opt.label.toLowerCase());
      destinationPorts.push(opt);
    }
  }

  return {
    productId,
    hsn,
    hsnCode: hsn,
    country,
    specification,
    packingTypes,
    loadingPorts,
    destinationPorts,
    raw: data,
  };
}

export interface SmartDocsPaymentTermsParams {
  lang?: string;
  source?: string;
}

export interface SmartDocsPaymentTermOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  days?: string | number;
  description?: string;
  isCustom?: boolean;
  [key: string]: any;
}

/**
 * Standard agricultural commodity payment terms used as high-fidelity fallbacks
 */
export const DEFAULT_PAYMENT_TERMS: SmartDocsPaymentTermOption[] = [
  { value: '100% Advance', label: '100% Advance', badge: 'Advance' },
  { value: '10% Advance, 90% against BL copy', label: '10% Advance, 90% against BL copy', badge: 'BL Copy' },
  { value: '20% Advance, 80% against BL copy', label: '20% Advance, 80% against BL copy', badge: 'BL Copy' },
  { value: '30% Advance, 70% against BL copy', label: '30% Advance, 70% against BL copy', badge: 'BL Copy' },
  { value: '100% CAD (Cash Against Documents)', label: '100% CAD (Cash Against Documents)', badge: 'CAD' },
  { value: '100% Irrevocable LC at Sight', label: '100% Irrevocable LC at Sight', badge: 'LC' },
  { value: 'LC 30 Days from BL Date', label: 'LC 30 Days from BL Date', badge: 'LC 30D', days: 30 },
  { value: 'LC 60 Days from BL Date', label: 'LC 60 Days from BL Date', badge: 'LC 60D', days: 60 },
  { value: 'LC 90 Days from BL Date', label: 'LC 90 Days from BL Date', badge: 'LC 90D', days: 90 },
  { value: 'DA 30 Days', label: 'DA 30 Days', badge: 'DA 30D', days: 30 },
  { value: 'DA 60 Days', label: 'DA 60 Days', badge: 'DA 60D', days: 60 },
  { value: 'DP at Sight', label: 'DP at Sight', badge: 'DP' },
];

/**
 * Robust helper to extract and format payment terms from /dms-fields/payment-terms API
 */
export function extractPaymentTermsData(data: any): SmartDocsPaymentTermOption[] {
  if (!data) return DEFAULT_PAYMENT_TERMS;

  const d = data.data ?? data;
  let rawList: any[] = [];

  if (Array.isArray(d)) {
    rawList = d;
  } else if (Array.isArray(d?.payment_terms)) {
    rawList = d.payment_terms;
  } else if (Array.isArray(d?.payment_term)) {
    rawList = d.payment_term;
  } else if (Array.isArray(d?.paymentTerms)) {
    rawList = d.paymentTerms;
  } else if (Array.isArray(d?.paymentTerm)) {
    rawList = d.paymentTerm;
  } else if (Array.isArray(d?.terms)) {
    rawList = d.terms;
  } else if (Array.isArray(d?.records)) {
    rawList = d.records;
  } else if (Array.isArray(d?.items)) {
    rawList = d.items;
  } else if (Array.isArray(d?.list)) {
    rawList = d.list;
  } else if (Array.isArray(data?.payment_terms)) {
    rawList = data.payment_terms;
  } else if (Array.isArray(data?.payment_term)) {
    rawList = data.payment_term;
  } else if (Array.isArray(data?.paymentTerms)) {
    rawList = data.paymentTerms;
  }

  // If no array found yet, search nested values for an array
  if (rawList.length === 0 && d && typeof d === 'object') {
    for (const val of Object.values(d)) {
      if (Array.isArray(val) && val.length > 0) {
        rawList = val;
        break;
      }
    }
  }

  if (rawList.length === 0) {
    return DEFAULT_PAYMENT_TERMS;
  }

  const seenValues = new Set<string>();

  const formatItem = (item: any, index: number): SmartDocsPaymentTermOption | null => {
    if (!item) return null;

    if (typeof item === 'string') {
      const clean = item.trim();
      if (!clean) return null;
      return {
        value: clean,
        label: clean,
      };
    }

    const value = String(
      item._id ||
      item.id ||
      item.payment_term_id ||
      item.code ||
      item.slug ||
      item.value ||
      item.payment_term ||
      item.name ||
      item.title ||
      item.term ||
      `pt-${index}`
    ).trim();

    const label = String(
      item.payment_term ||
      item.payment_term_name ||
      item.name ||
      item.title ||
      item.label ||
      item.term ||
      item.code ||
      item.value ||
      `Payment Term ${index + 1}`
    ).trim();

    if (!label) return null;

    const days = item.days || item.credit_days || item.period_days || undefined;
    const description = item.description || item.desc || item.notes || item.remarks || undefined;

    let subLabel: string | undefined = description ? String(description).trim() : undefined;
    if (!subLabel && days) {
      subLabel = `${days} Days credit period`;
    }

    let badge: string | undefined = undefined;
    if (days) {
      badge = `${days} Days`;
    } else if (item.badge) {
      badge = String(item.badge);
    } else if (item.type) {
      badge = String(item.type);
    }

    return {
      ...item,
      value: value || label,
      label,
      subLabel,
      badge,
      days,
      description,
      raw: item,
    };
  };

  const formatted: SmartDocsPaymentTermOption[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const item = formatItem(rawList[i], i);
    if (item && item.value && item.label) {
      const dedupeKey = item.label.toLowerCase();
      if (!seenValues.has(dedupeKey)) {
        seenValues.add(dedupeKey);
        formatted.push(item);
      }
    }
  }

  return formatted.length > 0 ? formatted : DEFAULT_PAYMENT_TERMS;
}

export interface SmartDocsCurrencyOption {
  id?: string;
  value: string;
  label: string;
  code?: string;
  symbol?: string;
  subLabel?: string;
  badge?: string;
  raw?: any;
  [key: string]: any;
}

export const DEFAULT_CURRENCIES: SmartDocsCurrencyOption[] = [
  { value: 'USD', label: 'USD ($)', code: 'USD', symbol: '$' },
  { value: 'EUR', label: 'EUR (€)', code: 'EUR', symbol: '€' },
  { value: 'INR', label: 'INR (₹)', code: 'INR', symbol: '₹' },
  { value: 'AED', label: 'AED (د.إ)', code: 'AED', symbol: 'د.إ' },
  { value: 'GBP', label: 'GBP (£)', code: 'GBP', symbol: '£' },
  { value: 'SGD', label: 'SGD (S$)', code: 'SGD', symbol: 'S$' },
  { value: 'CNY', label: 'CNY (¥)', code: 'CNY', symbol: '¥' },
  { value: 'CAD', label: 'CAD (C$)', code: 'CAD', symbol: 'C$' },
  { value: 'AUD', label: 'AUD (A$)', code: 'AUD', symbol: 'A$' },
  { value: 'JPY', label: 'JPY (¥)', code: 'JPY', symbol: '¥' },
  { value: 'CHF', label: 'CHF (CHF)', code: 'CHF', symbol: 'CHF' },
  { value: 'BRL', label: 'BRL (R$)', code: 'BRL', symbol: 'R$' },
  { value: 'ZAR', label: 'ZAR (R)', code: 'ZAR', symbol: 'R' },
  { value: 'RUB', label: 'RUB (₽)', code: 'RUB', symbol: '₽' },
  { value: 'MYR', label: 'MYR (RM)', code: 'MYR', symbol: 'RM' },
  { value: 'IDR', label: 'IDR (Rp)', code: 'IDR', symbol: 'Rp' },
  { value: 'THB', label: 'THB (฿)', code: 'THB', symbol: '฿' },
  { value: 'TRY', label: 'TRY (₺)', code: 'TRY', symbol: '₺' },
  { value: 'SAR', label: 'SAR (﷼)', code: 'SAR', symbol: '﷼' },
  { value: 'VND', label: 'VND (₫)', code: 'VND', symbol: '₫' },
];

/**
 * Robust helper to extract and format currency items from /currency API:
 * Formats options as "CODE (SYMBOL)", e.g. "USD ($)", and defaults value to CODE.
 */
export function extractCurrenciesData(data: any): SmartDocsCurrencyOption[] {
  if (!data) return DEFAULT_CURRENCIES;

  const d = data.data ?? data;
  let rawList: any[] = [];

  if (Array.isArray(d)) {
    rawList = d;
  } else if (Array.isArray(d?.currencies)) {
    rawList = d.currencies;
  } else if (Array.isArray(d?.currency)) {
    rawList = d.currency;
  } else if (Array.isArray(d?.records)) {
    rawList = d.records;
  } else if (Array.isArray(d?.items)) {
    rawList = d.items;
  } else if (Array.isArray(d?.list)) {
    rawList = d.list;
  } else if (Array.isArray(d?.result)) {
    rawList = d.result;
  } else if (Array.isArray(d?.results)) {
    rawList = d.results;
  } else if (Array.isArray(data?.currencies)) {
    rawList = data.currencies;
  } else if (Array.isArray(data?.currency)) {
    rawList = data.currency;
  }

  // If no array found yet, search nested values for an array
  if (rawList.length === 0 && d && typeof d === 'object') {
    for (const val of Object.values(d)) {
      if (Array.isArray(val) && val.length > 0) {
        rawList = val;
        break;
      }
    }
  }

  if (rawList.length === 0) {
    return DEFAULT_CURRENCIES;
  }

  const seenValues = new Set<string>();

  const formatCurrencyItem = (item: any, index: number): SmartDocsCurrencyOption | null => {
    if (!item) return null;

    if (typeof item === 'string') {
      const clean = item.trim().toUpperCase();
      if (!clean) return null;
      return {
        value: clean,
        label: clean,
        code: clean,
      };
    }

    const code = String(
      item.code ||
      item.currency_code ||
      item.currencyCode ||
      item.currency ||
      item.iso_code ||
      item.short_code ||
      item.value ||
      item.name ||
      ''
    ).trim().toUpperCase();

    const symbol = String(
      item.symbol ||
      item.currency_symbol ||
      item.currencySymbol ||
      item.sign ||
      item.icon ||
      ''
    ).trim();

    const name = String(
      item.name ||
      item.currency_name ||
      item.currencyName ||
      item.title ||
      item.label ||
      ''
    ).trim();

    if (!code && !symbol && !name) return null;

    const displayCode = code || name || `CUR-${index}`;

    // Format: Code and in brackets its symbol, e.g. "USD ($)"
    let displayLabel = displayCode;
    if (symbol) {
      if (displayLabel.includes(`(${symbol})`) || displayLabel.endsWith(` ${symbol}`)) {
        // already has symbol
      } else {
        displayLabel = `${displayCode} (${symbol})`;
      }
    }

    const value = displayCode;
    const dedupeKey = value.toUpperCase();
    if (seenValues.has(dedupeKey)) return null;
    seenValues.add(dedupeKey);

    const id = item.id || item._id || item.currency_id || item.currencyId;

    return {
      id: id ? String(id) : undefined,
      value: displayCode,
      label: displayLabel,
      code: displayCode,
      symbol: symbol || undefined,
      subLabel: name && name.toUpperCase() !== displayCode ? name : undefined,
      raw: item,
    };
  };

  const formatted = rawList
    .map(formatCurrencyItem)
    .filter((c): c is SmartDocsCurrencyOption => c !== null);

  if (formatted.length === 0) {
    return DEFAULT_CURRENCIES;
  }

  // Ensure USD is present in the list; if missing, prepend default USD option
  const hasUsd = formatted.some((c) => c.value === 'USD' || c.code === 'USD');
  if (!hasUsd) {
    formatted.unshift({ value: 'USD', label: 'USD ($)', code: 'USD', symbol: '$' });
  }

  return formatted;
}






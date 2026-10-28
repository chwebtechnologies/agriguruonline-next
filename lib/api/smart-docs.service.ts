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

  /**
   * Submits a Confirmation to generate a Sales Contract:
   * POST /confirmation/submit?lang_code=en&source=web
   */
  submitConfirmation: async (
    payload: SaveConfirmationPayload,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const url = `${baseUrl}/confirmation/submit`;

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
          success:
            json.success === 1 ||
            json.success === true ||
            json.status === true ||
            json.status === 200 ||
            json.status === 201 ||
            json.status === 'success',
          error_fields: json.error_fields || json.data?.error_fields || null,
          raw: json,
        };
      }

      return json;
    } catch (error: any) {
      console.error('[smartDocsService.submitConfirmation] error:', error);
      return {
        success: false,
        message: error?.message || 'Network error occurred while submitting confirmation',
      };
    }
  },

  /**
   * Fetches the Confirmation details by ID with authentication:
   * GET /confirmation/:id?lang_code=en&source=web
   */
  getConfirmation: async (
    id: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token || !id) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const encodedId = encodeURIComponent(String(id).trim());
    const url = `${baseUrl}/confirmation/${encodedId}`;

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
      console.error('[smartDocsService.getConfirmation] error:', error);
      return null;
    }
  },

  /**
   * GET /dms-templates/preview-pdf?prefix=:prefix&id=:id&lang_code=:lang&source=web
   * Fetches the rendered HTML preview for a document (e.g. confirmation).
   */
  getDocPreviewHtml: async (
    params: {
      prefix?: string;
      id: string;
      lang?: string;
      source?: string;
    },
    token: string
  ): Promise<{ success: boolean; html?: string; message?: string; error?: string }> => {
    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const safeId = sanitizeDocId(params.id);
    const prefix = params.prefix || 'confirmation';
    const source = params.source || 'web';

    const url = `${baseUrl}/dms-templates/preview-pdf`;

    try {
      const response = await customFetch(url, {
        method: 'GET',
        token,
        params: {
          prefix,
          id: safeId,
          lang_code: safeLang,
          source,
        },
        headers: {
          Accept: 'text/html, application/xhtml+xml, application/json, */*',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        let errorMsg = `Preview request failed with status: ${response.status}`;
        try {
          const rawText = await response.text();
          try {
            const errData = JSON.parse(rawText);
            errorMsg = errData.message || errData.error || errorMsg;
          } catch {
            if (rawText) errorMsg = rawText.slice(0, 300);
          }
        } catch {
          // ignore
        }
        return { success: false, error: errorMsg, message: errorMsg };
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      // Check if response is JSON containing HTML or error
      if (
        contentType.includes('application/json') ||
        (text.trim().startsWith('{') && text.trim().endsWith('}'))
      ) {
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object') {
            if (parsed.success === false || parsed.status === false) {
              return {
                success: false,
                error: parsed.message || parsed.error || 'Failed to generate preview',
                message: parsed.message || parsed.error || 'Failed to generate preview',
              };
            }
            const htmlContent =
              parsed.data?.html ||
              parsed.data?.template ||
              parsed.html ||
              parsed.template ||
              (typeof parsed.data === 'string' ? parsed.data : '');
            if (htmlContent) {
              return { success: true, html: htmlContent };
            }
          }
        } catch {
          // If JSON parse fails, fall through to treating text as raw HTML
        }
      }

      // Raw HTML response
      return { success: true, html: text };
    } catch (error: any) {
      console.error('[smartDocsService.getDocPreviewHtml] error:', error);
      return {
        success: false,
        error: error?.message || 'Network error fetching preview',
        message: error?.message || 'Network error fetching preview',
      };
    }
  },

  /**
   * GET /dms-templates/download-pdf?prefix=:prefix&id=:id&lang_code=:lang&source=web
   * Downloads the PDF file for a document (e.g. confirmation).
   */
  downloadDocPdf: async (
    params: {
      prefix?: string;
      id: string;
      lang?: string;
      source?: string;
    },
    token: string
  ): Promise<{
    success: boolean;
    base64?: string;
    url?: string;
    contentType?: string;
    filename?: string;
    message?: string;
    error?: string;
  }> => {
    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const safeId = sanitizeDocId(params.id);
    const prefix = params.prefix || 'confirmation';
    const source = params.source || 'web';

    const url = `${baseUrl}/dms-templates/download-pdf`;

    try {
      const response = await customFetch(url, {
        method: 'GET',
        token,
        params: {
          prefix,
          id: safeId,
          lang_code: safeLang,
          source,
        },
        headers: {
          Accept: 'application/pdf, application/octet-stream, application/json, */*',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        let errorMsg = `Download failed with status: ${response.status}`;
        try {
          const rawText = await response.text();
          try {
            const errData = JSON.parse(rawText);
            errorMsg = errData.message || errData.error || errorMsg;
          } catch {
            if (rawText) errorMsg = rawText.slice(0, 300);
          }
        } catch {
          // ignore
        }
        return { success: false, error: errorMsg, message: errorMsg };
      }

      const contentType = response.headers.get('content-type') || '';
      const contentDisposition = response.headers.get('content-disposition') || '';
      let filename = `${prefix}-${safeId}.pdf`;
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '').trim();
      }

      // Read response body ONCE as ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Check if response is JSON (e.g. download URL or error object)
      const isJson = contentType.includes('application/json') || (buffer.length > 0 && buffer[0] === 123);
      if (isJson) {
        try {
          const jsonStr = buffer.toString('utf-8');
          const json = JSON.parse(jsonStr);
          if (json && typeof json === 'object') {
            if (json.success === false || json.status === false) {
              return {
                success: false,
                error: json.message || json.error || 'Failed to download PDF',
                message: json.message || json.error || 'Failed to download PDF',
              };
            }
            if (json.data?.url || json.url || json.data?.download_url || json.download_url) {
              return {
                success: true,
                url: json.data?.url || json.url || json.data?.download_url || json.download_url,
                filename,
              };
            }
            if (json.data?.base64 || json.base64) {
              return {
                success: true,
                base64: json.data?.base64 || json.base64,
                contentType: 'application/pdf',
                filename,
              };
            }
          }
        } catch {
          // Not valid JSON, fall through to treating as binary PDF buffer
        }
      }

      // Direct binary buffer (PDF)
      const base64 = buffer.toString('base64');

      return {
        success: true,
        base64,
        contentType: contentType || 'application/pdf',
        filename,
      };
    } catch (error: any) {
      console.error('[smartDocsService.downloadDocPdf] error:', error);
      return {
        success: false,
        error: error?.message || 'Network error downloading PDF',
        message: error?.message || 'Network error downloading PDF',
      };
    }
  },
};

/**
 * Robustly extracts the confirmation document object from backend API response.
 */
export function extractConfirmationData(data: any): any {
  if (!data) return null;
  let current = data;
  if (current.data && typeof current.data === 'object' && !Array.isArray(current.data)) {
    current = current.data;
    if (current.data && typeof current.data === 'object' && !Array.isArray(current.data)) {
      current = current.data;
    }
  }
  if (current.confirmation && typeof current.confirmation === 'object' && !Array.isArray(current.confirmation)) {
    current = current.confirmation;
  }
  return current;
}

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
  bagWeightKg?: number;
  [key: string]: any;
}

/**
 * Robust utility to parse bag weight in Kilograms (KG) from packing strings or packing option objects.
 * Handles patterns such as:
 * - "25 KG PP Bags" -> 25
 * - "50 KG Bags" -> 50
 * - "25kg", "50kg" -> 25, 50
 * - "1000 KG Jumbo Bags" -> 1000
 * - "1 MT Jumbo Bags", "1.5 MT Bags" -> 1000, 1500
 * - "50 LBS Bags" -> ~22.68
 * - "25 KG NET / 25.2 KG GROSS" -> 25 (prefers NET)
 * - "Bulk", "Loose" -> 0 (no bags)
 * - Standalone numbers e.g. "25", "50", "1000" -> 25, 50, 1000
 * - Falls back to 50 if standard bag packing without specific weight
 */
export function parsePackingBagWeightKg(
  packing: any,
  packingList?: Array<{ value: string; label: string; bagWeightKg?: number; [key: string]: any }>
): number | null {
  if (packing === undefined || packing === null) return null;

  const extractQtyFromObj = (obj: any): number | null => {
    if (!obj || typeof obj !== 'object') return null;
    const rawQty =
      obj.bagWeightKg ??
      obj.quantity ??
      obj.qty ??
      obj.packing_quantity ??
      obj.pack_qty ??
      obj.weight ??
      obj.bag_weight_kg ??
      obj.bag_weight ??
      obj.capacity ??
      (obj.packing_type && typeof obj.packing_type === 'object'
        ? (obj.packing_type.quantity ?? obj.packing_type.qty ?? obj.packing_type.capacity ?? obj.packing_type.weight)
        : undefined);

    if (rawQty !== undefined && rawQty !== null && rawQty !== '') {
      const num = typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty).replace(/[^\d.]/g, ''));
      if (!isNaN(num) && num > 0) return num;
    }
    return null;
  };

  // 1. If explicit numeric quantity or bag weight is provided on the object
  if (typeof packing === 'object') {
    const fromObj = extractQtyFromObj(packing);
    if (fromObj !== null) return fromObj;
  }

  // 2. If packingList is provided and packing matches an option by value/id/_id/label/packing_type_id
  if (Array.isArray(packingList) && packingList.length > 0) {
    const cleanTarget = String(
      typeof packing === 'object'
        ? (packing.value || packing.id || packing._id || packing.packing_type_id || packing.label || '')
        : packing
    )
      .trim()
      .toLowerCase();

    if (cleanTarget) {
      const match = packingList.find((p) => {
        const v = String(p.value || '').trim().toLowerCase();
        const l = String(p.label || '').trim().toLowerCase();
        const id = p.id ? String(p.id).trim().toLowerCase() : '';
        const _id = p._id ? String(p._id).trim().toLowerCase() : '';
        const ptId = p.packing_type_id ? String(p.packing_type_id).trim().toLowerCase() : '';
        const ptName =
          p.packing_type && typeof p.packing_type === 'object'
            ? String(p.packing_type.title || p.packing_type.name || p.packing_type._id || p.packing_type.id || '').trim().toLowerCase()
            : '';
        return (
          v === cleanTarget ||
          l === cleanTarget ||
          (id && id === cleanTarget) ||
          (_id && _id === cleanTarget) ||
          (ptId && ptId === cleanTarget) ||
          (ptName && ptName === cleanTarget)
        );
      });

      if (match) {
        const fromMatch = extractQtyFromObj(match);
        if (fromMatch !== null) return fromMatch;
        const fromMatchLabel = parseWeightFromString(match.label || match.subLabel || match.name || match.title);
        if (fromMatchLabel !== null) return fromMatchLabel;
      }
    }
  }

  // 3. If packing itself is a pure number or numeric string (e.g. 50, 25, 20, "50", "25", "20")
  const rawStr = typeof packing === 'object'
    ? String(packing.label || packing.subLabel || packing.name || packing.title || packing.packing_type || packing.value || '')
    : String(packing);

  const trimmed = rawStr.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const val = parseFloat(trimmed);
    if (!isNaN(val) && val > 0 && val <= 5000) return val;
  }

  return parseWeightFromString(trimmed);
}

function parseWeightFromString(str?: string): number | null {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  if (!s || s === '[object Object]') return null;

  // Bulk / Loose cargo has NO bags (0 bags)
  if (/\b(?:bulk|loose)\b/i.test(s)) {
    return 0;
  }

  // Check for explicit NET weight in KG (e.g., "25 KG NET / 25.2 KG GROSS")
  const netKgMatch = s.match(/(?:net|net\s*(?:wt|weight)?)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?)\b/i);
  if (netKgMatch) {
    const val = parseFloat(netKgMatch[1]);
    if (!isNaN(val) && val > 0) return val;
  }

  // Check for MT / Metric Ton / Tonne (e.g. 1 MT Jumbo Bags = 1000 KG, up to 3 MT)
  const mtMatch = s.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*(?:mt|metric\s*tons?|tonnes?|tons?)\b/i);
  if (mtMatch) {
    const val = parseFloat(mtMatch[1]);
    if (!isNaN(val) && val > 0 && val <= 3) return val * 1000;
  }

  // Check for KG / KGS / Kilograms (e.g. "25 KG PP Bags", "25kg", "50 KG", "1000 KG")
  const kgMatch = s.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?)\b/i);
  if (kgMatch) {
    const val = parseFloat(kgMatch[1]);
    if (!isNaN(val) && val > 0) return val;
  }

  // Check for LBS / Pounds (1 lb ≈ 0.453592 kg)
  const lbsMatch = s.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/i);
  if (lbsMatch) {
    const val = parseFloat(lbsMatch[1]);
    if (!isNaN(val) && val > 0) return parseFloat((val * 0.45359237).toFixed(2));
  }

  // Check for Grams / GMS (e.g. 500 gm = 0.5 kg)
  const gmMatch = s.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*(?:gms?|grams?)\b/i);
  if (gmMatch) {
    const val = parseFloat(gmMatch[1]);
    if (!isNaN(val) && val > 0) return parseFloat((val / 1000).toFixed(4));
  }

  // Check for numbers preceding or following bag keywords (e.g. "25 PP Bags", "Bags of 25")
  if (!/\b(?:20|40)\s*(?:ft|feet|foot)\b/i.test(s)) {
    const bagWordMatch =
      s.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*(?:bags?|sacks?|cartons?|packs?)\b/i) ||
      s.match(/\b(?:bags?|sacks?|cartons?|packs?)\s*(?:of\s*)?(\d+(?:\.\d+)?)\b/i);
    if (bagWordMatch) {
      const val = parseFloat(bagWordMatch[1]);
      if (!isNaN(val) && val > 0 && val <= 5000) return val;
    }
  }

  // Standalone number string (e.g. "25", "50", "1000")
  if (/^\d+(?:\.\d+)?$/.test(s)) {
    const val = parseFloat(s);
    if (!isNaN(val) && val > 0 && val <= 5000) return val;
  }

  // If text mentions bags/packaging without a specific number, default to standard 50 KG
  if (/\b(?:bags?|sacks?|pp|jute|hdpe|paper)\b/i.test(s)) {
    return 50;
  }

  return 50;
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
        const bagWeightKg = parsePackingBagWeightKg(clean);
        packingTypes.push({
          value: clean,
          label: clean,
          bagWeightKg: bagWeightKg !== null ? bagWeightKg : undefined,
        });
      }
      continue;
    }

    if (typeof item === 'object') {
      const ptObj = item.packing_type && typeof item.packing_type === 'object' ? item.packing_type : null;
      const rawTitle = String(
        ptObj?.title ||
        ptObj?.name ||
        item.title ||
        item.name ||
        item.packing_name ||
        item.packing_type_name ||
        (typeof item.packing_type === 'string' ? item.packing_type : '') ||
        item.label ||
        item.type ||
        item.packing ||
        item.value ||
        ''
      ).trim();

      const rawQty =
        item.quantity ??
        item.qty ??
        item.packing_quantity ??
        item.pack_qty ??
        item.weight ??
        item.bagWeightKg ??
        item.bag_weight_kg ??
        ptObj?.quantity ??
        ptObj?.qty ??
        ptObj?.weight;

      const numQty =
        rawQty !== undefined && rawQty !== null && rawQty !== ''
          ? (typeof rawQty === 'number' ? rawQty : parseFloat(String(rawQty).replace(/[^\d.]/g, '')))
          : undefined;

      const validQty = numQty !== undefined && !isNaN(numQty) && numQty > 0 ? numQty : undefined;

      let label = rawTitle;
      if (!label || label === '[object Object]') {
        label = validQty ? `${validQty} KG Bags` : 'Standard Bags';
      } else if (validQty && !label.toLowerCase().includes(String(validQty))) {
        label = `${label} (${validQty} KG)`;
      }

      const value = String(
        item.id ||
        item._id ||
        item.code ||
        item.packing_type_id ||
        ptObj?.id ||
        ptObj?._id ||
        item.value ||
        label
      ).trim();

      const subLabel =
        item.description ||
        item.desc ||
        (validQty ? `${validQty} KG` : undefined) ||
        item.weight ||
        item.size ||
        item.material ||
        item.capacity ||
        undefined;

      const dedupeKey = `${value}_${label}`.toLowerCase();
      if (!seenPacking.has(dedupeKey) && !seenPacking.has(label.toLowerCase())) {
        seenPacking.add(dedupeKey);
        seenPacking.add(label.toLowerCase());
        const bagWeightKg =
          validQty ||
          (typeof item.bagWeightKg === 'number' && item.bagWeightKg > 0 ? item.bagWeightKg : undefined) ||
          (typeof item.weight === 'number' && item.weight > 0 ? item.weight : undefined) ||
          (typeof item.bag_weight_kg === 'number' && item.bag_weight_kg > 0 ? item.bag_weight_kg : undefined) ||
          parsePackingBagWeightKg(item) ||
          parsePackingBagWeightKg(label) ||
          (subLabel ? parsePackingBagWeightKg(subLabel) : null);

        packingTypes.push({
          ...item,
          value: value || label,
          label,
          subLabel: subLabel ? String(subLabel).trim() : undefined,
          bagWeightKg: bagWeightKg !== null ? bagWeightKg : undefined,
          quantity: validQty || bagWeightKg || undefined,
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

export const KNOWN_CURRENCIES: Record<string, { code: string; label: string; symbol: string; name: string }> = {
  USD: { code: 'USD', label: 'USD ($)', symbol: '$', name: 'US Dollar' },
  EUR: { code: 'EUR', label: 'EUR (€)', symbol: '€', name: 'Euro' },
  INR: { code: 'INR', label: 'INR (₹)', symbol: '₹', name: 'Indian Rupee' },
  AED: { code: 'AED', label: 'AED (د.إ)', symbol: 'د.إ', name: 'UAE Dirham' },
  GBP: { code: 'GBP', label: 'GBP (£)', symbol: '£', name: 'British Pound' },
  SGD: { code: 'SGD', label: 'SGD (S$)', symbol: 'S$', name: 'Singapore Dollar' },
  CNY: { code: 'CNY', label: 'CNY (¥)', symbol: '¥', name: 'Chinese Yuan' },
  CAD: { code: 'CAD', label: 'CAD (C$)', symbol: 'C$', name: 'Canadian Dollar' },
  AUD: { code: 'AUD', label: 'AUD (A$)', symbol: 'A$', name: 'Australian Dollar' },
  JPY: { code: 'JPY', label: 'JPY (¥)', symbol: '¥', name: 'Japanese Yen' },
  CHF: { code: 'CHF', label: 'CHF (CHF)', symbol: 'CHF', name: 'Swiss Franc' },
  BRL: { code: 'BRL', label: 'BRL (R$)', symbol: 'R$', name: 'Brazilian Real' },
  ZAR: { code: 'ZAR', label: 'ZAR (R)', symbol: 'R', name: 'South African Rand' },
  RUB: { code: 'RUB', label: 'RUB (₽)', symbol: '₽', name: 'Russian Ruble' },
  MYR: { code: 'MYR', label: 'MYR (RM)', symbol: 'RM', name: 'Malaysian Ringgit' },
  IDR: { code: 'IDR', label: 'IDR (Rp)', symbol: 'Rp', name: 'Indonesian Rupiah' },
  THB: { code: 'THB', label: 'THB (฿)', symbol: '฿', name: 'Thai Baht' },
  TRY: { code: 'TRY', label: 'TRY (₺)', symbol: '₺', name: 'Turkish Lira' },
  SAR: { code: 'SAR', label: 'SAR (﷼)', symbol: '﷼', name: 'Saudi Riyal' },
  VND: { code: 'VND', label: 'VND (₫)', symbol: '₫', name: 'Vietnamese Dong' },
  PKR: { code: 'PKR', label: 'PKR (₨)', symbol: '₨', name: 'Pakistani Rupee' },
  BDT: { code: 'BDT', label: 'BDT (৳)', symbol: '৳', name: 'Bangladeshi Taka' },
  NZD: { code: 'NZD', label: 'NZD (NZ$)', symbol: 'NZ$', name: 'New Zealand Dollar' },
  HKD: { code: 'HKD', label: 'HKD (HK$)', symbol: 'HK$', name: 'Hong Kong Dollar' },
  KRW: { code: 'KRW', label: 'KRW (₩)', symbol: '₩', name: 'South Korean Won' },
};

export const CURRENCY_ALIAS_MAP: Record<string, string> = {
  USD: 'USD',
  'US DOLLAR': 'USD',
  'US DOLLARS': 'USD',
  'US-DOLLAR': 'USD',
  'U.S. DOLLAR': 'USD',
  'UNITED STATES DOLLAR': 'USD',
  DOLLAR: 'USD',
  DOLLARS: 'USD',
  '$': 'USD',

  EUR: 'EUR',
  EURO: 'EUR',
  EUROS: 'EUR',
  '€': 'EUR',

  INR: 'INR',
  RUPEE: 'INR',
  RUPEES: 'INR',
  'INDIAN RUPEE': 'INR',
  'INDIAN RUPEES': 'INR',
  '₹': 'INR',
  RS: 'INR',
  'RS.': 'INR',

  AED: 'AED',
  DIRHAM: 'AED',
  DIRHAMS: 'AED',
  'UAE DIRHAM': 'AED',
  'د.إ': 'AED',

  GBP: 'GBP',
  POUND: 'GBP',
  POUNDS: 'GBP',
  'BRITISH POUND': 'GBP',
  'POUND STERLING': 'GBP',
  '£': 'GBP',

  SGD: 'SGD',
  'SINGAPORE DOLLAR': 'SGD',
  'S$': 'SGD',

  CNY: 'CNY',
  RMB: 'CNY',
  YUAN: 'CNY',
  'CHINESE YUAN': 'CNY',

  CAD: 'CAD',
  'CANADIAN DOLLAR': 'CAD',
  'C$': 'CAD',

  AUD: 'AUD',
  'AUSTRALIAN DOLLAR': 'AUD',
  'A$': 'AUD',

  JPY: 'JPY',
  YEN: 'JPY',
  'JAPANESE YEN': 'JPY',
  '¥': 'JPY',

  CHF: 'CHF',
  'SWISS FRANC': 'CHF',

  BRL: 'BRL',
  'BRAZILIAN REAL': 'BRL',
  'R$': 'BRL',

  ZAR: 'ZAR',
  RAND: 'ZAR',
  'SOUTH AFRICAN RAND': 'ZAR',

  RUB: 'RUB',
  RUBLE: 'RUB',
  'RUSSIAN RUBLE': 'RUB',
  '₽': 'RUB',

  MYR: 'MYR',
  RINGGIT: 'MYR',
  'MALAYSIAN RINGGIT': 'MYR',
  RM: 'MYR',

  IDR: 'IDR',
  RUPIAH: 'IDR',
  'INDONESIAN RUPIAH': 'IDR',
  RP: 'IDR',

  THB: 'THB',
  BAHT: 'THB',
  'THAI BAHT': 'THB',
  '฿': 'THB',

  TRY: 'TRY',
  LIRA: 'TRY',
  'TURKISH LIRA': 'TRY',
  '₺': 'TRY',

  SAR: 'SAR',
  RIYAL: 'SAR',
  'SAUDI RIYAL': 'SAR',
  '﷼': 'SAR',

  VND: 'VND',
  DONG: 'VND',
  'VIETNAMESE DONG': 'VND',
  '₫': 'VND',
};

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
 * Normalizes any currency string, code, or alias to standard uppercase 3-letter currency code (e.g. "USD").
 * Converts "US Dollar", "US DOLLAR", "US DOLLARS", "Dollar", "$", "USD ($)" to "USD".
 */
export function normalizeCurrencyCode(val: any): string {
  if (!val) return 'USD';
  if (typeof val === 'object') {
    const raw =
      val.code ||
      val.currency_code ||
      val.currencyCode ||
      val.iso_code ||
      val.short_code ||
      val.value ||
      val.currency ||
      val.currency_name ||
      val.name ||
      val.label ||
      '';
    return normalizeCurrencyCode(raw);
  }
  const clean = String(val).trim().toUpperCase();
  if (!clean || clean === '[OBJECT OBJECT]' || clean === 'UNDEFINED' || clean === 'NULL') {
    return 'USD';
  }

  // Direct alias match
  if (CURRENCY_ALIAS_MAP[clean]) {
    return CURRENCY_ALIAS_MAP[clean];
  }

  // Remove parenthesis and brackets e.g. "USD ($)" -> "USD"
  const stripped = clean.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
  if (CURRENCY_ALIAS_MAP[stripped]) {
    return CURRENCY_ALIAS_MAP[stripped];
  }

  // Check if string contains known alias
  for (const [alias, code] of Object.entries(CURRENCY_ALIAS_MAP)) {
    if (alias.length >= 3 && clean.includes(alias)) {
      return code;
    }
  }

  // If 3-character alphabetic code e.g. "EUR", "INR"
  if (/^[A-Z]{3}$/.test(stripped)) {
    return stripped;
  }

  return stripped || clean || 'USD';
}

/**
 * Returns the currency symbol for formatting or display (defaults to '$' for USD/unrecognized).
 */
export function getCurrencySymbol(currencyOrCode: any): string {
  if (typeof currencyOrCode === 'object' && currencyOrCode) {
    const sym =
      currencyOrCode.symbol ||
      currencyOrCode.currency_symbol ||
      currencyOrCode.currencySymbol ||
      currencyOrCode.sign;
    if (sym && typeof sym === 'string' && sym.trim()) {
      return sym.trim();
    }
  }
  const code = normalizeCurrencyCode(currencyOrCode);
  if (KNOWN_CURRENCIES[code]?.symbol) {
    return KNOWN_CURRENCIES[code].symbol;
  }
  return '$';
}

/**
 * Robustly normalizes any raw currency item, object, or code into a structured SmartDocsCurrencyOption.
 * Guarantees that "US Dollar" / "US DOLLAR" is cleanly represented as { value: 'USD', label: 'USD ($)', code: 'USD', symbol: '$' }.
 */
export function normalizeCurrencyOption(raw: any, existingList?: any[]): SmartDocsCurrencyOption {
  const code = normalizeCurrencyCode(raw);
  const known = KNOWN_CURRENCIES[code];

  let id: string | undefined = undefined;
  let rawSymbol: string | undefined = undefined;
  let rawObj: any = undefined;

  if (raw && typeof raw === 'object') {
    rawObj = raw;
    id = raw.id || raw._id || raw.currency_id || raw.currencyId;
    rawSymbol =
      raw.symbol ||
      raw.currency_symbol ||
      raw.currencySymbol ||
      raw.sign ||
      raw.icon;
  }

  // Check if an existing option matches by ID or Code in existingList
  if (existingList && Array.isArray(existingList) && existingList.length > 0) {
    const rawIdStr = id ? String(id) : typeof raw === 'string' ? raw.trim() : '';
    const match = existingList.find(
      (item: any) =>
        (rawIdStr && (String(item.id) === rawIdStr || String(item.value) === rawIdStr || String(item.raw?.id || item.raw?._id) === rawIdStr)) ||
        (item.value && String(item.value).toUpperCase() === code) ||
        (item.code && String(item.code).toUpperCase() === code) ||
        (item.label && String(item.label).toUpperCase().startsWith(code))
    );
    if (match) {
      const matchId = match.id || match.raw?.id || match.raw?._id || match.raw?.currency_id || id;
      const matchSymbol = match.symbol || rawSymbol || known?.symbol || '$';
      const matchLabel =
        match.label && match.label.includes('(')
          ? match.label
          : `${code} (${matchSymbol})`;

      return {
        id: matchId ? String(matchId) : undefined,
        value: code,
        label: matchLabel,
        code: code,
        symbol: matchSymbol,
        subLabel: match.subLabel || known?.name,
        raw: match.raw || rawObj,
      };
    }
  }

  const symbol = rawSymbol || known?.symbol || (code === 'USD' ? '$' : undefined);
  const label = known?.label || (symbol ? `${code} (${symbol})` : code);

  return {
    id: id ? String(id) : undefined,
    value: code,
    label: label,
    code: code,
    symbol: symbol,
    subLabel: known?.name,
    raw: rawObj,
  };
}

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
  const formatted: SmartDocsCurrencyOption[] = [];

  for (const item of rawList) {
    if (!item) continue;
    const opt = normalizeCurrencyOption(item);
    const dedupeKey = opt.value.toUpperCase();
    if (!seenValues.has(dedupeKey)) {
      seenValues.add(dedupeKey);
      formatted.push(opt);
    }
  }

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






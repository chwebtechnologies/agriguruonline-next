import { getSmartDocsApiUrl, getSafeLang, getAssetsUrl } from '@/lib/api-utils';
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
  if (row.contract && typeof row.contract === 'object') {
    pushIfValid(row.contract.id);
    pushIfValid(row.contract._id);
    pushIfValid(row.contract.contract_id);
  }
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
 * Extracts a unique primary document identifier from a Smart Docs record.
 */
export function extractSmartDocId(row: any): string {
  if (!row) return '';
  const allIds = extractAllSmartDocIds(row);
  return allIds[0] || '';
}

/**
 * Extracts a unique Contract identifier specifically from a Smart Docs record.
 * Prioritizes contract-specific IDs (contract_id, contractId, contract.id, etc.)
 */
export function extractContractDocId(row: any): string {
  if (!row) return '';
  if (typeof row === 'string' || typeof row === 'number') {
    const clean = sanitizeDocId(row);
    return clean ? clean : '';
  }

  const clean = (val: any) => sanitizeDocId(val);
  return (
    clean(row.contract_id) ||
    clean(row.contractId) ||
    clean(row.contract?.id) ||
    clean(row.contract?._id) ||
    clean(row.contract?.contract_id) ||
    clean(row.id) ||
    clean(row._id) ||
    clean(row.confirmation_id) ||
    clean(row.confirmationId) ||
    clean(row.doc_id) ||
    clean(row.document_id) ||
    clean(extractSmartDocId(row)) ||
    ''
  );
}

/**
 * Extracts the linked confirmation ID from any contract record (searching all candidate levels).
 */
export function extractLinkedConfirmationId(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const clean = (val: any) => sanitizeDocId(val);

  const candidates = [
    data.confirmation_id,
    data.confirmationId,
    data.trade_confirmation_id,
    data.tradeConfirmationId,
    typeof data.confirmation === 'string' ? data.confirmation : '',
    data.confirmation?.id,
    data.confirmation?._id,
    data.confirmation?.confirmation_id,
    data.contract?.confirmation_id,
    data.contract?.confirmationId,
    typeof data.contract?.confirmation === 'string' ? data.contract.confirmation : '',
    data.contract?.confirmation?.id,
    data.contract?.confirmation?._id,
    data.data?.confirmation_id,
    data.data?.confirmationId,
    typeof data.data?.confirmation === 'string' ? data.data.confirmation : '',
    data.data?.confirmation?.id,
    data.data?.confirmation?._id,
    data.doc_id,
    data.source_id,
    data.parent_id,
    data.ref_id,
  ];

  for (const c of candidates) {
    const id = clean(c);
    if (id && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(id)) {
      return id;
    }
  }

  return '';
}

/**
 * Extracts the linked contract ID from any confirmation record (searching all candidate levels).
 */
export function extractLinkedContractId(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const clean = (val: any) => sanitizeDocId(val);

  const candidates = [
    data.contract_id,
    data.contractId,
    typeof data.contract === 'string' ? data.contract : '',
    data.contract?.id,
    data.contract?._id,
    data.contract?.contract_id,
    data.data?.contract_id,
    data.data?.contractId,
    typeof data.data?.contract === 'string' ? data.data.contract : '',
    data.data?.contract?.id,
    data.data?.contract?._id,
    data.sales_contract_id,
    data.salesContractId,
  ];

  for (const c of candidates) {
    const id = clean(c);
    if (id && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(id)) {
      return id;
    }
  }

  return '';
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
   * Fetches the document list for selection with authentication:
   * GET /document-list/for-selection?lang_code=en&source=web
   */
  getDocumentListForSelection: async (
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const url = `${baseUrl}/document-list/for-selection`;

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
      console.error('[smartDocsService.getDocumentListForSelection] error:', error);
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
   * Fetches the Contract details by ID with authentication:
   * GET /contract/:id?lang_code=en&source=web
   */
  getContract: async (
    id: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token || !id) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const encodedId = encodeURIComponent(String(id).trim());
    const url = `${baseUrl}/contract/${encodedId}`;

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
      console.error('[smartDocsService.getContract] error:', error);
      return null;
    }
  },

  /**
   * Saves or updates a Contract draft with authentication:
   * PATCH /contract/save/{id}?lang_code=en&source=web
   * Supports FormData (for binary images/signatures) and JSON payload.
   */
  saveContractDraft: async (
    payload: any,
    params: { lang?: string; source?: string; id?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const rawCandidate =
      params.id ||
      (isFormData
        ? (payload.get('contract_id') || payload.get('id') || payload.get('confirmation_id'))
        : (payload?.contract_id || payload?.id || payload?.confirmation_id));

    const cleanCandidate = sanitizeDocId(rawCandidate);
    const isPlaceholder = /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|step-\d+)$/i.test(cleanCandidate);
    const cleanId = isPlaceholder ? '' : cleanCandidate;

    const url = cleanId ? `${baseUrl}/contract/save/${encodeURIComponent(cleanId)}` : `${baseUrl}/contract/save`;

    try {
      const headers: Record<string, string> = {};
      let body: any;

      if (isFormData) {
        body = payload;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(cleanContractPayload(payload));
      }

      let response = await customFetch(url, {
        method: 'PATCH',
        token,
        headers,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        body,
        cache: 'no-store',
      });

      let json = await response.json().catch(() => null);

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
          errors: json.errors || json.data?.errors || null,
          raw: json,
        };
      }

      return json;
    } catch (error: any) {
      console.error('[smartDocsService.saveContractDraft] error:', error);
      return {
        success: false,
        message: error?.message || 'Network error occurred while saving contract draft',
      };
    }
  },

  /**
   * Submits a Contract to advance workflow to Proforma Invoice:
   * PATCH /contract/submit/:id?lang_code=en&source=web
   * Supports FormData (for binary files/signatures) and JSON payload.
   */
  submitContract: async (
    payload: any,
    params: { lang?: string; source?: string; id?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const rawCandidate =
      params.id ||
      (isFormData
        ? (payload.get('contract_id') || payload.get('id') || payload.get('confirmation_id'))
        : (payload?.contract_id || payload?.id || payload?.confirmation_id));

    const cleanCandidate = sanitizeDocId(rawCandidate);
    const isPlaceholder = /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|step-\d+)$/i.test(cleanCandidate);
    const cleanId = isPlaceholder ? '' : cleanCandidate;

    const url = cleanId ? `${baseUrl}/contract/submit/${encodeURIComponent(cleanId)}` : `${baseUrl}/contract/submit`;

    try {
      const headers: Record<string, string> = {};
      let body: any;

      if (isFormData) {
        body = payload;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(cleanContractPayload(payload));
      }

      const response = await customFetch(url, {
        method: 'PATCH',
        token,
        headers,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        body,
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
          errors: json.errors || json.data?.errors || null,
          raw: json,
        };
      }

      return json;
    } catch (error: any) {
      console.error('[smartDocsService.submitContract] error:', error);
      return {
        success: false,
        message: error?.message || 'Network error occurred while submitting contract',
      };
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
              parsed.data?.content ||
              parsed.data?.template_html ||
              parsed.data?.preview_html ||
              parsed.data?.print_html ||
              parsed.data?.html_content ||
              parsed.data?.rendered_html ||
              parsed.data?.preview ||
              parsed.html ||
              parsed.template ||
              parsed.content ||
              parsed.template_html ||
              parsed.preview_html ||
              parsed.print_html ||
              parsed.html_content ||
              parsed.rendered_html ||
              parsed.preview ||
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
    pdf_buffer?: string;
    data?: any;
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

      // Check if response is JSON (e.g. download URL, pdf_buffer, or error object)
      const isJson = contentType.includes('application/json') || (buffer.length > 0 && buffer[0] === 123);
      if (isJson) {
        try {
          const jsonStr = buffer.toString('utf-8');
          const json = JSON.parse(jsonStr);
          if (json && typeof json === 'object') {
            if (
              json.success === false ||
              json.status === false ||
              (typeof json.status === 'number' && json.status >= 400)
            ) {
              return {
                success: false,
                error: json.message || json.error || 'Failed to download PDF',
                message: json.message || json.error || 'Failed to download PDF',
              };
            }

            // Custom filename if returned in response data
            const serverFileName =
              json.data?.file_name ||
              json.data?.filename ||
              json.data?.fileName ||
              json.file_name ||
              json.filename ||
              json.fileName;
            if (serverFileName && typeof serverFileName === 'string') {
              filename = serverFileName.trim();
            }

            // Direct URL
            const directUrl =
              json.data?.url ||
              json.url ||
              json.data?.download_url ||
              json.download_url ||
              json.data?.pdf_url ||
              json.pdf_url;
            if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('http')) {
              return {
                success: true,
                url: directUrl,
                filename,
              };
            }

            // Check pdf_buffer / base64 in data or root
            const rawBuffer =
              json.data?.pdf_buffer ??
              json.data?.pdfBuffer ??
              json.data?.buffer ??
              json.data?.file_buffer ??
              json.data?.fileBuffer ??
              json.data?.base64 ??
              json.data?.pdf ??
              json.pdf_buffer ??
              json.pdfBuffer ??
              json.buffer ??
              json.file_buffer ??
              json.base64 ??
              json.data;

            const extractedBase64 = extractPdfBase64(rawBuffer);
            if (extractedBase64) {
              return {
                success: true,
                base64: extractedBase64,
                pdf_buffer: extractedBase64,
                data: {
                  pdf_buffer: extractedBase64,
                  file_name: filename,
                },
                contentType: 'application/pdf',
                filename,
              };
            }

            // If it was valid JSON but did not contain any valid PDF payload
            return {
              success: false,
              error: json.message || json.error || 'No PDF data received from server',
              message: json.message || json.error || 'No PDF data received from server',
            };
          }
        } catch (jsonErr: any) {
          // If JSON parsing failed unexpectedly, fall through to treating as binary PDF
          console.warn('[smartDocsService.downloadDocPdf] JSON parse error, treating as binary:', jsonErr);
        }
      }

      // Direct binary buffer (PDF)
      const base64 = buffer.toString('base64');

      return {
        success: true,
        base64,
        pdf_buffer: base64,
        data: {
          pdf_buffer: base64,
          file_name: filename,
        },
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
 * Safely extracts a clean base64 PDF string from diverse payload formats:
 * - base64 string (with or without data URL prefix)
 * - Node Buffer serialized as JSON ({ type: "Buffer", data: number[] })
 * - Direct byte array (number[])
 * - Uint8Array or ArrayBuffer
 * - Binary PDF string starting with %PDF-
 * - Hex string starting with 25504446
 */
export function extractPdfBase64(raw: any): string | null {
  if (!raw) return null;

  // 1. String formats
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Data URI prefix: data:application/pdf;base64,...
    if (trimmed.startsWith('data:')) {
      const idx = trimmed.indexOf(';base64,');
      if (idx !== -1) {
        return trimmed.slice(idx + 8).replace(/\s+/g, '');
      }
      const commaIdx = trimmed.indexOf(',');
      if (commaIdx !== -1) {
        return trimmed.slice(commaIdx + 1).replace(/\s+/g, '');
      }
    }

    // JSON-encoded object: {"type":"Buffer","data":[...]}
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        const nested = extractPdfBase64(parsed);
        if (nested) return nested;
      } catch {
        // ignore
      }
    }

    // Raw binary string (starts with %PDF-)
    if (trimmed.startsWith('%PDF-')) {
      return typeof Buffer !== 'undefined'
        ? Buffer.from(trimmed, 'binary').toString('base64')
        : btoa(trimmed);
    }

    // Hex string (starts with 25504446 -> %PDF)
    if (
      /^[0-9a-fA-F]+$/.test(trimmed) &&
      trimmed.length % 2 === 0 &&
      trimmed.toLowerCase().startsWith('25504446')
    ) {
      return typeof Buffer !== 'undefined'
        ? Buffer.from(trimmed, 'hex').toString('base64')
        : null;
    }

    // Standard base64 string
    const cleanStr = trimmed.replace(/\s+/g, '');
    return cleanStr;
  }

  // 2. Node.js Buffer
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
    return raw.toString('base64');
  }

  // 3. Uint8Array or ArrayBuffer
  if (raw instanceof Uint8Array) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(raw).toString('base64');
    }
    let binary = '';
    const len = raw.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(raw[i]);
    }
    return btoa(binary);
  }
  if (raw instanceof ArrayBuffer) {
    const uint8 = new Uint8Array(raw);
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(uint8).toString('base64');
    }
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  // 4. Object representations
  if (typeof raw === 'object' && raw !== null) {
    // Array of numbers [37, 80, 68, 70, ...]
    if (Array.isArray(raw)) {
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(raw).toString('base64');
      }
      let binary = '';
      for (let i = 0; i < raw.length; i++) {
        binary += String.fromCharCode(raw[i]);
      }
      return btoa(binary);
    }

    // Standard Node Buffer JSON: { type: 'Buffer', data: number[] }
    if (Array.isArray(raw.data)) {
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(raw.data).toString('base64');
      }
      let binary = '';
      for (let i = 0; i < raw.data.length; i++) {
        binary += String.fromCharCode(raw.data[i]);
      }
      return btoa(binary);
    }

    // Nested properties
    if (raw.pdf_buffer !== undefined) {
      return extractPdfBase64(raw.pdf_buffer);
    }
    if (raw.pdfBuffer !== undefined) {
      return extractPdfBase64(raw.pdfBuffer);
    }
    if (raw.buffer !== undefined) {
      return extractPdfBase64(raw.buffer);
    }
    if (raw.file_buffer !== undefined) {
      return extractPdfBase64(raw.file_buffer);
    }
    if (raw.base64 !== undefined) {
      return extractPdfBase64(raw.base64);
    }
    if (raw.pdf !== undefined) {
      return extractPdfBase64(raw.pdf);
    }
    if (raw.data !== undefined) {
      return extractPdfBase64(raw.data);
    }
  }

  return null;
}

/**
 * Universal browser-safe downloader for Smart Docs PDF payloads.
 * Seamlessly handles:
 * - Direct HTTP URLs (fetch via Blob or window.open)
 * - Base64 strings (res.base64, res.pdf_buffer, res.data?.pdf_buffer)
 * - Node Buffer serialized as JSON ({ type: 'Buffer', data: number[] })
 * - Direct Byte Array (number[], Uint8Array, ArrayBuffer)
 */
export function downloadPdfFromActionResponse(
  res: any,
  fallbackFilename: string
): boolean {
  if (typeof window === 'undefined' || !res) return false;

  // 1. Direct URL handling
  const directUrl =
    res.url ||
    res.data?.url ||
    res.download_url ||
    res.data?.download_url ||
    res.data?.pdf_url;
  if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('http')) {
    try {
      fetch(directUrl)
        .then((fileRes) => fileRes.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = res.filename || fallbackFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
        })
        .catch(() => {
          window.open(directUrl, '_blank', 'noopener,noreferrer');
        });
      return true;
    } catch {
      window.open(directUrl, '_blank', 'noopener,noreferrer');
      return true;
    }
  }

  // 2. Extract buffer or base64
  const rawPayload =
    res.base64 ||
    res.pdf_buffer ||
    res.data?.pdf_buffer ||
    res.data?.buffer ||
    res.data?.base64 ||
    res.buffer;

  if (!rawPayload) return false;

  let byteArray: Uint8Array | null = null;

  if (rawPayload instanceof Uint8Array) {
    byteArray = rawPayload;
  } else if (rawPayload instanceof ArrayBuffer) {
    byteArray = new Uint8Array(rawPayload);
  } else if (Array.isArray(rawPayload)) {
    byteArray = new Uint8Array(rawPayload);
  } else if (
    typeof rawPayload === 'object' &&
    rawPayload !== null &&
    Array.isArray(rawPayload.data)
  ) {
    byteArray = new Uint8Array(rawPayload.data);
  } else if (typeof rawPayload === 'string') {
    let clean = rawPayload.trim();
    if (clean.startsWith('{') && clean.endsWith('}')) {
      try {
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed.data)) {
          byteArray = new Uint8Array(parsed.data);
        }
      } catch {
        // ignore
      }
    }
    if (!byteArray) {
      if (clean.includes(';base64,')) {
        clean = clean.split(';base64,')[1];
      } else if (clean.startsWith('data:')) {
        const commaIdx = clean.indexOf(',');
        if (commaIdx !== -1) clean = clean.slice(commaIdx + 1);
      }
      clean = clean.replace(/\s+/g, '');
      const binaryStr = atob(clean);
      const len = binaryStr.length;
      byteArray = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        byteArray[i] = binaryStr.charCodeAt(i);
      }
    }
  }

  if (!byteArray || byteArray.length === 0) {
    return false;
  }

  const filename = res.filename || fallbackFilename;
  const cleanName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blob = new Blob([byteArray as any], { type: res.contentType || 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
  return true;
}

/**
 * Robustly extracts the confirmation document object from backend API response.
 */
export function extractConfirmationData(data: any): any {
  if (!data) return null;
  if (data?.success === false && !data?.data) return null;
  if (data?.status === 404 || data?.status === 400 || data?.statusCode === 404) return null;
  if (data?.message && typeof data.message === 'string' && /not found/i.test(data.message) && !data?.data) return null;

  let current = data;
  let status = data?.status || data?.data?.status;
  if (current.data && typeof current.data === 'object' && !Array.isArray(current.data)) {
    if (typeof current.data.status === 'string') status = current.data.status;
    current = current.data;
    if (current.data && typeof current.data === 'object' && !Array.isArray(current.data)) {
      if (typeof current.data.status === 'string') status = current.data.status;
      current = current.data;
    }
  }
  if (current.confirmation && typeof current.confirmation === 'object' && !Array.isArray(current.confirmation)) {
    current = current.confirmation;
  }
  if (current && typeof current === 'object' && !Array.isArray(current) && !current.status && typeof status === 'string') {
    current.status = status;
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) return null;

  if (current.product && typeof current.product === 'object' && !current.product_name) {
    current.product_name = current.product.name || current.product.product_name || current.product.title || '';
  }

  const keys = Object.keys(current);
  if (keys.length === 0 || (keys.length <= 2 && keys.every(k => ['message', 'error', 'success', 'status', 'statusCode'].includes(k)))) {
    return null;
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
    if (value === undefined) continue;
    if (value === null) {
      if (
        key === 'is_partial' ||
        key === 'partial_shipment_allowed' ||
        key === 'is_partial_allowed' ||
        key === 'split_count' ||
        key === 'transhipment_allowed' ||
        key === 'transit_clause_allowed' ||
        key === 'any_advance' ||
        key === 'is_broker' ||
        key === 'sales_broker_allowed' ||
        key === 'broker_commission_type' ||
        key === 'sales_broker_type' ||
        key === 'seller_signature' ||
        key === 'seller_signature_url' ||
        key === 'exporter_signature' ||
        key === 'exporter_signature_url' ||
        key === 'buyer_signature' ||
        key === 'buyer_signature_url' ||
        key === 'importer_signature' ||
        key === 'importer_signature_url' ||
        key === 'broker_signature' ||
        key === 'broker_signature_url' ||
        key === 'sales_broker_signature' ||
        key === 'sales_broker_signature_url' ||
        key === 'comment_label' ||
        key === 'comment_value'
      ) {
        cleaned[key] = null;
      }
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        if (key === 'comment_label' || key === 'comment_value') {
          cleaned[key] = '';
        } else if (
          key === 'seller_signature' ||
          key === 'seller_signature_url' ||
          key === 'exporter_signature' ||
          key === 'exporter_signature_url' ||
          key === 'buyer_signature' ||
          key === 'buyer_signature_url' ||
          key === 'importer_signature' ||
          key === 'importer_signature_url' ||
          key === 'broker_signature' ||
          key === 'broker_signature_url' ||
          key === 'sales_broker_signature' ||
          key === 'sales_broker_signature_url'
        ) {
          cleaned[key] = null;
        }
        continue;
      }
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

/**
 * Formats a signature endpoint or path into a fully qualified image URL using the assets CDN domain.
 * If raw is null, undefined, 'null', or empty, returns an empty string.
 * Supports string paths or objects ({ url: '...', path: '...' }).
 */
export function formatSignatureUrl(raw?: any): string {
  if (!raw) return '';
  let str = '';
  if (typeof raw === 'string') {
    str = raw.trim();
  } else if (typeof raw === 'object') {
    const possibleKeys = ['url', 'path', 'src', 'image', 'file', 'endpoint', 'location'];
    for (const pk of possibleKeys) {
      if (raw[pk] && typeof raw[pk] === 'string') {
        str = raw[pk].trim();
        break;
      }
    }
  }

  if (
    !str ||
    str === 'null' ||
    str === 'undefined' ||
    str === '[object Object]'
  ) {
    return '';
  }

  // If already a base64 data URL, blob URL, or full HTTP/HTTPS URL
  if (str.startsWith('data:') || str.startsWith('blob:') || /^https?:\/\//i.test(str)) {
    return str.replace('assets.agriguruonline.cloud', 'assets.agriguruonline.com');
  }

  const assetsUrl = getAssetsUrl();
  const cleanPath = str.replace(/^\/+/, '');
  return `${assetsUrl}/${cleanPath}`;
}

/**
 * Normalizes signature value for payload submission.
 * - If data URL / base64: returns the new drawn/uploaded signature.
 * - If unmodified URL with asset prefix: strips back to relative endpoint.
 * - If empty/null: returns null so the backend properly clears or omits it.
 */
export function normalizeSignaturePayload(sig?: string | null): string | null | undefined {
  if (!sig || typeof sig !== 'string') return null;
  const trimmed = sig.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  const assetsUrl = getAssetsUrl();
  if (trimmed.startsWith(assetsUrl)) {
    return trimmed.slice(assetsUrl.length).replace(/^\//, '');
  }
  return trimmed;
}

/**
 * Robustly extracts the contract document object from backend API response.
 */
export function extractContractData(data: any): any {
  if (!data) return null;
  if (data?.success === false && !data?.data) return null;
  if (data?.status === 404 || data?.status === 400 || data?.statusCode === 404) return null;
  if (data?.message && typeof data.message === 'string' && /not found/i.test(data.message) && !data?.data) return null;

  let root = data;
  let dataLevel = data?.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : null;
  let nestedDataLevel = dataLevel?.data && typeof dataLevel.data === 'object' && !Array.isArray(dataLevel.data) ? dataLevel.data : null;
  let contractLevel = (nestedDataLevel?.contract || dataLevel?.contract || root?.contract);
  if (contractLevel && typeof contractLevel !== 'object') contractLevel = null;

  const merged: Record<string, any> = {};
  const layers = [contractLevel, nestedDataLevel, dataLevel, root].filter(Boolean);

  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer)) {
      if (k === 'contract' || k === 'data') continue;
      if (!(k in merged)) {
        merged[k] = v;
      } else if ((merged[k] === undefined || merged[k] === null || merged[k] === '') && v !== undefined && v !== null && v !== '') {
        // If inner layer didn't specify a value, fallback to outer layer
        // BUT do not fallback for signatures if inner layer explicitly cleared them
        const isSigKey = /signature/i.test(k);
        if (!isSigKey) {
          merged[k] = v;
        }
      }
    }
  }

  if (contractLevel) {
    merged.contract = contractLevel;
  }

  if (merged.product && typeof merged.product === 'object' && !merged.product_name) {
    merged.product_name = merged.product.name || merged.product.product_name || merged.product.title || '';
  }

  const keys = Object.keys(merged);
  if (keys.length === 0 || (keys.length <= 2 && keys.every(k => ['message', 'error', 'success', 'status', 'statusCode'].includes(k)))) {
    return null;
  }

  return merged;
}

/**
 * Sanitizes contract payload before sending to backend.
 */
export function cleanContractPayload(payload: Record<string, any>): Record<string, any> {
  if (!payload || typeof payload !== 'object') return {};
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (value === null) {
      if (
        key === 'is_partial' ||
        key === 'partial_shipment_allowed' ||
        key === 'is_partial_allowed' ||
        key === 'split_count' ||
        key === 'transhipment_allowed' ||
        key === 'transit_clause_allowed' ||
        key === 'any_advance' ||
        key === 'is_broker' ||
        key === 'sales_broker_allowed' ||
        key === 'broker_commission_type' ||
        key === 'sales_broker_type' ||
        key === 'seller_signature' ||
        key === 'seller_signature_url' ||
        key === 'exporter_signature' ||
        key === 'exporter_signature_url' ||
        key === 'buyer_signature' ||
        key === 'buyer_signature_url' ||
        key === 'importer_signature' ||
        key === 'importer_signature_url' ||
        key === 'broker_signature' ||
        key === 'broker_signature_url' ||
        key === 'sales_broker_signature' ||
        key === 'sales_broker_signature_url' ||
        key === 'comment_label' ||
        key === 'comment_value'
      ) {
        cleaned[key] = null;
      }
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        if (key === 'comment_label' || key === 'comment_value') {
          cleaned[key] = '';
        } else if (
          key === 'seller_signature' ||
          key === 'seller_signature_url' ||
          key === 'exporter_signature' ||
          key === 'exporter_signature_url' ||
          key === 'buyer_signature' ||
          key === 'buyer_signature_url' ||
          key === 'importer_signature' ||
          key === 'importer_signature_url' ||
          key === 'broker_signature' ||
          key === 'broker_signature_url' ||
          key === 'sales_broker_signature' ||
          key === 'sales_broker_signature_url'
        ) {
          cleaned[key] = null;
        }
        continue;
      }
      if (
        key === 'notes' ||
        key === 'container_terms' ||
        key === 'other_terms_2' ||
        key === 'force_majeur' ||
        key === 'confidentiality' ||
        key === 'other_terms' ||
        key === 'other_terms_1'
      ) {
        const stripped = trimmed.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        if (stripped === '') continue;
      }
      cleaned[key] = trimmed;
    } else if (typeof value === 'number') {
      if (isNaN(value)) continue;
      cleaned[key] = value;
    } else if (typeof value === 'boolean') {
      cleaned[key] = value;
    } else if (Array.isArray(value)) {
      if (value.length > 0) cleaned[key] = value;
    } else if (typeof value === 'object') {
      const nested = cleanContractPayload(value);
      if (Object.keys(nested).length > 0) cleaned[key] = nested;
    }
  }

  return cleaned;
}

export interface SaveConfirmationPayload {
  id?: string;
  bag_quantity?: number;
  buyer_instruction?: string;
  buyer_instruction_id?: string;
  comment_label?: string;
  comment_value?: string;
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

export const DEFAULT_WORKFLOW_STEPPER_ITEMS: StepperDocumentItem[] = [
  { step: 1, order: 1, name: 'Trade Confirmation', document_name: 'Trade Confirmation', status: 'completed' },
  { step: 2, order: 2, name: 'Sales Contract', document_name: 'Sales Contract', status: 'in_progress' },
  { step: 3, order: 3, name: 'Proforma Invoice', document_name: 'Proforma Invoice', status: 'pending' },
  { step: 4, order: 4, name: 'Shipment Instruction', document_name: 'Shipment Instruction', status: 'pending' },
  { step: 5, order: 5, name: 'Bill Of Lading', document_name: 'Bill Of Lading', status: 'pending' },
  { step: 6, order: 6, name: 'Custom Invoice', document_name: 'Custom Invoice', status: 'pending' },
  { step: 7, order: 7, name: 'Commercial Invoice', document_name: 'Commercial Invoice', status: 'pending' },
  { step: 8, order: 8, name: 'Packing List', document_name: 'Packing List', status: 'pending' },
  { step: 9, order: 9, name: 'Phyto Certificate', document_name: 'Phyto Certificate', status: 'pending' },
  { step: 10, order: 10, name: 'Fumigation Certificate', document_name: 'Fumigation Certificate', status: 'pending' },
  { step: 11, order: 11, name: 'Certificate Of Origin', document_name: 'Certificate Of Origin', status: 'pending' },
  { step: 12, order: 12, name: 'W & Q Certificate', document_name: 'W & Q Certificate', status: 'pending' },
];

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
    'result',
    'results',
    'rows',
    'data',
  ];

  for (const key of candidateKeys) {
    if (Array.isArray(d?.[key]) && d[key].length > 0) return d[key];
    if (Array.isArray(data?.[key]) && data[key].length > 0) return data[key];
  }

  for (const key of candidateKeys) {
    if (Array.isArray(d?.[key])) return d[key];
    if (Array.isArray(data?.[key])) return data[key];
  }

  const fallback = extractSmartDocsArray(data);
  if (Array.isArray(fallback) && fallback.length > 0) {
    return fallback;
  }

  return [];
}

export type NormalizedStepStatus = 'completed' | 'in_progress' | 'pending' | 'locked';

export function normalizeStepStatus(rawStatus?: string): NormalizedStepStatus {
  if (!rawStatus) return 'pending';
  const s = String(rawStatus).toLowerCase().trim();
  if (['completed', 'complete', 'done', 'approved', 'success', 'finished'].includes(s)) {
    return 'completed';
  }
  if (['in_progress', 'inprogress', 'in-progress', 'active', 'current', 'processing', 'draft'].includes(s)) {
    return 'in_progress';
  }
  if (['locked', 'lock', 'blocked'].includes(s)) {
    return 'locked';
  }
  return 'pending';
}

/**
 * Extracts a clean document/step ID from a StepperDocumentItem.
 * Filters out dummy placeholder names like "contract", "sales-contract", etc.
 * Never treats stepper template array _id as document primary key!
 */
export function extractStepId(step?: StepperDocumentItem | null): string {
  if (!step) return '';
  const isInvalidPlaceholder = (val: string) =>
    !val ||
    /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+|null|undefined|nan|\[object object\])$/i.test(
      val.trim()
    );

  // Explicit document ID fields from backend
  const explicitCandidates = [
    step.proforma_id,
    step.proformaId,
    step.contract_id,
    step.contractId,
    step.confirmation_id,
    step.confirmationId,
    step.document_id,
    step.documentId,
    step.doc_id,
    step.docId,
    step.smart_doc_id,
    step.smartDocId,
    step.record_id,
    step.recordId,
  ];

  for (const raw of explicitCandidates) {
    if (raw !== undefined && raw !== null) {
      const clean = String(raw).trim();
      if (clean && !isInvalidPlaceholder(clean)) {
        return clean;
      }
    }
  }

  return '';
}

export function isConfirmationStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (index === 0) return true;
  if (index === 1 || index === 2) return false;
  if (!step) return false;

  const stepNum = Number(step.step ?? step.step_number ?? step.order);
  if (stepNum === 1) return true;
  if (stepNum === 2 || stepNum === 3) return false;

  const id = String(step.id || step._id || '').toLowerCase();
  const name = String(
    step.document_name ||
    step.name ||
    step.title ||
    step.doc_name ||
    step.step_name ||
    step.label ||
    ''
  ).toLowerCase();
  return id.includes('confirmation') || name.includes('confirmation');
}

export function isContractStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (index === 0 || index === 2) return false;
  if (index === 1) return true;
  if (!step) return false;

  const stepNum = Number(step.step ?? step.step_number ?? step.order);
  if (stepNum === 1 || stepNum === 3) return false;
  if (stepNum === 2) return true;

  const id = String(step.id || step._id || '').toLowerCase();
  const name = String(
    step.document_name ||
    step.name ||
    step.title ||
    step.doc_name ||
    step.step_name ||
    step.label ||
    ''
  ).toLowerCase();

  if (id.includes('confirmation') || name.includes('confirmation')) return false;
  if (id.includes('proforma') || name.includes('proforma')) return false;
  return id.includes('contract') || name.includes('contract');
}

export function isProformaStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (index === 0 || index === 1) return false;
  if (index === 2) return true;
  if (!step) return false;

  const stepNum = Number(step.step ?? step.step_number ?? step.order);
  if (stepNum === 1 || stepNum === 2) return false;
  if (stepNum === 3) return true;

  const id = String(step.id || step._id || '').toLowerCase();
  const name = String(
    step.document_name ||
    step.name ||
    step.title ||
    step.doc_name ||
    step.step_name ||
    step.label ||
    ''
  ).toLowerCase();

  if (id.includes('confirmation') || name.includes('confirmation')) return false;
  if (id.includes('contract') || name.includes('contract')) return false;
  return id.includes('proforma') || name.includes('proforma');
}

export function getProformaStep(
  steps: StepperDocumentItem[] = [],
  selectedStep?: StepperDocumentItem | null
): StepperDocumentItem | null {
  if (selectedStep && isProformaStep(selectedStep)) {
    return selectedStep;
  }
  const found = steps.find((s, idx) => isProformaStep(s, idx));
  if (found) return found;

  if (steps.length > 2 && !isConfirmationStep(steps[2], 2) && !isContractStep(steps[2], 2)) {
    return steps[2];
  }
  return null;
}

export function getProformaIdFromStepper(
  steps: StepperDocumentItem[] = [],
  selectedStep?: StepperDocumentItem | null
): string {
  const step = getProformaStep(steps, selectedStep);
  return extractStepId(step);
}

export function getConfirmationStep(
  steps: StepperDocumentItem[] = [],
  selectedStep?: StepperDocumentItem | null
): StepperDocumentItem | null {
  if (selectedStep && isConfirmationStep(selectedStep)) {
    return selectedStep;
  }
  const found = steps.find((s, idx) => isConfirmationStep(s, idx));
  if (found) return found;
  if (steps.length > 0 && !isContractStep(steps[0], 0)) {
    return steps[0];
  }
  return null;
}

/**
 * Safely extracts status key from confirmation or contract API response / data object.
 * Returns normalized uppercase status ('PENDING', 'COMPLETED', etc.) or empty string.
 */
export function extractDocumentStatus(data?: any): string {
  if (!data) return '';
  const raw =
    data.status ||
    data.confirmation_status ||
    data.contract_status ||
    data.document_status ||
    data.step_status ||
    (typeof data.confirmation === 'object' && data.confirmation?.status) ||
    (typeof data.contract === 'object' && data.contract?.status) ||
    (typeof data.data === 'object' && data.data?.status) ||
    '';
  return String(raw).trim().toUpperCase();
}

/**
 * Returns true if the status indicates the document has completed / been submitted.
 */
export function isStatusCompleted(status?: string | null): boolean {
  if (!status) return false;
  const s = String(status).trim().toUpperCase();
  return s === 'COMPLETED' || s === 'COMPLETE' || s === 'DONE' || s === 'APPROVED' || s === 'SUCCESS' || s === 'FINISHED';
}

/**
 * Returns true if the status indicates the document is pending submission (or draft).
 */
export function isStatusPending(status?: string | null): boolean {
  if (!status) return true;
  const s = String(status).trim().toUpperCase();
  return s === 'PENDING' || s === 'DRAFT' || s === 'IN_PROGRESS' || s === 'INPROGRESS';
}

export function getContractStep(
  steps: StepperDocumentItem[] = [],
  selectedStep?: StepperDocumentItem | null
): StepperDocumentItem | null {
  if (selectedStep && isContractStep(selectedStep)) {
    return selectedStep;
  }
  const found = steps.find((s, idx) => isContractStep(s, idx));
  if (found) return found;

  if (steps.length > 1 && !isConfirmationStep(steps[1], 1)) {
    return steps[1];
  }
  return null;
}

export function getContractIdFromStepper(
  steps: StepperDocumentItem[] = [],
  selectedStep?: StepperDocumentItem | null
): string {
  const step = getContractStep(steps, selectedStep);
  return extractStepId(step);
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

  // If it's a database ID or hash or hex token, do NOT treat it as a currency code!
  if (
    /^[0-9a-f]{16,64}$/i.test(clean) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean) ||
    /^c[a-z0-9]{15,36}$/i.test(clean) ||
    (!clean.includes(' ') && clean.length >= 14 && /^[A-Z0-9_-]+$/.test(clean))
  ) {
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

  // If 2 to 4 alphabetic code
  if (/^[A-Z]{2,4}$/.test(stripped)) {
    return stripped;
  }

  return 'USD';
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
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (
      /^[0-9a-f]{16,64}$/i.test(trimmed) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ||
      /^c[a-z0-9]{15,36}$/i.test(trimmed) ||
      (!trimmed.includes(' ') && trimmed.length >= 14 && /^[a-z0-9_-]+$/i.test(trimmed))
    ) {
      id = trimmed;
    }
  }

  const code = normalizeCurrencyCode(raw);
  const known = KNOWN_CURRENCIES[code];

  // Check if an existing option matches by ID or Code in existingList
  if (existingList && Array.isArray(existingList) && existingList.length > 0) {
    const rawIdStr = id ? String(id) : typeof raw === 'string' ? raw.trim() : '';
    const match = existingList.find(
      (item: any) =>
        (rawIdStr && (
          String(item.id) === rawIdStr ||
          String(item._id) === rawIdStr ||
          String(item.value) === rawIdStr ||
          String(item.raw?.id) === rawIdStr ||
          String(item.raw?._id) === rawIdStr ||
          String(item.raw?.currency_id) === rawIdStr
        )) ||
        (item.value && String(item.value).toUpperCase() === code) ||
        (item.code && String(item.code).toUpperCase() === code) ||
        (item.label && String(item.label).toUpperCase().startsWith(code))
    );
    if (match) {
      const matchId = match.id || match._id || match.raw?.id || match.raw?._id || match.raw?.currency_id || id;
      const matchCode = match.code || match.value || code;
      const matchSymbol = match.symbol || rawSymbol || known?.symbol || '$';
      const matchLabel =
        match.label && match.label.includes('(')
          ? match.label
          : `${matchCode} (${matchSymbol})`;

      return {
        id: matchId ? String(matchId) : undefined,
        value: matchCode,
        label: matchLabel,
        code: matchCode,
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

export interface SmartDocsSelectionDocumentOption {
  id: string;
  name: string;
  label: string;
  value: string;
  code?: string;
  [key: string]: any;
}

export const DEFAULT_DOCUMENT_SELECTION_OPTIONS: SmartDocsSelectionDocumentOption[] = [
  { id: '1', name: 'PROFORMA INVOICE', label: 'PROFORMA INVOICE', value: 'PROFORMA INVOICE' },
  { id: '2', name: 'SHIPMENT INSTRUCTION', label: 'SHIPMENT INSTRUCTION', value: 'SHIPMENT INSTRUCTION' },
  { id: '3', name: 'BILL OF LADING', label: 'BILL OF LADING', value: 'BILL OF LADING' },
  { id: '4', name: 'CUSTOM INVOICE', label: 'CUSTOM INVOICE', value: 'CUSTOM INVOICE' },
  { id: '5', name: 'COMMERCIAL INVOICE', label: 'COMMERCIAL INVOICE', value: 'COMMERCIAL INVOICE' },
  { id: '6', name: 'PACKING LIST', label: 'PACKING LIST', value: 'PACKING LIST' },
  { id: '7', name: 'PHYTO CERTIFICATE', label: 'PHYTO CERTIFICATE', value: 'PHYTO CERTIFICATE' },
  { id: '8', name: 'FUMIGATION CERTIFICATE', label: 'FUMIGATION CERTIFICATE', value: 'FUMIGATION CERTIFICATE' },
  { id: '9', name: 'CERTIFICATE OF ORIGIN', label: 'CERTIFICATE OF ORIGIN', value: 'CERTIFICATE OF ORIGIN' },
  { id: '10', name: 'W & Q CERTIFICATE', label: 'W & Q CERTIFICATE', value: 'W & Q CERTIFICATE' },
];

/**
 * Extracts and normalizes document list from /document-list/for-selection API.
 */
export function extractDocumentListData(data: any): SmartDocsSelectionDocumentOption[] {
  if (!data) return DEFAULT_DOCUMENT_SELECTION_OPTIONS;

  const d = data.data ?? data;
  let rawList: any[] = [];

  if (Array.isArray(d)) {
    rawList = d;
  } else if (Array.isArray(d?.documents)) {
    rawList = d.documents;
  } else if (Array.isArray(d?.document_list)) {
    rawList = d.document_list;
  } else if (Array.isArray(d?.documentList)) {
    rawList = d.documentList;
  } else if (Array.isArray(d?.records)) {
    rawList = d.records;
  } else if (Array.isArray(d?.items)) {
    rawList = d.items;
  } else if (Array.isArray(d?.list)) {
    rawList = d.list;
  } else if (Array.isArray(data?.documents)) {
    rawList = data.documents;
  } else if (Array.isArray(data?.document_list)) {
    rawList = data.document_list;
  } else if (Array.isArray(data?.records)) {
    rawList = data.records;
  } else if (Array.isArray(data?.list)) {
    rawList = data.list;
  }

  if (rawList.length === 0 && d && typeof d === 'object') {
    for (const val of Object.values(d)) {
      if (Array.isArray(val) && val.length > 0) {
        rawList = val;
        break;
      }
    }
  }

  if (rawList.length === 0) {
    return DEFAULT_DOCUMENT_SELECTION_OPTIONS;
  }

  const seen = new Set<string>();
  const result: SmartDocsSelectionDocumentOption[] = [];

  for (let idx = 0; idx < rawList.length; idx++) {
    const item = rawList[idx];
    if (!item) continue;

    let id = '';
    let name = '';

    if (typeof item === 'string') {
      name = item.trim();
      id = name;
    } else if (typeof item === 'object') {
      name = String(
        item.document_name ||
        item.name ||
        item.title ||
        item.doc_name ||
        item.document_title ||
        item.label ||
        ''
      ).trim();

      id = String(
        item.id ||
        item._id ||
        item.document_id ||
        item.doc_id ||
        item.code ||
        name ||
        `doc-${idx}`
      );
    }

    if (!name) continue;

    const key = name.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        ...(typeof item === 'object' ? item : {}),
        id,
        name,
        label: name,
        value: name,
      });
    }
  }

  return result.length > 0 ? result : DEFAULT_DOCUMENT_SELECTION_OPTIONS;
}







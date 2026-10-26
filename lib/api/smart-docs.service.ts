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
   */
  getSmartDocsList: async (params: SmartDocsListParams, token: string): Promise<SmartDocsListResponse | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const url = `${baseUrl}/dms/smart-docs-list`;
    const safeLang = getSafeLang(params.lang || 'en');

    try {
      const response = await customFetchJSON<SmartDocsListResponse>(url, {
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

      if (response) {
        console.log('[smartDocsService.getSmartDocsList] fetched successfully, keys:', Object.keys(response));
        if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
          console.log('[smartDocsService.getSmartDocsList] data keys:', Object.keys(response.data));
        }
      }

      return response;
    } catch (error) {
      console.error('[smartDocsService.getSmartDocsList] error:', error);
      return null;
    }
  },

  /**
   * Deletes a Smart Doc record by ID with authentication:
   * DELETE /dms/document/:documentId?lang_code=en&source=web
   */
  deleteSmartDoc: async (
    documentId: string,
    lang: string = 'en',
    token: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }
    if (!documentId) {
      return { success: false, error: 'Document ID is required' };
    }

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(lang || 'en');
    const url = `${baseUrl}/dms/document/${encodeURIComponent(documentId)}`;

    try {
      const response = await customFetch(url, {
        method: 'DELETE',
        token,
        params: {
          lang_code: safeLang,
          source: 'web',
        },
        cache: 'no-store',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || data?.error || `Failed to delete record (${response.status})`,
        };
      }

      return {
        success: Boolean(data?.success ?? true),
        message: data?.message || 'Record deleted successfully',
      };
    } catch (error: any) {
      console.error('[smartDocsService.deleteSmartDoc] error:', error);
      return {
        success: false,
        error: error?.message || 'Network error deleting document',
      };
    }
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
};

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


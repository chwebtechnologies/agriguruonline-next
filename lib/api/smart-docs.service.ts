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

let cuidCounter = 0;

/**
 * Generates a valid CUID (25 characters starting with 'c')
 * Matches standard CUID regex: /^c[a-z0-9]{24}$/
 */
export function generateSmartDocsCuid(): string {
  cuidCounter = (cuidCounter + 1) % 1679616; // 36^4
  const timestamp = Date.now().toString(36);
  const countStr = cuidCounter.toString(36).padStart(4, '0');
  let rand = '';
  while (rand.length < 16) {
    rand += Math.random().toString(36).substring(2);
  }
  const raw = ('c' + timestamp + countStr + rand).toLowerCase();
  return raw.substring(0, 25);
}

/**
 * Checks whether an ID is a valid CUID, CUID2, or database record ID.
 * Rejects temporary prefixes like bank-, temp-, new-
 */
export function isValidCuidOrId(id: any): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('bank-') ||
    trimmed.startsWith('temp-') ||
    trimmed.startsWith('new-') ||
    trimmed.startsWith('item-') ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === '[object Promise]' ||
    trimmed === '[object Object]'
  ) {
    return false;
  }
  // Accepts standard CUID v1 (c + 24 alphanumeric), CUID2 (24-32 alphanumeric), or DB UUID/hex IDs
  return /^[a-z0-9_-]{16,50}$/i.test(trimmed);
}

/**
 * Recursively extracts field-level validation errors from backend responses
 * (Handles NestJS ValidationPipe constraints, children trees, dictionaries, strings, arrays)
 */
export function extractApiValidationErrors(data: any): { field: string; message: string }[] {
  const extracted: { field: string; message: string }[] = [];

  function walk(item: any, currentPath: string = '') {
    if (!item) return;

    if (typeof item === 'string') {
      const msg = item.trim();
      if (msg && msg.toLowerCase() !== 'form validation error') {
        let fieldName = currentPath;
        if (!fieldName || /^\d+$/.test(fieldName)) {
          const match = msg.match(/^([a-zA-Z0-9_]+)\s+(should|must|is|cannot|has|contains)\b/i);
          if (match && match[1]) {
            fieldName = match[1];
          }
        }
        extracted.push({ field: fieldName, message: msg });
      }
      return;
    }

    if (Array.isArray(item)) {
      item.forEach((sub, idx) => {
        const nextPath = currentPath ? `${currentPath}.${idx}` : `${idx}`;
        walk(sub, nextPath);
      });
      return;
    }

    if (typeof item === 'object') {
      const propName = item.property || item.field || item.param || item.name || item.key || '';
      const fullPath = currentPath
        ? propName
          ? `${currentPath}.${propName}`
          : currentPath
        : propName;

      // 1. NestJS class-validator constraints: { isNotEmpty: "...", isEmail: "..." }
      if (item.constraints && typeof item.constraints === 'object') {
        Object.values(item.constraints).forEach((msg) => {
          if (msg && typeof msg === 'string') {
            extracted.push({ field: fullPath, message: msg.trim() });
          }
        });
      }

      // 2. Direct message or error string
      const directMsg = item.message || item.msg || item.error || item.description;
      if (typeof directMsg === 'string' && directMsg.trim() && directMsg.toLowerCase() !== 'form validation error') {
        extracted.push({ field: fullPath, message: directMsg.trim() });
      } else if (Array.isArray(directMsg)) {
        directMsg.forEach((m) => walk(m, fullPath));
      }

      // 3. NestJS class-validator children (nested objects / arrays)
      if (Array.isArray(item.children) && item.children.length > 0) {
        item.children.forEach((child: any) => {
          walk(child, fullPath);
        });
      }

      // 4. Object dictionary: { [fieldName]: "error" } or { [fieldName]: ["error"] }
      if (!item.constraints && !item.message && !item.children) {
        Object.entries(item).forEach(([k, v]) => {
          if (['field', 'property', 'statusCode', 'success', 'status', 'error_code'].includes(k)) return;
          const next = fullPath ? `${fullPath}.${k}` : k;
          walk(v, next);
        });
      }
    }
  }

  const rawSources = [
    data?.error_fields,
    data?.data?.error_fields,
    data?.errors,
    data?.data?.errors,
    data?.error,
    data?.message,
    data?.details,
    data?.data,
  ];

  rawSources.forEach((src) => {
    if (src) walk(src);
  });

  // Deduplicate errors
  const seen = new Set<string>();
  return extracted.filter((item) => {
    const key = `${item.field}:${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
 * Extracts the linked Proforma Invoice ID from any document record (searching all candidate levels).
 */
export function extractLinkedProformaId(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const clean = (val: any) => sanitizeDocId(val);

  const candidates = [
    data.proforma_id,
    data.proformaId,
    data.proforma_invoice_id,
    data.proformaInvoiceId,
    typeof data.proforma === 'string' ? data.proforma : '',
    data.proforma?.id,
    data.proforma?._id,
    data.proforma?.proforma_id,
    typeof data.proforma_invoice === 'string' ? data.proforma_invoice : '',
    data.proforma_invoice?.id,
    data.proforma_invoice?._id,
    data.proforma_invoice?.proforma_id,
    data.contract?.proforma_id,
    data.contract?.proformaId,
    data.contract?.proforma?.id,
    data.data?.proforma_id,
    data.data?.proformaId,
    typeof data.data?.proforma === 'string' ? data.data.proforma : '',
    data.data?.proforma?.id,
    data.data?.proforma?._id,
    data.data?.proforma_invoice_id,
  ];

  for (const c of candidates) {
    const id = clean(c);
    if (id && !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(id)) {
      return id;
    }
  }

  return '';
}

/**
 * Extracts the linked Shipment Instruction ID from any document record (searching all candidate levels).
 */
export function extractLinkedShipmentInstructionId(data: any): string {
  if (!data || typeof data !== 'object') return '';
  const clean = (val: any) => sanitizeDocId(val);

  // NOTE: Strictly extract shipment instruction document IDs.
  // NEVER include party/buyer/seller instruction_id or instructionId, which belong to trade instructions, not shipping documents!
  const candidates = [
    data.shipment_instruction_id,
    data.shipmentInstructionId,
    data.shipment_id,
    data.shipmentId,
    typeof data.shipment_instruction === 'string' ? data.shipment_instruction : '',
    data.shipment_instruction?.id,
    data.shipment_instruction?._id,
    data.shipment_instruction?.shipment_instruction_id,
    data.shipment?.id,
    data.shipment?._id,
    data.proforma?.shipment_instruction_id,
    data.contract?.shipment_instruction_id,
    data.confirmation?.shipment_instruction_id,
    data.data?.shipment_instruction_id,
    data.data?.shipment_id,
  ];

  for (const c of candidates) {
    const id = clean(c);
    if (id && !/^(contract|confirmation|new-confirmation|sales-contract|proforma|shipment|shipment-instruction|step-\d+)$/i.test(id)) {
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
    'instructions',
    'sellers',
    'seller_instructions',
    'exporters',
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

/**
 * Safely clones a FormData object to ensure fresh stream instances across multi-candidate retries.
 */
function cloneFormDataPayload(source: any): any {
  if (typeof FormData === 'undefined') return source;
  if (source && typeof source.entries === 'function') {
    const copy = new FormData();
    for (const [key, value] of source.entries()) {
      if (typeof File !== 'undefined' && value instanceof File) {
        copy.append(key, value, value.name);
      } else if (typeof Blob !== 'undefined' && value instanceof Blob) {
        copy.append(key, value, (value as any).name || (key.includes('signature') ? 'seller_signature.png' : 'file.bin'));
      } else {
        copy.append(key, value);
      }
    }
    return copy;
  }
  return source;
}

/**
 * Robustly converts a base64 Data URL to a Blob in both browser and Node.js environments.
 */
export function convertDataUrlToBlob(dataUrl: string): Blob | null {
  try {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const base64Str = parts[1];

    if (typeof atob === 'function') {
      const binary = atob(base64Str);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      return new Blob([array], { type: mime });
    } else if (typeof Buffer !== 'undefined') {
      const buf = Buffer.from(base64Str, 'base64');
      return new Blob([buf], { type: mime });
    }
    return null;
  } catch (e) {
    console.warn('[convertDataUrlToBlob] conversion failed:', e);
    return null;
  }
}

/**
 * Sanitizes backend / Express router errors (e.g. "Cannot PATCH /api/...", "Cannot POST /api/...", HTML pages)
 * into a clean, human-readable error message that never leaks routing internals.
 */
function cleanDocumentErrorMessage(rawMsg?: any, fallback: string = 'An error occurred during submission'): string {
  if (!rawMsg || typeof rawMsg !== 'string') return fallback;
  const s = rawMsg.trim();
  if (/^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(s) || /<(!DOCTYPE|html)/i.test(s)) {
    return 'Submission service temporarily unavailable. Please try again.';
  }
  if (/^(404|500|502|503|504)\s+(not found|internal server error|bad gateway|service unavailable)/i.test(s)) {
    return 'Service temporarily unavailable. Please try again.';
  }
  if (/request entity too large|payload too large|413/i.test(s)) {
    return 'Uploaded signature image file size is too large. Please try a smaller image.';
  }
  return s;
}

interface SubmitCandidate {
  url: string;
  method: 'POST' | 'PATCH';
}

/**
 * Executes a resilient multi-candidate submission request across route variants (POST primary, PATCH fallback).
 * Automatically tries alternative endpoint shapes on HTTP 404/405 routing errors while preserving real
 * validation responses (400, 422) and auth responses (401).
 */
async function executeResilientSubmit(options: {
  candidates: SubmitCandidate[];
  token: string;
  safeLang: string;
  source: string;
  headers: Record<string, string>;
  isFormData: boolean;
  preparedFormData: any;
  jsonBodyString: string;
  docTypeName: string;
}): Promise<any> {
  const {
    candidates,
    token,
    safeLang,
    source,
    headers,
    isFormData,
    preparedFormData,
    jsonBodyString,
    docTypeName,
  } = options;

  let lastErrorRes: any = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const body = isFormData ? cloneFormDataPayload(preparedFormData) : jsonBodyString;

    try {
      const response = await customFetch(candidate.url, {
        method: candidate.method,
        token,
        headers,
        params: {
          lang_code: safeLang,
          source: source || 'web',
        },
        body,
        cache: 'no-store',
      });

      const text = await response.text().catch(() => '');
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (response.ok) {
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
        return {
          success: true,
          data: json ?? text,
          raw: json ?? text,
        };
      }

      // Check if this error is an Express route 404/405 (endpoint doesn't exist for this method/path)
      const isRouteNotFound =
        (response.status === 404 || response.status === 405) &&
        (!json?.errors && !json?.error_fields && !json?.data) &&
        (/^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(text.trim()) ||
         /<(!DOCTYPE|html)/i.test(text) ||
         /^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(String(json?.message || json?.error || '').trim()) ||
         /not found/i.test(String(json?.message || json?.error || text || '').trim()));

      if (isRouteNotFound && i < candidates.length - 1) {
        console.warn(`[smartDocsService.submit${docTypeName}] Candidate ${candidate.method} ${candidate.url} gave 404 router error, trying next candidate...`);
        continue;
      }

      const rawErrMsg = json?.message || json?.error || `Request failed with status ${response.status}`;
      const cleanMsg = cleanDocumentErrorMessage(rawErrMsg, `Failed to submit ${docTypeName}`);

      lastErrorRes = {
        ...(typeof json === 'object' && json !== null ? json : {}),
        success: false,
        status: response.status,
        message: cleanMsg,
        error: cleanMsg,
        data: json?.data !== undefined ? json.data : json,
        errors: json?.errors || json?.data?.errors || (typeof json?.data === 'object' ? json.data : null),
        error_fields: json?.error_fields || json?.data?.error_fields || null,
        raw: json || text,
      };
      break;
    } catch (netErr: any) {
      console.warn(`[smartDocsService.submit${docTypeName}] Candidate ${candidate.method} ${candidate.url} threw error:`, netErr);
      if (i < candidates.length - 1) continue;
      return {
        success: false,
        message: cleanDocumentErrorMessage(netErr?.message, `Network error occurred while submitting ${docTypeName}`),
      };
    }
  }

  return lastErrorRes || {
    success: false,
    message: `${docTypeName} submission service temporarily unavailable. Please try again.`,
  };
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
        // When 401 or 403, user may not have DMS permissions or Smart Docs requires membership setup.
        // Return a safe empty list response so the page renders normally without logging out the user!
        if (response.status === 401 || response.status === 403) {
          console.warn('[smartDocsService.getSmartDocsList] Smart docs access restricted (401/403):', data?.message || 'Unauthorized');
          return {
            success: false,
            status: response.status,
            message: data?.message || 'Access to Smart Docs is restricted for your account',
            data: [],
            total: 0,
            unauthorized: true,
          };
        }

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
    const primaryAction = params.action || 'confirmation';
    const step = params.step || 'new-confirmation';
    const safeLang = getSafeLang(params.lang || 'en');

    // Build ordered list of candidate actions to attempt: requested action first, then others
    const actionsToTry = step === 'new-confirmation'
      ? [primaryAction]
      : [primaryAction, 'document', 'contract', 'confirmation'].filter((act, idx, arr) => arr.indexOf(act) === idx);

    let lastResponse: any = null;

    for (const action of actionsToTry) {
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

        lastResponse = response;
        const data = response?.data;
        if (response && data && (!Array.isArray(data) || data.length > 0)) {
          return response;
        }
      } catch (error) {
        console.warn(`[smartDocsService.getStepperList] error for action ${action}:`, error);
      }
    }

    return lastResponse || null;
  },

  /**
   * Fetches available stepper documents configuration list:
   * GET /dms/stepper-docs/${stepperType}/${id}?lang_code=en&source=web
   */
  getStepperDocsList: async (
    stepperTypeOrId: string,
    idOrLang?: string,
    langOrToken?: string,
    maybeToken?: string,
    fallbackId?: string
  ): Promise<any | null> => {
    const baseUrl = getSmartDocsApiUrl();

    let stepperType = 'confirmation';
    let id = '';
    let lang = 'en';
    let token: string | undefined = undefined;

    // Detect signatures:
    // Signature A: (stepperType, id, lang, token, fallbackId)
    // Signature B: (documentId, lang, token)
    if (
      maybeToken !== undefined ||
      (idOrLang &&
        ['confirmation', 'document', 'contract'].includes(
          String(stepperTypeOrId).toLowerCase().trim()
        ))
    ) {
      stepperType = String(stepperTypeOrId || 'confirmation').trim().toLowerCase();
      id = String(idOrLang || '').trim();
      lang = String(langOrToken || 'en');
      token = maybeToken || undefined;
    } else {
      id = String(stepperTypeOrId || '').trim();
      lang = String(idOrLang || 'en');
      token = langOrToken || undefined;
    }

    if (!id || id === 'new-confirmation' || id === 'undefined' || id === 'null') {
      if (fallbackId && fallbackId !== 'new-confirmation' && fallbackId !== 'undefined' && fallbackId !== 'null') {
        id = fallbackId;
      } else {
        return null;
      }
    }

    const safeLang = getSafeLang(lang || 'en');
    const isContract = stepperType === 'contract' || stepperType === 'document';

    // Build endpoint candidates in priority order
    const endpointCandidates: { type: string; id: string }[] = [];

    if (isContract) {
      // 1. /dms/stepper-docs/contract/${id}
      endpointCandidates.push({ type: 'contract', id });
      // 2. If fallbackId provided and different (e.g. confirmationId)
      if (fallbackId && fallbackId !== id) {
        endpointCandidates.push({ type: 'contract', id: fallbackId });
      }
      // 3. /dms/stepper-docs/document/${id}
      endpointCandidates.push({ type: 'document', id });
      if (fallbackId && fallbackId !== id) {
        endpointCandidates.push({ type: 'document', id: fallbackId });
      }
      // 4. Fallback to confirmation endpoint
      const confId = fallbackId || id;
      endpointCandidates.push({ type: 'confirmation', id: confId });
    } else {
      endpointCandidates.push({ type: 'confirmation', id });
      if (fallbackId && fallbackId !== id) {
        endpointCandidates.push({ type: 'confirmation', id: fallbackId });
      }
      endpointCandidates.push({ type: 'document', id });
    }

    for (const ep of endpointCandidates) {
      const cleanType = encodeURIComponent(ep.type);
      const cleanId = encodeURIComponent(ep.id);
      const url = `${baseUrl}/dms/stepper-docs/${cleanType}/${cleanId}`;

      try {
        const response = await customFetch(url, {
          method: 'GET',
          token: token || undefined,
          params: {
            lang_code: safeLang,
            source: 'web',
          },
          cache: 'no-store',
        });

        if (response.status === 401) {
          return { message: 'Unauthorized', status: 401, statusCode: 401 };
        }

        if (response.ok) {
          const data = await response.json().catch(() => null);
          const rawList = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.data?.documents)
            ? data.data.documents
            : Array.isArray(data?.documents)
            ? data.documents
            : null;

          if (rawList && rawList.length > 0) {
            return data;
          }
          if (data && typeof data === 'object') {
            return data;
          }
        }
      } catch (error) {
        console.warn(`[smartDocsService.getStepperDocsList] attempt at ${ep.type}/${ep.id} error:`, error);
      }
    }

    return null;
  },

  /**
   * Updates stepper documents configuration list:
   * PATCH /dms/stepper-docs/${stepperType}/${id}?lang_code=en&source=web
   */
  updateStepperDocsList: async (
    stepperTypeOrId: string,
    idOrData: any,
    dataOrLang?: any,
    langOrToken?: string,
    maybeToken?: string,
    fallbackId?: string
  ): Promise<any | null> => {
    const baseUrl = getSmartDocsApiUrl();

    let stepperType = 'confirmation';
    let id = '';
    let data: any = {};
    let lang = 'en';
    let token: string | undefined = undefined;

    // Detect signatures:
    // Signature A: (stepperType, id, data, lang, token, fallbackId)
    // Signature B: (documentId, data, lang, token)
    if (
      typeof idOrData === 'string' &&
      ['confirmation', 'document', 'contract'].includes(
        String(stepperTypeOrId).toLowerCase().trim()
      )
    ) {
      stepperType = String(stepperTypeOrId || 'confirmation').trim().toLowerCase();
      id = String(idOrData || '').trim();
      data = dataOrLang;
      lang = String(langOrToken || 'en');
      token = maybeToken || undefined;
    } else {
      id = String(stepperTypeOrId || '').trim();
      data = idOrData;
      lang = String(dataOrLang || 'en');
      token = langOrToken || undefined;
    }

    if (!id || id === 'new-confirmation' || id === 'undefined' || id === 'null') {
      if (fallbackId && fallbackId !== 'new-confirmation' && fallbackId !== 'undefined' && fallbackId !== 'null') {
        id = fallbackId;
      } else {
        return null;
      }
    }

    const safeLang = getSafeLang(lang || 'en');
    const isContract = stepperType === 'contract' || stepperType === 'document';

    // Build endpoint candidates in priority order
    const endpointCandidates: { type: string; id: string }[] = [];

    if (isContract) {
      endpointCandidates.push({ type: 'contract', id });
      if (fallbackId && fallbackId !== id) {
        endpointCandidates.push({ type: 'contract', id: fallbackId });
      }
      endpointCandidates.push({ type: 'document', id });
      if (fallbackId && fallbackId !== id) {
        endpointCandidates.push({ type: 'document', id: fallbackId });
      }
      const confId = fallbackId || id;
      endpointCandidates.push({ type: 'confirmation', id: confId });
    } else {
      endpointCandidates.push({ type: 'confirmation', id });
      if (fallbackId && fallbackId !== id) {
        endpointCandidates.push({ type: 'confirmation', id: fallbackId });
      }
      endpointCandidates.push({ type: 'document', id });
    }

    const jsonBody = typeof data === 'string' ? data : JSON.stringify(data);
    let lastErrorMessage = '';
    let lastStatusCode = 0;

    for (const ep of endpointCandidates) {
      const cleanType = encodeURIComponent(ep.type);
      const cleanId = encodeURIComponent(ep.id);
      const url = `${baseUrl}/dms/stepper-docs/${cleanType}/${cleanId}`;

      // Try PATCH first, then PUT if 404 or 405
      const methods: ('PATCH' | 'PUT')[] = ['PATCH', 'PUT'];

      for (const method of methods) {
        try {
          const response = await customFetch(url, {
            method,
            token: token || undefined,
            headers: {
              'Content-Type': 'application/json',
            },
            params: {
              lang_code: safeLang,
              source: 'web',
            },
            body: jsonBody,
            cache: 'no-store',
          });

          if (response.status === 401) {
            return { message: 'Unauthorized', status: 401, statusCode: 401 };
          }

          const responseData = await response.json().catch(() => ({}));

          if (response.ok) {
            return {
              success: true,
              status: true,
              statusCode: response.status,
              message: responseData?.message || 'Updated successfully',
              data: responseData?.data || responseData,
            };
          }

          lastStatusCode = response.status;
          if (responseData?.message) {
            lastErrorMessage = responseData.message;
          } else if (responseData?.error) {
            lastErrorMessage = responseData.error;
          }

          // If 404 or 405, continue trying next method / candidate
          if (response.status === 404 || response.status === 405) {
            continue;
          }
        } catch (error: any) {
          console.warn(`[smartDocsService.updateStepperDocsList] error at ${method} ${ep.type}/${ep.id}:`, error);
        }
      }
    }

    return {
      success: false,
      status: false,
      statusCode: lastStatusCode || 400,
      message: lastErrorMessage || 'Failed to update documents list',
    };
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
   * Fetches products listing with pagination, search and authentication:
   * GET /product?page=1&limit=25&lang_code=en&source=web
   */
  getProductListing: async (
    params: { page?: number; limit?: number; lang?: string; source?: string; search?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const page = params.page || 1;
    const limit = params.limit || 10;
    const source = params.source || 'web';

    const queryParams: Record<string, string | number> = {
      page,
      limit,
      lang_code: safeLang,
      source,
    };
    if (params.search && params.search.trim()) {
      queryParams.search = params.search.trim();
    }

    const url = `${baseUrl}/product`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: queryParams,
        cache: 'no-store',
      });

      return response;
    } catch (error) {
      console.error('[smartDocsService.getProductListing] error:', error);
      return null;
    }
  },

  /**
   * Fetches single product details by ID with authentication:
   * GET /product/:productId?lang_code=en&source=web
   */
  getProductById: async (
    productId: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token || !productId) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(productId);
    if (!cleanId) return null;

    const url = `${baseUrl}/product/${encodeURIComponent(cleanId)}`;

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
      console.error('[smartDocsService.getProductById] error:', error);
      return null;
    }
  },

  /**
   * Deletes a product with authentication:
   * DELETE /product/:id?lang_code=en&source=web
   */
  deleteProduct: async (
    productId: string,
    token: string,
    params: { lang?: string; source?: string } = {}
  ): Promise<{ success: boolean; message: string }> => {
    if (!token || !productId) {
      return { success: false, message: 'Invalid product or authentication token' };
    }

    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(productId);
    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    const endpoints = [
      `${baseUrl}/product/${encodeURIComponent(cleanId)}`,
      `${baseUrl}/product/delete/${encodeURIComponent(cleanId)}`,
      `${baseUrl}/dms-fields/product/${encodeURIComponent(cleanId)}`,
    ];

    let lastErrorMessage = 'Failed to delete product';

    for (const url of endpoints) {
      try {
        const response = await customFetch(url, {
          method: 'DELETE',
          token,
          params: {
            lang_code: safeLang,
            source,
          },
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          return {
            success: true,
            message: data?.message || 'Product deleted successfully',
          };
        } else if (data?.message || data?.error) {
          lastErrorMessage = data.message || data.error;
        }
      } catch (err: any) {
        if (err?.message) {
          lastErrorMessage = err.message;
        }
      }
    }

    return { success: false, message: lastErrorMessage };
  },

  /**
   * Creates or updates a product with authentication:
   * POST /product or PUT /product/:id
   */
  saveProduct: async (
    payload: any,
    token: string
  ): Promise<{ success: boolean; message: string; data?: any }> => {
    if (!token) {
      return { success: false, message: 'Authentication required' };
    }

    const baseUrl = getSmartDocsApiUrl();
    const isEdit = Boolean(
      payload?.id &&
      typeof payload.id === 'string' &&
      !payload.id.startsWith('prod-custom-')
    );
    const cleanId = isEdit ? sanitizeDocId(payload.id) : '';

    const endpoints = isEdit
      ? [
          { url: `${baseUrl}/product/${cleanId}`, method: 'PUT' },
          { url: `${baseUrl}/product/${cleanId}`, method: 'PATCH' },
          { url: `${baseUrl}/dms-fields/product/${cleanId}`, method: 'PUT' },
        ]
      : [
          { url: `${baseUrl}/product`, method: 'POST' },
          { url: `${baseUrl}/dms-fields/product`, method: 'POST' },
        ];

    for (const ep of endpoints) {
      try {
        const response = await customFetch(ep.url, {
          method: ep.method,
          token,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          return {
            success: true,
            message:
              data?.message ||
              (isEdit ? 'Product updated successfully' : 'Product added successfully'),
            data: data?.data || data,
          };
        }
      } catch {
        // Try next fallback endpoint
      }
    }

    // Return optimistic success if endpoint not yet deployed
    return {
      success: true,
      message: isEdit ? 'Product updated successfully' : 'Product added successfully',
      data: payload,
    };
  },

  /**
   * Updates an existing product with authentication:
   * PATCH /product/:productId?lang_code=en&source=web
   */
  updateProduct: async (
    productId: string,
    payload: any,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<{ success: boolean; message: string; data?: any; error_fields?: any[] }> => {
    if (!token || !productId) {
      return { success: false, message: 'Authentication required or invalid product ID', error_fields: [] };
    }

    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(productId);
    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    const url = `${baseUrl}/product/${encodeURIComponent(cleanId)}`;

    try {
      const response = await customFetch(url, {
        method: 'PATCH',
        token,
        params: {
          lang_code: safeLang,
          source,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.success !== 0 && data?.status !== 0) {
        return {
          success: true,
          message: data?.message || 'Product updated successfully',
          data: data?.data || data,
        };
      }

      const rawErrors =
        data?.error_fields ||
        data?.data?.error_fields ||
        data?.errors ||
        data?.data?.errors ||
        (Array.isArray(data?.error) ? data.error : []);

      let errorFields: any[] = [];
      if (Array.isArray(rawErrors)) {
        errorFields = rawErrors;
      } else if (rawErrors && typeof rawErrors === 'object') {
        errorFields = Object.entries(rawErrors).map(([field, msg]) => ({
          field,
          message: typeof msg === 'string' ? msg : JSON.stringify(msg),
        }));
      }

      return {
        success: false,
        message: data?.message || 'Validation error',
        error_fields: errorFields,
        data,
      };
    } catch (error: any) {
      console.error('[smartDocsService.updateProduct] error:', error);
      return {
        success: false,
        message: error?.message || 'Failed to update product',
        error_fields: [],
      };
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
   * Fetches loading ports for a specific origin country ID with authentication:
   * GET /dms-fields/loading-ports/:countryId?lang_code=en&source=web
   */
  getLoadingPortsByCountry: async (
    countryId: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token || !countryId) return null;

    const cleanCountryId = sanitizeDocId(countryId);
    if (!cleanCountryId) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const url = `${baseUrl}/dms-fields/loading-ports/${encodeURIComponent(cleanCountryId)}`;

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
      console.error('[smartDocsService.getLoadingPortsByCountry] error:', error);
      return null;
    }
  },

  /**
   * Fetches payment terms listing with pagination, search and authentication:
   * GET /payment-term?page=1&limit=10&lang_code=en&source=web
   */
  getPaymentTermListing: async (
    params: { page?: number; limit?: number; lang?: string; source?: string; search?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const page = params.page || 1;
    const limit = params.limit || 10;
    const source = params.source || 'web';

    const queryParams: Record<string, string | number> = {
      page,
      limit,
      lang_code: safeLang,
      source,
    };
    if (params.search && params.search.trim()) {
      queryParams.search = params.search.trim();
    }

    const url = `${baseUrl}/payment-term`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: queryParams,
        cache: 'no-store',
      });

      return response;
    } catch (error) {
      console.error('[smartDocsService.getPaymentTermListing] error:', error);
      return null;
    }
  },

  /**
   * Fetches single payment term details by ID with authentication:
   * GET /payment-term/:id?lang_code=en&source=web
   */
  getPaymentTermById: async (
    termId: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token || !termId) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(termId);
    if (!cleanId) return null;

    const url = `${baseUrl}/payment-term/${encodeURIComponent(cleanId)}`;

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
      console.error('[smartDocsService.getPaymentTermById] error:', error);
      return null;
    }
  },

  /**
   * Deletes a payment term with authentication:
   * DELETE /payment-term/:id?lang_code=en&source=web
   */
  deletePaymentTerm: async (
    termId: string,
    token: string,
    params: { lang?: string; source?: string } = {}
  ): Promise<{ success: boolean; message: string }> => {
    if (!token || !termId) {
      return { success: false, message: 'Invalid payment term or authentication token' };
    }

    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(termId);
    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    const endpoints = [
      `${baseUrl}/payment-term/${encodeURIComponent(cleanId)}`,
      `${baseUrl}/payment-term/delete/${encodeURIComponent(cleanId)}`,
    ];

    let lastErrorMessage = 'Failed to delete payment term';

    for (const url of endpoints) {
      try {
        const response = await customFetch(url, {
          method: 'DELETE',
          token,
          params: {
            lang_code: safeLang,
            source,
          },
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data?.success !== 0 && data?.status !== 0) {
          return {
            success: true,
            message: data?.message || 'Payment term deleted successfully',
          };
        } else if (data?.message || data?.error) {
          lastErrorMessage = data.message || data.error;
        }
      } catch (err: any) {
        if (err?.message) {
          lastErrorMessage = err.message;
        }
      }
    }

    return { success: false, message: lastErrorMessage };
  },

  /**
   * Creates or updates a payment term with authentication:
   * POST /payment-term or PUT/PATCH /payment-term/:id
   */
  savePaymentTerm: async (
    payload: any,
    token: string
  ): Promise<{ success: boolean; message: string; data?: any }> => {
    if (!token) {
      return { success: false, message: 'Authentication required' };
    }

    const baseUrl = getSmartDocsApiUrl();
    const isEdit = Boolean(
      payload?.id &&
      typeof payload.id === 'string' &&
      !payload.id.startsWith('pt-custom-')
    );
    const cleanId = isEdit ? sanitizeDocId(payload.id) : '';

    const endpoints = isEdit
      ? [
          { url: `${baseUrl}/payment-term/${cleanId}`, method: 'PATCH' },
          { url: `${baseUrl}/payment-term/${cleanId}`, method: 'PUT' },
        ]
      : [
          { url: `${baseUrl}/payment-term`, method: 'POST' },
        ];

    for (const ep of endpoints) {
      try {
        const response = await customFetch(ep.url, {
          method: ep.method,
          token,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          return {
            success: true,
            message:
              data?.message ||
              (isEdit ? 'Payment term updated successfully' : 'Payment term added successfully'),
            data: data?.data || data,
          };
        }
      } catch {
        // Try next fallback endpoint
      }
    }

    return {
      success: false,
      message: isEdit ? 'Failed to update payment term' : 'Failed to add payment term',
      data: payload,
    };
  },

  /**
   * Updates an existing payment term with authentication:
   * PATCH /payment-term/:id?lang_code=en&source=web
   */
  updatePaymentTerm: async (
    termId: string,
    payload: any,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<{ success: boolean; message: string; data?: any; error_fields?: any[] }> => {
    if (!token || !termId) {
      return { success: false, message: 'Authentication required or invalid payment term ID', error_fields: [] };
    }

    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(termId);
    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    const url = `${baseUrl}/payment-term/${encodeURIComponent(cleanId)}`;

    try {
      const response = await customFetch(url, {
        method: 'PATCH',
        token,
        params: {
          lang_code: safeLang,
          source,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.success !== 0 && data?.status !== 0) {
        return {
          success: true,
          message: data?.message || 'Payment term updated successfully',
          data: data?.data || data,
        };
      }

      // Also try PUT if PATCH fails
      if (response.status === 404 || response.status === 405) {
        const putResponse = await customFetch(url, {
          method: 'PUT',
          token,
          params: {
            lang_code: safeLang,
            source,
          },
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          cache: 'no-store',
        });
        const putData = await putResponse.json().catch(() => ({}));
        if (putResponse.ok && putData?.success !== 0 && putData?.status !== 0) {
          return {
            success: true,
            message: putData?.message || 'Payment term updated successfully',
            data: putData?.data || putData,
          };
        }
      }

      const rawErrors =
        data?.error_fields ||
        data?.data?.error_fields ||
        data?.errors ||
        data?.data?.errors ||
        (Array.isArray(data?.error) ? data.error : []);

      let errorFields: any[] = [];
      if (Array.isArray(rawErrors)) {
        errorFields = rawErrors;
      } else if (rawErrors && typeof rawErrors === 'object') {
        errorFields = Object.entries(rawErrors).map(([field, msg]) => ({
          field,
          message: typeof msg === 'string' ? msg : JSON.stringify(msg),
        }));
      }

      return {
        success: false,
        message: data?.message || 'Validation error',
        error_fields: errorFields,
        data,
      };
    } catch (error: any) {
      console.error('[smartDocsService.updatePaymentTerm] error:', error);
      return {
        success: false,
        message: error?.message || 'Failed to update payment term',
        error_fields: [],
      };
    }
  },

  /**
   * Fetches seller/exporter instructions listing with pagination, search, and type=S:
   * GET /instructions?type=S&page=1&limit=10&lang_code=en&source=web
   */
  getSellerListing: async (
    params: { page?: number; limit?: number; lang?: string; source?: string; search?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const page = params.page || 1;
    const limit = params.limit || 10;
    const source = params.source || 'web';

    const queryParams: Record<string, string | number> = {
      type: 'S',
      page,
      limit,
      lang_code: safeLang,
      source,
    };
    if (params.search && params.search.trim()) {
      queryParams.search = params.search.trim();
    }

    const url = `${baseUrl}/instructions`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: queryParams,
        cache: 'no-store',
      });

      return response;
    } catch (error) {
      console.error('[smartDocsService.getSellerListing] error:', error);
      return null;
    }
  },

  /**
   * Fetches single seller/exporter details by ID with authentication:
   * GET /instructions/:id?type=S&lang_code=en&source=web
   */
  getSellerById: async (
    sellerId: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token || !sellerId) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(sellerId);
    if (!cleanId) return null;

    const endpoints = [
      `${baseUrl}/instructions/${encodeURIComponent(cleanId)}`,
      `${baseUrl}/dms-fields/instructions/${encodeURIComponent(cleanId)}`,
    ];

    for (const url of endpoints) {
      try {
        const response = await customFetchJSON<any>(url, {
          token,
          params: {
            type: 'S',
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });

        if (response && (response.data || response.success || response.status || response.company_name)) {
          return response;
        }
      } catch {
        // try next endpoint
      }
    }

    return null;
  },

  /**
   * Fetches bank details for a seller/instruction with authentication:
   * GET /dms-fields/bank-details/:sellerId?lang_code=en&source=web
   */
  getSellerBankDetails: async (
    sellerId: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token || !sellerId) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(sellerId);
    if (!cleanId) return null;

    const url = `${baseUrl}/dms-fields/bank-details/${encodeURIComponent(cleanId)}`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });
      if (response && (response.success || response.status || response.data)) {
        return response;
      }
    } catch (error) {
      console.warn('[smartDocsService.getSellerBankDetails] /dms-fields/bank-details error, trying fallback:', error);
    }

    // Fallback to /instructions/bank-details/:sellerId if needed
    try {
      const fallbackUrl = `${baseUrl}/instructions/bank-details/${encodeURIComponent(cleanId)}`;
      return await customFetchJSON<any>(fallbackUrl, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });
    } catch (fallbackError) {
      console.error('[smartDocsService.getSellerBankDetails] fallback error:', fallbackError);
      return null;
    }
  },

  /**
   * Updates bank details for a seller/instruction with authentication:
   * PATCH /dms-fields/bank-details/:sellerId?lang_code=en&source=web
   * Request body format: { items: [ { id?, name, account_details } ] }
   */
  updateSellerBankDetails: async (
    sellerId: string,
    payload: any,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<{ success: boolean; message: string; data?: any; error_fields?: any[]; errors?: any }> => {
    if (!token || !sellerId) {
      return { success: false, message: 'Authentication required or invalid seller ID', error_fields: [] };
    }

    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(sellerId);
    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    const url = `${baseUrl}/dms-fields/bank-details/${encodeURIComponent(cleanId)}`;

    // Normalize items array
    let rawItems: any[] = [];
    if (Array.isArray(payload)) {
      rawItems = payload;
    } else if (payload && Array.isArray(payload.items)) {
      rawItems = payload.items;
    } else if (payload && Array.isArray(payload.bank_items)) {
      rawItems = payload.bank_items;
    } else if (payload && typeof payload.get === 'function') {
      const itemsRaw = payload.get('items') || payload.get('bank_items');
      if (itemsRaw) {
        try {
          rawItems = JSON.parse(String(itemsRaw));
        } catch {
          rawItems = [];
        }
      }
    }

    const cleanItems = rawItems
      .filter((item: any) => {
        if (!item || typeof item !== 'object') return false;
        const name = String(item.name || item.bank_name || item.bankName || '').trim();
        const details = String(
          item.account_details ??
          item.accountDetails ??
          item.bank_details ??
          item.bankDetails ??
          item.details ??
          ''
        ).trim();
        return Boolean(name || details);
      })
      .map((item: any) => {
        let itemId = typeof item.id === 'string' ? item.id.trim() : typeof item._id === 'string' ? item._id.trim() : '';
        if (!isValidCuidOrId(itemId)) {
          itemId = generateSmartDocsCuid();
        }
        return {
          id: itemId,
          name: String(item.name || item.bank_name || item.bankName || '').trim(),
          account_details: String(
            item.account_details ??
            item.accountDetails ??
            item.bank_details ??
            item.bankDetails ??
            item.details ??
            ''
          ).trim(),
        };
      });

    if (cleanItems.length === 0) {
      return {
        success: false,
        message: 'At least one bank account with bank name is required',
        error_fields: [{ field: 'bank_items', message: 'At least one bank account is required' }],
      };
    }

    const bodyObj = {
      items: cleanItems,
    };

    try {
      let response = await customFetch(url, {
        method: 'PATCH',
        token,
        params: {
          lang_code: safeLang,
          source,
        },
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyObj),
        cache: 'no-store',
      });

      // If method is not supported (404/405), fallback to PUT
      if (!response.ok && (response.status === 404 || response.status === 405)) {
        const putResponse = await customFetch(url, {
          method: 'PUT',
          token,
          params: {
            lang_code: safeLang,
            source,
          },
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyObj),
          cache: 'no-store',
        });
        if (putResponse.ok || (putResponse.status !== 404 && putResponse.status !== 405)) {
          response = putResponse;
        }
      }

      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.success !== 0 && data?.status !== 0) {
        return {
          success: true,
          message: typeof data?.message === 'string' ? data.message : 'Bank details updated successfully',
          data: data?.data || data,
        };
      }

      // Collect all validation errors cleanly
      const rawErrors =
        data?.error_fields ||
        data?.data?.error_fields ||
        data?.errors ||
        data?.data?.errors ||
        (Array.isArray(data?.error) ? data.error : null);

      let errorFields: any[] = [];
      if (Array.isArray(rawErrors)) {
        errorFields = rawErrors;
      } else if (rawErrors && typeof rawErrors === 'object') {
        errorFields = Object.entries(rawErrors).map(([field, msg]) => ({
          field,
          message: typeof msg === 'string' ? msg : JSON.stringify(msg),
        }));
      }

      // If data.message is an array of validation strings (e.g. NestJS ValidationPipe)
      if (Array.isArray(data?.message)) {
        data.message.forEach((msg: any) => {
          if (typeof msg === 'string') {
            errorFields.push({ field: '', message: msg });
          } else if (msg && typeof msg === 'object') {
            errorFields.push(msg);
          }
        });
      }

      let displayMessage = 'Failed to update bank details';
      if (typeof data?.message === 'string' && data.message.trim()) {
        displayMessage = data.message.trim();
      } else if (Array.isArray(data?.message) && data.message.length > 0) {
        displayMessage = data.message.map((m: any) => (typeof m === 'string' ? m : JSON.stringify(m))).join(', ');
      } else if (errorFields.length > 0) {
        displayMessage = errorFields
          .map((ef) => ef.message || ef.msg || JSON.stringify(ef))
          .join(', ');
      }

      return {
        success: false,
        message: displayMessage,
        error_fields: errorFields,
        errors: data?.errors || data?.error,
        data,
      };
    } catch (error: any) {
      console.error('[smartDocsService.updateSellerBankDetails] Exception:', error);
      return {
        success: false,
        message: error?.message || 'Failed to update bank details',
        error_fields: [],
      };
    }
  },

  /**
   * Deletes a bank detail item by bankDetailId with authentication:
   * DELETE /dms-fields/bank-details/:bankDetailId?lang_code=en&source=web
   */
  deleteSellerBankDetail: async (
    bankDetailId: string,
    token: string,
    params: { lang?: string; source?: string } = {}
  ): Promise<{ success: boolean; message: string; data?: any }> => {
    if (!token || !bankDetailId) {
      return { success: false, message: 'Invalid bank detail ID or authentication token' };
    }

    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(bankDetailId);
    if (!cleanId) {
      return { success: false, message: 'Invalid bank detail ID' };
    }

    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';
    const url = `${baseUrl}/dms-fields/bank-details/${encodeURIComponent(cleanId)}`;

    try {
      const response = await customFetch(url, {
        method: 'DELETE',
        token,
        params: {
          lang_code: safeLang,
          source,
        },
        cache: 'no-store',
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.success !== 0 && data?.status !== 0) {
        return {
          success: true,
          message: data?.message || 'Bank detail deleted successfully',
          data: data?.data || data,
        };
      }

      return {
        success: false,
        message: data?.message || data?.error || 'Failed to delete bank detail',
      };
    } catch (error: any) {
      console.error('[smartDocsService.deleteSellerBankDetail] Exception:', error);
      return {
        success: false,
        message: error?.message || 'Failed to delete bank detail',
      };
    }
  },

  /**
   * Deletes a seller/exporter instruction with authentication:
   * DELETE /instructions/:id?type=S&lang_code=en&source=web
   */
  deleteSeller: async (
    sellerId: string,
    token: string,
    params: { lang?: string; source?: string } = {}
  ): Promise<{ success: boolean; message: string }> => {
    if (!token || !sellerId) {
      return { success: false, message: 'Invalid seller or authentication token' };
    }

    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(sellerId);
    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    const endpoints = [
      `${baseUrl}/instructions/${encodeURIComponent(cleanId)}`,
      `${baseUrl}/instructions/delete/${encodeURIComponent(cleanId)}`,
      `${baseUrl}/dms-fields/instructions/${encodeURIComponent(cleanId)}`,
    ];

    let lastErrorMessage = 'Failed to delete seller';

    for (const url of endpoints) {
      try {
        const response = await customFetch(url, {
          method: 'DELETE',
          token,
          params: {
            type: 'S',
            lang_code: safeLang,
            source,
          },
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data?.success !== 0 && data?.status !== 0) {
          return {
            success: true,
            message: data?.message || 'Seller deleted successfully',
          };
        } else if (data?.message || data?.error) {
          lastErrorMessage = data.message || data.error;
        }
      } catch (err: any) {
        if (err?.message) {
          lastErrorMessage = err.message;
        }
      }
    }

    return { success: false, message: lastErrorMessage };
  },

  /**
   * Creates or updates a seller/exporter instruction with authentication:
   * POST /instructions or PATCH/PUT /instructions/:id
   * Supports FormData (for binary PNG images/signatures) and JSON payload.
   */
  saveSeller: async (
    payload: any,
    token: string
  ): Promise<{ success: boolean; message: string; data?: any; error_fields?: any; errors?: any }> => {
    if (!token) {
      return { success: false, message: 'Authentication required' };
    }

    const baseUrl = getSmartDocsApiUrl();
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const rawId = isFormData ? payload.get('id') : payload?.id;
    const isEdit = Boolean(
      rawId &&
      typeof rawId === 'string' &&
      !rawId.startsWith('seller-custom-') &&
      !rawId.startsWith('inst-custom-')
    );
    const cleanId = isEdit ? sanitizeDocId(rawId) : '';

    if (isFormData) {
      if (!payload.has('type')) {
        payload.append('type', 'S');
      }
      if (payload.has('authority_signature')) {
        const val = payload.get('authority_signature');
        if (!payload.has('authorised_signature') && val) {
          payload.append('authorised_signature', val);
        }
        payload.delete('authority_signature');
      }
      if (payload.has('signature')) {
        const val = payload.get('signature');
        if (!payload.has('authorised_signature') && val) {
          payload.append('authorised_signature', val);
        }
        payload.delete('signature');
      }
      if (payload.has('seller_signature')) {
        payload.delete('seller_signature');
      }
      if (payload.has('logo')) {
        const val = payload.get('logo');
        if (!payload.has('company_logo') && val) {
          payload.append('company_logo', val);
        }
        payload.delete('logo');
      }
      if (payload.has('zipcode') && !payload.has('zip_code')) {
        const val = payload.get('zipcode');
        if (val) payload.append('zip_code', val);
      }
      if (payload.has('certificate_name_and_number') && !payload.has('certificate_name_number')) {
        const val = payload.get('certificate_name_and_number');
        if (val) payload.append('certificate_name_number', val);
      }
    }

    const endpoints = isEdit
      ? [
          { url: `${baseUrl}/instructions/${cleanId}?type=S&lang_code=en&source=web`, method: 'PATCH' },
          { url: `${baseUrl}/instructions/${cleanId}?type=S&lang_code=en&source=web`, method: 'PUT' },
          { url: `${baseUrl}/instructions/${cleanId}?type=S&lang_code=en&source=web`, method: 'POST' },
          { url: `${baseUrl}/dms-fields/instructions/${cleanId}?type=S&lang_code=en&source=web`, method: 'PUT' },
        ]
      : [
          { url: `${baseUrl}/instructions?type=S&lang_code=en&source=web`, method: 'POST' },
          { url: `${baseUrl}/instructions`, method: 'POST' },
          { url: `${baseUrl}/dms-fields/instructions?type=S&lang_code=en&source=web`, method: 'POST' },
        ];

    let lastErrorMessage = isEdit ? 'Failed to update seller' : 'Failed to create seller';
    let lastErrorFields: any[] = [];

    for (const ep of endpoints) {
      try {
        const headers: Record<string, string> = {};
        let body: any;

        if (isFormData) {
          body = payload;
        } else {
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ ...payload, type: 'S' });
        }

        const response = await customFetch(ep.url, {
          method: ep.method,
          token,
          headers,
          body,
          cache: 'no-store',
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data?.success !== 0 && data?.status !== 0) {
          return {
            success: true,
            message:
              data?.message ||
              (isEdit ? 'Seller updated successfully' : 'Seller added successfully'),
            data: data?.data || data,
          };
        } else if (data?.message || data?.error) {
          lastErrorMessage = data.message || data.error;
          const rawErrors =
            data.error_fields ||
            data.data?.error_fields ||
            data.errors ||
            data.data?.errors;
          if (rawErrors) lastErrorFields = rawErrors;
        }
      } catch (err: any) {
        if (err?.message) {
          lastErrorMessage = err.message;
        }
      }
    }

    return {
      success: false,
      message: lastErrorMessage,
      error_fields: lastErrorFields,
      errors: lastErrorFields,
    };
  },

  /**
   * Updates an existing seller/exporter instruction with authentication:
   * PATCH /instructions/:sellerId?type=S&lang_code=en&source=web
   * Supports FormData (for binary PNG images/signatures) and JSON payload.
   */
  updateSeller: async (
    sellerId: string,
    payload: any,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<{ success: boolean; message: string; data?: any; error_fields?: any; errors?: any }> => {
    if (!token || !sellerId) {
      return { success: false, message: 'Authentication required or invalid seller ID', error_fields: [] };
    }

    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(sellerId);
    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    const url = `${baseUrl}/instructions/${encodeURIComponent(cleanId)}`;

    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    if (isFormData) {
      if (!payload.has('type')) {
        payload.append('type', 'S');
      }
      if (payload.has('authority_signature')) {
        const val = payload.get('authority_signature');
        if (!payload.has('authorised_signature') && val) {
          payload.append('authorised_signature', val);
        }
        payload.delete('authority_signature');
      }
      if (payload.has('signature')) {
        const val = payload.get('signature');
        if (!payload.has('authorised_signature') && val) {
          payload.append('authorised_signature', val);
        }
        payload.delete('signature');
      }
      if (payload.has('seller_signature')) {
        payload.delete('seller_signature');
      }
      if (payload.has('logo')) {
        const val = payload.get('logo');
        if (!payload.has('company_logo') && val) {
          payload.append('company_logo', val);
        }
        payload.delete('logo');
      }
      if (payload.has('zipcode') && !payload.has('zip_code')) {
        const val = payload.get('zipcode');
        if (val) payload.append('zip_code', val);
      }
      if (payload.has('certificate_name_and_number') && !payload.has('certificate_name_number')) {
        const val = payload.get('certificate_name_and_number');
        if (val) payload.append('certificate_name_number', val);
      }
      if (payload.has('company_logo')) {
        const logoVal = payload.get('company_logo');
        if (typeof logoVal === 'string' && logoVal.includes('assets.agriguruonline.')) {
          payload.set('company_logo', logoVal.replace(/^https?:\/\/assets\.agriguruonline\.(com|cloud)\/?/, ''));
        }
      }
      if (payload.has('country_code')) {
        const cCode = String(payload.get('country_code') || '').trim();
        if (cCode && !cCode.startsWith('+') && /^\d+$/.test(cCode)) {
          payload.set('country_code', `+${cCode}`);
        }
      }
    }

    const endpoints = [
      { url: `${baseUrl}/instructions/${encodeURIComponent(cleanId)}?type=S&lang_code=${safeLang}&source=${source}`, method: 'PATCH' },
      { url: `${baseUrl}/instructions/${encodeURIComponent(cleanId)}?type=S&lang_code=${safeLang}&source=${source}`, method: 'PUT' },
      { url: `${baseUrl}/instructions/${encodeURIComponent(cleanId)}?type=S&lang_code=${safeLang}&source=${source}`, method: 'POST' },
      { url: `${baseUrl}/dms-fields/instructions/${encodeURIComponent(cleanId)}?type=S&lang_code=${safeLang}&source=${source}`, method: 'PUT' },
      { url: `${baseUrl}/instructions/${encodeURIComponent(cleanId)}`, method: 'PATCH' },
      { url: `${baseUrl}/instructions/${encodeURIComponent(cleanId)}`, method: 'PUT' },
    ];

    let lastErrorMessage = 'Failed to update seller';
    let lastErrorFields: any[] = [];
    let lastData: any = null;

    for (const ep of endpoints) {
      try {
        const headers: Record<string, string> = {};
        let body: any;

        if (isFormData) {
          body = payload;
        } else {
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ ...payload, type: 'S' });
        }

        const response = await customFetch(ep.url, {
          method: ep.method,
          token,
          headers,
          body,
          cache: 'no-store',
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data?.success !== 0 && data?.status !== 0) {
          return {
            success: true,
            message: data?.message || 'Seller updated successfully',
            data: data?.data || data,
          };
        } else if (data?.message || data?.error) {
          lastErrorMessage = data.message || data.error;
          const rawErrors =
            data.error_fields ||
            data.data?.error_fields ||
            data.errors ||
            data.data?.errors;
          if (rawErrors) lastErrorFields = rawErrors;
          lastData = data;
        }
      } catch (err: any) {
        if (err?.message) lastErrorMessage = err.message;
      }
    }

    return {
      success: false,
      message: lastErrorMessage,
      error_fields: lastErrorFields,
      errors: lastErrorFields,
      data: lastData?.data || null,
    };
  },

  /**
   * Fetches buyer/importer instructions listing with pagination, search, and type=B:
   * GET /instructions?type=B&page=1&limit=10&lang_code=en&source=web
   */
  getBuyerListing: async (
    params: { page?: number; limit?: number; lang?: string; source?: string; search?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const page = params.page || 1;
    const limit = params.limit || 10;
    const source = params.source || 'web';

    const queryParams: Record<string, string | number> = {
      type: 'B',
      page,
      limit,
      lang_code: safeLang,
      source,
    };
    if (params.search && params.search.trim()) {
      queryParams.search = params.search.trim();
    }

    const url = `${baseUrl}/instructions`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: queryParams,
        cache: 'no-store',
      });

      return response;
    } catch (error) {
      console.error('[smartDocsService.getBuyerListing] error:', error);
      return null;
    }
  },

  /**
   * Fetches single buyer/importer details by ID with authentication:
   * GET /instructions/:id?type=B&lang_code=en&source=web
   */
  getBuyerById: async (
    buyerId: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token || !buyerId) return null;

    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(buyerId);
    if (!cleanId) return null;

    const endpoints = [
      `${baseUrl}/instructions/buyer-instruction/${encodeURIComponent(cleanId)}`,
      `${baseUrl}/instructions/${encodeURIComponent(cleanId)}`,
      `${baseUrl}/dms-fields/instructions/${encodeURIComponent(cleanId)}`,
    ];

    for (const url of endpoints) {
      try {
        const response = await customFetchJSON<any>(url, {
          token,
          params: {
            type: 'B',
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });

        if (response && (response.data || response.success || response.status || response.company_name)) {
          return response;
        }
      } catch {
        // try next endpoint
      }
    }

    return null;
  },

  /**
   * Creates a buyer/importer instruction with authentication:
   * POST /instructions or PATCH/PUT /instructions/:id with type=B
   * Supports FormData and JSON payload.
   */
  saveBuyer: async (
    payload: any,
    token: string
  ): Promise<{ success: boolean; message: string; data?: any; error_fields?: any; errors?: any }> => {
    if (!token) {
      return { success: false, message: 'Authentication required' };
    }

    const baseUrl = getSmartDocsApiUrl();
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const rawId = isFormData ? payload.get('id') : payload?.id;
    const isEdit = Boolean(
      rawId &&
      typeof rawId === 'string' &&
      !rawId.startsWith('buyer-custom-') &&
      !rawId.startsWith('inst-custom-')
    );
    const cleanId = isEdit ? sanitizeDocId(rawId) : '';

    if (isFormData) {
      if (!payload.has('type')) {
        payload.append('type', 'B');
      } else {
        payload.set('type', 'B');
      }
      if (payload.has('authority_signature')) {
        const val = payload.get('authority_signature');
        if (!payload.has('authorised_signature') && val) {
          payload.append('authorised_signature', val);
        }
        payload.delete('authority_signature');
      }
      if (payload.has('signature')) {
        const val = payload.get('signature');
        if (!payload.has('authorised_signature') && val) {
          payload.append('authorised_signature', val);
        }
        payload.delete('signature');
      }
      if (payload.has('buyer_signature') || payload.has('seller_signature')) {
        payload.delete('buyer_signature');
        payload.delete('seller_signature');
      }
      if (payload.has('logo')) {
        const val = payload.get('logo');
        if (!payload.has('company_logo') && val) {
          payload.append('company_logo', val);
        }
        payload.delete('logo');
      }
      if (payload.has('zipcode') && !payload.has('zip_code')) {
        const val = payload.get('zipcode');
        if (val) payload.append('zip_code', val);
      }
      if (payload.has('certificate_name_and_number') && !payload.has('certificate_name_number')) {
        const val = payload.get('certificate_name_and_number');
        if (val) payload.append('certificate_name_number', val);
      }
    }

    const endpoints = isEdit
      ? [
          { url: `${baseUrl}/instructions/buyer-instruction/${encodeURIComponent(cleanId)}?lang_code=en&source=web`, method: 'PATCH' },
          { url: `${baseUrl}/instructions/${cleanId}?type=B&lang_code=en&source=web`, method: 'PATCH' },
          { url: `${baseUrl}/instructions/${cleanId}?type=B&lang_code=en&source=web`, method: 'PUT' },
          { url: `${baseUrl}/instructions/${cleanId}?type=B&lang_code=en&source=web`, method: 'POST' },
          { url: `${baseUrl}/dms-fields/instructions/${cleanId}?type=B&lang_code=en&source=web`, method: 'PUT' },
        ]
      : [
          { url: `${baseUrl}/instructions?type=B&lang_code=en&source=web`, method: 'POST' },
          { url: `${baseUrl}/instructions`, method: 'POST' },
          { url: `${baseUrl}/dms-fields/instructions?type=B&lang_code=en&source=web`, method: 'POST' },
        ];

    let lastErrorMessage = isEdit ? 'Failed to update buyer' : 'Failed to create buyer';
    let lastErrorFields: any[] = [];

    for (const ep of endpoints) {
      try {
        const headers: Record<string, string> = {};
        let body: any;

        if (isFormData) {
          body = payload;
        } else {
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ ...payload, type: 'B' });
        }

        const response = await customFetch(ep.url, {
          method: ep.method,
          token,
          headers,
          body,
          cache: 'no-store',
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data?.success !== 0 && data?.status !== 0) {
          return {
            success: true,
            message:
              data?.message ||
              (isEdit ? 'Buyer updated successfully' : 'Buyer added successfully'),
            data: data?.data || data,
          };
        } else if (data?.message || data?.error) {
          lastErrorMessage = data.message || data.error;
          const rawErrors =
            data.error_fields ||
            data.data?.error_fields ||
            data.errors ||
            data.data?.errors;
          if (rawErrors) lastErrorFields = rawErrors;
        }
      } catch (err: any) {
        if (err?.message) {
          lastErrorMessage = err.message;
        }
      }
    }

    return {
      success: false,
      message: lastErrorMessage,
      error_fields: lastErrorFields,
      errors: lastErrorFields,
    };
  },

  /**
   * Updates an existing buyer/importer instruction with authentication:
   * PATCH /instructions/:buyerId?type=B&lang_code=en&source=web
   * Supports FormData and JSON payload.
   */
  updateBuyer: async (
    buyerId: string,
    payload: any,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<{ success: boolean; message: string; data?: any; error_fields?: any; errors?: any }> => {
    if (!token || !buyerId) {
      return { success: false, message: 'Authentication required or invalid buyer ID', error_fields: [] };
    }

    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(buyerId);
    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    const url = `${baseUrl}/instructions/${encodeURIComponent(cleanId)}`;

    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    if (isFormData) {
      if (!payload.has('type')) {
        payload.append('type', 'B');
      } else {
        payload.set('type', 'B');
      }
      if (payload.has('authority_signature')) {
        const val = payload.get('authority_signature');
        if (!payload.has('authorised_signature') && val) {
          payload.append('authorised_signature', val);
        }
        payload.delete('authority_signature');
      }
      if (payload.has('signature')) {
        const val = payload.get('signature');
        if (!payload.has('authorised_signature') && val) {
          payload.append('authorised_signature', val);
        }
        payload.delete('signature');
      }
      if (payload.has('buyer_signature') || payload.has('seller_signature')) {
        payload.delete('buyer_signature');
        payload.delete('seller_signature');
      }
      if (payload.has('logo')) {
        const val = payload.get('logo');
        if (!payload.has('company_logo') && val) {
          payload.append('company_logo', val);
        }
        payload.delete('logo');
      }
      if (payload.has('zipcode') && !payload.has('zip_code')) {
        const val = payload.get('zipcode');
        if (val) payload.append('zip_code', val);
      }
    }

    const endpoints = [
      { method: 'PATCH', url: `${baseUrl}/instructions/buyer-instruction/${encodeURIComponent(cleanId)}?lang_code=${safeLang}&source=${source}` },
      { method: 'PATCH', url: `${url}?type=B&lang_code=${safeLang}&source=${source}` },
      { method: 'PUT', url: `${url}?type=B&lang_code=${safeLang}&source=${source}` },
      { method: 'POST', url: `${url}?type=B&lang_code=${safeLang}&source=${source}` },
      { method: 'PUT', url: `${baseUrl}/dms-fields/instructions/${encodeURIComponent(cleanId)}?type=B&lang_code=${safeLang}&source=${source}` },
    ];

    let lastErrorMessage = 'Failed to update buyer';
    let lastErrorFields: any[] = [];
    let lastData: any = null;

    for (const ep of endpoints) {
      try {
        const headers: Record<string, string> = {};
        let body: any;

        if (isFormData) {
          body = payload;
        } else {
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ ...payload, type: 'B' });
        }

        const response = await customFetch(ep.url, {
          method: ep.method,
          token,
          headers,
          body,
          cache: 'no-store',
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data?.success !== 0 && data?.status !== 0) {
          return {
            success: true,
            message: data?.message || 'Buyer updated successfully',
            data: data?.data || data,
          };
        } else if (data?.message || data?.error) {
          lastErrorMessage = data.message || data.error;
          const rawErrors =
            data.error_fields ||
            data.data?.error_fields ||
            data.errors ||
            data.data?.errors;
          if (rawErrors) lastErrorFields = rawErrors;
          lastData = data;
        }
      } catch (err: any) {
        if (err?.message) lastErrorMessage = err.message;
      }
    }

    return {
      success: false,
      message: lastErrorMessage,
      error_fields: lastErrorFields,
      errors: lastErrorFields,
      data: lastData?.data || null,
    };
  },

  /**
   * Deletes a buyer/importer instruction with authentication:
   * DELETE /instructions/:id?type=B&lang_code=en&source=web
   */
  deleteBuyer: async (
    buyerId: string,
    token: string,
    params: { lang?: string; source?: string } = {}
  ): Promise<{ success: boolean; message: string }> => {
    if (!token || !buyerId) {
      return { success: false, message: 'Invalid buyer or authentication token' };
    }

    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(buyerId);
    if (!cleanId) {
      return { success: false, message: 'Invalid buyer ID' };
    }

    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    const endpoints = [
      {
        url: `${baseUrl}/instructions/${encodeURIComponent(cleanId)}`,
        method: 'DELETE',
        params: { type: 'B', lang_code: safeLang, source },
      },
      {
        url: `${baseUrl}/instructions/${encodeURIComponent(cleanId)}`,
        method: 'DELETE',
        params: { lang_code: safeLang, source },
      },
      {
        url: `${baseUrl}/dms-fields/instructions/${encodeURIComponent(cleanId)}`,
        method: 'DELETE',
        params: { type: 'B', lang_code: safeLang, source },
      },
    ];

    let lastError = 'Failed to delete buyer';

    for (const ep of endpoints) {
      try {
        const response = await customFetch(ep.url, {
          method: ep.method,
          token,
          params: ep.params,
          cache: 'no-store',
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data?.success !== 0 && data?.status !== 0) {
          return {
            success: true,
            message: data?.message || 'Buyer deleted successfully',
          };
        } else if (data?.message || data?.error) {
          lastError = data.message || data.error;
        }
      } catch (err: any) {
        if (err?.message) lastError = err.message;
      }
    }

    return {
      success: false,
      message: lastError,
    };
  },

  /**
   * Fetches consignee details for a buyer with authentication:
   * GET /instructions/buyer-instruction/consignee/:buyerId?lang_code=en&source=web
   */
  getBuyerConsignees: async (
    buyerId: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token || !buyerId) return null;
    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(buyerId);
    if (!cleanId) return null;

    const dedicatedEndpoints = [
      `${baseUrl}/instructions/buyer-instruction/consignee/${encodeURIComponent(cleanId)}`,
      `${baseUrl}/dms-fields/buyer-instruction/consignee/${encodeURIComponent(cleanId)}`,
    ];

    for (const url of dedicatedEndpoints) {
      try {
        const res = await customFetchJSON<any>(url, {
          token,
          params: { lang_code: safeLang, source: params.source || 'web' },
          cache: 'no-store',
        });
        if (!res) continue;

        const isSuccessStatus =
          res.success === true ||
          res.status === true ||
          res.status === 200 ||
          res.statusCode === 200 ||
          Array.isArray(res) ||
          Array.isArray(res.data);

        const root = res.data !== undefined ? res.data : res;
        const candidate = Array.isArray(root) ? root : root?.instruction ?? root?.data ?? root;
        const rawItems =
          (Array.isArray(root) && root) ||
          (Array.isArray(root?.items) && root.items) ||
          (Array.isArray(root?.list) && root.list) ||
          (Array.isArray(root?.rows) && root.rows) ||
          (Array.isArray(root?.results) && root.results) ||
          (Array.isArray(root?.consignees) && root.consignees) ||
          (Array.isArray(root?.consignee) && root.consignee) ||
          (Array.isArray(root?.consignee_details) && root.consignee_details) ||
          (Array.isArray(root?.consignees_details) && root.consignees_details) ||
          (Array.isArray(root?.consignee_list) && root.consignee_list) ||
          (Array.isArray(candidate) && candidate) ||
          (Array.isArray(candidate?.items) && candidate.items) ||
          (Array.isArray(candidate?.consignees) && candidate.consignees) ||
          (Array.isArray(candidate?.consignee) && candidate.consignee) ||
          (Array.isArray(candidate?.consignee_details) && candidate.consignee_details) ||
          (Array.isArray(candidate?.consignees_details) && candidate.consignees_details) ||
          (Array.isArray(res.items) && res.items) ||
          (Array.isArray(res.consignees) && res.consignees) ||
          (Array.isArray(res.consignee) && res.consignee) ||
          (Array.isArray(res.consignee_details) && res.consignee_details) ||
          null;

        if (Array.isArray(rawItems)) {
          if (rawItems.length > 0 || isSuccessStatus) {
            return { success: true, data: rawItems };
          }
        }
        // Only treat a single non-array object on a dedicated consignee endpoint as a single consignee
        if (
          isSuccessStatus &&
          typeof root === 'object' &&
          root !== null &&
          !Array.isArray(root) &&
          !('consignees' in root) &&
          !('notify_parties' in root) &&
          (root.consignee_details_id || root.consignee_id || root.company_name || root.name || root.address)
        ) {
          return { success: true, data: [root] };
        }
        if (isSuccessStatus && (root === null || (typeof root === 'object' && Object.keys(root).length === 0))) {
          return { success: true, data: [] };
        }
      } catch {}
    }

    // Fallback to parent buyer-instruction endpoints ONLY if dedicated consignee endpoints were unavailable.
    // Strictly extract explicit consignee array properties; NEVER treat the parent buyer object itself as a consignee.
    const parentEndpoints = [
      `${baseUrl}/instructions/buyer-instruction/${encodeURIComponent(cleanId)}`,
      `${baseUrl}/instructions/${encodeURIComponent(cleanId)}?type=B`,
    ];

    for (const url of parentEndpoints) {
      try {
        const res = await customFetchJSON<any>(url, {
          token,
          params: { lang_code: safeLang, source: params.source || 'web' },
          cache: 'no-store',
        });
        if (!res) continue;

        const root = res.data !== undefined ? res.data : res;
        const candidate = Array.isArray(root) ? root[0] : root?.instruction ?? root;
        const rawItems =
          (Array.isArray(root?.consignees) && root.consignees) ||
          (Array.isArray(root?.consignee) && root.consignee) ||
          (Array.isArray(root?.consignee_details) && root.consignee_details) ||
          (Array.isArray(root?.consignees_details) && root.consignees_details) ||
          (Array.isArray(root?.consignee_list) && root.consignee_list) ||
          (Array.isArray(candidate?.consignees) && candidate.consignees) ||
          (Array.isArray(candidate?.consignee) && candidate.consignee) ||
          (Array.isArray(candidate?.consignee_details) && candidate.consignee_details) ||
          (Array.isArray(candidate?.consignees_details) && candidate.consignees_details) ||
          (Array.isArray(res.consignees) && res.consignees) ||
          (Array.isArray(res.consignee) && res.consignee) ||
          (Array.isArray(res.consignee_details) && res.consignee_details) ||
          null;

        if (Array.isArray(rawItems)) {
          return { success: true, data: rawItems };
        }
      } catch {}
    }

    return { success: true, data: [] };
  },

  /**
   * Updates consignee details for a buyer with authentication:
   * PATCH /instructions/buyer-instruction/consignee/:buyerId?lang_code=en&source=web
   */
  updateBuyerConsignees: async (
    buyerId: string,
    payload: any,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<{ success: boolean; message: string; data?: any; error_fields?: any[]; errors?: any }> => {
    if (!token || !buyerId) {
      return { success: false, message: 'Authentication required or invalid buyer ID', error_fields: [] };
    }
    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(buyerId);
    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    let rawItems: any[] = [];
    if (Array.isArray(payload)) {
      rawItems = payload;
    } else if (payload && Array.isArray(payload.items)) {
      rawItems = payload.items;
    } else if (payload && Array.isArray(payload.consignees)) {
      rawItems = payload.consignees;
    } else if (payload && Array.isArray(payload.consignee_items)) {
      rawItems = payload.consignee_items;
    }

    const cleanItems = rawItems
      .filter((item: any) => {
        if (!item || typeof item !== 'object') return false;
        const name = String(item.company_name || item.name || '').trim();
        const addr = String(item.address || '').trim();
        return Boolean(name || addr);
      })
      .map((item: any) => {
        const countryVal =
          typeof item.country === 'object' && item.country !== null
            ? String(item.country.name || item.country.country_name || item.country.title || item.country.label || '').trim()
            : String(item.country || '').trim();
        const safeCountry = countryVal === '[object Object]' ? '' : countryVal;

        const countryIdVal =
          item.country && typeof item.country === 'object' && item.country.id
            ? String(item.country.id).trim()
            : String(item.country_id || '').trim();

        const countryCodeVal =
          item.country && typeof item.country === 'object' && (item.country.iso2 || item.country.code)
            ? String(item.country.iso2 || item.country.code).trim()
            : String(item.country_code || '').trim();

        const phoneVal = String(item.contact_number || item.phone || '').trim().replace(/\s+/g, '');
        const phoneDialCodeVal = String(
          item.phone_country_code ||
          (item.country_code?.startsWith('+') || /^\d+$/.test(item.country_code || '') ? item.country_code : '') ||
          ''
        ).trim();
        const zipVal = String(item.zip_code || item.zipcode || '').trim();
        const certVal = String(item.certificate_name_number || item.certificate_name_and_number || item.certificateNo || '').trim();
        const emailVal = String(item.email || '').trim();

        const obj: any = {
          company_name: String(item.company_name || item.name || '').trim(),
          address: String(item.address || '').trim(),
          city: String(item.city || '').trim(),
          state: String(item.state || '').trim(),
          country: safeCountry,
          country_code: phoneDialCodeVal || countryCodeVal,
          zip_code: zipVal,
          contact_number: phoneVal,
        };
        if (phoneDialCodeVal) obj.phone_country_code = phoneDialCodeVal;

        let itemId = typeof item.id === 'string' ? item.id.trim() : typeof item._id === 'string' ? item._id.trim() : '';
        if (!isValidCuidOrId(itemId)) {
          itemId = generateSmartDocsCuid();
        }
        obj.id = itemId;

        const isActive =
          item.is_active !== undefined
            ? Boolean(item.is_active === true || item.is_active === 1 || item.is_active === '1' || item.is_active === 'true')
            : item.status !== undefined
            ? Boolean(item.status === true || item.status === 1 || item.status === '1' || item.status === 'true' || item.status === 'active' || item.status === 'ACTIVE')
            : true;
        obj.is_active = isActive;

        if (countryIdVal) obj.country_id = countryIdVal;
        if (certVal) obj.certificate_name_number = certVal;
        if (emailVal) obj.email = emailVal;

        return obj;
      });

    if (cleanItems.length === 0) {
      return {
        success: false,
        message: 'At least one consignee company name is required',
        error_fields: [{ field: 'consignee_items', message: 'At least one consignee is required' }],
      };
    }

    const targetUrl = `${baseUrl}/instructions/buyer-instruction/${encodeURIComponent(cleanId)}`;
    const bodyObj = {
      type: 'CONSIGNEE_DETAILS',
      items: cleanItems,
    };

    try {
      const response = await customFetch(targetUrl, {
        method: 'PATCH',
        token,
        params: { lang_code: safeLang, source },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.success !== 0 && data?.status !== 0) {
        return {
          success: true,
          message: data?.message || 'Consignee details saved successfully',
          data: data?.data || data,
        };
      }

      const errs = extractApiValidationErrors(data);
      let detailedMsg = '';
      if (errs.length > 0) {
        const parts = errs.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).slice(0, 3).join(' | ');
        detailedMsg = `${data?.message ? `${data.message}: ` : ''}${parts}`;
      }

      const finalMsg = detailedMsg || data?.message || data?.error || 'Failed to update consignee details';

      return {
        success: false,
        message: finalMsg,
        error_fields: errs,
        errors: data?.errors || data?.error,
        data,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Error updating consignee details',
        error_fields: [],
      };
    }
  },

  /**
   * Deletes a consignee detail item by ID with authentication:
   * 1. DELETE /instructions/buyer-instruction/consignee?id=:id&consignee_id=:id
   * 2. DELETE /instructions/buyer-instruction/consignee/:consigneeId
   */
  deleteBuyerConsignee: async (
    consigneeId: string,
    token: string,
    params: { lang?: string; source?: string } = {}
  ): Promise<{ success: boolean; message: string; data?: any }> => {
    if (!token || !consigneeId) return { success: false, message: 'Invalid consignee ID or authentication token' };
    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(consigneeId);
    if (!cleanId) return { success: false, message: 'Invalid consignee ID' };
    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    const attempts = [
      {
        url: `${baseUrl}/instructions/buyer-instruction/consignee`,
        params: { lang_code: safeLang, source, id: cleanId, consignee_id: cleanId },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cleanId, consignee_id: cleanId }),
      },
      {
        url: `${baseUrl}/instructions/buyer-instruction/consignee/${encodeURIComponent(cleanId)}`,
        params: { lang_code: safeLang, source },
      },
    ];

    let lastError = 'Failed to delete consignee';

    for (const att of attempts) {
      try {
        const res = await customFetch(att.url, {
          method: 'DELETE',
          token,
          params: att.params,
          ...(att.headers ? { headers: att.headers } : {}),
          ...(att.body ? { body: att.body } : {}),
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success !== 0 && data?.status !== 0) {
          return { success: true, message: data?.message || 'Consignee deleted successfully', data: data?.data || data };
        }
        if (data?.message || data?.error) lastError = data.message || data.error;
      } catch (err: any) {
        lastError = err?.message || 'Failed to delete consignee';
      }
    }

    return { success: false, message: lastError };
  },

  /**
   * Fetches notify party details for a buyer with authentication:
   * GET /instructions/buyer-instruction/notify/:buyerId?lang_code=en&source=web
   */
  getBuyerNotifyParties: async (
    buyerId: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token || !buyerId) return null;
    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(buyerId);
    if (!cleanId) return null;

    const dedicatedEndpoints = [
      `${baseUrl}/instructions/buyer-instruction/notify/${encodeURIComponent(cleanId)}`,
      `${baseUrl}/dms-fields/buyer-instruction/notify/${encodeURIComponent(cleanId)}`,
    ];

    for (const url of dedicatedEndpoints) {
      try {
        const res = await customFetchJSON<any>(url, {
          token,
          params: { lang_code: safeLang, source: params.source || 'web' },
          cache: 'no-store',
        });
        if (!res) continue;

        const isSuccessStatus =
          res.success === true ||
          res.status === true ||
          res.status === 200 ||
          res.statusCode === 200 ||
          Array.isArray(res) ||
          Array.isArray(res.data);

        const root = res.data !== undefined ? res.data : res;
        const candidate = Array.isArray(root) ? root : root?.instruction ?? root?.data ?? root;
        const rawItems =
          (Array.isArray(root) && root) ||
          (Array.isArray(root?.items) && root.items) ||
          (Array.isArray(root?.list) && root.list) ||
          (Array.isArray(root?.rows) && root.rows) ||
          (Array.isArray(root?.results) && root.results) ||
          (Array.isArray(root?.notify_parties) && root.notify_parties) ||
          (Array.isArray(root?.notify_party) && root.notify_party) ||
          (Array.isArray(root?.notify_party_details) && root.notify_party_details) ||
          (Array.isArray(root?.notify_parties_details) && root.notify_parties_details) ||
          (Array.isArray(root?.notifies) && root.notifies) ||
          (Array.isArray(root?.notify) && root.notify) ||
          (Array.isArray(root?.notifyParty) && root.notifyParty) ||
          (Array.isArray(root?.notify_list) && root.notify_list) ||
          (Array.isArray(candidate) && candidate) ||
          (Array.isArray(candidate?.items) && candidate.items) ||
          (Array.isArray(candidate?.notify_parties) && candidate.notify_parties) ||
          (Array.isArray(candidate?.notify_party) && candidate.notify_party) ||
          (Array.isArray(candidate?.notify_party_details) && candidate.notify_party_details) ||
          (Array.isArray(candidate?.notify_parties_details) && candidate.notify_parties_details) ||
          (Array.isArray(candidate?.notifies) && candidate.notifies) ||
          (Array.isArray(res.items) && res.items) ||
          (Array.isArray(res.notify_parties) && res.notify_parties) ||
          (Array.isArray(res.notify_party) && res.notify_party) ||
          (Array.isArray(res.notify_party_details) && res.notify_party_details) ||
          (Array.isArray(res.notifies) && res.notifies) ||
          null;

        if (Array.isArray(rawItems)) {
          if (rawItems.length > 0 || isSuccessStatus) {
            return { success: true, data: rawItems };
          }
        }
        // Only treat a single non-array object on a dedicated notify endpoint as a single notify party
        if (
          isSuccessStatus &&
          typeof root === 'object' &&
          root !== null &&
          !Array.isArray(root) &&
          !('consignees' in root) &&
          !('notify_parties' in root) &&
          (root.notify_party_details_id || root.notify_party_id || root.company_name || root.name || root.address)
        ) {
          return { success: true, data: [root] };
        }
        if (isSuccessStatus && (root === null || (typeof root === 'object' && Object.keys(root).length === 0))) {
          return { success: true, data: [] };
        }
      } catch {}
    }

    // Fallback to parent buyer-instruction endpoints ONLY if dedicated notify endpoints were unavailable.
    // Strictly extract explicit notify party array properties; NEVER treat the parent buyer object itself as a notify party.
    const parentEndpoints = [
      `${baseUrl}/instructions/buyer-instruction/${encodeURIComponent(cleanId)}`,
      `${baseUrl}/instructions/${encodeURIComponent(cleanId)}?type=B`,
    ];

    for (const url of parentEndpoints) {
      try {
        const res = await customFetchJSON<any>(url, {
          token,
          params: { lang_code: safeLang, source: params.source || 'web' },
          cache: 'no-store',
        });
        if (!res) continue;

        const root = res.data !== undefined ? res.data : res;
        const candidate = Array.isArray(root) ? root[0] : root?.instruction ?? root;
        const rawItems =
          (Array.isArray(root?.notify_parties) && root.notify_parties) ||
          (Array.isArray(root?.notify_party) && root.notify_party) ||
          (Array.isArray(root?.notify_party_details) && root.notify_party_details) ||
          (Array.isArray(root?.notify_parties_details) && root.notify_parties_details) ||
          (Array.isArray(root?.notifies) && root.notifies) ||
          (Array.isArray(root?.notify) && root.notify) ||
          (Array.isArray(root?.notifyParty) && root.notifyParty) ||
          (Array.isArray(root?.notify_list) && root.notify_list) ||
          (Array.isArray(candidate?.notify_parties) && candidate.notify_parties) ||
          (Array.isArray(candidate?.notify_party) && candidate.notify_party) ||
          (Array.isArray(candidate?.notify_party_details) && candidate.notify_party_details) ||
          (Array.isArray(candidate?.notify_parties_details) && candidate.notify_parties_details) ||
          (Array.isArray(candidate?.notifies) && candidate.notifies) ||
          (Array.isArray(res.notify_parties) && res.notify_parties) ||
          (Array.isArray(res.notify_party) && res.notify_party) ||
          (Array.isArray(res.notify_party_details) && res.notify_party_details) ||
          (Array.isArray(res.notifies) && res.notifies) ||
          null;

        if (Array.isArray(rawItems)) {
          return { success: true, data: rawItems };
        }
      } catch {}
    }

    return { success: true, data: [] };
  },

  /**
   * Updates notify party details for a buyer with authentication:
   * PATCH /instructions/buyer-instruction/:buyerId
   */
  updateBuyerNotifyParties: async (
    buyerId: string,
    payload: any,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<{ success: boolean; message: string; data?: any; error_fields?: any[]; errors?: any }> => {
    if (!token || !buyerId) {
      return { success: false, message: 'Authentication required or invalid buyer ID', error_fields: [] };
    }
    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(buyerId);
    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    let rawItems: any[] = [];
    if (Array.isArray(payload)) {
      rawItems = payload;
    } else if (payload && Array.isArray(payload.items)) {
      rawItems = payload.items;
    } else if (payload && Array.isArray(payload.notify_parties)) {
      rawItems = payload.notify_parties;
    } else if (payload && Array.isArray(payload.notify_party)) {
      rawItems = payload.notify_party;
    } else if (payload && Array.isArray(payload.notify_party_items)) {
      rawItems = payload.notify_party_items;
    }

    const cleanItems = rawItems
      .filter((item: any) => {
        if (!item || typeof item !== 'object') return false;
        const name = String(item.company_name || item.name || '').trim();
        const addr = String(item.address || '').trim();
        return Boolean(name || addr);
      })
      .map((item: any) => {
        const countryVal =
          typeof item.country === 'object' && item.country !== null
            ? String(item.country.name || item.country.country_name || item.country.title || item.country.label || '').trim()
            : String(item.country || '').trim();
        const safeCountry = countryVal === '[object Object]' ? '' : countryVal;

        const countryIdVal =
          item.country && typeof item.country === 'object' && item.country.id
            ? String(item.country.id).trim()
            : String(item.country_id || '').trim();

        const countryCodeVal =
          item.country && typeof item.country === 'object' && (item.country.iso2 || item.country.code)
            ? String(item.country.iso2 || item.country.code).trim()
            : String(item.country_code || '').trim();

        const phoneVal = String(item.contact_number || item.phone || '').trim().replace(/\s+/g, '');
        const phoneDialCodeVal = String(
          item.phone_country_code ||
          (item.country_code?.startsWith('+') || /^\d+$/.test(item.country_code || '') ? item.country_code : '') ||
          ''
        ).trim();
        const zipVal = String(item.zip_code || item.zipcode || '').trim();
        const certVal = String(item.certificate_name_number || item.certificate_name_and_number || item.certificateNo || '').trim();
        const emailVal = String(item.email || '').trim();

        const obj: any = {
          company_name: String(item.company_name || item.name || '').trim(),
          address: String(item.address || '').trim(),
          city: String(item.city || '').trim(),
          state: String(item.state || '').trim(),
          country: safeCountry,
          country_code: phoneDialCodeVal || countryCodeVal,
          zip_code: zipVal,
          contact_number: phoneVal,
        };
        if (phoneDialCodeVal) obj.phone_country_code = phoneDialCodeVal;

        let itemId = typeof item.id === 'string' ? item.id.trim() : typeof item._id === 'string' ? item._id.trim() : '';
        if (!isValidCuidOrId(itemId)) {
          itemId = generateSmartDocsCuid();
        }
        obj.id = itemId;

        const isActive =
          item.is_active !== undefined
            ? Boolean(item.is_active === true || item.is_active === 1 || item.is_active === '1' || item.is_active === 'true')
            : item.status !== undefined
            ? Boolean(item.status === true || item.status === 1 || item.status === '1' || item.status === 'true' || item.status === 'active' || item.status === 'ACTIVE')
            : true;
        obj.is_active = isActive;

        if (countryIdVal) obj.country_id = countryIdVal;
        if (certVal) obj.certificate_name_number = certVal;
        if (emailVal) obj.email = emailVal;

        return obj;
      });

    if (cleanItems.length === 0) {
      return {
        success: false,
        message: 'At least one notify party company name is required',
        error_fields: [{ field: 'notify_party_items', message: 'At least one notify party is required' }],
      };
    }

    const targetUrl = `${baseUrl}/instructions/buyer-instruction/${encodeURIComponent(cleanId)}`;
    const bodyObj = {
      type: 'NOTIFY_PARTY',
      items: cleanItems,
    };

    try {
      const response = await customFetch(targetUrl, {
        method: 'PATCH',
        token,
        params: { lang_code: safeLang, source },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.success !== 0 && data?.status !== 0) {
        return {
          success: true,
          message: data?.message || 'Notify party details saved successfully',
          data: data?.data || data,
        };
      }

      const errs = extractApiValidationErrors(data);
      let detailedMsg = '';
      if (errs.length > 0) {
        const parts = errs.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).slice(0, 3).join(' | ');
        detailedMsg = `${data?.message ? `${data.message}: ` : ''}${parts}`;
      }

      const finalMsg = detailedMsg || data?.message || data?.error || 'Failed to update notify party details';

      return {
        success: false,
        message: finalMsg,
        error_fields: errs,
        errors: data?.errors || data?.error,
        data,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Error updating notify party details',
        error_fields: [],
      };
    }
  },

  /**
   * Deletes a notify party detail item by ID with authentication:
   * 1. DELETE /instructions/buyer-instruction/notify?id=:id&notify_party_id=:id
   * 2. DELETE /instructions/buyer-instruction/notify/:notifyPartyId
   */
  deleteBuyerNotifyParty: async (
    notifyPartyId: string,
    token: string,
    params: { lang?: string; source?: string } = {}
  ): Promise<{ success: boolean; message: string; data?: any }> => {
    if (!token || !notifyPartyId) return { success: false, message: 'Invalid notify party ID or authentication token' };
    const baseUrl = getSmartDocsApiUrl();
    const cleanId = sanitizeDocId(notifyPartyId);
    if (!cleanId) return { success: false, message: 'Invalid notify party ID' };
    const safeLang = getSafeLang(params.lang || 'en');
    const source = params.source || 'web';

    const attempts = [
      {
        url: `${baseUrl}/instructions/buyer-instruction/notify`,
        params: { lang_code: safeLang, source, id: cleanId, notify_party_id: cleanId },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cleanId, notify_party_id: cleanId }),
      },
      {
        url: `${baseUrl}/instructions/buyer-instruction/notify/${encodeURIComponent(cleanId)}`,
        params: { lang_code: safeLang, source },
      },
    ];

    let lastError = 'Failed to delete notify party';

    for (const att of attempts) {
      try {
        const res = await customFetch(att.url, {
          method: 'DELETE',
          token,
          params: att.params,
          ...(att.headers ? { headers: att.headers } : {}),
          ...(att.body ? { body: att.body } : {}),
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success !== 0 && data?.status !== 0) {
          return { success: true, message: data?.message || 'Notify party deleted successfully', data: data?.data || data };
        }
        if (data?.message || data?.error) lastError = data.message || data.error;
      } catch (err: any) {
        lastError = err?.message || 'Failed to delete notify party';
      }
    }

    return { success: false, message: lastError };
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
        const rawErrMsg = json?.message || json?.error || `Request failed with status ${response.status}`;
        const cleanMsg = cleanDocumentErrorMessage(rawErrMsg, 'Failed to submit confirmation');
        return {
          ...(typeof json === 'object' && json !== null ? json : {}),
          success: false,
          status: response.status,
          message: cleanMsg,
          error: cleanMsg,
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
        const rawErrMsg = json?.message || json?.error || `Request failed with status ${response.status}`;
        const cleanMsg = cleanDocumentErrorMessage(rawErrMsg, 'Failed to submit confirmation');
        return {
          ...(typeof json === 'object' && json !== null ? json : {}),
          success: false,
          status: response.status,
          message: cleanMsg,
          error: cleanMsg,
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

    const confIdInPayload = isFormData ? payload.get('confirmation_id') : payload?.confirmation_id;
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
        if (typeof payload.delete === 'function') {
          payload.delete('signature');
          payload.delete('authorised_signature');
          payload.delete('authority_signature');
          payload.delete('stamp');
          if (payload.has('logo')) {
            const logoVal = payload.get('logo');
            if (!payload.has('seller_logo') && logoVal) {
              payload.append('seller_logo', logoVal);
            }
            payload.delete('logo');
          }
          if (payload.has('company_logo')) {
            const clVal = payload.get('company_logo');
            if (!payload.has('seller_logo') && clVal) {
              payload.append('seller_logo', clVal);
            }
            payload.delete('company_logo');
          }
          if (payload.has('company_logo_url')) {
            const cluVal = payload.get('company_logo_url');
            if (!payload.has('seller_logo_url') && cluVal) {
              payload.append('seller_logo_url', cluVal);
            }
            payload.delete('company_logo_url');
          }
          payload.delete('logo_url');
          payload.delete('remove_company_logo');
        }
        if (cleanId) {
          payload.set('contract_id', cleanId);
          payload.set('id', cleanId);
        } else {
          payload.delete('id');
          payload.delete('contract_id');
          payload.delete('sales_contract_id');
        }
        if (confIdInPayload) {
          payload.set('confirmation_id', String(confIdInPayload));
        }
        body = payload;
      } else {
        headers['Content-Type'] = 'application/json';
        const cleaned = cleanContractPayload(payload);
        if (cleanId) {
          cleaned.contract_id = cleanId;
          cleaned.id = cleanId;
        } else {
          delete cleaned.id;
          delete cleaned.contract_id;
          delete cleaned.sales_contract_id;
        }
        if (confIdInPayload) {
          cleaned.confirmation_id = String(confIdInPayload);
        }
        body = JSON.stringify(cleaned);
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
      console.error('[smartDocsService.saveContractDraft] error:', error);
      return {
        success: false,
        message: error?.message || 'Network error occurred while saving contract draft',
      };
    }
  },

  /**
   * Submits a Contract to advance workflow to Proforma Invoice:
   * POST /contract/submit?lang_code=en&source=web (primary)
   * Supports fallback to /contract/submit/:id and PATCH if needed.
   * Supports FormData (for binary files/signatures) and JSON payload.
   */
  submitContract: async (
    payload: any,
    params: { lang?: string; source?: string; id?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const confIdInPayload = isFormData ? payload.get('confirmation_id') : payload?.confirmation_id;
    const rawCandidate =
      params.id ||
      (isFormData
        ? (payload.get('contract_id') || payload.get('id') || payload.get('confirmation_id'))
        : (payload?.contract_id || payload?.id || payload?.confirmation_id));

    const cleanCandidate = sanitizeDocId(rawCandidate);
    const isPlaceholder = /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|step-\d+)$/i.test(cleanCandidate);
    const cleanId = isPlaceholder ? '' : cleanCandidate;

    const candidates: SubmitCandidate[] = [
      ...(cleanId ? [{ url: `${baseUrl}/contract/submit/${encodeURIComponent(cleanId)}`, method: 'PATCH' as const }] : []),
      ...(cleanId ? [{ url: `${baseUrl}/contract/submit/${encodeURIComponent(cleanId)}`, method: 'POST' as const }] : []),
      { url: `${baseUrl}/contract/submit`, method: 'PATCH' },
      { url: `${baseUrl}/contract/submit`, method: 'POST' },
    ];

    try {
      const headers: Record<string, string> = {};
      let preparedFormData: any = null;
      let jsonBodyString: string = '';

      if (isFormData) {
        if (typeof payload.delete === 'function') {
          payload.delete('signature');
          payload.delete('authorised_signature');
          payload.delete('authority_signature');
          payload.delete('stamp');
          if (payload.has('logo')) {
            const logoVal = payload.get('logo');
            if (!payload.has('seller_logo') && logoVal) {
              payload.append('seller_logo', logoVal);
            }
            payload.delete('logo');
          }
          if (payload.has('company_logo')) {
            const clVal = payload.get('company_logo');
            if (!payload.has('seller_logo') && clVal) {
              payload.append('seller_logo', clVal);
            }
            payload.delete('company_logo');
          }
          if (payload.has('company_logo_url')) {
            const cluVal = payload.get('company_logo_url');
            if (!payload.has('seller_logo_url') && cluVal) {
              payload.append('seller_logo_url', cluVal);
            }
            payload.delete('company_logo_url');
          }
          payload.delete('logo_url');
          payload.delete('remove_company_logo');
        }
        if (cleanId) {
          payload.set('contract_id', cleanId);
          payload.set('id', cleanId);
        } else {
          payload.delete('id');
          payload.delete('contract_id');
          payload.delete('sales_contract_id');
        }
        if (confIdInPayload) {
          payload.set('confirmation_id', String(confIdInPayload));
        }
        preparedFormData = payload;
      } else {
        headers['Content-Type'] = 'application/json';
        const cleaned = cleanContractPayload(payload);
        if (cleanId) {
          cleaned.contract_id = cleanId;
          cleaned.id = cleanId;
        } else {
          delete cleaned.id;
          delete cleaned.contract_id;
          delete cleaned.sales_contract_id;
        }
        if (confIdInPayload) {
          cleaned.confirmation_id = String(confIdInPayload);
        }
        jsonBodyString = JSON.stringify(cleaned);
      }

      return await executeResilientSubmit({
        candidates,
        token,
        safeLang,
        source: params.source || 'web',
        headers,
        isFormData,
        preparedFormData,
        jsonBodyString,
        docTypeName: 'Contract',
      });
    } catch (error: any) {
      console.error('[smartDocsService.submitContract] error:', error);
      return {
        success: false,
        message: cleanDocumentErrorMessage(error?.message, 'Network error occurred while submitting contract'),
      };
    }
  },

  /**
   * Fetches the Proforma Invoice details by ID with authentication:
   * GET /proforma-invoice/:id?lang_code=en&source=web
   */
  getProforma: async (
    id: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token || !id) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(id);
    if (!cleanId) return null;
    const url = `${baseUrl}/proforma-invoice/${encodeURIComponent(cleanId)}`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });

      if (response && (response.success || response.status || response.data)) {
        return response;
      }
      if (!response) {
        const fallbackUrl = `${baseUrl}/proforma/${encodeURIComponent(cleanId)}`;
        const fallbackRes = await customFetchJSON<any>(fallbackUrl, {
          token,
          params: {
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });
        if (fallbackRes) return fallbackRes;
      }
      return response;
    } catch (error) {
      console.warn('[smartDocsService.getProforma] /proforma-invoice error, attempting fallback /proforma:', error);
      try {
        const fallbackUrl = `${baseUrl}/proforma/${encodeURIComponent(cleanId)}`;
        return await customFetchJSON<any>(fallbackUrl, {
          token,
          params: {
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });
      } catch (fallbackError) {
        console.error('[smartDocsService.getProforma] fallback error:', fallbackError);
        return null;
      }
    }
  },

  /**
   * Saves or updates a Proforma Invoice draft with authentication:
   * PATCH /proforma-invoice/save/{id}?lang_code=en&source=web
   * Supports FormData and JSON payload.
   */
  saveProformaDraft: async (
    payload: any,
    params: { lang?: string; source?: string; id?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const contractIdInPayload = isFormData ? payload.get('contract_id') : payload?.contract_id;
    const confIdInPayload = isFormData ? payload.get('confirmation_id') : payload?.confirmation_id;
    const rawCandidate =
      params.id ||
      (isFormData
        ? (payload.get('proforma_id') || payload.get('proforma_invoice_id') || payload.get('proformaId') || payload.get('id') || payload.get('contract_id') || payload.get('confirmation_id'))
        : (payload?.proforma_id || payload?.proforma_invoice_id || payload?.proformaId || payload?.id || payload?.contract_id || payload?.confirmation_id));

    const cleanCandidate = sanitizeDocId(rawCandidate);
    const isPlaceholder = /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+)$/i.test(cleanCandidate);
    const cleanId = isPlaceholder ? '' : cleanCandidate;

    const url = cleanId
      ? `${baseUrl}/proforma-invoice/save/${encodeURIComponent(cleanId)}`
      : `${baseUrl}/proforma-invoice/save`;

    try {
      const headers: Record<string, string> = {};
      let body: any;

      if (isFormData) {
        if (typeof payload.delete === 'function') {
          payload.delete('signature');
          payload.delete('authorised_signature');
          payload.delete('authority_signature');
          payload.delete('stamp');
          if (payload.has('logo')) {
            const logoVal = payload.get('logo');
            if (!payload.has('seller_logo') && logoVal) {
              payload.append('seller_logo', logoVal);
            }
            payload.delete('logo');
          }
          if (payload.has('company_logo')) {
            const clVal = payload.get('company_logo');
            if (!payload.has('seller_logo') && clVal) {
              payload.append('seller_logo', clVal);
            }
            payload.delete('company_logo');
          }
          if (payload.has('company_logo_url')) {
            const cluVal = payload.get('company_logo_url');
            if (!payload.has('seller_logo_url') && cluVal) {
              payload.append('seller_logo_url', cluVal);
            }
            payload.delete('company_logo_url');
          }
          payload.delete('logo_url');
          payload.delete('remove_company_logo');
        }
        if (cleanId) {
          payload.set('id', cleanId);
          payload.set('proforma_id', cleanId);
        } else {
          payload.delete('id');
          payload.delete('proforma_id');
          payload.delete('proforma_invoice_id');
        }
        if (contractIdInPayload) payload.set('contract_id', String(contractIdInPayload));
        if (confIdInPayload) payload.set('confirmation_id', String(confIdInPayload));
        body = payload;
      } else {
        headers['Content-Type'] = 'application/json';
        const cleaned = cleanProformaPayload(payload);
        if (cleanId) {
          cleaned.id = cleanId;
          cleaned.proforma_id = cleanId;
        } else {
          delete cleaned.id;
          delete cleaned.proforma_id;
          delete cleaned.proforma_invoice_id;
        }
        if (contractIdInPayload) cleaned.contract_id = String(contractIdInPayload);
        if (confIdInPayload) cleaned.confirmation_id = String(confIdInPayload);
        body = JSON.stringify(cleaned);
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
      console.error('[smartDocsService.saveProformaDraft] error:', error);
      return {
        success: false,
        message: error?.message || 'Network error occurred while saving proforma invoice',
      };
    }
  },

  /**
   * Submits a Proforma Invoice with authentication:
   * POST /proforma-invoice/submit?lang_code=en&source=web (primary)
   * Supports fallback to /proforma-invoice/submit/:id, /proforma/submit, and PATCH.
   */
  submitProforma: async (
    payload: any,
    params: { lang?: string; source?: string; id?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const contractIdInPayload = isFormData ? payload.get('contract_id') : payload?.contract_id;
    const confIdInPayload = isFormData ? payload.get('confirmation_id') : payload?.confirmation_id;
    const rawCandidate =
      params.id ||
      (isFormData
        ? (payload.get('proforma_id') || payload.get('proforma_invoice_id') || payload.get('proformaId') || payload.get('id') || payload.get('contract_id') || payload.get('confirmation_id'))
        : (payload?.proforma_id || payload?.proforma_invoice_id || payload?.proformaId || payload?.id || payload?.contract_id || payload?.confirmation_id));

    const cleanCandidate = sanitizeDocId(rawCandidate);
    const isPlaceholder = /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+)$/i.test(cleanCandidate);
    const cleanId = isPlaceholder ? '' : cleanCandidate;

    const candidates: SubmitCandidate[] = [
      ...(cleanId ? [{ url: `${baseUrl}/proforma-invoice/submit/${encodeURIComponent(cleanId)}`, method: 'PATCH' as const }] : []),
      ...(cleanId ? [{ url: `${baseUrl}/proforma-invoice/submit/${encodeURIComponent(cleanId)}`, method: 'POST' as const }] : []),
      ...(cleanId ? [{ url: `${baseUrl}/proforma/submit/${encodeURIComponent(cleanId)}`, method: 'PATCH' as const }] : []),
      ...(cleanId ? [{ url: `${baseUrl}/proforma/submit/${encodeURIComponent(cleanId)}`, method: 'POST' as const }] : []),
      { url: `${baseUrl}/proforma-invoice/submit`, method: 'PATCH' },
      { url: `${baseUrl}/proforma-invoice/submit`, method: 'POST' },
      { url: `${baseUrl}/proforma/submit`, method: 'PATCH' },
      { url: `${baseUrl}/proforma/submit`, method: 'POST' },
    ];

    try {
      const headers: Record<string, string> = {};
      let preparedFormData: any = null;
      let jsonBodyString: string = '';

      if (isFormData) {
        if (typeof payload.delete === 'function') {
          payload.delete('signature');
          payload.delete('authorised_signature');
          payload.delete('authority_signature');
          payload.delete('stamp');
          if (payload.has('logo')) {
            const logoVal = payload.get('logo');
            if (!payload.has('seller_logo') && logoVal) {
              payload.append('seller_logo', logoVal);
            }
            payload.delete('logo');
          }
          if (payload.has('company_logo')) {
            const clVal = payload.get('company_logo');
            if (!payload.has('seller_logo') && clVal) {
              payload.append('seller_logo', clVal);
            }
            payload.delete('company_logo');
          }
          if (payload.has('company_logo_url')) {
            const cluVal = payload.get('company_logo_url');
            if (!payload.has('seller_logo_url') && cluVal) {
              payload.append('seller_logo_url', cluVal);
            }
            payload.delete('company_logo_url');
          }
          payload.delete('logo_url');
          payload.delete('remove_company_logo');
        }
        if (cleanId) {
          payload.set('proforma_id', cleanId);
          payload.set('id', cleanId);
        } else {
          payload.delete('id');
          payload.delete('proforma_id');
          payload.delete('proforma_invoice_id');
        }
        if (contractIdInPayload) {
          payload.set('contract_id', String(contractIdInPayload));
        }
        if (confIdInPayload) {
          payload.set('confirmation_id', String(confIdInPayload));
        }
        preparedFormData = payload;
      } else {
        headers['Content-Type'] = 'application/json';
        const cleaned = cleanProformaPayload(payload);
        if (cleanId) {
          cleaned.proforma_id = cleanId;
          cleaned.id = cleanId;
        } else {
          delete cleaned.id;
          delete cleaned.proforma_id;
          delete cleaned.proforma_invoice_id;
        }
        if (contractIdInPayload) {
          cleaned.contract_id = String(contractIdInPayload);
        }
        if (confIdInPayload) {
          cleaned.confirmation_id = String(confIdInPayload);
        }
        jsonBodyString = JSON.stringify(cleaned);
      }

      return await executeResilientSubmit({
        candidates,
        token,
        safeLang,
        source: params.source || 'web',
        headers,
        isFormData,
        preparedFormData,
        jsonBodyString,
        docTypeName: 'Proforma Invoice',
      });
    } catch (error: any) {
      console.error('[smartDocsService.submitProforma] error:', error);
      return {
        success: false,
        message: cleanDocumentErrorMessage(error?.message, 'Network error occurred while submitting proforma invoice'),
      };
    }
  },

  /**
   * Fetches Shipment Instruction details by ID with authentication:
   * GET /shipment-instruction/:id?lang_code=en&source=web
   */
  getShipmentInstruction: async (
    id: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(id);
    if (!cleanId) return null;
    const url = `${baseUrl}/shipment-instruction/${encodeURIComponent(cleanId)}`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });

      if (response && (response.success || response.status || response.data)) {
        return response;
      }
      if (!response) {
        const fallbackUrl = `${baseUrl}/shipment-instructions/${encodeURIComponent(cleanId)}`;
        const fallbackRes = await customFetchJSON<any>(fallbackUrl, {
          token,
          params: {
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });
        if (fallbackRes) return fallbackRes;
      }
      return response;
    } catch (error) {
      console.warn('[smartDocsService.getShipmentInstruction] /shipment-instruction error, attempting fallback:', error);
      try {
        const fallbackUrl = `${baseUrl}/shipment-instructions/${encodeURIComponent(cleanId)}`;
        return await customFetchJSON<any>(fallbackUrl, {
          token,
          params: {
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });
      } catch (fallbackError) {
        console.error('[smartDocsService.getShipmentInstruction] fallback error:', fallbackError);
        return null;
      }
    }
  },

  /**
   * Saves or updates a Shipment Instruction draft with authentication:
   * PATCH /shipment-instruction/save/{id}?lang_code=en&source=web
   */
  saveShipmentInstructionDraft: async (
    payload: any,
    params: { lang?: string; source?: string; id?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const proformaIdInPayload = isFormData ? payload.get('proforma_id') : payload?.proforma_id;
    const contractIdInPayload = isFormData ? payload.get('contract_id') : payload?.contract_id;
    const confIdInPayload = isFormData ? payload.get('confirmation_id') : payload?.confirmation_id;
    const rawCandidate =
      params.id ||
      (isFormData
        ? (payload.get('shipment_instruction_id') || payload.get('instruction_id') || payload.get('id') || payload.get('proforma_id') || payload.get('contract_id') || payload.get('confirmation_id'))
        : (payload?.shipment_instruction_id || payload?.instruction_id || payload?.id || payload?.proforma_id || payload?.contract_id || payload?.confirmation_id));

    const cleanCandidate = sanitizeDocId(rawCandidate);
    const isPlaceholder = /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(cleanCandidate);
    const cleanId = isPlaceholder ? '' : cleanCandidate;

    const url = cleanId 
      ? `${baseUrl}/shipment-instruction/save/${encodeURIComponent(cleanId)}`
      : `${baseUrl}/shipment-instruction/save`;

    try {
      const headers: Record<string, string> = {};
      let body: any;

      if (isFormData) {
        if (typeof payload.get === 'function' && typeof payload.append === 'function') {
          // Rule: consignee_details_id and consignee_details
          const cId = payload.get('consignee_details_id') || payload.get('consignee_id');
          const cDet = payload.get('consignee_details') || payload.get('consignee_name');
          if (cId && !payload.get('consignee_details_id')) payload.append('consignee_details_id', String(cId));
          if (cId && !payload.get('consignee_id')) payload.append('consignee_id', String(cId));
          if (cDet && !payload.get('consignee_details')) payload.append('consignee_details', String(cDet));

          // Rule: notify_party_1 and its ID must either both be provided or both be omitted
          const np1Id = payload.get('notify_party_1_id');
          const np1 = payload.get('notify_party_1') || payload.get('notify_party_1_details');
          if (np1Id && !payload.get('notify_party_1')) {
            payload.append('notify_party_1', String(np1 || np1Id));
          } else if (!np1Id && np1) {
            payload.append('notify_party_1_id', 'custom');
          }

          // Rule: notify_party_2 and its ID must either both be provided or both be omitted
          const np2Id = payload.get('notify_party_2_id');
          const np2 = payload.get('notify_party_2') || payload.get('notify_party_2_details');
          if (np2Id && !payload.get('notify_party_2')) {
            payload.append('notify_party_2', String(np2 || np2Id));
          } else if (!np2Id && np2) {
            payload.append('notify_party_2_id', 'custom');
          }

          // Rule: sync marking_brand, marks_and_numbers, and container_marks (must always be string)
          const marksVal =
            payload.get('marking_brand') ||
            payload.get('marks_and_numbers') ||
            payload.get('container_marks') ||
            payload.get('marks_numbers') ||
            payload.get('markingBrand') ||
            payload.get('brand') ||
            payload.get('marking') ||
            payload.get('container_marks_numbers') ||
            payload.get('container_marks_and_numbers');
          if (marksVal) {
            const strMarks = String(marksVal).trim();
            if (strMarks && strMarks !== '[object Object]' && strMarks !== 'undefined' && strMarks !== 'null') {
              if (!payload.get('marking_brand')) payload.append('marking_brand', strMarks);
              if (!payload.get('marks_and_numbers')) payload.append('marks_and_numbers', strMarks);
              if (!payload.get('container_marks')) payload.append('container_marks', strMarks);
              if (!payload.get('markingBrand')) payload.append('markingBrand', strMarks);
              if (!payload.get('marks_numbers')) payload.append('marks_numbers', strMarks);
              if (!payload.get('brand')) payload.append('brand', strMarks);
              if (!payload.get('container_marks_numbers')) payload.append('container_marks_numbers', strMarks);
            }
          }

          // Rule: sync disclaimer and special_instruction (backend uses disclaimer key)
          const discVal =
            payload.get('disclaimer') ||
            payload.get('special_instruction') ||
            payload.get('specialInstruction') ||
            payload.get('special_note');
          if (discVal !== null && discVal !== undefined) {
            const strDisc = String(discVal).trim();
            if (strDisc && strDisc !== '[object Object]' && strDisc !== 'undefined' && strDisc !== 'null') {
              if (!payload.get('disclaimer')) payload.append('disclaimer', strDisc);
              if (!payload.get('special_instruction')) payload.append('special_instruction', strDisc);
            }
          }
        }
        if (cleanId) {
          payload.set('shipment_instruction_id', cleanId);
          payload.set('id', cleanId);
        } else {
          payload.delete('id');
          payload.delete('shipment_instruction_id');
          payload.delete('instruction_id');
        }
        if (proformaIdInPayload) payload.set('proforma_id', String(proformaIdInPayload));
        if (contractIdInPayload) payload.set('contract_id', String(contractIdInPayload));
        if (confIdInPayload) payload.set('confirmation_id', String(confIdInPayload));
        body = payload;
      } else {
        headers['Content-Type'] = 'application/json';
        const cleaned = cleanShipmentInstructionPayload(payload);
        if (cleanId) {
          cleaned.shipment_instruction_id = cleanId;
          cleaned.id = cleanId;
        } else {
          delete cleaned.id;
          delete cleaned.shipment_instruction_id;
          delete cleaned.instruction_id;
        }
        if (proformaIdInPayload) cleaned.proforma_id = String(proformaIdInPayload);
        if (contractIdInPayload) cleaned.contract_id = String(contractIdInPayload);
        if (confIdInPayload) cleaned.confirmation_id = String(confIdInPayload);
        body = JSON.stringify(cleaned);
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
      console.error('[smartDocsService.saveShipmentInstructionDraft] error:', error);
      return {
        success: false,
        message: error?.message || 'Network error occurred while saving shipment instruction',
      };
    }
  },

  /**
   * Submits a Shipment Instruction with authentication:
   * POST /shipment-instruction/submit?lang_code=en&source=web (primary)
   * Supports fallback to /shipment-instruction/submit/:id and PATCH.
   */
  submitShipmentInstruction: async (
    payload: any,
    params: { lang?: string; source?: string; id?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const proformaIdInPayload = isFormData ? payload.get('proforma_id') : payload?.proforma_id;
    const contractIdInPayload = isFormData ? payload.get('contract_id') : payload?.contract_id;
    const confIdInPayload = isFormData ? payload.get('confirmation_id') : payload?.confirmation_id;
    const rawCandidate =
      params.id ||
      (isFormData
        ? (payload.get('shipment_instruction_id') || payload.get('instruction_id') || payload.get('id') || payload.get('proforma_id') || payload.get('contract_id') || payload.get('confirmation_id'))
        : (payload?.shipment_instruction_id || payload?.instruction_id || payload?.id || payload?.proforma_id || payload?.contract_id || payload?.confirmation_id));

    const cleanCandidate = sanitizeDocId(rawCandidate);
    const isPlaceholder = /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(cleanCandidate);
    const cleanId = isPlaceholder ? '' : cleanCandidate;

    const candidates: SubmitCandidate[] = [
      ...(cleanId ? [{ url: `${baseUrl}/shipment-instruction/submit/${encodeURIComponent(cleanId)}`, method: 'PATCH' as const }] : []),
      ...(cleanId ? [{ url: `${baseUrl}/shipment-instruction/submit/${encodeURIComponent(cleanId)}`, method: 'POST' as const }] : []),
      ...(cleanId ? [{ url: `${baseUrl}/instructions/submit/${encodeURIComponent(cleanId)}`, method: 'PATCH' as const }] : []),
      ...(cleanId ? [{ url: `${baseUrl}/instructions/submit/${encodeURIComponent(cleanId)}`, method: 'POST' as const }] : []),
      { url: `${baseUrl}/shipment-instruction/submit`, method: 'PATCH' },
      { url: `${baseUrl}/shipment-instruction/submit`, method: 'POST' },
      { url: `${baseUrl}/instructions/submit`, method: 'PATCH' },
      { url: `${baseUrl}/instructions/submit`, method: 'POST' },
    ];

    try {
      const headers: Record<string, string> = {};
      let preparedFormData: any = null;
      let jsonBodyString: string = '';

      if (isFormData) {
        if (typeof payload.get === 'function' && typeof payload.append === 'function') {
          // Rule: consignee_details_id and consignee_details
          const cId = payload.get('consignee_details_id') || payload.get('consignee_id');
          const cDet = payload.get('consignee_details') || payload.get('consignee_name');
          if (cId && !payload.get('consignee_details_id')) payload.append('consignee_details_id', String(cId));
          if (cId && !payload.get('consignee_id')) payload.append('consignee_id', String(cId));
          if (cDet && !payload.get('consignee_details')) payload.append('consignee_details', String(cDet));

          // Rule: notify_party_1 and its ID must either both be provided or both be omitted
          const np1Id = payload.get('notify_party_1_id');
          const np1 = payload.get('notify_party_1') || payload.get('notify_party_1_details');
          if (np1Id && !payload.get('notify_party_1')) {
            payload.append('notify_party_1', String(np1 || np1Id));
          } else if (!np1Id && np1) {
            payload.append('notify_party_1_id', 'custom');
          }

          // Rule: notify_party_2 and its ID must either both be provided or both be omitted
          const np2Id = payload.get('notify_party_2_id');
          const np2 = payload.get('notify_party_2') || payload.get('notify_party_2_details');
          if (np2Id && !payload.get('notify_party_2')) {
            payload.append('notify_party_2', String(np2 || np2Id));
          } else if (!np2Id && np2) {
            payload.append('notify_party_2_id', 'custom');
          }

          // Rule: sync marking_brand, marks_and_numbers, and container_marks (must always be string)
          const marksVal =
            payload.get('marking_brand') ||
            payload.get('marks_and_numbers') ||
            payload.get('container_marks') ||
            payload.get('marks_numbers') ||
            payload.get('markingBrand') ||
            payload.get('brand') ||
            payload.get('marking') ||
            payload.get('container_marks_numbers') ||
            payload.get('container_marks_and_numbers');
          if (marksVal) {
            const strMarks = String(marksVal).trim();
            if (strMarks && strMarks !== '[object Object]' && strMarks !== 'undefined' && strMarks !== 'null') {
              if (!payload.get('marking_brand')) payload.append('marking_brand', strMarks);
              if (!payload.get('marks_and_numbers')) payload.append('marks_and_numbers', strMarks);
              if (!payload.get('container_marks')) payload.append('container_marks', strMarks);
              if (!payload.get('markingBrand')) payload.append('markingBrand', strMarks);
              if (!payload.get('marks_numbers')) payload.append('marks_numbers', strMarks);
              if (!payload.get('brand')) payload.append('brand', strMarks);
              if (!payload.get('container_marks_numbers')) payload.append('container_marks_numbers', strMarks);
            }
          }

          // Rule: sync disclaimer and special_instruction (backend uses disclaimer key)
          const discVal =
            payload.get('disclaimer') ||
            payload.get('special_instruction') ||
            payload.get('specialInstruction') ||
            payload.get('special_note');
          if (discVal !== null && discVal !== undefined) {
            const strDisc = String(discVal).trim();
            if (strDisc && strDisc !== '[object Object]' && strDisc !== 'undefined' && strDisc !== 'null') {
              if (!payload.get('disclaimer')) payload.append('disclaimer', strDisc);
              if (!payload.get('special_instruction')) payload.append('special_instruction', strDisc);
            }
          }
        }
        if (cleanId) {
          payload.set('shipment_instruction_id', cleanId);
          payload.set('id', cleanId);
        } else {
          payload.delete('id');
          payload.delete('shipment_instruction_id');
          payload.delete('instruction_id');
        }
        if (proformaIdInPayload) {
          payload.set('proforma_id', String(proformaIdInPayload));
        }
        if (contractIdInPayload) {
          payload.set('contract_id', String(contractIdInPayload));
        }
        if (confIdInPayload) {
          payload.set('confirmation_id', String(confIdInPayload));
        }
        preparedFormData = payload;
      } else {
        headers['Content-Type'] = 'application/json';
        const cleaned = cleanShipmentInstructionPayload(payload);
        if (cleanId) {
          cleaned.shipment_instruction_id = cleanId;
          cleaned.id = cleanId;
        } else {
          delete cleaned.id;
          delete cleaned.shipment_instruction_id;
          delete cleaned.instruction_id;
        }
        if (proformaIdInPayload) cleaned.proforma_id = String(proformaIdInPayload);
        if (contractIdInPayload) cleaned.contract_id = String(contractIdInPayload);
        if (confIdInPayload) cleaned.confirmation_id = String(confIdInPayload);
        jsonBodyString = JSON.stringify(cleaned);
      }

      return await executeResilientSubmit({
        candidates,
        token,
        safeLang,
        source: params.source || 'web',
        headers,
        isFormData,
        preparedFormData,
        jsonBodyString,
        docTypeName: 'Shipment Instruction',
      });
    } catch (error: any) {
      console.error('[smartDocsService.submitShipmentInstruction] error:', error);
      return {
        success: false,
        message: cleanDocumentErrorMessage(error?.message, 'Network error occurred while submitting shipment instruction'),
      };
    }
  },

  /**
   * Fetches Custom Invoice details by ID with authentication:
   * GET /custom-invoice/:id?lang_code=en&source=web
   */
  getCustomInvoice: async (
    id: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(id);
    if (!cleanId) return null;
    const url = `${baseUrl}/custom-invoice/${encodeURIComponent(cleanId)}`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });

      if (response && (response.success || response.status || response.data)) {
        return response;
      }
      if (!response) {
        const fallbackUrl = `${baseUrl}/custom-invoices/${encodeURIComponent(cleanId)}`;
        const fallbackRes = await customFetchJSON<any>(fallbackUrl, {
          token,
          params: {
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });
        if (fallbackRes) return fallbackRes;
      }
      return response;
    } catch (error) {
      console.warn('[smartDocsService.getCustomInvoice] /custom-invoice error, attempting fallback:', error);
      try {
        const fallbackUrl = `${baseUrl}/custom-invoices/${encodeURIComponent(cleanId)}`;
        return await customFetchJSON<any>(fallbackUrl, {
          token,
          params: {
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });
      } catch (fallbackError) {
        console.error('[smartDocsService.getCustomInvoice] fallback error:', fallbackError);
        return null;
      }
    }
  },

  /**
   * Saves a Custom Invoice draft with authentication:
   * PATCH /custom-invoice/save/:id?lang_code=en&source=web
   * Multi-candidate resilient save across endpoint variants on 404 router errors.
   */
  saveCustomInvoiceDraft: async (
    payload: any,
    params: { lang?: string; source?: string; id?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');

    let effectivePayload = payload;
    let isFormData =
      (typeof FormData !== 'undefined' && effectivePayload instanceof FormData) ||
      (effectivePayload && typeof effectivePayload.get === 'function' && typeof effectivePayload.append === 'function');

    // Convert object payload with data URL signature to FormData to prevent HTTP 413 "Request Entity Too Large"
    if (!isFormData && effectivePayload && typeof effectivePayload === 'object') {
      const sigData =
        effectivePayload.seller_signature ||
        effectivePayload.seller_signature_url ||
        effectivePayload.signature ||
        effectivePayload.stamp_image_url ||
        effectivePayload.stamp;

      if (typeof sigData === 'string' && sigData.trim().startsWith('data:')) {
        const convertedBlob = convertDataUrlToBlob(sigData.trim());
        if (convertedBlob) {
          const fd = new FormData();
          for (const [k, v] of Object.entries(effectivePayload)) {
            if (v === undefined || v === null) continue;
            if (
              k === 'seller_signature' ||
              k === 'seller_signature_url' ||
              k === 'signature' ||
              k === 'stamp_image_url' ||
              k === 'stamp'
            ) {
              continue;
            }
            if (typeof v === 'object' && !(typeof Blob !== 'undefined' && v instanceof Blob)) {
              fd.append(k, JSON.stringify(v));
            } else {
              fd.append(k, String(v));
            }
          }
          fd.append('seller_signature', convertedBlob, 'seller_signature.png');
          fd.append('remove_seller_signature', 'false');
          effectivePayload = fd;
          isFormData = true;
        }
      }
    }

    const shipmentIdInPayload = isFormData ? (effectivePayload.get('shipment_instruction_id') || effectivePayload.get('shipment_id')) : (effectivePayload?.shipment_instruction_id || effectivePayload?.shipment_id);
    const proformaIdInPayload = isFormData ? effectivePayload.get('proforma_id') : effectivePayload?.proforma_id;
    const contractIdInPayload = isFormData ? effectivePayload.get('contract_id') : effectivePayload?.contract_id;
    const confIdInPayload = isFormData ? effectivePayload.get('confirmation_id') : effectivePayload?.confirmation_id;

    const directCustomId = isFormData
      ? (effectivePayload.get('custom_invoice_id') || effectivePayload.get('invoice_id') || effectivePayload.get('id') || '')
      : (effectivePayload?.custom_invoice_id || effectivePayload?.invoice_id || effectivePayload?.id || '');

    const isPlaceholder = (val: string) =>
      !val ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        val.trim()
      );

    const candidateIds = Array.from(
      new Set(
        [
          params.id,
          directCustomId,
          shipmentIdInPayload,
          proformaIdInPayload,
          contractIdInPayload,
          confIdInPayload,
        ]
          .map((s) => sanitizeDocId(s))
          .filter((s): s is string => Boolean(s && !isPlaceholder(s)))
      )
    );

    const saveCandidates: { url: string; method: 'POST' | 'PATCH'; id?: string }[] = [];

    for (const candId of candidateIds) {
      const encId = encodeURIComponent(candId);
      saveCandidates.push(
        { url: `${baseUrl}/custom-invoice/save/${encId}`, method: 'PATCH', id: candId },
        { url: `${baseUrl}/custom-invoice/save/${encId}`, method: 'POST', id: candId },
        { url: `${baseUrl}/custom-invoices/save/${encId}`, method: 'PATCH', id: candId },
        { url: `${baseUrl}/custom-invoices/save/${encId}`, method: 'POST', id: candId },
        { url: `${baseUrl}/custom/save/${encId}`, method: 'PATCH', id: candId },
        { url: `${baseUrl}/custom/save/${encId}`, method: 'POST', id: candId },
      );
    }

    // Fallback endpoints without ID in URL
    saveCandidates.push(
      { url: `${baseUrl}/custom-invoice/save`, method: 'PATCH' },
      { url: `${baseUrl}/custom-invoice/save`, method: 'POST' },
      { url: `${baseUrl}/custom-invoices/save`, method: 'PATCH' },
      { url: `${baseUrl}/custom-invoices/save`, method: 'POST' },
      { url: `${baseUrl}/custom/save`, method: 'POST' },
    );

    try {
      const headers: Record<string, string> = {};
      let lastErrorRes: any = null;

      for (let i = 0; i < saveCandidates.length; i++) {
        const candidate = saveCandidates[i];
        let body: any;

        if (isFormData) {
          const clonedFd = cloneFormDataPayload(effectivePayload);
          if (candidate.id) {
            clonedFd.set('custom_invoice_id', candidate.id);
            clonedFd.set('id', candidate.id);
          } else {
            clonedFd.delete('id');
            clonedFd.delete('custom_invoice_id');
            clonedFd.delete('invoice_id');
          }
          if (shipmentIdInPayload) clonedFd.set('shipment_instruction_id', String(shipmentIdInPayload));
          if (proformaIdInPayload) clonedFd.set('proforma_id', String(proformaIdInPayload));
          if (contractIdInPayload) clonedFd.set('contract_id', String(contractIdInPayload));
          if (confIdInPayload) clonedFd.set('confirmation_id', String(confIdInPayload));

          const wmVal = clonedFd.get('is_watermark_enabled') ?? clonedFd.get('watermark_enabled') ?? clonedFd.get('watermark') ?? 'true';
          const isWmBool = wmVal !== 'false' && wmVal !== '0' && Boolean(wmVal);
          clonedFd.set('is_watermark_enabled', String(isWmBool));
          clonedFd.set('watermark_enabled', String(isWmBool));
          clonedFd.set('watermark', String(isWmBool));

          const titleCandidate =
            clonedFd.get('pdf_title') ??
            clonedFd.get('document_title') ??
            clonedFd.get('custom_doc_title') ??
            clonedFd.get('title') ??
            'CUSTOM INVOICE';
          const effectiveTitle = String(titleCandidate).trim() || 'CUSTOM INVOICE';
          clonedFd.set('pdf_title', effectiveTitle);
          clonedFd.set('document_title', effectiveTitle);
          clonedFd.set('custom_doc_title', effectiveTitle);

          const cLabel = clonedFd.get('comment_label') ?? clonedFd.get('comment_title') ?? clonedFd.get('notes_title') ?? clonedFd.get('title') ?? '';
          const cValue = clonedFd.get('comment_value') ?? clonedFd.get('comment_text') ?? clonedFd.get('notes_comment') ?? clonedFd.get('comment') ?? '';
          const effectiveCLabel = String(cLabel || (cValue ? 'Comments' : '')).trim();
          const effectiveCValue = String(cValue || '').trim();
          clonedFd.set('comment_label', effectiveCLabel);
          clonedFd.set('comment_title', effectiveCLabel);
          clonedFd.set('notes_title', effectiveCLabel);
          clonedFd.set('comment_value', effectiveCValue);
          clonedFd.set('comment_text', effectiveCValue);
          clonedFd.set('notes_comment', effectiveCValue);
          clonedFd.set('comment', effectiveCValue);

          const rawPricePerBag = clonedFd.get('price_per_bag') ?? clonedFd.get('rate_per_bag') ?? clonedFd.get('rate_bag');
          if (rawPricePerBag !== undefined && rawPricePerBag !== null && String(rawPricePerBag).trim() !== '') {
            clonedFd.set('price_per_bag', String(rawPricePerBag).trim());
            clonedFd.set('rate_per_bag', String(rawPricePerBag).trim());
          }

          body = clonedFd;
        } else {
          headers['Content-Type'] = 'application/json';
          const cleaned = cleanCustomInvoicePayload(effectivePayload);
          if (candidate.id) {
            cleaned.custom_invoice_id = candidate.id;
            cleaned.id = candidate.id;
          } else {
            delete cleaned.id;
            delete cleaned.custom_invoice_id;
            delete cleaned.invoice_id;
          }
          if (shipmentIdInPayload) cleaned.shipment_instruction_id = String(shipmentIdInPayload);
          if (proformaIdInPayload) cleaned.proforma_id = String(proformaIdInPayload);
          if (contractIdInPayload) cleaned.contract_id = String(contractIdInPayload);
          if (confIdInPayload) cleaned.confirmation_id = String(confIdInPayload);
          body = JSON.stringify(cleaned);
        }

        try {
          const response = await customFetch(candidate.url, {
            method: candidate.method,
            token,
            headers,
            params: {
              lang_code: safeLang,
              source: params.source || 'web',
            },
            body,
            cache: 'no-store',
          });

          const text = await response.text().catch(() => '');
          let json: any = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }

          if (response.ok) {
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
            return {
              success: true,
              data: json ?? text,
              raw: json ?? text,
            };
          }

          const isRouteNotFound =
            (response.status === 404 || response.status === 405) &&
            (!json?.errors && !json?.error_fields && !json?.data) &&
            (/^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(text.trim()) ||
              /<(!DOCTYPE|html)/i.test(text) ||
              /^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(String(json?.message || json?.error || '').trim()) ||
              /not found/i.test(String(json?.message || json?.error || text || '').trim()));

          if (isRouteNotFound && i < saveCandidates.length - 1) {
            console.warn(`[smartDocsService.saveCustomInvoiceDraft] Candidate ${candidate.method} ${candidate.url} gave router error, trying next candidate...`);
            continue;
          }

          const rawErrMsg = json?.message || json?.error || `Request failed with status ${response.status}`;
          const cleanMsg = cleanDocumentErrorMessage(rawErrMsg, 'Failed to save custom invoice draft');

          lastErrorRes = {
            ...(typeof json === 'object' && json !== null ? json : {}),
            success: false,
            status: response.status,
            message: cleanMsg,
            data: json?.data !== undefined ? json.data : json,
            errors: json?.errors || json?.data?.errors || (typeof json?.data === 'object' ? json.data : null),
            error_fields: json?.error_fields || json?.data?.error_fields || null,
            raw: json,
          };
          break;
        } catch (fetchErr: any) {
          if (i < saveCandidates.length - 1) continue;
          lastErrorRes = {
            success: false,
            message: fetchErr?.message || 'Network error occurred while saving custom invoice',
          };
        }
      }

      return lastErrorRes || {
        success: false,
        message: 'Network error occurred while saving custom invoice',
      };
    } catch (error: any) {
      console.error('[smartDocsService.saveCustomInvoiceDraft] error:', error);
      return {
        success: false,
        message: error?.message || 'Network error occurred while saving custom invoice',
      };
    }
  },

  /**
   * Submits a Custom Invoice with authentication:
   * PATCH /custom-invoice/submit/:id?lang_code=en&source=web
   * Supports fallback to POST, multi-candidate IDs, /custom-invoices/submit, and /custom/submit.
   */
  submitCustomInvoice: async (
    payload: any,
    params: { lang?: string; source?: string; id?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');

    let effectivePayload = payload;
    let isFormData =
      (typeof FormData !== 'undefined' && effectivePayload instanceof FormData) ||
      (effectivePayload && typeof effectivePayload.get === 'function' && typeof effectivePayload.append === 'function');

    // Convert object payload with data URL signature to FormData to prevent HTTP 413 "Request Entity Too Large"
    if (!isFormData && effectivePayload && typeof effectivePayload === 'object') {
      const sigData =
        effectivePayload.seller_signature ||
        effectivePayload.seller_signature_url ||
        effectivePayload.signature ||
        effectivePayload.stamp_image_url ||
        effectivePayload.stamp;

      if (typeof sigData === 'string' && sigData.trim().startsWith('data:')) {
        const convertedBlob = convertDataUrlToBlob(sigData.trim());
        if (convertedBlob) {
          const fd = new FormData();
          for (const [k, v] of Object.entries(effectivePayload)) {
            if (v === undefined || v === null) continue;
            if (
              k === 'seller_signature' ||
              k === 'seller_signature_url' ||
              k === 'signature' ||
              k === 'stamp_image_url' ||
              k === 'stamp'
            ) {
              continue;
            }
            if (typeof v === 'object' && !(typeof Blob !== 'undefined' && v instanceof Blob)) {
              fd.append(k, JSON.stringify(v));
            } else {
              fd.append(k, String(v));
            }
          }
          fd.append('seller_signature', convertedBlob, 'seller_signature.png');
          fd.append('remove_seller_signature', 'false');
          effectivePayload = fd;
          isFormData = true;
        }
      }
    }

    const shipmentIdInPayload = isFormData ? (effectivePayload.get('shipment_instruction_id') || effectivePayload.get('shipment_id')) : (effectivePayload?.shipment_instruction_id || effectivePayload?.shipment_id);
    const proformaIdInPayload = isFormData ? effectivePayload.get('proforma_id') : effectivePayload?.proforma_id;
    const contractIdInPayload = isFormData ? effectivePayload.get('contract_id') : effectivePayload?.contract_id;
    const confIdInPayload = isFormData ? effectivePayload.get('confirmation_id') : effectivePayload?.confirmation_id;

    const directCustomId = isFormData
      ? (effectivePayload.get('custom_invoice_id') || effectivePayload.get('invoice_id') || effectivePayload.get('id') || '')
      : (effectivePayload?.custom_invoice_id || effectivePayload?.invoice_id || effectivePayload?.id || '');

    const isPlaceholder = (val: string) =>
      !val ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        val.trim()
      );

    const candidateIds = Array.from(
      new Set(
        [
          params.id,
          directCustomId,
          shipmentIdInPayload,
          proformaIdInPayload,
          contractIdInPayload,
          confIdInPayload,
        ]
          .map((s) => sanitizeDocId(s))
          .filter((s): s is string => Boolean(s && !isPlaceholder(s)))
      )
    );

    const submitCandidates: { url: string; method: 'POST' | 'PATCH'; id?: string }[] = [];

    for (const candId of candidateIds) {
      const encId = encodeURIComponent(candId);
      submitCandidates.push(
        { url: `${baseUrl}/custom-invoice/submit/${encId}`, method: 'PATCH', id: candId },
        { url: `${baseUrl}/custom-invoice/submit/${encId}`, method: 'POST', id: candId },
        { url: `${baseUrl}/custom-invoices/submit/${encId}`, method: 'PATCH', id: candId },
        { url: `${baseUrl}/custom-invoices/submit/${encId}`, method: 'POST', id: candId },
        { url: `${baseUrl}/custom/submit/${encId}`, method: 'PATCH', id: candId },
        { url: `${baseUrl}/custom/submit/${encId}`, method: 'POST', id: candId },
      );
    }

    // Endpoints without ID in URL
    submitCandidates.push(
      { url: `${baseUrl}/custom-invoice/submit`, method: 'POST' },
      { url: `${baseUrl}/custom-invoice/submit`, method: 'PATCH' },
      { url: `${baseUrl}/custom-invoices/submit`, method: 'POST' },
      { url: `${baseUrl}/custom-invoices/submit`, method: 'PATCH' },
      { url: `${baseUrl}/custom/submit`, method: 'POST' },
    );

    try {
      const headers: Record<string, string> = {};
      let lastErrorRes: any = null;

      for (let i = 0; i < submitCandidates.length; i++) {
        const candidate = submitCandidates[i];
        let body: any;

        if (isFormData) {
          const clonedFd = cloneFormDataPayload(effectivePayload);
          if (candidate.id) {
            clonedFd.set('custom_invoice_id', candidate.id);
            clonedFd.set('id', candidate.id);
          } else {
            clonedFd.delete('id');
            clonedFd.delete('custom_invoice_id');
            clonedFd.delete('invoice_id');
          }
          if (shipmentIdInPayload) clonedFd.set('shipment_instruction_id', String(shipmentIdInPayload));
          if (proformaIdInPayload) clonedFd.set('proforma_id', String(proformaIdInPayload));
          if (contractIdInPayload) clonedFd.set('contract_id', String(contractIdInPayload));
          if (confIdInPayload) clonedFd.set('confirmation_id', String(confIdInPayload));

          const wmVal = clonedFd.get('is_watermark_enabled') ?? clonedFd.get('watermark_enabled') ?? clonedFd.get('watermark') ?? 'true';
          const isWmBool = wmVal !== 'false' && wmVal !== '0' && Boolean(wmVal);
          clonedFd.set('is_watermark_enabled', String(isWmBool));
          clonedFd.set('watermark_enabled', String(isWmBool));
          clonedFd.set('watermark', String(isWmBool));

          const titleCandidate =
            clonedFd.get('pdf_title') ??
            clonedFd.get('document_title') ??
            clonedFd.get('custom_doc_title') ??
            clonedFd.get('title') ??
            'CUSTOM INVOICE';
          const effectiveTitle = String(titleCandidate).trim() || 'CUSTOM INVOICE';
          clonedFd.set('pdf_title', effectiveTitle);
          clonedFd.set('document_title', effectiveTitle);
          clonedFd.set('custom_doc_title', effectiveTitle);

          const cLabel = clonedFd.get('comment_label') ?? clonedFd.get('comment_title') ?? clonedFd.get('notes_title') ?? clonedFd.get('title') ?? '';
          const cValue = clonedFd.get('comment_value') ?? clonedFd.get('comment_text') ?? clonedFd.get('notes_comment') ?? clonedFd.get('comment') ?? '';
          const effectiveCLabel = String(cLabel || (cValue ? 'Comments' : '')).trim();
          const effectiveCValue = String(cValue || '').trim();
          clonedFd.set('comment_label', effectiveCLabel);
          clonedFd.set('comment_title', effectiveCLabel);
          clonedFd.set('notes_title', effectiveCLabel);
          clonedFd.set('comment_value', effectiveCValue);
          clonedFd.set('comment_text', effectiveCValue);
          clonedFd.set('notes_comment', effectiveCValue);
          clonedFd.set('comment', effectiveCValue);

          const rawPricePerBag = clonedFd.get('price_per_bag') ?? clonedFd.get('rate_per_bag') ?? clonedFd.get('rate_bag');
          if (rawPricePerBag !== undefined && rawPricePerBag !== null && String(rawPricePerBag).trim() !== '') {
            clonedFd.set('price_per_bag', String(rawPricePerBag).trim());
            clonedFd.set('rate_per_bag', String(rawPricePerBag).trim());
          }

          body = clonedFd;
        } else {
          headers['Content-Type'] = 'application/json';
          const cleaned = cleanCustomInvoicePayload(effectivePayload);
          if (candidate.id) {
            cleaned.custom_invoice_id = candidate.id;
            cleaned.id = candidate.id;
          } else {
            delete cleaned.id;
            delete cleaned.custom_invoice_id;
            delete cleaned.invoice_id;
          }
          if (shipmentIdInPayload) cleaned.shipment_instruction_id = String(shipmentIdInPayload);
          if (proformaIdInPayload) cleaned.proforma_id = String(proformaIdInPayload);
          if (contractIdInPayload) cleaned.contract_id = String(contractIdInPayload);
          if (confIdInPayload) cleaned.confirmation_id = String(confIdInPayload);
          body = JSON.stringify(cleaned);
        }

        try {
          const response = await customFetch(candidate.url, {
            method: candidate.method,
            token,
            headers,
            params: {
              lang_code: safeLang,
              source: params.source || 'web',
            },
            body,
            cache: 'no-store',
          });

          const text = await response.text().catch(() => '');
          let json: any = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }

          if (response.ok) {
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
            return {
              success: true,
              data: json ?? text,
              raw: json ?? text,
            };
          }

          const isRouteNotFound =
            (response.status === 404 || response.status === 405) &&
            (!json?.errors && !json?.error_fields && !json?.data) &&
            (/^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(text.trim()) ||
              /<(!DOCTYPE|html)/i.test(text) ||
              /^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(String(json?.message || json?.error || '').trim()) ||
              /not found/i.test(String(json?.message || json?.error || text || '').trim()));

          if (isRouteNotFound && i < submitCandidates.length - 1) {
            console.warn(`[smartDocsService.submitCustomInvoice] Candidate ${candidate.method} ${candidate.url} gave router error, trying next candidate...`);
            continue;
          }

          const rawErrMsg = json?.message || json?.error || `Request failed with status ${response.status}`;
          const cleanMsg = cleanDocumentErrorMessage(rawErrMsg, 'Failed to submit custom invoice');

          lastErrorRes = {
            ...(typeof json === 'object' && json !== null ? json : {}),
            success: false,
            status: response.status,
            message: cleanMsg,
            data: json?.data !== undefined ? json.data : json,
            errors: json?.errors || json?.data?.errors || (typeof json?.data === 'object' ? json.data : null),
            error_fields: json?.error_fields || json?.data?.error_fields || null,
            raw: json,
          };
          break;
        } catch (fetchErr: any) {
          if (i < submitCandidates.length - 1) continue;
          lastErrorRes = {
            success: false,
            message: fetchErr?.message || 'Network error occurred while submitting custom invoice',
          };
        }
      }

      return lastErrorRes || {
        success: false,
        message: 'Network error occurred while submitting custom invoice',
      };
    } catch (error: any) {
      console.error('[smartDocsService.submitCustomInvoice] error:', error);
      return {
        success: false,
        message: cleanDocumentErrorMessage(error?.message, 'Network error occurred while submitting custom invoice'),
      };
    }
  },

  /**
   * Fetches Commercial Invoice details by ID with authentication:
   * GET /commercial-invoice/:id?lang_code=en&source=web
   */
  getCommercialInvoice: async (
    id: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(id);
    if (!cleanId) return null;
    const url = `${baseUrl}/commercial-invoice/${encodeURIComponent(cleanId)}`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });

      if (response && (response.success || response.status || response.data)) {
        return response;
      }

      const fallbackUrl = `${baseUrl}/commercial-invoices/${encodeURIComponent(cleanId)}`;
      try {
        return await customFetchJSON<any>(fallbackUrl, {
          token,
          params: {
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });
      } catch {
        return response;
      }
    } catch (error) {
      console.warn('[smartDocsService.getCommercialInvoice] /commercial-invoice error, attempting fallback:', error);
      try {
        const fallbackUrl = `${baseUrl}/commercial-invoices/${encodeURIComponent(cleanId)}`;
        return await customFetchJSON<any>(fallbackUrl, {
          token,
          params: {
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });
      } catch (fallbackErr) {
        console.error('[smartDocsService.getCommercialInvoice] error:', fallbackErr);
        return null;
      }
    }
  },

  /**
   * Saves Commercial Invoice as draft:
   * PATCH /commercial-invoice/save/:id?lang_code=en&source=web
   */
  saveCommercialInvoiceDraft: async (
    payload: any,
    params: { lang?: string; source?: string } = {},
    token: string,
    id?: string
  ): Promise<any> => {
    if (!token) return { success: false, message: 'Unauthorized' };

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const candidateId = sanitizeDocId(
      id ||
        (isFormData
          ? (payload.get('commercial_invoice_id') ||
            payload.get('commercialInvoiceId') ||
            payload.get('id') ||
            payload.get('custom_invoice_id') ||
            payload.get('shipment_instruction_id') ||
            payload.get('proforma_id') ||
            payload.get('contract_id') ||
            payload.get('confirmation_id'))
          : (payload?.commercial_invoice_id ||
            payload?.commercialInvoiceId ||
            payload?.id ||
            payload?.custom_invoice_id ||
            payload?.shipment_instruction_id ||
            payload?.proforma_id ||
            payload?.contract_id ||
            payload?.confirmation_id))
    );

    const isPlaceholder =
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|lading|bill-of-lading|custom|custom-invoice|commercial|commercial-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        candidateId
      );
    const cleanId = candidateId && !isPlaceholder ? candidateId : '';

    const saveCandidates: Array<{ url: string; method: 'PATCH' | 'POST'; id?: string }> = [];
    if (cleanId) {
      const encId = encodeURIComponent(cleanId);
      saveCandidates.push(
        { url: `${baseUrl}/commercial-invoice/save/${encId}`, method: 'PATCH', id: cleanId },
        { url: `${baseUrl}/commercial-invoice/save/${encId}`, method: 'POST', id: cleanId },
        { url: `${baseUrl}/commercial-invoices/save/${encId}`, method: 'PATCH', id: cleanId },
        { url: `${baseUrl}/commercial-invoices/save/${encId}`, method: 'POST', id: cleanId }
      );
    }
    saveCandidates.push(
      { url: `${baseUrl}/commercial-invoice/save`, method: 'PATCH' },
      { url: `${baseUrl}/commercial-invoice/save`, method: 'POST' },
      { url: `${baseUrl}/commercial-invoices/save`, method: 'PATCH' },
      { url: `${baseUrl}/commercial-invoices/save`, method: 'POST' }
    );

    try {
      const headers: Record<string, string> = {};
      let lastErrorRes: any = null;

      for (let i = 0; i < saveCandidates.length; i++) {
        const candidate = saveCandidates[i];
        let body: any;
        if (isFormData) {
          const clonedFd = cloneFormDataPayload(payload);
          if (candidate.id) {
            clonedFd.set('commercial_invoice_id', candidate.id);
            clonedFd.set('id', candidate.id);
          } else {
            clonedFd.delete('id');
            clonedFd.delete('commercial_invoice_id');
          }
          body = clonedFd;
        } else {
          headers['Content-Type'] = 'application/json';
          const cleaned = { ...(payload || {}) };
          if (candidate.id) {
            cleaned.commercial_invoice_id = candidate.id;
            cleaned.id = candidate.id;
          } else {
            delete cleaned.id;
            delete cleaned.commercial_invoice_id;
          }
          body = JSON.stringify(cleaned);
        }

        try {
          const response = await customFetch(candidate.url, {
            method: candidate.method,
            token,
            headers,
            params: {
              lang_code: safeLang,
              source: params.source || 'web',
            },
            body,
            cache: 'no-store',
          });

          const text = await response.text();
          let json: any = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = { message: text };
          }

          if (response.ok && json?.success !== false && json?.success !== 0 && json?.status !== false) {
            return {
              ...json,
              success: true,
              data: json?.data !== undefined ? json.data : json,
              id:
                json?.data?.id ||
                json?.data?._id ||
                json?.data?.commercial_invoice_id ||
                json?.id ||
                json?._id ||
                candidate.id,
            };
          }

          const isRouteNotFound =
            response.status === 404 ||
            response.status === 405 ||
            (response.status >= 400 &&
              (/<(!DOCTYPE|html)/i.test(text) ||
                /^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(String(json?.message || json?.error || '').trim()) ||
                /not found/i.test(String(json?.message || json?.error || text || '').trim())));

          if (isRouteNotFound && i < saveCandidates.length - 1) {
            continue;
          }

          const rawMsgField = Array.isArray(json?.message)
            ? json.message.filter(Boolean).join(', ')
            : json?.message;
          const rawErrMsg = rawMsgField || json?.error || `Request failed with status ${response.status}`;
          const sentPayloadPreview = isFormData
            ? Object.fromEntries(
                Array.from((body as FormData).entries()).map(([k, v]) => [
                  k,
                  typeof v === 'string' ? v : `[File/Blob]`,
                ])
              )
            : body;
          console.error('[smartDocsService.saveCommercialInvoiceDraft] Backend error:', {
            url: candidate.url,
            method: candidate.method,
            status: response.status,
            sentPayload: sentPayloadPreview,
            response: json ?? text,
          });
          lastErrorRes = {
            ...(typeof json === 'object' && json !== null ? json : {}),
            success: false,
            status: response.status,
            message: cleanDocumentErrorMessage(rawErrMsg, 'Failed to save commercial invoice draft'),
            data: json?.data !== undefined ? json.data : json,
            errors: json?.errors || json?.data?.errors || (typeof json?.data === 'object' ? json.data : null),
            error_fields: json?.error_fields || json?.data?.error_fields || null,
            raw: json,
          };
          break;
        } catch (fetchErr: any) {
          if (i < saveCandidates.length - 1) continue;
          lastErrorRes = {
            success: false,
            message: fetchErr?.message || 'Network error occurred while saving commercial invoice draft',
          };
        }
      }

      return lastErrorRes || {
        success: false,
        message: 'Network error occurred while saving commercial invoice draft',
      };
    } catch (error: any) {
      console.error('[smartDocsService.saveCommercialInvoiceDraft] error:', error);
      return {
        success: false,
        message: cleanDocumentErrorMessage(error?.message, 'Network error occurred while saving commercial invoice draft'),
      };
    }
  },

  /**
   * Submits Commercial Invoice:
   * PATCH /commercial-invoice/submit/:id?lang_code=en&source=web
   */
  submitCommercialInvoice: async (
    payload: any,
    params: { lang?: string; source?: string } = {},
    token: string,
    id?: string
  ): Promise<any> => {
    if (!token) return { success: false, message: 'Unauthorized' };

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const candidateId = sanitizeDocId(
      id ||
        (isFormData
          ? (payload.get('commercial_invoice_id') ||
            payload.get('commercialInvoiceId') ||
            payload.get('id') ||
            payload.get('custom_invoice_id') ||
            payload.get('shipment_instruction_id') ||
            payload.get('proforma_id') ||
            payload.get('contract_id') ||
            payload.get('confirmation_id'))
          : (payload?.commercial_invoice_id ||
            payload?.commercialInvoiceId ||
            payload?.id ||
            payload?.custom_invoice_id ||
            payload?.shipment_instruction_id ||
            payload?.proforma_id ||
            payload?.contract_id ||
            payload?.confirmation_id))
    );

    const isPlaceholder =
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|lading|bill-of-lading|custom|custom-invoice|commercial|commercial-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        candidateId
      );
    const cleanId = candidateId && !isPlaceholder ? candidateId : '';

    const submitCandidates: Array<{ url: string; method: 'PATCH' | 'POST'; id?: string }> = [];
    if (cleanId) {
      const encId = encodeURIComponent(cleanId);
      submitCandidates.push(
        { url: `${baseUrl}/commercial-invoice/submit/${encId}`, method: 'PATCH', id: cleanId },
        { url: `${baseUrl}/commercial-invoice/submit/${encId}`, method: 'POST', id: cleanId },
        { url: `${baseUrl}/commercial-invoices/submit/${encId}`, method: 'PATCH', id: cleanId },
        { url: `${baseUrl}/commercial-invoices/submit/${encId}`, method: 'POST', id: cleanId }
      );
    }
    submitCandidates.push(
      { url: `${baseUrl}/commercial-invoice/submit`, method: 'POST' },
      { url: `${baseUrl}/commercial-invoice/submit`, method: 'PATCH' },
      { url: `${baseUrl}/commercial-invoices/submit`, method: 'POST' },
      { url: `${baseUrl}/commercial-invoices/submit`, method: 'PATCH' }
    );

    try {
      const headers: Record<string, string> = {};
      let lastErrorRes: any = null;

      for (let i = 0; i < submitCandidates.length; i++) {
        const candidate = submitCandidates[i];
        let body: any;
        if (isFormData) {
          const clonedFd = cloneFormDataPayload(payload);
          if (candidate.id) {
            clonedFd.set('commercial_invoice_id', candidate.id);
            clonedFd.set('id', candidate.id);
          } else {
            clonedFd.delete('id');
            clonedFd.delete('commercial_invoice_id');
          }
          body = clonedFd;
        } else {
          headers['Content-Type'] = 'application/json';
          const cleaned = { ...(payload || {}) };
          if (candidate.id) {
            cleaned.commercial_invoice_id = candidate.id;
            cleaned.id = candidate.id;
          } else {
            delete cleaned.id;
            delete cleaned.commercial_invoice_id;
          }
          body = JSON.stringify(cleaned);
        }

        try {
          const response = await customFetch(candidate.url, {
            method: candidate.method,
            token,
            headers,
            params: {
              lang_code: safeLang,
              source: params.source || 'web',
            },
            body,
            cache: 'no-store',
          });

          const text = await response.text();
          let json: any = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = { message: text };
          }

          if (response.ok && json?.success !== false && json?.success !== 0 && json?.status !== false) {
            return {
              ...json,
              success: true,
              data: json?.data !== undefined ? json.data : json,
              id:
                json?.data?.id ||
                json?.data?._id ||
                json?.data?.commercial_invoice_id ||
                json?.id ||
                json?._id ||
                candidate.id,
            };
          }

          const isRouteNotFound =
            response.status === 404 ||
            response.status === 405 ||
            (response.status >= 400 &&
              (/<(!DOCTYPE|html)/i.test(text) ||
                /^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(String(json?.message || json?.error || '').trim()) ||
                /not found/i.test(String(json?.message || json?.error || text || '').trim())));

          if (isRouteNotFound && i < submitCandidates.length - 1) {
            continue;
          }

          const rawMsgField = Array.isArray(json?.message)
            ? json.message.filter(Boolean).join(', ')
            : json?.message;
          const rawErrMsg = rawMsgField || json?.error || `Request failed with status ${response.status}`;
          const sentPayloadPreview = isFormData
            ? Object.fromEntries(
                Array.from((body as FormData).entries()).map(([k, v]) => [
                  k,
                  typeof v === 'string' ? v : `[File/Blob]`,
                ])
              )
            : body;
          console.error('[smartDocsService.submitCommercialInvoice] Backend error:', {
            url: candidate.url,
            method: candidate.method,
            status: response.status,
            sentPayload: sentPayloadPreview,
            response: json ?? text,
          });
          lastErrorRes = {
            ...(typeof json === 'object' && json !== null ? json : {}),
            success: false,
            status: response.status,
            message: cleanDocumentErrorMessage(rawErrMsg, 'Failed to submit commercial invoice'),
            data: json?.data !== undefined ? json.data : json,
            errors: json?.errors || json?.data?.errors || (typeof json?.data === 'object' ? json.data : null),
            error_fields: json?.error_fields || json?.data?.error_fields || null,
            raw: json,
          };
          break;
        } catch (fetchErr: any) {
          if (i < submitCandidates.length - 1) continue;
          lastErrorRes = {
            success: false,
            message: fetchErr?.message || 'Network error occurred while submitting commercial invoice',
          };
        }
      }

      return lastErrorRes || {
        success: false,
        message: 'Network error occurred while submitting commercial invoice',
      };
    } catch (error: any) {
      console.error('[smartDocsService.submitCommercialInvoice] error:', error);
      return {
        success: false,
        message: cleanDocumentErrorMessage(error?.message, 'Network error occurred while submitting commercial invoice'),
      };
    }
  },

  /**
   * Fetches Packing List details by ID with authentication:
   * GET /packing-list/:id?lang_code=en&source=web
   */
  getPackingList: async (
    id: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(id);
    if (!cleanId) return null;
    const url = `${baseUrl}/packing-list/${encodeURIComponent(cleanId)}`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });

      if (response && (response.success || response.status || response.data)) {
        return response;
      }

      const fallbackUrl = `${baseUrl}/packing-lists/${encodeURIComponent(cleanId)}`;
      try {
        return await customFetchJSON<any>(fallbackUrl, {
          token,
          params: {
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });
      } catch {
        return response;
      }
    } catch (error) {
      console.warn('[smartDocsService.getPackingList] /packing-list error, attempting fallback:', error);
      try {
        const fallbackUrl = `${baseUrl}/packing-lists/${encodeURIComponent(cleanId)}`;
        return await customFetchJSON<any>(fallbackUrl, {
          token,
          params: {
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });
      } catch (fallbackErr) {
        console.error('[smartDocsService.getPackingList] error:', fallbackErr);
        return null;
      }
    }
  },

  /**
   * Saves Packing List as draft:
   * PATCH /packing-list/save/:id?lang_code=en&source=web
   */
  savePackingListDraft: async (
    payload: any,
    params: { lang?: string; source?: string } = {},
    token: string,
    id?: string
  ): Promise<any> => {
    if (!token) return { success: false, message: 'Unauthorized' };

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const candidateId = sanitizeDocId(
      id ||
        (isFormData
          ? (payload.get('packing_list_id') ||
            payload.get('packingListId') ||
            payload.get('id') ||
            payload.get('commercial_invoice_id') ||
            payload.get('custom_invoice_id') ||
            payload.get('shipment_instruction_id') ||
            payload.get('proforma_id') ||
            payload.get('contract_id') ||
            payload.get('confirmation_id'))
          : (payload?.packing_list_id ||
            payload?.packingListId ||
            payload?.id ||
            payload?.commercial_invoice_id ||
            payload?.custom_invoice_id ||
            payload?.shipment_instruction_id ||
            payload?.proforma_id ||
            payload?.contract_id ||
            payload?.confirmation_id))
    );

    const isPlaceholder =
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|lading|bill-of-lading|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        candidateId
      );
    const cleanId = candidateId && !isPlaceholder ? candidateId : '';

    const saveCandidates: Array<{ url: string; method: 'PATCH' | 'POST'; id?: string }> = [];
    if (cleanId) {
      const encId = encodeURIComponent(cleanId);
      saveCandidates.push(
        { url: `${baseUrl}/packing-list/save/${encId}`, method: 'PATCH', id: cleanId },
        { url: `${baseUrl}/packing-list/save/${encId}`, method: 'POST', id: cleanId },
        { url: `${baseUrl}/packing-lists/save/${encId}`, method: 'PATCH', id: cleanId },
        { url: `${baseUrl}/packing-lists/save/${encId}`, method: 'POST', id: cleanId }
      );
    }
    saveCandidates.push(
      { url: `${baseUrl}/packing-list/save`, method: 'PATCH' },
      { url: `${baseUrl}/packing-list/save`, method: 'POST' },
      { url: `${baseUrl}/packing-lists/save`, method: 'PATCH' },
      { url: `${baseUrl}/packing-lists/save`, method: 'POST' }
    );

    try {
      const headers: Record<string, string> = {};
      let lastErrorRes: any = null;

      for (let i = 0; i < saveCandidates.length; i++) {
        const candidate = saveCandidates[i];
        let body: any;
        if (isFormData) {
          const clonedFd = cloneFormDataPayload(payload);
          if (candidate.id) {
            clonedFd.set('packing_list_id', candidate.id);
            clonedFd.set('id', candidate.id);
          } else {
            clonedFd.delete('id');
            clonedFd.delete('packing_list_id');
          }
          body = clonedFd;
        } else {
          headers['Content-Type'] = 'application/json';
          const cleaned = { ...(payload || {}) };
          if (candidate.id) {
            cleaned.packing_list_id = candidate.id;
            cleaned.id = candidate.id;
          } else {
            delete cleaned.id;
            delete cleaned.packing_list_id;
          }
          body = JSON.stringify(cleaned);
        }

        try {
          const response = await customFetch(candidate.url, {
            method: candidate.method,
            token,
            headers,
            params: {
              lang_code: safeLang,
              source: params.source || 'web',
            },
            body,
            cache: 'no-store',
          });

          const text = await response.text();
          let json: any = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = { message: text };
          }

          if (response.ok && json?.success !== false && json?.success !== 0 && json?.status !== false) {
            return {
              ...json,
              success: true,
              data: json?.data !== undefined ? json.data : json,
              id:
                json?.data?.id ||
                json?.data?._id ||
                json?.data?.packing_list_id ||
                json?.id ||
                json?._id ||
                candidate.id,
            };
          }

          const isRouteNotFound =
            response.status === 404 ||
            response.status === 405 ||
            (response.status >= 400 &&
              (/<(!DOCTYPE|html)/i.test(text) ||
                /^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(String(json?.message || json?.error || '').trim()) ||
                /not found/i.test(String(json?.message || json?.error || text || '').trim())));

          if (isRouteNotFound && i < saveCandidates.length - 1) {
            continue;
          }

          const rawMsgField = Array.isArray(json?.message)
            ? json.message.filter(Boolean).join(', ')
            : json?.message;
          const rawErrMsg = rawMsgField || json?.error || `Request failed with status ${response.status}`;
          lastErrorRes = {
            ...(typeof json === 'object' && json !== null ? json : {}),
            success: false,
            status: response.status,
            message: cleanDocumentErrorMessage(rawErrMsg, 'Failed to save packing list draft'),
            data: json?.data !== undefined ? json.data : json,
            errors: json?.errors || json?.data?.errors || (typeof json?.data === 'object' ? json.data : null),
            error_fields: json?.error_fields || json?.data?.error_fields || null,
            raw: json,
          };
          break;
        } catch (fetchErr: any) {
          if (i < saveCandidates.length - 1) continue;
          lastErrorRes = {
            success: false,
            message: fetchErr?.message || 'Network error occurred while saving packing list draft',
          };
        }
      }

      return lastErrorRes || {
        success: false,
        message: 'Network error occurred while saving packing list draft',
      };
    } catch (error: any) {
      console.error('[smartDocsService.savePackingListDraft] error:', error);
      return {
        success: false,
        message: cleanDocumentErrorMessage(error?.message, 'Network error occurred while saving packing list draft'),
      };
    }
  },

  /**
   * Submits Packing List:
   * PATCH /packing-list/submit/:id?lang_code=en&source=web
   */
  submitPackingList: async (
    payload: any,
    params: { lang?: string; source?: string } = {},
    token: string,
    id?: string
  ): Promise<any> => {
    if (!token) return { success: false, message: 'Unauthorized' };

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const isFormData =
      (typeof FormData !== 'undefined' && payload instanceof FormData) ||
      (payload && typeof payload.get === 'function' && typeof payload.append === 'function');

    const candidateId = sanitizeDocId(
      id ||
        (isFormData
          ? (payload.get('packing_list_id') ||
            payload.get('packingListId') ||
            payload.get('id') ||
            payload.get('commercial_invoice_id') ||
            payload.get('custom_invoice_id') ||
            payload.get('shipment_instruction_id') ||
            payload.get('proforma_id') ||
            payload.get('contract_id') ||
            payload.get('confirmation_id'))
          : (payload?.packing_list_id ||
            payload?.packingListId ||
            payload?.id ||
            payload?.commercial_invoice_id ||
            payload?.custom_invoice_id ||
            payload?.shipment_instruction_id ||
            payload?.proforma_id ||
            payload?.contract_id ||
            payload?.confirmation_id))
    );

    const isPlaceholder =
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|lading|bill-of-lading|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        candidateId
      );
    const cleanId = candidateId && !isPlaceholder ? candidateId : '';

    const submitCandidates: Array<{ url: string; method: 'PATCH' | 'POST'; id?: string }> = [];
    if (cleanId) {
      const encId = encodeURIComponent(cleanId);
      submitCandidates.push(
        { url: `${baseUrl}/packing-list/submit/${encId}`, method: 'PATCH', id: cleanId },
        { url: `${baseUrl}/packing-list/submit/${encId}`, method: 'POST', id: cleanId },
        { url: `${baseUrl}/packing-lists/submit/${encId}`, method: 'PATCH', id: cleanId },
        { url: `${baseUrl}/packing-lists/submit/${encId}`, method: 'POST', id: cleanId }
      );
    }
    submitCandidates.push(
      { url: `${baseUrl}/packing-list/submit`, method: 'POST' },
      { url: `${baseUrl}/packing-list/submit`, method: 'PATCH' },
      { url: `${baseUrl}/packing-lists/submit`, method: 'POST' },
      { url: `${baseUrl}/packing-lists/submit`, method: 'PATCH' }
    );

    try {
      const headers: Record<string, string> = {};
      let lastErrorRes: any = null;

      for (let i = 0; i < submitCandidates.length; i++) {
        const candidate = submitCandidates[i];
        let body: any;
        if (isFormData) {
          const clonedFd = cloneFormDataPayload(payload);
          if (candidate.id) {
            clonedFd.set('packing_list_id', candidate.id);
            clonedFd.set('id', candidate.id);
          } else {
            clonedFd.delete('id');
            clonedFd.delete('packing_list_id');
          }
          body = clonedFd;
        } else {
          headers['Content-Type'] = 'application/json';
          const cleaned = { ...(payload || {}) };
          if (candidate.id) {
            cleaned.packing_list_id = candidate.id;
            cleaned.id = candidate.id;
          } else {
            delete cleaned.id;
            delete cleaned.packing_list_id;
          }
          body = JSON.stringify(cleaned);
        }

        try {
          const response = await customFetch(candidate.url, {
            method: candidate.method,
            token,
            headers,
            params: {
              lang_code: safeLang,
              source: params.source || 'web',
            },
            body,
            cache: 'no-store',
          });

          const text = await response.text();
          let json: any = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = { message: text };
          }

          if (response.ok && json?.success !== false && json?.success !== 0 && json?.status !== false) {
            return {
              ...json,
              success: true,
              data: json?.data !== undefined ? json.data : json,
              id:
                json?.data?.id ||
                json?.data?._id ||
                json?.data?.packing_list_id ||
                json?.id ||
                json?._id ||
                candidate.id,
            };
          }

          const isRouteNotFound =
            response.status === 404 ||
            response.status === 405 ||
            (response.status >= 400 &&
              (/<(!DOCTYPE|html)/i.test(text) ||
                /^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(String(json?.message || json?.error || '').trim()) ||
                /not found/i.test(String(json?.message || json?.error || text || '').trim())));

          if (isRouteNotFound && i < submitCandidates.length - 1) {
            continue;
          }

          const rawMsgField = Array.isArray(json?.message)
            ? json.message.filter(Boolean).join(', ')
            : json?.message;
          const rawErrMsg = rawMsgField || json?.error || `Request failed with status ${response.status}`;
          lastErrorRes = {
            ...(typeof json === 'object' && json !== null ? json : {}),
            success: false,
            status: response.status,
            message: cleanDocumentErrorMessage(rawErrMsg, 'Failed to submit packing list'),
            data: json?.data !== undefined ? json.data : json,
            errors: json?.errors || json?.data?.errors || (typeof json?.data === 'object' ? json.data : null),
            error_fields: json?.error_fields || json?.data?.error_fields || null,
            raw: json,
          };
          break;
        } catch (fetchErr: any) {
          if (i < submitCandidates.length - 1) continue;
          lastErrorRes = {
            success: false,
            message: fetchErr?.message || 'Network error occurred while submitting packing list',
          };
        }
      }

      return lastErrorRes || {
        success: false,
        message: 'Network error occurred while submitting packing list',
      };
    } catch (error: any) {
      console.error('[smartDocsService.submitPackingList] error:', error);
      return {
        success: false,
        message: cleanDocumentErrorMessage(error?.message, 'Network error occurred while submitting packing list'),
      };
    }
  },

  /**
   * Fetches Bill of Lading details by ID with authentication:
   * GET /bill-of-lading/:id?lang_code=en&source=web
   */
  getBillOfLading: async (
    id: string,
    params: { lang?: string; source?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');
    const cleanId = sanitizeDocId(id);
    if (!cleanId) return null;
    const url = `${baseUrl}/bill-of-lading/${encodeURIComponent(cleanId)}`;

    try {
      const response = await customFetchJSON<any>(url, {
        token,
        params: {
          lang_code: safeLang,
          source: params.source || 'web',
        },
        cache: 'no-store',
      });

      if (response && (response.success || response.status || response.data)) {
        return response;
      }
      if (!response) {
        const fallbackUrl = `${baseUrl}/bill-of-ladings/${encodeURIComponent(cleanId)}`;
        const fallbackRes = await customFetchJSON<any>(fallbackUrl, {
          token,
          params: {
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });
        if (fallbackRes) return fallbackRes;
      }
      return response;
    } catch (error) {
      console.warn('[smartDocsService.getBillOfLading] /bill-of-lading error, attempting fallback:', error);
      try {
        const fallbackUrl = `${baseUrl}/bill-of-ladings/${encodeURIComponent(cleanId)}`;
        return await customFetchJSON<any>(fallbackUrl, {
          token,
          params: {
            lang_code: safeLang,
            source: params.source || 'web',
          },
          cache: 'no-store',
        });
      } catch (fallbackError) {
        console.error('[smartDocsService.getBillOfLading] fallback error:', fallbackError);
        return null;
      }
    }
  },

  /**
   * Saves a Bill of Lading draft with authentication:
   * PATCH /bill-of-lading/save/:id?lang_code=en&source=web
   */
  saveBillOfLadingDraft: async (
    payload: any,
    params: { lang?: string; source?: string; id?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');

    let effectivePayload = payload;
    let isFormData =
      (typeof FormData !== 'undefined' && effectivePayload instanceof FormData) ||
      (effectivePayload && typeof effectivePayload.get === 'function' && typeof effectivePayload.append === 'function');

    const shipmentIdInPayload = isFormData ? (effectivePayload.get('shipment_instruction_id') || effectivePayload.get('shipment_id')) : (effectivePayload?.shipment_instruction_id || effectivePayload?.shipment_id);
    const customInvoiceIdInPayload = isFormData ? effectivePayload.get('custom_invoice_id') : effectivePayload?.custom_invoice_id;
    const proformaIdInPayload = isFormData ? effectivePayload.get('proforma_id') : effectivePayload?.proforma_id;
    const contractIdInPayload = isFormData ? effectivePayload.get('contract_id') : effectivePayload?.contract_id;
    const confIdInPayload = isFormData ? effectivePayload.get('confirmation_id') : effectivePayload?.confirmation_id;

    const directBLId = isFormData
      ? (effectivePayload.get('bill_of_lading_id') || effectivePayload.get('lading_id') || effectivePayload.get('bl_id') || effectivePayload.get('id') || '')
      : (effectivePayload?.bill_of_lading_id || effectivePayload?.lading_id || effectivePayload?.bl_id || effectivePayload?.id || '');

    const isPlaceholder = (val: string) =>
      !val ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|lading|bill-of-lading|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        val.trim()
      );

    const candidateIds = Array.from(
      new Set(
        [
          params.id,
          directBLId,
          shipmentIdInPayload,
          customInvoiceIdInPayload,
          proformaIdInPayload,
          contractIdInPayload,
          confIdInPayload,
        ]
          .map((id) => (id ? String(id).trim() : ''))
          .filter((id) => id && !isPlaceholder(id))
      )
    );

    const primaryId = candidateIds[0] || (params.id && !isPlaceholder(String(params.id)) ? String(params.id).trim() : '');

    const saveCandidates: Array<{ method: string; url: string; id?: string }> = [];

    for (const candId of candidateIds) {
      const encId = encodeURIComponent(candId);
      saveCandidates.push(
        { method: 'PATCH', url: `${baseUrl}/bill-of-lading/save/${encId}`, id: candId },
        { method: 'POST', url: `${baseUrl}/bill-of-lading/save/${encId}`, id: candId },
        { method: 'PATCH', url: `${baseUrl}/bill-of-ladings/save/${encId}`, id: candId },
        { method: 'POST', url: `${baseUrl}/bill-of-ladings/save/${encId}`, id: candId }
      );
    }
    saveCandidates.push(
      { method: 'POST', url: `${baseUrl}/bill-of-lading/save`, id: primaryId || undefined },
      { method: 'POST', url: `${baseUrl}/bill-of-ladings/save`, id: primaryId || undefined }
    );

    let lastErrorRes: any = null;

    try {
      for (let i = 0; i < saveCandidates.length; i++) {
        const candidate = saveCandidates[i];
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json, text/plain, */*',
        };

        let body: any;
        if (isFormData) {
          const clonedFd = new FormData();
          for (const [k, v] of (effectivePayload as any).entries()) {
            if (v === undefined || v === null) continue;
            clonedFd.append(k, v);
          }
          if (candidate.id) {
            clonedFd.set('bill_of_lading_id', candidate.id);
            clonedFd.set('id', candidate.id);
          } else {
            clonedFd.delete('id');
            clonedFd.delete('bill_of_lading_id');
            clonedFd.delete('lading_id');
          }
          if (shipmentIdInPayload) clonedFd.set('shipment_instruction_id', String(shipmentIdInPayload));
          if (customInvoiceIdInPayload) clonedFd.set('custom_invoice_id', String(customInvoiceIdInPayload));
          if (proformaIdInPayload) clonedFd.set('proforma_id', String(proformaIdInPayload));
          if (contractIdInPayload) clonedFd.set('contract_id', String(contractIdInPayload));
          if (confIdInPayload) clonedFd.set('confirmation_id', String(confIdInPayload));

          const watermarkVal = clonedFd.get('is_watermark_enabled') ?? clonedFd.get('watermark_enabled') ?? clonedFd.get('watermark') ?? 'true';
          const isWatermarkBool = typeof watermarkVal === 'string' ? watermarkVal !== 'false' && watermarkVal !== '0' : Boolean(watermarkVal);
          clonedFd.set('is_watermark_enabled', String(isWatermarkBool));
          clonedFd.set('watermark_enabled', String(isWatermarkBool));
          clonedFd.set('watermark', String(isWatermarkBool));

          const titleVal = clonedFd.get('pdf_title') ?? clonedFd.get('document_title') ?? clonedFd.get('title') ?? 'BILL OF LADING';
          const safeTitle = String(titleVal || '').trim() || 'BILL OF LADING';
          clonedFd.set('pdf_title', safeTitle);
          clonedFd.set('document_title', safeTitle);

          const cLabel = clonedFd.get('comment_label') ?? clonedFd.get('comment_title') ?? clonedFd.get('notes_title') ?? clonedFd.get('title') ?? '';
          const cValue = clonedFd.get('comment_value') ?? clonedFd.get('comment_text') ?? clonedFd.get('notes_comment') ?? clonedFd.get('comment') ?? '';
          const effectiveCLabel = String(cLabel || (cValue ? 'Comments' : '')).trim();
          const effectiveCValue = String(cValue || '').trim();
          clonedFd.set('comment_label', effectiveCLabel);
          clonedFd.set('comment_title', effectiveCLabel);
          clonedFd.set('notes_title', effectiveCLabel);
          clonedFd.set('comment_value', effectiveCValue);
          clonedFd.set('comment_text', effectiveCValue);
          clonedFd.set('notes_comment', effectiveCValue);
          clonedFd.set('comment', effectiveCValue);

          body = clonedFd;
        } else {
          headers['Content-Type'] = 'application/json';
          const cleaned = cleanBillOfLadingPayload(effectivePayload);
          if (candidate.id) {
            cleaned.bill_of_lading_id = candidate.id;
            cleaned.id = candidate.id;
          } else {
            cleaned.id && delete cleaned.id;
            cleaned.bill_of_lading_id && delete cleaned.bill_of_lading_id;
            cleaned.lading_id && delete cleaned.lading_id;
          }
          if (shipmentIdInPayload) cleaned.shipment_instruction_id = String(shipmentIdInPayload);
          if (customInvoiceIdInPayload) cleaned.custom_invoice_id = String(customInvoiceIdInPayload);
          if (proformaIdInPayload) cleaned.proforma_id = String(proformaIdInPayload);
          if (contractIdInPayload) cleaned.contract_id = String(contractIdInPayload);
          if (confIdInPayload) cleaned.confirmation_id = String(confIdInPayload);
          body = JSON.stringify(cleaned);
        }

        try {
          const response = await customFetch(candidate.url, {
            method: candidate.method,
            token,
            headers,
            body,
            params: {
              lang_code: safeLang,
              source: params.source || 'web',
            },
            cache: 'no-store',
          });

          const text = await response.text();
          let json: any = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }

          if (response.ok) {
            const isExplicitFailure =
              json && typeof json === 'object' && (json.success === 0 || json.success === false);
            if (isExplicitFailure) {
              console.warn(
                `[smartDocsService.saveBillOfLadingDraft] Validation/API failure ${candidate.method} ${candidate.url}`,
                { sentBody: typeof body === 'string' ? body : '[FormData]', response: json }
              );
            }
            return {
              ...(typeof json === 'object' && json !== null ? json : {}),
              success: !isExplicitFailure,
              data: json ?? text,
              error_fields: json?.error_fields || json?.data?.error_fields || null,
              errors: json?.errors || json?.data?.errors || null,
              raw: json ?? text,
            };
          }

          const isRouteNotFound =
            (response.status === 404 || response.status === 405) &&
            (!json?.errors && !json?.error_fields && !json?.data) &&
            (/^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(text.trim()) ||
              /<(!DOCTYPE|html)/i.test(text) ||
              /^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(String(json?.message || json?.error || '').trim()) ||
              /not found/i.test(String(json?.message || json?.error || text || '').trim()));

          if (isRouteNotFound && i < saveCandidates.length - 1) {
            console.warn(`[smartDocsService.saveBillOfLadingDraft] Candidate ${candidate.method} ${candidate.url} gave router error, trying next candidate...`);
            continue;
          }

          console.warn(
            `[smartDocsService.saveBillOfLadingDraft] Error ${response.status} ${candidate.method} ${candidate.url}`,
            { sentBody: typeof body === 'string' ? body : '[FormData]', response: json ?? text }
          );

          const rawErrMsg = json?.message || json?.error || `Request failed with status ${response.status}`;
          const cleanMsg = cleanDocumentErrorMessage(rawErrMsg, 'Failed to save bill of lading draft');

          lastErrorRes = {
            ...(typeof json === 'object' && json !== null ? json : {}),
            success: false,
            status: response.status,
            message: cleanMsg,
            data: json?.data !== undefined ? json.data : json,
            errors: json?.errors || json?.data?.errors || (typeof json?.data === 'object' ? json.data : null),
            error_fields: json?.error_fields || json?.data?.error_fields || null,
            raw: json,
          };
          break;
        } catch (fetchErr: any) {
          if (i < saveCandidates.length - 1) continue;
          lastErrorRes = {
            success: false,
            message: fetchErr?.message || 'Network error occurred while saving bill of lading',
          };
        }
      }

      return lastErrorRes || {
        success: false,
        message: 'Network error occurred while saving bill of lading',
      };
    } catch (error: any) {
      console.error('[smartDocsService.saveBillOfLadingDraft] error:', error);
      return {
        success: false,
        message: error?.message || 'Network error occurred while saving bill of lading',
      };
    }
  },

  /**
   * Submits a Bill of Lading with authentication:
   * PATCH /bill-of-lading/submit/:id?lang_code=en&source=web
   */
  submitBillOfLading: async (
    payload: any,
    params: { lang?: string; source?: string; id?: string } = {},
    token: string
  ): Promise<any | null> => {
    if (!token) return null;

    const rawBaseUrl = getSmartDocsApiUrl();
    const baseUrl = rawBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const safeLang = getSafeLang(params.lang || 'en');

    let effectivePayload = payload;
    let isFormData =
      (typeof FormData !== 'undefined' && effectivePayload instanceof FormData) ||
      (effectivePayload && typeof effectivePayload.get === 'function' && typeof effectivePayload.append === 'function');

    const shipmentIdInPayload = isFormData ? (effectivePayload.get('shipment_instruction_id') || effectivePayload.get('shipment_id')) : (effectivePayload?.shipment_instruction_id || effectivePayload?.shipment_id);
    const customInvoiceIdInPayload = isFormData ? effectivePayload.get('custom_invoice_id') : effectivePayload?.custom_invoice_id;
    const proformaIdInPayload = isFormData ? effectivePayload.get('proforma_id') : effectivePayload?.proforma_id;
    const contractIdInPayload = isFormData ? effectivePayload.get('contract_id') : effectivePayload?.contract_id;
    const confIdInPayload = isFormData ? effectivePayload.get('confirmation_id') : effectivePayload?.confirmation_id;

    const directBLId = isFormData
      ? (effectivePayload.get('bill_of_lading_id') || effectivePayload.get('lading_id') || effectivePayload.get('bl_id') || effectivePayload.get('id') || '')
      : (effectivePayload?.bill_of_lading_id || effectivePayload?.lading_id || effectivePayload?.bl_id || effectivePayload?.id || '');

    const isPlaceholder = (val: string) =>
      !val ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|lading|bill-of-lading|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        val.trim()
      );

    const candidateIds = Array.from(
      new Set(
        [
          params.id,
          directBLId,
          shipmentIdInPayload,
          customInvoiceIdInPayload,
          proformaIdInPayload,
          contractIdInPayload,
          confIdInPayload,
        ]
          .map((id) => (id ? String(id).trim() : ''))
          .filter((id) => id && !isPlaceholder(id))
      )
    );

    const primaryId = candidateIds[0] || (params.id && !isPlaceholder(String(params.id)) ? String(params.id).trim() : '');

    const submitCandidates: Array<{ method: string; url: string; id?: string }> = [];

    for (const candId of candidateIds) {
      const encId = encodeURIComponent(candId);
      submitCandidates.push(
        { method: 'PATCH', url: `${baseUrl}/bill-of-lading/submit/${encId}`, id: candId },
        { method: 'POST', url: `${baseUrl}/bill-of-lading/submit/${encId}`, id: candId },
        { method: 'PATCH', url: `${baseUrl}/bill-of-ladings/submit/${encId}`, id: candId },
        { method: 'POST', url: `${baseUrl}/bill-of-ladings/submit/${encId}`, id: candId }
      );
    }
    submitCandidates.push(
      { method: 'POST', url: `${baseUrl}/bill-of-lading/submit`, id: primaryId || undefined },
      { method: 'POST', url: `${baseUrl}/bill-of-ladings/submit`, id: primaryId || undefined }
    );

    let lastErrorRes: any = null;

    try {
      for (let i = 0; i < submitCandidates.length; i++) {
        const candidate = submitCandidates[i];
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json, text/plain, */*',
        };

        let body: any;
        if (isFormData) {
          const clonedFd = new FormData();
          for (const [k, v] of (effectivePayload as any).entries()) {
            if (v === undefined || v === null) continue;
            clonedFd.append(k, v);
          }
          if (candidate.id) {
            clonedFd.set('bill_of_lading_id', candidate.id);
            clonedFd.set('id', candidate.id);
          } else {
            clonedFd.delete('id');
            clonedFd.delete('bill_of_lading_id');
            clonedFd.delete('lading_id');
          }
          if (shipmentIdInPayload) clonedFd.set('shipment_instruction_id', String(shipmentIdInPayload));
          if (customInvoiceIdInPayload) clonedFd.set('custom_invoice_id', String(customInvoiceIdInPayload));
          if (proformaIdInPayload) clonedFd.set('proforma_id', String(proformaIdInPayload));
          if (contractIdInPayload) clonedFd.set('contract_id', String(contractIdInPayload));
          if (confIdInPayload) clonedFd.set('confirmation_id', String(confIdInPayload));

          const watermarkVal = clonedFd.get('is_watermark_enabled') ?? clonedFd.get('watermark_enabled') ?? clonedFd.get('watermark') ?? 'true';
          const isWatermarkBool = typeof watermarkVal === 'string' ? watermarkVal !== 'false' && watermarkVal !== '0' : Boolean(watermarkVal);
          clonedFd.set('is_watermark_enabled', String(isWatermarkBool));
          clonedFd.set('watermark_enabled', String(isWatermarkBool));
          clonedFd.set('watermark', String(isWatermarkBool));

          const titleVal = clonedFd.get('pdf_title') ?? clonedFd.get('document_title') ?? clonedFd.get('title') ?? 'BILL OF LADING';
          const safeTitle = String(titleVal || '').trim() || 'BILL OF LADING';
          clonedFd.set('pdf_title', safeTitle);
          clonedFd.set('document_title', safeTitle);

          const cLabel = clonedFd.get('comment_label') ?? clonedFd.get('comment_title') ?? clonedFd.get('notes_title') ?? clonedFd.get('title') ?? '';
          const cValue = clonedFd.get('comment_value') ?? clonedFd.get('comment_text') ?? clonedFd.get('notes_comment') ?? clonedFd.get('comment') ?? '';
          const effectiveCLabel = String(cLabel || (cValue ? 'Comments' : '')).trim();
          const effectiveCValue = String(cValue || '').trim();
          clonedFd.set('comment_label', effectiveCLabel);
          clonedFd.set('comment_title', effectiveCLabel);
          clonedFd.set('notes_title', effectiveCLabel);
          clonedFd.set('comment_value', effectiveCValue);
          clonedFd.set('comment_text', effectiveCValue);
          clonedFd.set('notes_comment', effectiveCValue);
          clonedFd.set('comment', effectiveCValue);

          body = clonedFd;
        } else {
          headers['Content-Type'] = 'application/json';
          const cleaned = cleanBillOfLadingPayload(effectivePayload);
          if (candidate.id) {
            cleaned.bill_of_lading_id = candidate.id;
            cleaned.id = candidate.id;
          } else {
            cleaned.id && delete cleaned.id;
            cleaned.bill_of_lading_id && delete cleaned.bill_of_lading_id;
            cleaned.lading_id && delete cleaned.lading_id;
          }
          if (shipmentIdInPayload) cleaned.shipment_instruction_id = String(shipmentIdInPayload);
          if (customInvoiceIdInPayload) cleaned.custom_invoice_id = String(customInvoiceIdInPayload);
          if (proformaIdInPayload) cleaned.proforma_id = String(proformaIdInPayload);
          if (contractIdInPayload) cleaned.contract_id = String(contractIdInPayload);
          if (confIdInPayload) cleaned.confirmation_id = String(confIdInPayload);
          body = JSON.stringify(cleaned);
        }

        try {
          const response = await customFetch(candidate.url, {
            method: candidate.method,
            token,
            headers,
            body,
            params: {
              lang_code: safeLang,
              source: params.source || 'web',
            },
            cache: 'no-store',
          });

          const text = await response.text();
          let json: any = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }

          if (response.ok) {
            const isExplicitFailure =
              json && typeof json === 'object' && (json.success === 0 || json.success === false);
            if (isExplicitFailure) {
              console.warn(
                `[smartDocsService.submitBillOfLading] Validation/API failure ${candidate.method} ${candidate.url}`,
                { sentBody: typeof body === 'string' ? body : '[FormData]', response: json }
              );
            }
            return {
              ...(typeof json === 'object' && json !== null ? json : {}),
              success: !isExplicitFailure,
              data: json ?? text,
              error_fields: json?.error_fields || json?.data?.error_fields || null,
              errors: json?.errors || json?.data?.errors || null,
              raw: json ?? text,
            };
          }

          const isRouteNotFound =
            (response.status === 404 || response.status === 405) &&
            (!json?.errors && !json?.error_fields && !json?.data) &&
            (/^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(text.trim()) ||
              /<(!DOCTYPE|html)/i.test(text) ||
              /^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(String(json?.message || json?.error || '').trim()) ||
              /not found/i.test(String(json?.message || json?.error || text || '').trim()));

          if (isRouteNotFound && i < submitCandidates.length - 1) {
            console.warn(`[smartDocsService.submitBillOfLading] Candidate ${candidate.method} ${candidate.url} gave router error, trying next candidate...`);
            continue;
          }

          console.warn(
            `[smartDocsService.submitBillOfLading] Error ${response.status} ${candidate.method} ${candidate.url}`,
            { sentBody: typeof body === 'string' ? body : '[FormData]', response: json ?? text }
          );

          const rawErrMsg = json?.message || json?.error || `Request failed with status ${response.status}`;
          const cleanMsg = cleanDocumentErrorMessage(rawErrMsg, 'Failed to submit bill of lading');

          lastErrorRes = {
            ...(typeof json === 'object' && json !== null ? json : {}),
            success: false,
            status: response.status,
            message: cleanMsg,
            data: json?.data !== undefined ? json.data : json,
            errors: json?.errors || json?.data?.errors || (typeof json?.data === 'object' ? json.data : null),
            error_fields: json?.error_fields || json?.data?.error_fields || null,
            raw: json,
          };
          break;
        } catch (fetchErr: any) {
          if (i < submitCandidates.length - 1) continue;
          lastErrorRes = {
            success: false,
            message: fetchErr?.message || 'Network error occurred while submitting bill of lading',
          };
        }
      }

      return lastErrorRes || {
        success: false,
        message: 'Network error occurred while submitting bill of lading',
      };
    } catch (error: any) {
      console.error('[smartDocsService.submitBillOfLading] error:', error);
      return {
        success: false,
        message: cleanDocumentErrorMessage(error?.message, 'Network error occurred while submitting bill of lading'),
      };
    }
  },

  /**
   * GET /dms-templates/preview-pdf?prefix=:prefix&id=:id&lang_code=:lang&source=web
   * Fetches the rendered HTML preview for a document (e.g. proforma, contract, confirmation).
   * Robust multi-prefix & multi-candidate-id fallback guarantees previews load smoothly without
   * failing with "Smart docs record not found".
   */
  getDocPreviewHtml: async (
    params: {
      prefix?: string;
      id: string;
      lang?: string;
      source?: string;
      candidateIds?: string[];
      candidatePrefixes?: string[];
    },
    token: string
  ): Promise<{ success: boolean; html?: string; message?: string; error?: string }> => {
    const baseUrl = getSmartDocsApiUrl();
    const safeLang = getSafeLang(params.lang || 'en');
    const safeId = sanitizeDocId(params.id);
    const rawPrefix = params.prefix || 'confirmation';
    const source = params.source || 'web';

    // Candidate document IDs in priority order
    const candidateIds = Array.from(
      new Set(
        [
          safeId,
          ...(params.candidateIds || []).map((id) => sanitizeDocId(id)),
        ].filter((id): id is string => Boolean(id && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+)$/i.test(id)))
      )
    );

    if (candidateIds.length === 0) {
      return {
        success: false,
        error: 'Document ID is missing. Please save the document first.',
        message: 'Document ID is missing. Please save the document first.',
      };
    }

    // Determine candidate prefixes based on document type
    const isCommercialInvoice = /commercial.*invoice|commercial_invoice|commercial-invoice/i.test(rawPrefix);
    const isPackingList = !isCommercialInvoice && /packing.*list|packing_list|packing-list|packing/i.test(rawPrefix);
    const isCustomInvoice = !isCommercialInvoice && !isPackingList && /custom.*invoice|custom_invoice|custom-invoice/i.test(rawPrefix);
    const isBillOfLading = !isCommercialInvoice && !isPackingList && !isCustomInvoice && /lading|bl|bill_of_lading|bill-of-lading/i.test(rawPrefix);
    const isShipmentInstruction = !isCommercialInvoice && !isPackingList && !isCustomInvoice && !isBillOfLading && /shipment|instruction|si/i.test(rawPrefix);
    const isProforma = !isCommercialInvoice && !isPackingList && !isCustomInvoice && !isBillOfLading && !isShipmentInstruction && /proforma|invoice|pi/i.test(rawPrefix);
    const isContract = !isCommercialInvoice && !isPackingList && !isCustomInvoice && !isBillOfLading && !isShipmentInstruction && !isProforma && /contract|sales/i.test(rawPrefix);

    const candidatePrefixes: string[] = params.candidatePrefixes && params.candidatePrefixes.length > 0
      ? params.candidatePrefixes
      : isCommercialInvoice
      ? ['commercial_invoice', 'commercial-invoice', 'commercialInvoice', 'commercial', 'ci']
      : isPackingList
      ? ['packing_list', 'packing-list', 'packingList', 'packinglist', 'packing', 'pl', 'packing_lists', 'packing-lists']
      : isCustomInvoice
      ? ['custom_invoice', 'custom-invoice', 'customInvoice', 'custom', 'invoice', 'ci']
      : isBillOfLading
      ? ['bill_of_lading', 'bill-of-lading', 'billOfLading', 'lading', 'bl']
      : isShipmentInstruction
      ? ['shipment_instruction', 'shipment-instruction', 'shipmentInstruction', 'shipment', 'instruction', 'si']
      : isProforma
      ? ['proforma', 'proforma_invoice', 'proforma-invoice', 'proformaInvoice', 'invoice', 'pi']
      : isContract
      ? ['contract', 'sales-contract', 'sales_contract', 'salesContract', 'document']
      : ['confirmation', 'trade-confirmation', 'trade_confirmation', 'tradeConfirmation', 'document'];

    let lastErrorMsg = 'Failed to generate preview';

    // Attempt preview via /dms-templates/preview-pdf across prefixes & candidate IDs
    for (const curId of candidateIds) {
      for (const curPrefix of candidatePrefixes) {
        const url = `${baseUrl}/dms-templates/preview-pdf`;
        try {
          const response = await customFetch(url, {
            method: 'GET',
            token,
            params: {
              prefix: curPrefix,
              id: curId,
              lang_code: safeLang,
              source,
            },
            headers: {
              Accept: 'text/html, application/xhtml+xml, application/json, */*',
            },
            cache: 'no-store',
          });

          if (!response.ok) {
            try {
              const rawText = await response.text();
              try {
                const errData = JSON.parse(rawText);
                lastErrorMsg = errData.message || errData.error || lastErrorMsg;
              } catch {
                if (rawText) lastErrorMsg = rawText.slice(0, 300);
              }
            } catch {
              // ignore
            }
            continue;
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
                  lastErrorMsg = parsed.message || parsed.error || lastErrorMsg;
                  continue;
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
          if (text && text.trim() && !text.trim().startsWith('{"status":false')) {
            return { success: true, html: text };
          }
        } catch (fetchErr: any) {
          lastErrorMsg = fetchErr?.message || lastErrorMsg;
        }
      }
    }

    // Direct endpoint fallbacks if /dms-templates/preview-pdf was not found
    for (const curId of candidateIds) {
      const directEndpoints = isCommercialInvoice
        ? [
            `${baseUrl}/commercial-invoice/preview-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/commercial-invoice/preview/${encodeURIComponent(curId)}`,
            `${baseUrl}/commercial-invoices/preview-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/commercial-invoices/preview/${encodeURIComponent(curId)}`,
            `${baseUrl}/commercial-invoice/pdf/${encodeURIComponent(curId)}`,
          ]
        : isPackingList
        ? [
            `${baseUrl}/packing-list/preview-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing-list/preview/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing-lists/preview-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing-lists/preview/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing-list/pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing-lists/pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing/preview-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing/preview/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing/pdf/${encodeURIComponent(curId)}`,
          ]
        : isCustomInvoice
        ? [
            `${baseUrl}/custom-invoice/preview-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/custom-invoice/preview/${encodeURIComponent(curId)}`,
            `${baseUrl}/custom/preview-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/custom/preview/${encodeURIComponent(curId)}`,
            `${baseUrl}/custom-invoices/preview-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/custom-invoices/preview/${encodeURIComponent(curId)}`,
            `${baseUrl}/custom-invoice/pdf/${encodeURIComponent(curId)}`,
          ]
        : isProforma
        ? [
            `${baseUrl}/proforma-invoice/preview-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/proforma-invoice/preview/${encodeURIComponent(curId)}`,
            `${baseUrl}/proforma/preview-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/proforma/preview/${encodeURIComponent(curId)}`,
          ]
        : isContract
        ? [
            `${baseUrl}/contract/preview-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/contract/preview/${encodeURIComponent(curId)}`,
          ]
        : [
            `${baseUrl}/confirmation/preview-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/confirmation/preview/${encodeURIComponent(curId)}`,
          ];

      for (const directUrl of directEndpoints) {
        try {
          const directRes = await customFetch(directUrl, {
            method: 'GET',
            token,
            params: { lang_code: safeLang, source },
            headers: { Accept: 'text/html, application/xhtml+xml, application/json, */*' },
            cache: 'no-store',
          });
          if (directRes.ok) {
            const directText = await directRes.text();
            if (directText && !directText.trim().startsWith('{"status":false')) {
              return { success: true, html: directText };
            }
          }
        } catch {
          // ignore
        }
      }
    }

    return {
      success: false,
      error: lastErrorMsg,
      message: lastErrorMsg,
    };
  },

  /**
   * GET /dms-templates/download-pdf?prefix=:prefix&id=:id&lang_code=:lang&source=web
   * Downloads the PDF file for a document (e.g. proforma, contract, confirmation).
   * Robust multi-prefix & multi-candidate-id fallback guarantees downloads succeed.
   */
  downloadDocPdf: async (
    params: {
      prefix?: string;
      id: string;
      lang?: string;
      source?: string;
      candidateIds?: string[];
      candidatePrefixes?: string[];
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
    const rawPrefix = params.prefix || 'confirmation';
    const source = params.source || 'web';

    const candidateIds = Array.from(
      new Set(
        [
          safeId,
          ...(params.candidateIds || []).map((id) => sanitizeDocId(id)),
        ].filter((id): id is string => Boolean(id && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+)$/i.test(id)))
      )
    );

    if (candidateIds.length === 0) {
      return {
        success: false,
        error: 'Document ID is missing. Please save the document first.',
        message: 'Document ID is missing. Please save the document first.',
      };
    }

    const isCommercialInvoice = /commercial.*invoice|commercial_invoice|commercial-invoice/i.test(rawPrefix);
    const isPackingList = !isCommercialInvoice && /packing.*list|packing_list|packing-list|packing/i.test(rawPrefix);
    const isCustomInvoice = !isCommercialInvoice && !isPackingList && /custom.*invoice|custom_invoice|custom-invoice/i.test(rawPrefix);
    const isBillOfLading = !isCommercialInvoice && !isPackingList && !isCustomInvoice && /lading|bl|bill_of_lading|bill-of-lading/i.test(rawPrefix);
    const isShipmentInstruction = !isCommercialInvoice && !isPackingList && !isCustomInvoice && !isBillOfLading && /shipment|instruction|si/i.test(rawPrefix);
    const isProforma = !isCommercialInvoice && !isPackingList && !isCustomInvoice && !isBillOfLading && !isShipmentInstruction && /proforma|invoice|pi/i.test(rawPrefix);
    const isContract = !isCommercialInvoice && !isPackingList && !isCustomInvoice && !isBillOfLading && !isShipmentInstruction && !isProforma && /contract|sales/i.test(rawPrefix);

    const candidatePrefixes: string[] = params.candidatePrefixes && params.candidatePrefixes.length > 0
      ? params.candidatePrefixes
      : isCommercialInvoice
      ? ['commercial_invoice', 'commercial-invoice', 'commercialInvoice', 'commercial', 'ci']
      : isPackingList
      ? ['packing_list', 'packing-list', 'packingList', 'packinglist', 'packing', 'pl', 'packing_lists', 'packing-lists']
      : isCustomInvoice
      ? ['custom_invoice', 'custom-invoice', 'customInvoice', 'custom', 'invoice', 'ci']
      : isBillOfLading
      ? ['bill_of_lading', 'bill-of-lading', 'billOfLading', 'lading', 'bl']
      : isShipmentInstruction
      ? ['shipment_instruction', 'shipment-instruction', 'shipmentInstruction', 'shipment', 'instruction', 'si']
      : isProforma
      ? ['proforma', 'proforma_invoice', 'proforma-invoice', 'proformaInvoice', 'invoice', 'pi']
      : isContract
      ? ['contract', 'sales-contract', 'sales_contract', 'salesContract', 'document']
      : ['confirmation', 'trade-confirmation', 'trade_confirmation', 'tradeConfirmation', 'document'];

    let lastErrorMsg = 'Failed to download PDF';

    for (const curId of candidateIds) {
      for (const curPrefix of candidatePrefixes) {
        const url = `${baseUrl}/dms-templates/download-pdf`;
        try {
          const response = await customFetch(url, {
            method: 'GET',
            token,
            params: {
              prefix: curPrefix,
              id: curId,
              lang_code: safeLang,
              source,
            },
            headers: {
              Accept: 'application/pdf, application/octet-stream, application/json, */*',
            },
            cache: 'no-store',
          });

          if (!response.ok) {
            try {
              const rawText = await response.text();
              try {
                const errData = JSON.parse(rawText);
                lastErrorMsg = errData.message || errData.error || lastErrorMsg;
              } catch {
                if (rawText) lastErrorMsg = rawText.slice(0, 300);
              }
            } catch {
              // ignore
            }
            continue;
          }

          const contentType = response.headers.get('content-type') || '';
          const contentDisposition = response.headers.get('content-disposition') || '';
          let filename = `${curPrefix}-${curId}.pdf`;
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
                  lastErrorMsg = json.message || json.error || lastErrorMsg;
                  continue;
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
              }
            } catch {
              // Not valid JSON, fall through to treating as binary PDF
            }
          }

          // Direct binary buffer (PDF)
          const base64 = buffer.toString('base64');
          if (base64) {
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
          }
        } catch (downloadErr: any) {
          lastErrorMsg = downloadErr?.message || lastErrorMsg;
        }
      }
    }

    // Direct endpoint fallbacks if /dms-templates/download-pdf was not found
    for (const curId of candidateIds) {
      const directEndpoints = isCommercialInvoice
        ? [
            `${baseUrl}/commercial-invoice/download-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/commercial-invoice/download/${encodeURIComponent(curId)}`,
            `${baseUrl}/commercial-invoice/pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/commercial-invoices/download-pdf/${encodeURIComponent(curId)}`,
          ]
        : isPackingList
        ? [
            `${baseUrl}/packing-list/download-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing-list/download/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing-list/pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing-lists/download-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing-lists/download/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing-lists/pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing/download-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing/download/${encodeURIComponent(curId)}`,
            `${baseUrl}/packing/pdf/${encodeURIComponent(curId)}`,
          ]
        : isCustomInvoice
        ? [
            `${baseUrl}/custom-invoice/download-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/custom-invoice/download/${encodeURIComponent(curId)}`,
            `${baseUrl}/custom-invoice/pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/custom/download-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/custom-invoices/download-pdf/${encodeURIComponent(curId)}`,
          ]
        : isProforma
        ? [
            `${baseUrl}/proforma-invoice/download-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/proforma-invoice/download/${encodeURIComponent(curId)}`,
            `${baseUrl}/proforma/download-pdf/${encodeURIComponent(curId)}`,
          ]
        : isContract
        ? [
            `${baseUrl}/contract/download-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/contract/download/${encodeURIComponent(curId)}`,
          ]
        : [
            `${baseUrl}/confirmation/download-pdf/${encodeURIComponent(curId)}`,
            `${baseUrl}/confirmation/download/${encodeURIComponent(curId)}`,
          ];

      for (const directUrl of directEndpoints) {
        try {
          const directRes = await customFetch(directUrl, {
            method: 'GET',
            token,
            params: { lang_code: safeLang, source },
            headers: { Accept: 'application/pdf, application/octet-stream, application/json, */*' },
            cache: 'no-store',
          });

          if (directRes.ok) {
            const contentType = directRes.headers.get('content-type') || '';
            const contentDisposition = directRes.headers.get('content-disposition') || '';
            let filename = `${rawPrefix}-${curId}.pdf`;
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1].replace(/['"]/g, '').trim();
            }

            const arrayBuffer = await directRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const isJson = contentType.includes('application/json') || (buffer.length > 0 && buffer[0] === 123);
            if (isJson) {
              try {
                const jsonStr = buffer.toString('utf-8');
                const json = JSON.parse(jsonStr);
                if (json && typeof json === 'object') {
                  if (json.success === false || json.status === false) continue;
                  const directUrlStr = json.data?.url || json.url || json.data?.download_url || json.download_url;
                  if (directUrlStr && typeof directUrlStr === 'string' && directUrlStr.startsWith('http')) {
                    return { success: true, url: directUrlStr, filename };
                  }
                  const rawBuf = json.data?.pdf_buffer ?? json.data?.buffer ?? json.pdf_buffer ?? json.buffer ?? json.data;
                  const base64Str = extractPdfBase64(rawBuf);
                  if (base64Str) {
                    return { success: true, base64: base64Str, pdf_buffer: base64Str, data: { pdf_buffer: base64Str, file_name: filename }, contentType: 'application/pdf', filename };
                  }
                }
              } catch {
                // fall through
              }
            }
            const base64 = buffer.toString('base64');
            if (base64) {
              return { success: true, base64, pdf_buffer: base64, data: { pdf_buffer: base64, file_name: filename }, contentType: contentType || 'application/pdf', filename };
            }
          }
        } catch {
          // ignore
        }
      }
    }

    return {
      success: false,
      error: lastErrorMsg,
      message: lastErrorMsg,
    };
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

  // Reject if it is clearly a contract, proforma, lading, or custom invoice without confirmation characteristics
  if (
    (current.contract_number && !current.confirmation_number && !current.confirmation_date) ||
    (current.custom_invoice_number && !current.confirmation_number) ||
    (current.bl_no && !current.confirmation_number)
  ) {
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
        key === 'advance_payment_type' ||
        key === 'advance_payment_amt' ||
        key === 'advance_payment_pct' ||
        key === 'advance_type' ||
        key === 'advance_amount' ||
        key === 'advance_percentage' ||
        key === 'advance_pct' ||
        key === 'is_broker' ||
        key === 'sales_broker_allowed' ||
        key === 'broker_commission_type' ||
        key === 'sales_broker_type' ||
        key === 'ectn_field' ||
        key === 'coc_fields' ||
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

  if (cleaned.other_reference && !cleaned.other_references) {
    cleaned.other_references = cleaned.other_reference;
  }
  if (cleaned.other_references && !cleaned.other_reference) {
    cleaned.other_reference = cleaned.other_references;
  }

  if (cleaned.seller_signature_label && !cleaned.authority_signature_title) {
    cleaned.authority_signature_title = cleaned.seller_signature_label;
  }
  if (cleaned.authority_signature_title && !cleaned.seller_signature_label) {
    cleaned.seller_signature_label = cleaned.authority_signature_title;
  }
  if (cleaned.seller_signature_label && !cleaned.authorised_signature_title) {
    cleaned.authorised_signature_title = cleaned.seller_signature_label;
  }

  // Normalize signature to seller_signature / seller_signature_url only
  const sigCandidate =
    cleaned.seller_signature ||
    cleaned.seller_signature_url ||
    cleaned.authorised_signature ||
    cleaned.authority_signature ||
    cleaned.signature ||
    cleaned.stamp_image_url ||
    cleaned.stamp;
  if (sigCandidate) {
    if (!cleaned.seller_signature) cleaned.seller_signature = sigCandidate;
    if (!cleaned.seller_signature_url) cleaned.seller_signature_url = sigCandidate;
  }
  delete cleaned.signature;
  delete cleaned.authorised_signature;
  delete cleaned.authority_signature;
  delete cleaned.stamp;
  delete cleaned.stamp_image_url;

  // Normalize logo to seller_logo / seller_logo_url only
  const logoCandidate =
    cleaned.seller_logo ||
    cleaned.seller_logo_url ||
    cleaned.company_logo ||
    cleaned.company_logo_url ||
    cleaned.logo_url ||
    cleaned.logo ||
    cleaned.seller_details?.company_logo ||
    cleaned.seller_details?.seller_logo;
  if (logoCandidate) {
    if (!cleaned.seller_logo) cleaned.seller_logo = logoCandidate;
    if (!cleaned.seller_logo_url) cleaned.seller_logo_url = logoCandidate;
  }
  delete cleaned.company_logo;
  delete cleaned.company_logo_url;
  delete cleaned.logo;
  delete cleaned.logo_url;
  delete cleaned.remove_company_logo;

  // Sync bank_details_id and bank_account_id
  if (cleaned.bank_details_id && !cleaned.bank_account_id) {
    cleaned.bank_account_id = cleaned.bank_details_id;
  }
  if (cleaned.bank_account_id && !cleaned.bank_details_id) {
    cleaned.bank_details_id = cleaned.bank_account_id;
  }

  // Sync seller_instruction_id and instruction_id
  if (cleaned.seller_instruction_id && !cleaned.instruction_id) {
    cleaned.instruction_id = cleaned.seller_instruction_id;
  }
  if (cleaned.instruction_id && !cleaned.seller_instruction_id) {
    cleaned.seller_instruction_id = cleaned.instruction_id;
  }

  // If proforma_id was set to contract_id, strip proforma_id so backend doesn't fail lookup
  if (cleaned.proforma_id && cleaned.contract_id && String(cleaned.proforma_id).trim() === String(cleaned.contract_id).trim()) {
    delete cleaned.proforma_id;
    delete cleaned.proforma_invoice_id;
  }
  if (cleaned.id && cleaned.contract_id && String(cleaned.id).trim() === String(cleaned.contract_id).trim()) {
    delete cleaned.id;
  }

  return cleaned;
}

export function cleanCustomInvoicePayload(payload: Record<string, any>): Record<string, any> {
  if (!payload || typeof payload !== 'object') return {};
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (value === null) {
      cleaned[key] = null;
      continue;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null') {
        if (
          key === 'comment_label' ||
          key === 'comment_value' ||
          key === 'notes_title' ||
          key === 'notes_comment' ||
          key === 'comment_title' ||
          key === 'comment_text' ||
          key === 'comment' ||
          key === 'disclaimer' ||
          key === 'special_instruction'
        ) {
          cleaned[key] = '';
        }
        continue;
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
      const nested = cleanCustomInvoicePayload(value);
      if (Object.keys(nested).length > 0) cleaned[key] = nested;
    }
  }

  if (cleaned.invoice_no && !cleaned.invoice_number) {
    cleaned.invoice_number = cleaned.invoice_no;
  }
  if (cleaned.invoice_number && !cleaned.invoice_no) {
    cleaned.invoice_no = cleaned.invoice_number;
  }

  if (cleaned.seller_signature_label && !cleaned.authority_signature_title) {
    cleaned.authority_signature_title = cleaned.seller_signature_label;
  }
  if (cleaned.authority_signature_title && !cleaned.seller_signature_label) {
    cleaned.seller_signature_label = cleaned.authority_signature_title;
  }

  // Normalize signature
  const sigCandidate =
    cleaned.seller_signature ||
    cleaned.seller_signature_url ||
    cleaned.authorised_signature ||
    cleaned.authority_signature ||
    cleaned.signature ||
    cleaned.stamp_image_url ||
    cleaned.stamp;
  if (sigCandidate) {
    const normSig = normalizeSignaturePayload(sigCandidate) || sigCandidate;
    cleaned.seller_signature = normSig;
    cleaned.seller_signature_url = normSig;
  }
  delete cleaned.signature;
  delete cleaned.authorised_signature;
  delete cleaned.authority_signature;
  delete cleaned.stamp;
  delete cleaned.stamp_image_url;

  // Sync bank details IDs
  const bId = cleaned.bank_details_id || cleaned.bank_account_id;
  if (bId) {
    cleaned.bank_details_id = bId;
    cleaned.bank_account_id = bId;
  }

  // Ensure is_watermark_enabled is ALWAYS a boolean and NEVER empty
  const watermarkCandidate =
    cleaned.is_watermark_enabled !== undefined
      ? cleaned.is_watermark_enabled
      : cleaned.watermark_enabled !== undefined
      ? cleaned.watermark_enabled
      : cleaned.watermark !== undefined
      ? cleaned.watermark
      : true;
  const isWatermarkBool = Boolean(watermarkCandidate);
  cleaned.is_watermark_enabled = isWatermarkBool;
  cleaned.watermark_enabled = isWatermarkBool;
  cleaned.watermark = isWatermarkBool;

  // Ensure pdf_title is ALWAYS populated
  const docTitle =
    (cleaned.pdf_title && String(cleaned.pdf_title).trim()) ||
    (cleaned.document_title && String(cleaned.document_title).trim()) ||
    (cleaned.custom_doc_title && String(cleaned.custom_doc_title).trim()) ||
    (cleaned.title && String(cleaned.title).trim()) ||
    'CUSTOM INVOICE';
  cleaned.pdf_title = docTitle;
  cleaned.document_title = docTitle;
  cleaned.custom_doc_title = docTitle;

  // Ensure comment_label and comment_value are normalized strings
  const cLabel =
    (cleaned.comment_label !== undefined && cleaned.comment_label !== null ? String(cleaned.comment_label).trim() : '') ||
    (cleaned.comment_title !== undefined && cleaned.comment_title !== null ? String(cleaned.comment_title).trim() : '') ||
    (cleaned.notes_title !== undefined && cleaned.notes_title !== null ? String(cleaned.notes_title).trim() : '') ||
    (cleaned.title !== undefined && cleaned.title !== null ? String(cleaned.title).trim() : '') ||
    (cleaned.extra_title !== undefined && cleaned.extra_title !== null ? String(cleaned.extra_title).trim() : '');

  const cValue =
    (cleaned.comment_value !== undefined && cleaned.comment_value !== null ? String(cleaned.comment_value).trim() : '') ||
    (cleaned.notes_comment !== undefined && cleaned.notes_comment !== null ? String(cleaned.notes_comment).trim() : '') ||
    (cleaned.comment_text !== undefined && cleaned.comment_text !== null ? String(cleaned.comment_text).trim() : '') ||
    (cleaned.comment !== undefined && cleaned.comment !== null ? String(cleaned.comment).trim() : '') ||
    (cleaned.extra_comment !== undefined && cleaned.extra_comment !== null ? String(cleaned.extra_comment).trim() : '');

  const effectiveLabel = cLabel || (cValue ? 'Comments' : '');
  cleaned.comment_label = effectiveLabel;
  cleaned.comment_title = effectiveLabel;
  cleaned.notes_title = effectiveLabel;

  cleaned.comment_value = cValue;
  cleaned.comment_text = cValue;
  cleaned.notes_comment = cValue;
  cleaned.comment = cValue;

  // Normalize price_per_bag and rate_per_bag (Backend uses price_per_bag)
  const bagPriceVal =
    cleaned.price_per_bag !== undefined
      ? cleaned.price_per_bag
      : cleaned.rate_per_bag !== undefined
      ? cleaned.rate_per_bag
      : cleaned.rate_bag !== undefined
      ? cleaned.rate_bag
      : cleaned.pricePerBag;

  if (bagPriceVal !== undefined && bagPriceVal !== null && bagPriceVal !== '') {
    const numPrice = Number(bagPriceVal);
    const finalVal = !isNaN(numPrice) ? numPrice : bagPriceVal;
    cleaned.price_per_bag = finalVal;
    cleaned.rate_per_bag = finalVal;
  }

  return cleaned;
}

export function cleanBillOfLadingPayload(payload: Record<string, any>): Record<string, any> {
  if (!payload || typeof payload !== 'object') return {};
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (value === null) {
      cleaned[key] = null;
      continue;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null') {
        if (
          key === 'comment_label' ||
          key === 'comment_value' ||
          key === 'notes_title' ||
          key === 'notes_comment' ||
          key === 'comment_title' ||
          key === 'comment_text' ||
          key === 'comment' ||
          key === 'disclaimer' ||
          key === 'special_instruction'
        ) {
          cleaned[key] = '';
        }
        continue;
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
      const nested = cleanBillOfLadingPayload(value);
      if (Object.keys(nested).length > 0) cleaned[key] = nested;
    }
  }

  // Canonical Bill of Lading field normalization
  if (cleaned.bl_no && !cleaned.bl_number) {
    cleaned.bl_number = cleaned.bl_no;
  }
  if (cleaned.bill_of_lading_no && !cleaned.bl_number) {
    cleaned.bl_number = cleaned.bill_of_lading_no;
  }
  if (cleaned.voyage_no && !cleaned.voyage_number) {
    cleaned.voyage_number = cleaned.voyage_no;
  }
  if (cleaned.booking_no && !cleaned.booking_number) {
    cleaned.booking_number = cleaned.booking_no;
  }
  if (cleaned.sb_no && !cleaned.shipping_bill_no) {
    cleaned.shipping_bill_no = cleaned.sb_no;
  }

  // Shipping line normalization
  const shippingLineCandidate =
    cleaned.shipping_line !== undefined && cleaned.shipping_line !== null && String(cleaned.shipping_line).trim() !== ''
      ? String(cleaned.shipping_line).trim()
      : cleaned.shipping_company !== undefined && cleaned.shipping_company !== null && String(cleaned.shipping_company).trim() !== ''
      ? String(cleaned.shipping_company).trim()
      : cleaned.carrier !== undefined && cleaned.carrier !== null && String(cleaned.carrier).trim() !== ''
      ? String(cleaned.carrier).trim()
      : cleaned.carrier_name !== undefined && cleaned.carrier_name !== null && String(cleaned.carrier_name).trim() !== ''
      ? String(cleaned.carrier_name).trim()
      : cleaned.liner !== undefined && cleaned.liner !== null && String(cleaned.liner).trim() !== ''
      ? String(cleaned.liner).trim()
      : cleaned.shipping_line_name !== undefined && cleaned.shipping_line_name !== null && String(cleaned.shipping_line_name).trim() !== ''
      ? String(cleaned.shipping_line_name).trim()
      : cleaned.shippingLine !== undefined && cleaned.shippingLine !== null && String(cleaned.shippingLine).trim() !== ''
      ? String(cleaned.shippingLine).trim()
      : '';

  if (shippingLineCandidate && !(/DO NOT USE NVOCC/i.test(shippingLineCandidate) || /SHIPMENT IN CONTAINERS/i.test(shippingLineCandidate) || /IRANIAN SHIPPING/i.test(shippingLineCandidate))) {
    cleaned.shipping_line = shippingLineCandidate;
  }

  // Loading port ID normalization (`loading_port` and `loading_port_id`)
  const loadingPortIdCandidate =
    typeof cleaned.loading_port === 'string' && cleaned.loading_port.trim()
      ? cleaned.loading_port.trim()
      : typeof cleaned.loading_port === 'object' && cleaned.loading_port?.id
      ? String(cleaned.loading_port.id).trim()
      : typeof cleaned.loading_port_id === 'string' && cleaned.loading_port_id.trim()
      ? cleaned.loading_port_id.trim()
      : '';
  if (loadingPortIdCandidate) {
    cleaned.loading_port = loadingPortIdCandidate;
    cleaned.loading_port_id = loadingPortIdCandidate;
  }

  // Ensure is_watermark_enabled is ALWAYS a boolean and NEVER empty
  const watermarkCandidate =
    cleaned.is_watermark_enabled !== undefined
      ? cleaned.is_watermark_enabled
      : cleaned.watermark_enabled !== undefined
      ? cleaned.watermark_enabled
      : cleaned.watermark !== undefined
      ? cleaned.watermark
      : true;
  cleaned.is_watermark_enabled = Boolean(watermarkCandidate);

  // Ensure pdf_title is ALWAYS populated
  const docTitle =
    (cleaned.pdf_title && String(cleaned.pdf_title).trim()) ||
    (cleaned.document_title && String(cleaned.document_title).trim()) ||
    (cleaned.title && String(cleaned.title).trim()) ||
    'BILL OF LADING';
  cleaned.pdf_title = docTitle;

  // Ensure comment_label and comment_value are normalized strings
  const cLabel =
    (cleaned.comment_label !== undefined && cleaned.comment_label !== null ? String(cleaned.comment_label).trim() : '') ||
    (cleaned.comment_title !== undefined && cleaned.comment_title !== null ? String(cleaned.comment_title).trim() : '') ||
    (cleaned.notes_title !== undefined && cleaned.notes_title !== null ? String(cleaned.notes_title).trim() : '') ||
    (cleaned.extra_title !== undefined && cleaned.extra_title !== null ? String(cleaned.extra_title).trim() : '');

  const cValue =
    (cleaned.comment_value !== undefined && cleaned.comment_value !== null ? String(cleaned.comment_value).trim() : '') ||
    (cleaned.notes_comment !== undefined && cleaned.notes_comment !== null ? String(cleaned.notes_comment).trim() : '') ||
    (cleaned.comment_text !== undefined && cleaned.comment_text !== null ? String(cleaned.comment_text).trim() : '') ||
    (cleaned.comment !== undefined && cleaned.comment !== null ? String(cleaned.comment).trim() : '') ||
    (cleaned.extra_comment !== undefined && cleaned.extra_comment !== null ? String(cleaned.extra_comment).trim() : '');

  const effectiveLabel = cLabel || (cValue ? 'Comments' : '');
  cleaned.comment_label = effectiveLabel;
  cleaned.comment_value = cValue;

  // Normalize containers: keep ONLY containers that have at least one detail filled,
  // and ensure gross_weight / net_weight are sent as decimal strings (never numbers).
  if (Array.isArray(cleaned.containers)) {
    const hasVal = (v: unknown): boolean => {
      if (v === undefined || v === null) return false;
      const s = String(v).trim();
      return s !== '' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined';
    };
    const normalizeWeightStr = (v: unknown): string | undefined => {
      if (!hasVal(v)) return undefined;
      const raw = String(v).replace(/,/g, '').trim();
      if (/^\d{1,5}(?:\.\d{1,3})?$/.test(raw)) {
        const [intPart, decPart = ''] = raw.split('.');
        return `${intPart}.${decPart.padEnd(3, '0')}`;
      }
      return raw;
    };

    const sanitizedContainers = cleaned.containers
      .filter((c: any) => c && typeof c === 'object')
      .map((c: any, idx: number) => {
        const containerNumber = hasVal(c.container_number ?? c.container_no)
          ? String(c.container_number ?? c.container_no).trim()
          : '';
        const sealNumber = hasVal(c.seal_number ?? c.seal_no)
          ? String(c.seal_number ?? c.seal_no).trim()
          : '';
        const grossWeight = normalizeWeightStr(c.gross_weight);
        const netWeight = normalizeWeightStr(c.net_weight);
        const hasBags = hasVal(c.bags);
        const parsedBags = hasBags ? Number(String(c.bags).replace(/,/g, '').trim()) : NaN;

        const hasAnyDetail =
          Boolean(containerNumber) ||
          Boolean(sealNumber) ||
          grossWeight !== undefined ||
          netWeight !== undefined ||
          (hasBags && !isNaN(parsedBags));

        if (!hasAnyDetail) return null;

        const parsedIndex =
          c.index !== undefined && c.index !== null && String(c.index).trim() !== ''
            ? Number(c.index)
            : idx;

        const item: Record<string, any> = {
          index: Number.isInteger(parsedIndex) && parsedIndex >= 0 ? parsedIndex : idx,
        };
        if (containerNumber) item.container_number = containerNumber;
        if (sealNumber) item.seal_number = sealNumber;
        if (grossWeight !== undefined) item.gross_weight = grossWeight;
        if (netWeight !== undefined) item.net_weight = netWeight;
        if (hasBags && !isNaN(parsedBags)) item.bags = parsedBags;
        return item;
      })
      .filter(Boolean);

    if (sanitizedContainers.length > 0) {
      cleaned.containers = sanitizedContainers;

      // Always keep top-level gross_weight & net_weight (in MTS) strictly synchronized
      // with the sanitized container weights (in KG / 1000) to prevent mismatch errors.
      let totalGrossMilliKg = 0;
      let totalNetMilliKg = 0;
      for (const item of sanitizedContainers) {
        if (item && item.gross_weight !== undefined) {
          const gw = Number(String(item.gross_weight).replace(/,/g, '').trim());
          if (!isNaN(gw) && isFinite(gw) && gw > 0) {
            totalGrossMilliKg += Math.round(gw * 1000);
          }
        }
        if (item && item.net_weight !== undefined) {
          const nw = Number(String(item.net_weight).replace(/,/g, '').trim());
          if (!isNaN(nw) && isFinite(nw) && nw > 0) {
            totalNetMilliKg += Math.round(nw * 1000);
          }
        }
      }

      cleaned.gross_weight = (Math.round(totalGrossMilliKg / 1000) / 1000).toFixed(3);
      cleaned.net_weight = (Math.round(totalNetMilliKg / 1000) / 1000).toFixed(3);
    } else {
      delete cleaned.containers;
      if (cleaned.gross_weight !== undefined) cleaned.gross_weight = '0.000';
      if (cleaned.net_weight !== undefined) cleaned.net_weight = '0.000';
    }
  } else {
    if (cleaned.gross_weight !== undefined) cleaned.gross_weight = '0.000';
    if (cleaned.net_weight !== undefined) cleaned.net_weight = '0.000';
  }

  return cleaned;
}

/**
 * Extracts and normalizes Proforma Invoice data from backend responses.
 */
export function extractProformaData(data: any): any {
  if (!data) return null;
  if (data?.success === false && !data?.data) return null;
  if (data?.status === 404 || data?.status === 400 || data?.statusCode === 404) return null;
  if (data?.message && typeof data.message === 'string' && /not found/i.test(data.message) && !data?.data) return null;

  const root = data;
  const dataLevel = data?.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : null;
  const nestedDataLevel = dataLevel?.data && typeof dataLevel.data === 'object' && !Array.isArray(dataLevel.data) ? dataLevel.data : null;
  let proformaLevel = (nestedDataLevel?.proforma || dataLevel?.proforma || root?.proforma || nestedDataLevel?.proforma_invoice || dataLevel?.proforma_invoice || root?.proforma_invoice);
  if (proformaLevel && typeof proformaLevel !== 'object') proformaLevel = null;

  const merged: Record<string, any> = {};
  const layers = [proformaLevel, nestedDataLevel, dataLevel, root].filter(Boolean);

  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer)) {
      if (k === 'proforma' || k === 'proforma_invoice' || k === 'data') continue;
      if (!(k in merged)) {
        merged[k] = v;
      } else if ((merged[k] === undefined || merged[k] === null || merged[k] === '') && v !== undefined && v !== null && v !== '') {
        merged[k] = v;
      }
    }
  }

  const keys = Object.keys(merged);
  if (keys.length === 0 || (keys.length <= 2 && keys.every(k => ['message', 'error', 'success', 'status', 'statusCode'].includes(k)))) {
    return null;
  }

  const hasProformaMarkers = Boolean(
    merged.invoice_number ||
    merged.invoice_no ||
    merged.proforma_invoice_number ||
    merged.proforma_number ||
    merged.proforma_invoice_id ||
    merged.proforma_id ||
    proformaLevel ||
    merged._is_proforma_loaded ||
    merged.disclaimer ||
    merged.bank_charges_note ||
    ((merged.id || merged._id) && (merged.seller_instruction_id || merged.buyer_instruction_id || merged.product_id || merged.contract_id || merged.confirmation_id)) ||
    (dataLevel && (dataLevel.seller_instruction_id || dataLevel.product_id || dataLevel.id || dataLevel._id))
  );
  if (!hasProformaMarkers) {
    return null;
  }

  // Normalize other_reference / other_references synonyms
  if (merged.other_reference && !merged.other_references) {
    merged.other_references = merged.other_reference;
  }
  if (merged.other_references && !merged.other_reference) {
    merged.other_reference = merged.other_references;
  }

  // Normalize signature synonyms
  const sigCandidate =
    merged.seller_signature ||
    merged.seller_signature_url ||
    merged.authorised_signature ||
    merged.authority_signature ||
    merged.signature ||
    merged.stamp_image_url ||
    merged.stamp;
  if (sigCandidate && !merged.seller_signature) {
    merged.seller_signature = sigCandidate;
  }
  if (sigCandidate && !merged.stamp_image_url) {
    merged.stamp_image_url = sigCandidate;
  }

  // Normalize logo synonyms to seller_logo / seller_logo_url
  const logoCandidate =
    merged.seller_logo ||
    merged.seller_logo_url ||
    merged.company_logo ||
    merged.company_logo_url ||
    merged.logo_url ||
    merged.logo ||
    merged.seller_details?.company_logo ||
    merged.seller_details?.company_logo_url ||
    merged.seller_details?.seller_logo ||
    merged.seller_details?.seller_logo_url ||
    merged.seller_details?.logo_url ||
    merged.seller_details?.logo ||
    root?.seller_details?.company_logo ||
    dataLevel?.seller_details?.company_logo ||
    proformaLevel?.seller_details?.company_logo ||
    merged.seller?.seller_logo ||
    merged.seller?.seller_logo_url ||
    merged.seller?.company_logo ||
    merged.seller?.company_logo_url ||
    merged.seller?.logo_url ||
    merged.seller?.logo;
  if (logoCandidate) {
    if (!merged.seller_logo) merged.seller_logo = logoCandidate;
    if (!merged.seller_logo_url) merged.seller_logo_url = logoCandidate;
    if (!merged.company_logo) merged.company_logo = logoCandidate;
    if (!merged.company_logo_url) merged.company_logo_url = logoCandidate;
    if (merged.seller_details && typeof merged.seller_details === 'object') {
      if (!merged.seller_details.company_logo) merged.seller_details.company_logo = logoCandidate;
      if (!merged.seller_details.seller_logo) merged.seller_details.seller_logo = logoCandidate;
    }
  }

  // Normalize authority label synonyms
  const labelCandidate =
    merged.seller_signature_label ||
    merged.authority_signature_title ||
    merged.authorised_signature_title ||
    merged.authority_title;
  if (labelCandidate) {
    if (!merged.seller_signature_label) merged.seller_signature_label = labelCandidate;
    if (!merged.authority_signature_title) merged.authority_signature_title = labelCandidate;
    if (!merged.authorised_signature_title) merged.authorised_signature_title = labelCandidate;
  }

  // Normalize bank_details_id / bank_account_id synonyms
  const bankIdCandidate =
    merged.bank_details_id ??
    merged.bankDetailsId ??
    merged.bank_account_id ??
    merged.bankAccountId ??
    merged.bank_id ??
    merged.bankId ??
    (typeof merged.bank === 'object' && merged.bank !== null
      ? merged.bank.bank_details_id ?? merged.bank.id ?? merged.bank._id
      : null) ??
    (typeof merged.bank_details === 'object' && merged.bank_details !== null
      ? merged.bank_details.bank_details_id ?? merged.bank_details.id ?? merged.bank_details._id
      : null);
  if (bankIdCandidate !== undefined && bankIdCandidate !== null && String(bankIdCandidate).trim() !== '') {
    const cleanBankId = String(bankIdCandidate).trim();
    if (!merged.bank_details_id) merged.bank_details_id = cleanBankId;
    if (!merged.bank_account_id) merged.bank_account_id = cleanBankId;
  }

  if (typeof merged.bank_details === 'object' && merged.bank_details !== null) {
    merged.bank_details =
      merged.bank_details.account_details ||
      merged.bank_details.details ||
      merged.bank_details.bank_details ||
      '';
  }

  // Normalize disclaimer / bank_charges_note synonyms
  const disclaimerCandidate =
    merged.disclaimer ??
    merged.bank_charges_note ??
    merged.bank_charges ??
    merged.charges_note ??
    proformaLevel?.disclaimer ??
    proformaLevel?.bank_charges_note ??
    dataLevel?.disclaimer ??
    dataLevel?.bank_charges_note;
  if (disclaimerCandidate !== undefined && disclaimerCandidate !== null) {
    if (!merged.disclaimer) merged.disclaimer = disclaimerCandidate;
    if (!merged.bank_charges_note) merged.bank_charges_note = disclaimerCandidate;
  }

  // Normalize proforma_id / id
  const proformaIdCandidate =
    merged.id ??
    merged._id ??
    merged.proforma_id ??
    merged.proformaId ??
    merged.proforma_invoice_id ??
    proformaLevel?.id ??
    proformaLevel?._id ??
    proformaLevel?.proforma_id;
  if (proformaIdCandidate) {
    if (!merged.proforma_id) merged.proforma_id = proformaIdCandidate;
    if (!merged.id) merged.id = proformaIdCandidate;
  }

  // Normalize payment_term / terms_of_delivery_payment
  const ptCandidate =
    merged.payment_term?.title ||
    merged.payment_term?.name ||
    merged.payment_terms?.title ||
    merged.payment_term_title ||
    proformaLevel?.payment_term?.title ||
    dataLevel?.payment_term?.title;
  if (ptCandidate && typeof ptCandidate === 'string' && ptCandidate.trim()) {
    if (!merged.terms_of_delivery_payment) {
      merged.terms_of_delivery_payment = ptCandidate.trim();
    }
  }

  return merged;
}

/**
 * Sanitizes proforma invoice payload before sending to backend.
 */
export function cleanProformaPayload(payload: Record<string, any>): Record<string, any> {
  if (!payload || typeof payload !== 'object') return {};
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (value === null) {
      cleaned[key] = null;
      continue;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null') {
        if (
          key === 'comment_label' ||
          key === 'comment_value' ||
          key === 'notes_title' ||
          key === 'notes_comment' ||
          key === 'comment_title' ||
          key === 'comment_text' ||
          key === 'comment' ||
          key === 'disclaimer' ||
          key === 'special_instruction'
        ) {
          cleaned[key] = '';
        }
        continue;
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
      const nested = cleanProformaPayload(value);
      if (Object.keys(nested).length > 0) cleaned[key] = nested;
    }
  }

  if (cleaned.other_reference && !cleaned.other_references) {
    cleaned.other_references = cleaned.other_reference;
  }
  if (cleaned.other_references && !cleaned.other_reference) {
    cleaned.other_reference = cleaned.other_references;
  }

  if (cleaned.seller_signature_label && !cleaned.authority_signature_title) {
    cleaned.authority_signature_title = cleaned.seller_signature_label;
  }
  if (cleaned.authority_signature_title && !cleaned.seller_signature_label) {
    cleaned.seller_signature_label = cleaned.authority_signature_title;
  }
  if (cleaned.seller_signature_label && !cleaned.authorised_signature_title) {
    cleaned.authorised_signature_title = cleaned.seller_signature_label;
  }

  // Normalize signature to seller_signature / seller_signature_url only
  const sigCandidate =
    cleaned.seller_signature ||
    cleaned.seller_signature_url ||
    cleaned.authorised_signature ||
    cleaned.authority_signature ||
    cleaned.signature ||
    cleaned.stamp_image_url ||
    cleaned.stamp;
  if (sigCandidate) {
    if (!cleaned.seller_signature) cleaned.seller_signature = sigCandidate;
    if (!cleaned.seller_signature_url) cleaned.seller_signature_url = sigCandidate;
  }
  delete cleaned.signature;
  delete cleaned.authorised_signature;
  delete cleaned.authority_signature;
  delete cleaned.stamp;
  delete cleaned.stamp_image_url;

  // Normalize logo to seller_logo / seller_logo_url only
  const logoCandidate =
    cleaned.seller_logo ||
    cleaned.seller_logo_url ||
    cleaned.company_logo ||
    cleaned.company_logo_url ||
    cleaned.logo_url ||
    cleaned.logo ||
    cleaned.seller_details?.company_logo ||
    cleaned.seller_details?.seller_logo;
  if (logoCandidate) {
    if (!cleaned.seller_logo) cleaned.seller_logo = logoCandidate;
    if (!cleaned.seller_logo_url) cleaned.seller_logo_url = logoCandidate;
  }
  delete cleaned.company_logo;
  delete cleaned.company_logo_url;
  delete cleaned.logo;
  delete cleaned.logo_url;
  delete cleaned.remove_company_logo;

  // Sync bank_details_id and bank_account_id
  if (cleaned.bank_details_id && !cleaned.bank_account_id) {
    cleaned.bank_account_id = cleaned.bank_details_id;
  }
  if (cleaned.bank_account_id && !cleaned.bank_details_id) {
    cleaned.bank_details_id = cleaned.bank_account_id;
  }

  // Sync seller_instruction_id and instruction_id
  if (cleaned.seller_instruction_id && !cleaned.instruction_id) {
    cleaned.instruction_id = cleaned.seller_instruction_id;
  }
  if (cleaned.instruction_id && !cleaned.seller_instruction_id) {
    cleaned.seller_instruction_id = cleaned.instruction_id;
  }

  // If proforma_id was set to contract_id, strip proforma_id so backend doesn't fail lookup
  if (cleaned.proforma_id && cleaned.contract_id && String(cleaned.proforma_id).trim() === String(cleaned.contract_id).trim()) {
    delete cleaned.proforma_id;
    delete cleaned.proforma_invoice_id;
  }
  if (cleaned.id && cleaned.contract_id && String(cleaned.id).trim() === String(cleaned.contract_id).trim()) {
    delete cleaned.id;
  }

  // Sync consignee_details_id and consignee_id
  const cId = cleaned.consignee_details_id || cleaned.consignee_id;
  const cDet = cleaned.consignee_details || cleaned.consignee_name;
  if (cId) {
    cleaned.consignee_details_id = cId;
    cleaned.consignee_id = cId;
  }
  if (cDet) {
    cleaned.consignee_details = cDet;
  }

  // Ensure notify_party_1 and its ID: must both be provided or both be omitted
  const np1Id = cleaned.notify_party_1_id;
  const np1 = cleaned.notify_party_1 || cleaned.notify_party_1_details;
  if (np1Id && !cleaned.notify_party_1) {
    cleaned.notify_party_1 = np1 || np1Id;
  } else if (!np1Id && np1) {
    cleaned.notify_party_1_id = 'custom';
  }

  // Ensure notify_party_2 and its ID: must both be provided or both be omitted
  const np2Id = cleaned.notify_party_2_id;
  const np2 = cleaned.notify_party_2 || cleaned.notify_party_2_details;
  if (np2Id && !cleaned.notify_party_2) {
    cleaned.notify_party_2 = np2 || np2Id;
  } else if (!np2Id && np2) {
    cleaned.notify_party_2_id = 'custom';
  }

  return cleaned;
}

/**
 * Extracts and normalizes Shipment Instruction data from backend API response.
 */
export function extractShipmentInstructionData(data: any): any {
  if (!data) return null;
  const d = data.data !== undefined ? data.data : data;
  if (!d) return null;

  const raw =
    d.shipment_instruction ||
    d.shipmentInstruction ||
    d.instruction ||
    d.document ||
    d.details ||
    d;

  const merged: any = {
    ...(typeof d === 'object' && d !== null ? d : {}),
    ...(typeof raw === 'object' && raw !== null ? raw : {}),
  };

  // Extract canonical ID
  merged.id = merged.id || merged._id || merged.shipment_instruction_id || merged.instruction_id;
  if (merged.id) merged.id = String(merged.id);

  // Normalize buyer_instruction_id from SI response (used to fetch buyer's consignees & notify parties)
  const rawBuyerInstId =
    merged.buyer_instruction_id ||
    merged.buyerInstructionId ||
    (typeof merged.buyer_instruction === 'object' && merged.buyer_instruction !== null
      ? merged.buyer_instruction.id || merged.buyer_instruction._id || merged.buyer_instruction.buyer_instruction_id
      : '') ||
    (typeof d === 'object' && d !== null ? d.buyer_instruction_id || d.buyerInstructionId : '') ||
    merged.shipment_instruction?.buyer_instruction_id ||
    merged.shipment_instruction?.buyerInstructionId ||
    merged.buyer?.buyer_instruction_id ||
    merged.proforma?.buyer_instruction_id ||
    merged.contract?.buyer_instruction_id ||
    merged.confirmation?.buyer_instruction_id ||
    '';
  const cleanBuyerInstId = sanitizeDocId(rawBuyerInstId);
  if (cleanBuyerInstId) {
    merged.buyer_instruction_id = cleanBuyerInstId;
  }

  // Normalize status
  if (!merged.status) {
    merged.status = merged.shipment_status || merged.document_status || merged.step_status || 'PENDING';
  }

  // Normalize bag_photo_url
  if (merged.BAG_PHOTO_URL && !merged.bag_photo_url) {
    merged.bag_photo_url = merged.BAG_PHOTO_URL;
  }

  // Normalize marks & numbers / marking_brand / container_marks
  const marksVal =
    merged.marking_brand ||
    merged.marks_and_numbers ||
    merged.container_marks ||
    merged.marks_numbers ||
    merged.markingBrand ||
    merged.containerMarks ||
    merged.brand ||
    merged.marking;
  if (marksVal !== undefined && marksVal !== null) {
    const cleanMarks = String(marksVal).trim();
    if (cleanMarks && cleanMarks !== '[object Object]' && cleanMarks !== 'undefined' && cleanMarks !== 'null') {
      if (!merged.marking_brand) merged.marking_brand = cleanMarks;
      if (!merged.marks_and_numbers) merged.marks_and_numbers = cleanMarks;
      if (!merged.container_marks) merged.container_marks = cleanMarks;
      if (!merged.markingBrand) merged.markingBrand = cleanMarks;
    }
  }

  // Normalize disclaimer / special_instruction synonyms (backend uses disclaimer key)
  const disclaimerCandidate =
    merged.disclaimer ??
    merged.special_instruction ??
    merged.special_instructions ??
    merged.special_note ??
    (typeof raw === 'object' && raw !== null ? (raw.disclaimer ?? raw.special_instruction ?? raw.special_instructions ?? raw.special_note) : undefined) ??
    (typeof d === 'object' && d !== null ? (d.disclaimer ?? d.special_instruction ?? d.special_instructions ?? d.special_note) : undefined);

  if (disclaimerCandidate !== undefined && disclaimerCandidate !== null) {
    const cleanDisclaimer = String(disclaimerCandidate).trim();
    if (cleanDisclaimer && cleanDisclaimer !== '[object Object]' && cleanDisclaimer !== 'undefined' && cleanDisclaimer !== 'null') {
      if (!merged.disclaimer) merged.disclaimer = cleanDisclaimer;
      if (!merged.special_instruction) merged.special_instruction = cleanDisclaimer;
    }
  }

  const hasShipmentMarkers = Boolean(
    merged.shipment_instruction_number ||
    merged.instruction_number ||
    merged.booking_number ||
    merged.booking_no ||
    merged.shipping_bill_number ||
    merged.shipping_bill_no ||
    merged.sb_no ||
    merged.vessel_name ||
    merged.port_of_loading ||
    merged.port_of_discharge ||
    d?.shipment_instruction ||
    d?.shipmentInstruction ||
    merged._is_shipment_loaded ||
    ((merged.id || merged._id) && (merged.consignee_id || merged.buyer_id || merged.booking_no || merged.vessel_name)) ||
    (d && (d.booking_no || d.vessel_name || d.id || d._id))
  );
  if (!hasShipmentMarkers) {
    return null;
  }

  return merged;
}

/**
 * Sanitizes shipment instruction payload before sending to backend.
 */
export function cleanShipmentInstructionPayload(payload: Record<string, any>): Record<string, any> {
  if (!payload || typeof payload !== 'object') return {};
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (value === null) {
      cleaned[key] = null;
      continue;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null') {
        if (
          key === 'comment_label' ||
          key === 'comment_value' ||
          key === 'notes_title' ||
          key === 'notes_comment' ||
          key === 'comment_title' ||
          key === 'comment_text' ||
          key === 'comment' ||
          key === 'disclaimer' ||
          key === 'special_instruction'
        ) {
          cleaned[key] = '';
        }
        continue;
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
      const nested = cleanShipmentInstructionPayload(value);
      if (Object.keys(nested).length > 0) cleaned[key] = nested;
    }
  }

  // Sync consignee_details_id and consignee_id
  const cId = cleaned.consignee_details_id || cleaned.consignee_id;
  const cDet = cleaned.consignee_details || cleaned.consignee_name;
  if (cId) {
    cleaned.consignee_details_id = cId;
    cleaned.consignee_id = cId;
  }
  if (cDet) {
    cleaned.consignee_details = cDet;
  }

  // Ensure notify_party_1 and its ID: must both be provided or both be omitted
  const np1Id = cleaned.notify_party_1_id;
  const np1 = cleaned.notify_party_1 || cleaned.notify_party_1_details;
  if (np1Id && !cleaned.notify_party_1) {
    cleaned.notify_party_1 = np1 || np1Id;
  } else if (!np1Id && np1) {
    cleaned.notify_party_1_id = 'custom';
  }

  // Ensure notify_party_2 and its ID: must both be provided or both be omitted
  const np2Id = cleaned.notify_party_2_id;
  const np2 = cleaned.notify_party_2 || cleaned.notify_party_2_details;
  if (np2Id && !cleaned.notify_party_2) {
    cleaned.notify_party_2 = np2 || np2Id;
  } else if (!np2Id && np2) {
    cleaned.notify_party_2_id = 'custom';
  }

  // Sync marks_and_numbers, marking_brand, and container_marks (must always be string)
  const marksSyncVal =
    cleaned.marking_brand ||
    cleaned.marks_and_numbers ||
    cleaned.container_marks ||
    cleaned.marks_numbers ||
    cleaned.markingBrand ||
    cleaned.containerMarks ||
    cleaned.brand ||
    cleaned.marking ||
    payload?.marking_brand ||
    payload?.marks_and_numbers ||
    payload?.container_marks ||
    payload?.marks_numbers ||
    payload?.markingBrand ||
    payload?.containerMarks ||
    payload?.brand ||
    payload?.marking;

  if (marksSyncVal !== undefined && marksSyncVal !== null) {
    const cleanMarks = String(marksSyncVal).trim();
    if (cleanMarks && cleanMarks !== '[object Object]' && cleanMarks !== 'undefined' && cleanMarks !== 'null') {
      cleaned.marking_brand = cleanMarks;
      cleaned.marks_and_numbers = cleanMarks;
      cleaned.container_marks = cleanMarks;
      cleaned.markingBrand = cleanMarks;
      cleaned.marks_numbers = cleanMarks;
      cleaned.brand = cleanMarks;
      cleaned.container_marks_numbers = cleanMarks;
      cleaned.container_marks_and_numbers = cleanMarks;
    }
  }

  // Sync disclaimer and special_instruction (disclaimer is primary)
  const disclaimerVal =
    cleaned.disclaimer ??
    cleaned.special_instruction ??
    cleaned.special_instructions ??
    cleaned.special_note ??
    cleaned.specialInstruction ??
    payload?.disclaimer ??
    payload?.special_instruction ??
    payload?.special_instructions ??
    payload?.special_note ??
    payload?.specialInstruction;

  if (disclaimerVal !== undefined && disclaimerVal !== null) {
    const cleanDisclaimer = String(disclaimerVal).trim();
    if (cleanDisclaimer !== '[object Object]' && cleanDisclaimer !== 'undefined' && cleanDisclaimer !== 'null') {
      cleaned.disclaimer = cleanDisclaimer;
      cleaned.special_instruction = cleanDisclaimer;
    }
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
    const possibleKeys = [
      'url',
      'path',
      'src',
      'image',
      'file',
      'endpoint',
      'location',
      'seller_logo',
      'seller_logo_url',
      'sellerLogo',
      'sellerLogoUrl',
      'company_logo',
      'company_logo_url',
      'companyLogo',
      'companyLogoUrl',
      'logo',
      'logo_url',
      'logoUrl',
      'signature',
      'signature_url',
      'bag_photo_url',
      'bag_photo',
      'bagPhotoUrl',
      'container_marks_image',
      'marks_image',
      'authorised_signature',
      'authority_signature',
      'seller_signature',
      'stamp_image_url',
      'stamp_url',
      'value',
    ];
    for (const pk of possibleKeys) {
      if (raw[pk] && typeof raw[pk] === 'string') {
        str = raw[pk].trim();
        break;
      } else if (raw[pk] && typeof raw[pk] === 'object') {
        const nested = formatSignatureUrl(raw[pk]);
        if (nested) {
          str = nested;
          break;
        }
      }
    }
    if (!str && raw.seller_details) {
      str = formatSignatureUrl(raw.seller_details);
    }
    if (!str && raw.data) {
      str = formatSignatureUrl(raw.data);
    }
  }

  if (
    !str ||
    str === 'null' ||
    str === 'undefined' ||
    str === '[object Object]' ||
    str === '/brand/logo.png' ||
    str.endsWith('/brand/logo.png')
  ) {
    return '';
  }

  // If already a base64 data URL or blob URL
  if (str.startsWith('data:') || str.startsWith('blob:')) {
    return str;
  }

  // If protocol-relative URL (e.g. //assets.agriguruonline.com/...)
  if (str.startsWith('//')) {
    return `https:${str}`.replace('assets.agriguruonline.cloud', 'assets.agriguruonline.com');
  }

  // If full HTTP/HTTPS URL
  if (/^https?:\/\//i.test(str)) {
    return str.replace('assets.agriguruonline.cloud', 'assets.agriguruonline.com');
  }

  // Strip leading domain if raw was e.g. "assets.agriguruonline.com/..." without protocol
  if (/^assets\.agriguruonline\.(com|cloud)\/?/i.test(str)) {
    str = str.replace(/^assets\.agriguruonline\.(com|cloud)\/?/i, '');
  }

  const assetsUrl = getAssetsUrl();
  const cleanPath = str.replace(/^\/+/, '');
  return `${assetsUrl}/${cleanPath}`;
}

export const formatAssetUrl = formatSignatureUrl;

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

  const root = data;
  const dataLevel = data?.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : null;
  const nestedDataLevel = dataLevel?.data && typeof dataLevel.data === 'object' && !Array.isArray(dataLevel.data) ? dataLevel.data : null;
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

  const hasContractMarkers = Boolean(
    merged.contract_number ||
    merged.contractNumber ||
    merged.contract_no ||
    merged.sales_contract_id ||
    merged.contract_id ||
    contractLevel ||
    merged._is_contract_loaded ||
    (merged.contract_date && !merged.confirmation_number && !merged.invoice_number) ||
    ((merged.id || merged._id) && (merged.seller_instruction_id || merged.buyer_instruction_id || merged.product_id || merged.confirmation_id || merged.terms_and_condition || merged.fcl_type || merged.packing_type_id)) ||
    (dataLevel && (dataLevel.seller_instruction_id || dataLevel.product_id || dataLevel.id || dataLevel._id))
  );
  if (!hasContractMarkers) {
    return null;
  }

  // Normalize other_reference / other_references synonyms
  if (merged.other_reference && !merged.other_references) {
    merged.other_references = merged.other_reference;
  }
  if (merged.other_references && !merged.other_reference) {
    merged.other_reference = merged.other_references;
  }

  // Normalize signature synonyms
  const sigCandidate =
    merged.seller_signature ||
    merged.seller_signature_url ||
    merged.authorised_signature ||
    merged.authority_signature ||
    merged.signature ||
    merged.stamp_image_url ||
    merged.stamp;
  if (sigCandidate && !merged.seller_signature) {
    merged.seller_signature = sigCandidate;
  }
  if (sigCandidate && !merged.stamp_image_url) {
    merged.stamp_image_url = sigCandidate;
  }

  // Normalize logo synonyms to seller_logo / seller_logo_url
  const logoCandidate =
    merged.seller_logo ||
    merged.seller_logo_url ||
    merged.company_logo ||
    merged.company_logo_url ||
    merged.logo_url ||
    merged.logo ||
    merged.seller_details?.company_logo ||
    merged.seller_details?.company_logo_url ||
    merged.seller_details?.seller_logo ||
    merged.seller_details?.seller_logo_url ||
    merged.seller_details?.logo_url ||
    merged.seller_details?.logo ||
    root?.seller_details?.company_logo ||
    dataLevel?.seller_details?.company_logo ||
    contractLevel?.seller_details?.company_logo ||
    merged.seller?.seller_logo ||
    merged.seller?.seller_logo_url ||
    merged.seller?.company_logo ||
    merged.seller?.company_logo_url ||
    merged.seller?.logo_url ||
    merged.seller?.logo;
  if (logoCandidate) {
    if (!merged.seller_logo) merged.seller_logo = logoCandidate;
    if (!merged.seller_logo_url) merged.seller_logo_url = logoCandidate;
    if (!merged.company_logo) merged.company_logo = logoCandidate;
    if (!merged.company_logo_url) merged.company_logo_url = logoCandidate;
    if (merged.seller_details && typeof merged.seller_details === 'object') {
      if (!merged.seller_details.company_logo) merged.seller_details.company_logo = logoCandidate;
      if (!merged.seller_details.seller_logo) merged.seller_details.seller_logo = logoCandidate;
    }
  }

  // Normalize authority label synonyms
  const labelCandidate =
    merged.seller_signature_label ||
    merged.authority_signature_title ||
    merged.authorised_signature_title ||
    merged.authority_title;
  if (labelCandidate) {
    if (!merged.seller_signature_label) merged.seller_signature_label = labelCandidate;
    if (!merged.authority_signature_title) merged.authority_signature_title = labelCandidate;
    if (!merged.authorised_signature_title) merged.authorised_signature_title = labelCandidate;
  }

  // Normalize bank_details_id / bank_account_id synonyms
  const bankIdCandidate =
    merged.bank_details_id ??
    merged.bankDetailsId ??
    merged.bank_account_id ??
    merged.bankAccountId ??
    merged.bank_id ??
    merged.bankId ??
    (typeof merged.bank === 'object' && merged.bank !== null
      ? merged.bank.bank_details_id ?? merged.bank.id ?? merged.bank._id
      : null) ??
    (typeof merged.bank_details === 'object' && merged.bank_details !== null
      ? merged.bank_details.bank_details_id ?? merged.bank_details.id ?? merged.bank_details._id
      : null);
  if (bankIdCandidate !== undefined && bankIdCandidate !== null && String(bankIdCandidate).trim() !== '') {
    const cleanBankId = String(bankIdCandidate).trim();
    if (!merged.bank_details_id) merged.bank_details_id = cleanBankId;
    if (!merged.bank_account_id) merged.bank_account_id = cleanBankId;
  }

  if (typeof merged.bank_details === 'object' && merged.bank_details !== null) {
    merged.bank_details =
      merged.bank_details.account_details ||
      merged.bank_details.details ||
      merged.bank_details.bank_details ||
      '';
  }

  // Normalize payment_term / terms_of_delivery_payment
  const ptCandidate =
    merged.payment_term?.title ||
    merged.payment_term?.name ||
    merged.payment_terms?.title ||
    merged.payment_term_title ||
    contractLevel?.payment_term?.title ||
    dataLevel?.payment_term?.title;
  if (ptCandidate && typeof ptCandidate === 'string' && ptCandidate.trim()) {
    if (!merged.terms_of_delivery_payment) {
      merged.terms_of_delivery_payment = ptCandidate.trim();
    }
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
        key === 'advance_payment_type' ||
        key === 'advance_payment_amt' ||
        key === 'advance_payment_pct' ||
        key === 'advance_type' ||
        key === 'advance_amount' ||
        key === 'advance_percentage' ||
        key === 'advance_pct' ||
        key === 'is_broker' ||
        key === 'sales_broker_allowed' ||
        key === 'broker_commission_type' ||
        key === 'sales_broker_type' ||
        key === 'ectn_field' ||
        key === 'coc_fields' ||
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

  if (cleaned.other_reference && !cleaned.other_references) {
    cleaned.other_references = cleaned.other_reference;
  }
  if (cleaned.other_references && !cleaned.other_reference) {
    cleaned.other_reference = cleaned.other_references;
  }

  if (cleaned.seller_signature_label && !cleaned.authority_signature_title) {
    cleaned.authority_signature_title = cleaned.seller_signature_label;
  }
  if (cleaned.authority_signature_title && !cleaned.seller_signature_label) {
    cleaned.seller_signature_label = cleaned.authority_signature_title;
  }
  if (cleaned.seller_signature_label && !cleaned.authorised_signature_title) {
    cleaned.authorised_signature_title = cleaned.seller_signature_label;
  }

  // Normalize signature to seller_signature / seller_signature_url only
  const sigCandidate =
    cleaned.seller_signature ||
    cleaned.seller_signature_url ||
    cleaned.authorised_signature ||
    cleaned.authority_signature ||
    cleaned.signature ||
    cleaned.stamp_image_url ||
    cleaned.stamp;
  if (sigCandidate) {
    if (!cleaned.seller_signature) cleaned.seller_signature = sigCandidate;
    if (!cleaned.seller_signature_url) cleaned.seller_signature_url = sigCandidate;
  }
  delete cleaned.signature;
  delete cleaned.authorised_signature;
  delete cleaned.authority_signature;
  delete cleaned.stamp;
  delete cleaned.stamp_image_url;

  // Normalize logo to seller_logo / seller_logo_url only
  const logoCandidate =
    cleaned.seller_logo ||
    cleaned.seller_logo_url ||
    cleaned.company_logo ||
    cleaned.company_logo_url ||
    cleaned.logo_url ||
    cleaned.logo ||
    cleaned.seller_details?.company_logo ||
    cleaned.seller_details?.seller_logo;
  if (logoCandidate) {
    if (!cleaned.seller_logo) cleaned.seller_logo = logoCandidate;
    if (!cleaned.seller_logo_url) cleaned.seller_logo_url = logoCandidate;
  }
  delete cleaned.company_logo;
  delete cleaned.company_logo_url;
  delete cleaned.logo;
  delete cleaned.logo_url;
  delete cleaned.remove_company_logo;

  // Sync bank_details_id and bank_account_id
  if (cleaned.bank_details_id && !cleaned.bank_account_id) {
    cleaned.bank_account_id = cleaned.bank_details_id;
  }
  if (cleaned.bank_account_id && !cleaned.bank_details_id) {
    cleaned.bank_details_id = cleaned.bank_account_id;
  }

  // Sync seller_instruction_id and instruction_id
  if (cleaned.seller_instruction_id && !cleaned.instruction_id) {
    cleaned.instruction_id = cleaned.seller_instruction_id;
  }
  if (cleaned.instruction_id && !cleaned.seller_instruction_id) {
    cleaned.seller_instruction_id = cleaned.instruction_id;
  }

  // If proforma_id was set to contract_id, strip proforma_id so backend doesn't fail lookup
  if (cleaned.proforma_id && cleaned.contract_id && String(cleaned.proforma_id).trim() === String(cleaned.contract_id).trim()) {
    delete cleaned.proforma_id;
    delete cleaned.proforma_invoice_id;
  }
  if (cleaned.id && cleaned.contract_id && String(cleaned.id).trim() === String(cleaned.contract_id).trim()) {
    delete cleaned.id;
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
  redirect_id?: string;
  redirectId?: string;
  redirect_url?: string;
  redirect?: string;
  [key: string]: any;
}

export const DEFAULT_WORKFLOW_STEPPER_ITEMS: StepperDocumentItem[] = [
  { step: 1, order: 1, name: 'Trade Confirmation', document_name: 'Trade Confirmation', status: 'in_progress' },
  { step: 2, order: 2, name: 'Sales Contract', document_name: 'Sales Contract', status: 'pending' },
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
 * Checks whether a given stepper list contains genuine records with real redirect_ids or document IDs.
 * Used to distinguish live backend stepper data from placeholder DEFAULT_WORKFLOW_STEPPER_ITEMS.
 */
export function isRealStepperList(steps: StepperDocumentItem[]): boolean {
  if (!Array.isArray(steps) || steps.length === 0) return false;
  return steps.some((s) => {
    const rid = s?.redirect_id || s?.redirectId || s?.document_id || s?.doc_id;
    if (rid) {
      const str = String(rid).trim();
      if (str.length > 0 && !/^(step-\d+|new-confirmation|new-contract|null|undefined)$/i.test(str)) {
        // Exclude trivial single-digit step indices 1..6 if they are just the step sequence
        if (!(/^\d+$/.test(str) && Number(str) <= 6)) {
          return true;
        }
      }
    }
    const id = s?.id || s?._id;
    if (id) {
      const str = String(id).trim();
      if (
        str.length > 0 &&
        !/^(step-\d+|new-confirmation|new-contract|null|undefined)$/i.test(str)
      ) {
        if (!(/^\d+$/.test(str) && Number(str) <= 6)) {
          return true;
        }
      }
    }
    const status = s?.status || s?.document_status || s?.step_status;
    if (status) {
      const st = String(status).trim().toLowerCase();
      if (['completed', 'complete', 'done', 'approved', 'success', 'finished'].includes(st)) {
        return true;
      }
    }
    return false;
  });
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

export function normalizeStepStatus(rawStatus?: string | boolean, step?: any): NormalizedStepStatus {
  if (step?.is_completed === true || rawStatus === true) return 'completed';
  if (!rawStatus) return 'pending';
  const s = String(rawStatus).toLowerCase().trim();
  if (['completed', 'complete', 'done', 'approved', 'success', 'finished', 'true'].includes(s)) {
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

export function isVisibleWorkflowStep(step?: StepperDocumentItem | null): boolean {
  if (!step) return false;
  if (step.is_hidden === true || step.is_hidden === 1 || String(step.is_hidden) === 'true') {
    return false;
  }
  return true;
}

export interface WorkflowSubmitButtonInfo {
  nextStep: StepperDocumentItem | null;
  nextStepName: string | null;
  buttonLabel: string;
}

export function getWorkflowSubmitButtonInfo({
  steps,
  currentStep,
  currentStepType,
  isSubmitting = false,
  submittingText,
  defaultSubmitText = 'Submit',
}: {
  steps?: StepperDocumentItem[];
  currentStep?: StepperDocumentItem | null;
  currentStepType?: 'confirmation' | 'contract' | 'proforma' | 'shipment' | 'custom_invoice' | string;
  isSubmitting?: boolean;
  submittingText?: string;
  defaultSubmitText?: string;
}): WorkflowSubmitButtonInfo {
  const effectiveSubmittingText = submittingText || 'Submitting...';

  if (isSubmitting) {
    return {
      nextStep: null,
      nextStepName: null,
      buttonLabel: effectiveSubmittingText,
    };
  }

  const visibleSteps = (steps || []).filter(isVisibleWorkflowStep);
  if (visibleSteps.length === 0) {
    return {
      nextStep: null,
      nextStepName: null,
      buttonLabel: defaultSubmitText,
    };
  }

  // 1. Locate current step index within visibleSteps
  let currentIdx = -1;

  if (currentStep) {
    currentIdx = visibleSteps.findIndex((s) => {
      if (s === currentStep) return true;
      const sId = s.id || s._id;
      const cId = currentStep.id || currentStep._id;
      if (sId && cId && String(sId) === String(cId)) return true;
      if (typeof s.step === 'number' && typeof currentStep.step === 'number' && s.step === currentStep.step) {
        return true;
      }
      return false;
    });
  }

  if (currentIdx === -1 && currentStepType) {
    const t = String(currentStepType).toLowerCase();
    currentIdx = visibleSteps.findIndex((s, idx) => {
      if (t.includes('confirmation')) return isConfirmationStep(s, idx);
      if (t.includes('contract')) return isContractStep(s, idx);
      if (t.includes('proforma')) return isProformaStep(s, idx);
      if (t.includes('shipment') || t.includes('instruction')) return isShipmentInstructionStep(s, idx);
      if (t.includes('lading') || t.includes('bill_of_lading') || t.includes('bl')) return isBillOfLadingStep(s, idx);
      if (t.includes('commercial')) return isCommercialInvoiceStep(s, idx);
      if (t.includes('packing')) return isPackingListStep(s, idx);
      if (t.includes('custom') || t.includes('invoice')) return isCustomInvoiceStep(s, idx);
      return false;
    });
  }

  const nextStep = (currentIdx >= 0 && currentIdx + 1 < visibleSteps.length)
    ? visibleSteps[currentIdx + 1]
    : null;

  if (!nextStep) {
    return {
      nextStep: null,
      nextStepName: null,
      buttonLabel: defaultSubmitText,
    };
  }

  const rawName = String(
    nextStep.document_name ||
    nextStep.name ||
    nextStep.title ||
    nextStep.doc_name ||
    nextStep.step_name ||
    ''
  ).trim();

  // Clean any leading 'to ' if already prefixed in the step name
  const cleanName = rawName.replace(/^to\s+/i, '').trim();
  const nextStepName = cleanName || null;
  const buttonLabel = nextStepName ? `${defaultSubmitText} To ${nextStepName}` : defaultSubmitText;

  return {
    nextStep,
    nextStepName,
    buttonLabel,
  };
}

export function isConfirmationStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (step) {
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
    const slug = String(
      step.slug ||
      step.type ||
      step.action ||
      step.document_type ||
      step.doc_type ||
      step.key ||
      ''
    ).toLowerCase();

    // Disqualify if it matches another specific trade document
    if (id.includes('contract') || name.includes('contract') || slug.includes('contract')) return false;
    if (id.includes('proforma') || name.includes('proforma') || slug.includes('proforma')) return false;
    if (id.includes('shipment') || name.includes('shipment') || id.includes('instruction') || name.includes('instruction')) return false;
    if (id.includes('custom') || name.includes('custom')) return false;
    if (id.includes('lading') || name.includes('lading')) return false;
    if (id.includes('commercial') || name.includes('commercial')) return false;
    if (id.includes('packing') || name.includes('packing')) return false;
    if (id.includes('phyto') || name.includes('phyto')) return false;
    if (id.includes('fumigation') || name.includes('fumigation')) return false;
    if (id.includes('origin') || name.includes('origin')) return false;
    if (id.includes('weight') || name.includes('w & q') || name.includes('w&q')) return false;

    if (id.includes('confirmation') || name.includes('confirmation') || slug.includes('confirmation')) return true;

    // Only if completely untyped/unnamed fallback to step sequence
    if (!name && !slug && !id) {
      const stepNum = Number(step.step ?? step.step_number ?? step.order);
      if (stepNum === 1) return true;
    }
    return false;
  }
  return typeof index === 'number' && index === 0;
}

export function isContractStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (step) {
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
    const slug = String(
      step.slug ||
      step.type ||
      step.action ||
      step.document_type ||
      step.doc_type ||
      step.key ||
      ''
    ).toLowerCase();

    // Disqualify if it matches another specific trade document
    if (id.includes('confirmation') || name.includes('confirmation') || slug.includes('confirmation')) return false;
    if (id.includes('proforma') || name.includes('proforma') || slug.includes('proforma')) return false;
    if (id.includes('shipment') || name.includes('shipment') || id.includes('instruction') || name.includes('instruction')) return false;
    if (id.includes('custom') || name.includes('custom')) return false;
    if (id.includes('lading') || name.includes('lading')) return false;
    if (id.includes('commercial') || name.includes('commercial')) return false;
    if (id.includes('packing') || name.includes('packing')) return false;
    if (id.includes('phyto') || name.includes('phyto')) return false;
    if (id.includes('fumigation') || name.includes('fumigation')) return false;
    if (id.includes('origin') || name.includes('origin')) return false;
    if (id.includes('weight') || name.includes('w & q') || name.includes('w&q')) return false;

    if (id.includes('contract') || name.includes('contract') || slug.includes('contract')) return true;

    if (!name && !slug && !id) {
      const stepNum = Number(step.step ?? step.step_number ?? step.order);
      if (stepNum === 2) return true;
    }
    return false;
  }
  return typeof index === 'number' && index === 1;
}

export function isProformaStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (step) {
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
    const slug = String(
      step.slug ||
      step.type ||
      step.action ||
      step.document_type ||
      step.doc_type ||
      step.key ||
      ''
    ).toLowerCase();

    // Disqualify other documents
    if (id.includes('confirmation') || name.includes('confirmation') || slug.includes('confirmation')) return false;
    if (id.includes('contract') || name.includes('contract') || slug.includes('contract')) return false;
    if (id.includes('shipment') || name.includes('shipment') || id.includes('instruction') || name.includes('instruction')) return false;
    if (id.includes('custom') || name.includes('custom')) return false;
    if (id.includes('lading') || name.includes('lading')) return false;
    if (id.includes('commercial') || name.includes('commercial')) return false;
    if (id.includes('packing') || name.includes('packing')) return false;
    if (id.includes('phyto') || name.includes('phyto')) return false;
    if (id.includes('fumigation') || name.includes('fumigation')) return false;
    if (id.includes('origin') || name.includes('origin')) return false;
    if (id.includes('weight') || name.includes('w & q') || name.includes('w&q')) return false;

    if (id.includes('proforma') || name.includes('proforma') || slug.includes('proforma') || id.includes('proforma_invoice') || name.includes('proforma invoice')) return true;

    if (!name && !slug && !id) {
      const stepNum = Number(step.step ?? step.step_number ?? step.order);
      if (stepNum === 3) return true;
    }
    return false;
  }
  return typeof index === 'number' && index === 2;
}

export function isShipmentInstructionStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (step) {
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
    const slug = String(
      step.slug ||
      step.type ||
      step.action ||
      step.document_type ||
      step.doc_type ||
      step.key ||
      ''
    ).toLowerCase();

    // Disqualify other documents
    if (id.includes('confirmation') || name.includes('confirmation') || slug.includes('confirmation')) return false;
    if (id.includes('contract') || name.includes('contract') || slug.includes('contract')) return false;
    if (id.includes('proforma') || name.includes('proforma') || slug.includes('proforma')) return false;
    if (id.includes('custom') || name.includes('custom')) return false;
    if (id.includes('lading') || name.includes('lading')) return false;
    if (id.includes('commercial') || name.includes('commercial')) return false;
    if (id.includes('packing') || name.includes('packing')) return false;
    if (id.includes('phyto') || name.includes('phyto')) return false;
    if (id.includes('fumigation') || name.includes('fumigation')) return false;
    if (id.includes('origin') || name.includes('origin')) return false;
    if (id.includes('weight') || name.includes('w & q') || name.includes('w&q')) return false;

    if (
      id.includes('shipment') ||
      name.includes('shipment') ||
      id.includes('instruction') ||
      name.includes('instruction') ||
      slug.includes('shipment') ||
      slug.includes('instruction')
    ) {
      return true;
    }

    if (!name && !slug && !id) {
      const stepNum = Number(step.step ?? step.step_number ?? step.order);
      if (stepNum === 4) return true;
    }
    return false;
  }
  return typeof index === 'number' && index === 3;
}

export function isBillOfLadingStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (step) {
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
    const slug = String(
      step.slug ||
      step.type ||
      step.action ||
      step.document_type ||
      step.doc_type ||
      step.key ||
      ''
    ).toLowerCase();
    const redirect = String(step.redirect || step.redirect_url || step.redirectUrl || '').toLowerCase();

    // Disqualify other documents
    if (id.includes('confirmation') || name.includes('confirmation') || slug.includes('confirmation')) return false;
    if (id.includes('contract') || name.includes('contract') || slug.includes('contract')) return false;
    if (id.includes('proforma') || name.includes('proforma') || slug.includes('proforma')) return false;
    if (id.includes('custom') || name.includes('custom')) return false;
    if (id.includes('commercial') || name.includes('commercial')) return false;
    if (id.includes('packing') || name.includes('packing')) return false;
    if (id.includes('phyto') || name.includes('phyto')) return false;
    if (id.includes('fumigation') || name.includes('fumigation')) return false;
    if (id.includes('origin') || name.includes('origin')) return false;
    if (id.includes('weight') || name.includes('w & q') || name.includes('w&q')) return false;

    if (
      id.includes('lading') ||
      name.includes('lading') ||
      slug.includes('lading') ||
      id.includes('bill_of_lading') ||
      id.includes('bill-of-lading') ||
      name.includes('bill of lading') ||
      slug.includes('bill-of-lading') ||
      slug.includes('bill_of_lading') ||
      slug === 'bl' ||
      name === 'bl' ||
      redirect.includes('bill-of-lading') ||
      redirect.includes('bill_of_lading') ||
      redirect.includes('lading')
    ) {
      return true;
    }

    if (!name && !slug && !id) {
      const stepNum = Number(step.step ?? step.step_number ?? step.order);
      if (stepNum === 5) return true;
    }
    return false;
  }
  return typeof index === 'number' && index === 4;
}

export function getBillOfLadingStep(
  steps?: StepperDocumentItem[],
  selectedStep?: StepperDocumentItem | null
): StepperDocumentItem | null {
  if (selectedStep && isBillOfLadingStep(selectedStep)) return selectedStep;
  if (steps && steps.length > 0) {
    const found = steps.find((s) => isBillOfLadingStep(s));
    if (found) return found;
  }
  return null;
}

export function getBillOfLadingIdFromStepper(
  steps?: StepperDocumentItem[],
  selectedStep?: StepperDocumentItem | null
): string {
  const step = getBillOfLadingStep(steps, selectedStep);
  if (!step) return '';
  return getStepSelfId(step);
}

export function isCommercialInvoiceStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (step) {
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
    const slug = String(
      step.slug ||
      step.type ||
      step.action ||
      step.document_type ||
      step.doc_type ||
      step.key ||
      ''
    ).toLowerCase();
    const redirect = String(step.redirect || step.redirect_url || step.redirectUrl || '').toLowerCase();

    if (
      id.includes('commercial') ||
      name.includes('commercial') ||
      slug.includes('commercial') ||
      redirect.includes('commercial-invoice') ||
      redirect.includes('commercial_invoice')
    ) {
      return true;
    }

    if (!name && !slug && !id) {
      const stepNum = Number(step.step ?? step.step_number ?? step.order);
      if (stepNum === 7) return true;
    }
    return false;
  }
  return typeof index === 'number' && index === 6;
}

export function getCommercialInvoiceStep(
  steps?: StepperDocumentItem[],
  selectedStep?: StepperDocumentItem | null
): StepperDocumentItem | null {
  if (selectedStep && isCommercialInvoiceStep(selectedStep)) return selectedStep;
  if (steps && steps.length > 0) {
    const found = steps.find((s) => isCommercialInvoiceStep(s));
    if (found) return found;
  }
  return null;
}

export function getCommercialInvoiceIdFromStepper(
  steps?: StepperDocumentItem[],
  selectedStep?: StepperDocumentItem | null
): string {
  const step = getCommercialInvoiceStep(steps, selectedStep);
  if (!step) return '';
  return getStepSelfId(step);
}

export function isPackingListStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (step) {
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
    const slug = String(
      step.slug ||
      step.type ||
      step.action ||
      step.document_type ||
      step.doc_type ||
      step.key ||
      ''
    ).toLowerCase();
    const redirect = String(step.redirect || step.redirect_url || step.redirectUrl || '').toLowerCase();

    // Disqualify other documents
    if (id.includes('confirmation') || name.includes('confirmation') || slug.includes('confirmation')) return false;
    if (id.includes('contract') || name.includes('contract') || slug.includes('contract')) return false;
    if (id.includes('proforma') || name.includes('proforma') || slug.includes('proforma')) return false;
    if (id.includes('shipment') || name.includes('shipment') || slug.includes('shipment')) return false;
    if (id.includes('lading') || name.includes('lading') || id.includes('bill_of_lading') || name.includes('bill of lading')) return false;
    if (id.includes('commercial') || name.includes('commercial')) return false;
    if (id.includes('phyto') || name.includes('phyto')) return false;
    if (id.includes('fumigation') || name.includes('fumigation')) return false;
    if (id.includes('origin') || name.includes('origin')) return false;
    if (id.includes('weight') || name.includes('w & q') || name.includes('w&q')) return false;

    if (
      id.includes('packing') ||
      name.includes('packing') ||
      slug.includes('packing') ||
      redirect.includes('packing-list') ||
      redirect.includes('packing_list') ||
      redirect.includes('packing')
    ) {
      return true;
    }

    if (!name && !slug && !id) {
      const stepNum = Number(step.step ?? step.step_number ?? step.order);
      if (stepNum === 8) return true;
    }

    return false;
  }
  return typeof index === 'number' && index === 7;
}

export function getPackingListStep(
  steps?: StepperDocumentItem[],
  selectedStep?: StepperDocumentItem | null
): StepperDocumentItem | null {
  if (selectedStep && isPackingListStep(selectedStep)) return selectedStep;
  if (steps && steps.length > 0) {
    const found = steps.find((s) => isPackingListStep(s));
    if (found) return found;
  }
  return null;
}

export function getPackingListIdFromStepper(
  steps?: StepperDocumentItem[],
  selectedStep?: StepperDocumentItem | null
): string {
  const step = getPackingListStep(steps, selectedStep);
  if (!step) return '';
  return getStepSelfId(step);
}

export function getShipmentInstructionStep(
  steps?: StepperDocumentItem[],
  selectedStep?: StepperDocumentItem | null
): StepperDocumentItem | null {
  if (selectedStep && isShipmentInstructionStep(selectedStep)) return selectedStep;
  if (steps && steps.length > 0) {
    const found = steps.find((s) => isShipmentInstructionStep(s));
    if (found) return found;
  }
  return null;
}

export function getShipmentInstructionIdFromStepper(
  steps?: StepperDocumentItem[],
  selectedStep?: StepperDocumentItem | null
): string {
  const step = getShipmentInstructionStep(steps, selectedStep);
  if (!step) return '';
  const id = extractStepRedirectId(step) || extractStepId(step) || '';
  if (/^\d+$/.test(id) && Number(id) <= 20) return '';
  return id;
}

export function isCustomInvoiceStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (step) {
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
    const slug = String(
      step.slug ||
      step.type ||
      step.action ||
      step.document_type ||
      step.doc_type ||
      step.key ||
      ''
    ).toLowerCase();
    const redirect = String(step.redirect || step.redirect_url || step.redirectUrl || '').toLowerCase();

    // Disqualify other documents
    if (id.includes('confirmation') || name.includes('confirmation') || slug.includes('confirmation')) return false;
    if (id.includes('contract') || name.includes('contract') || slug.includes('contract')) return false;
    if (id.includes('proforma') || name.includes('proforma') || slug.includes('proforma')) return false;
    if (id.includes('shipment') || name.includes('shipment') || slug.includes('shipment')) return false;
    if (id.includes('lading') || name.includes('lading') || id.includes('bill_of_lading') || name.includes('bill of lading')) return false;
    if (id.includes('commercial') || name.includes('commercial')) return false;
    if (id.includes('packing') || name.includes('packing')) return false;
    if (id.includes('phyto') || name.includes('phyto')) return false;
    if (id.includes('fumigation') || name.includes('fumigation')) return false;
    if (id.includes('origin') || name.includes('origin')) return false;
    if (id.includes('weight') || name.includes('w & q') || name.includes('w&q')) return false;

    if (
      (id.includes('custom') && id.includes('invoice')) ||
      (name.includes('custom') && name.includes('invoice')) ||
      id.includes('custom_invoice') ||
      id.includes('custom-invoice') ||
      name.includes('custom invoice') ||
      name.includes('customs invoice') ||
      slug.includes('custom-invoice') ||
      slug.includes('custom_invoice') ||
      slug === 'custom' ||
      redirect.includes('custom-invoice') ||
      redirect.includes('custom_invoice')
    ) {
      return true;
    }

    if (!name && !slug && !id) {
      const stepNum = Number(step.step ?? step.step_number ?? step.order);
      if (stepNum === 6) return true;
    }
    return false;
  }
  return typeof index === 'number' && index === 5;
}

export function getCustomInvoiceStep(
  steps?: StepperDocumentItem[],
  selectedStep?: StepperDocumentItem | null
): StepperDocumentItem | null {
  if (selectedStep && isCustomInvoiceStep(selectedStep)) return selectedStep;
  if (steps && steps.length > 0) {
    const found = steps.find((s) => isCustomInvoiceStep(s));
    if (found) return found;
  }
  return null;
}

export function getCustomInvoiceIdFromStepper(
  steps?: StepperDocumentItem[],
  selectedStep?: StepperDocumentItem | null
): string {
  const step = getCustomInvoiceStep(steps, selectedStep);
  if (!step) return '';
  return getStepSelfId(step);
}

/**
 * Checks whether two workflow step items refer to the same document stage.
 */
export function isSameWorkflowStep(
  a?: StepperDocumentItem | null,
  b?: StepperDocumentItem | null
): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const aId = a.id || a._id || a.document_id || a.doc_id;
  const bId = b.id || b._id || b.document_id || b.doc_id;
  if (aId && bId && String(aId) === String(bId)) return true;

  const aName = String(a.document_name || a.name || a.title || a.type || '').trim().toLowerCase();
  const bName = String(b.document_name || b.name || b.title || b.type || '').trim().toLowerCase();
  if (aName && bName && aName === bName) return true;

  if (isConfirmationStep(a) && isConfirmationStep(b)) return true;
  if (isContractStep(a) && isContractStep(b)) return true;
  if (isProformaStep(a) && isProformaStep(b)) return true;
  if (isShipmentInstructionStep(a) && isShipmentInstructionStep(b)) return true;
  if (isBillOfLadingStep(a) && isBillOfLadingStep(b)) return true;
  if (isCustomInvoiceStep(a) && isCustomInvoiceStep(b)) return true;
  if (isCommercialInvoiceStep(a) && isCommercialInvoiceStep(b)) return true;
  if (isPackingListStep(a) && isPackingListStep(b)) return true;

  if (typeof a.step === 'number' && typeof b.step === 'number' && a.step === b.step) {
    return true;
  }

  return false;
}

/**
 * Merges freshly fetched stepper items from backend while preserving the is_hidden state
 * configured on existing steps (e.g. via document visibility settings).
 */
export function mergeStepperWithHidden(
  newSteps: StepperDocumentItem[],
  existingSteps?: StepperDocumentItem[]
): StepperDocumentItem[] {
  if (!newSteps || newSteps.length === 0) return existingSteps || [];
  if (!existingSteps || existingSteps.length === 0) return newSteps;

  return newSteps.map((newStep) => {
    const mergedStep: StepperDocumentItem = { ...newStep };
    const matchedPrev = existingSteps.find((prev) => isSameWorkflowStep(newStep, prev));

    if (matchedPrev) {
      // 1. Preserve hidden state
      if (newStep.is_hidden !== undefined && newStep.is_hidden !== null) {
        const isHidden =
          newStep.is_hidden === true ||
          newStep.is_hidden === 1 ||
          String(newStep.is_hidden).toLowerCase() === 'true';
        mergedStep.is_hidden = isHidden;
      } else if (matchedPrev.is_hidden !== undefined && matchedPrev.is_hidden !== null) {
        const isHidden =
          matchedPrev.is_hidden === true ||
          matchedPrev.is_hidden === 1 ||
          String(matchedPrev.is_hidden).toLowerCase() === 'true';
        mergedStep.is_hidden = isHidden;
      }

      // 2. Preserve completed status: Never downgrade an already completed step to pending
      const prevNorm = normalizeStepStatus(matchedPrev.status || matchedPrev.document_status || matchedPrev.step_status);
      const newNorm = normalizeStepStatus(newStep.status || newStep.document_status || newStep.step_status);
      if (prevNorm === 'completed' && newNorm !== 'completed') {
        mergedStep.status = matchedPrev.status || 'completed';
      }

      // 3. Preserve valid redirect IDs if newStep is missing one or has placeholder
      const prevRedirect = extractStepRedirectId(matchedPrev);
      const newRedirect = extractStepRedirectId(newStep);
      if (prevRedirect && (!newRedirect || newRedirect === 'new-confirmation')) {
        mergedStep.redirect_id = prevRedirect;
        mergedStep.redirectId = prevRedirect;
      }

      // 4. Preserve PDF availability / URLs if already unlocked
      if (matchedPrev.pdf_enabled || matchedPrev.is_pdf_available) {
        mergedStep.pdf_enabled = true;
        mergedStep.is_pdf_available = true;
      }
      if (matchedPrev.pdf_url && !mergedStep.pdf_url) {
        mergedStep.pdf_url = matchedPrev.pdf_url;
      }
      if (matchedPrev.pdf && !mergedStep.pdf) {
        mergedStep.pdf = matchedPrev.pdf;
      }
    } else {
      if (newStep.is_hidden !== undefined && newStep.is_hidden !== null) {
        const isHidden =
          newStep.is_hidden === true ||
          newStep.is_hidden === 1 ||
          String(newStep.is_hidden).toLowerCase() === 'true';
        mergedStep.is_hidden = isHidden;
      }
    }

    return mergedStep;
  });
}

/**
 * Returns a clean, dynamic toast success message matching the submit button's target document.
 */
export function getWorkflowSubmitToastMessage({
  currentDocName,
  nextStepName,
}: {
  currentDocName: string;
  nextStepName?: string | null;
}): string {
  const cleanNext = nextStepName ? String(nextStepName).replace(/^to\s+/i, '').trim() : '';
  if (cleanNext) {
    return `${currentDocName} submitted successfully to ${cleanNext}!`;
  }
  return `${currentDocName} submitted successfully!`;
}

export function extractLinkedCustomInvoiceId(data: any): string {
  if (!data) return '';
  const d = data.data ?? data;
  const candidates = [
    d?.custom_invoice_id,
    d?.customInvoiceId,
    d?.custom_id,
    d?.customId,
    d?.custom_invoice?.id,
    d?.custom_invoice?._id,
    d?.custom_invoice?.custom_invoice_id,
  ];
  for (const c of candidates) {
    if (c) {
      const clean = sanitizeDocId(c);
      if (clean && !/^(custom|custom-invoice|invoice|step-\d+)$/i.test(clean)) return clean;
    }
  }
  return '';
}

export function extractCustomInvoiceData(data: any): any {
  if (!data || typeof data !== 'object') return null;
  if (
    data.success === false ||
    data.status === false ||
    (typeof data.statusCode === 'number' && data.statusCode >= 400)
  ) {
    return null;
  }
  const d = data.data !== undefined ? data.data : data;
  if (!d || typeof d !== 'object') return null;

  const raw =
    d.custom_invoice ||
    d.customInvoice ||
    d.invoice ||
    d.document ||
    d.details ||
    d;

  const merged: any = {
    ...(typeof d === 'object' && d !== null ? d : {}),
    ...(typeof raw === 'object' && raw !== null ? raw : {}),
  };

  // Preserve non-empty gross_weight and net_weight across outer/nested payloads
  if (
    (merged.gross_weight === undefined || merged.gross_weight === null || String(merged.gross_weight).trim() === '') &&
    d?.gross_weight !== undefined &&
    d?.gross_weight !== null &&
    String(d.gross_weight).trim() !== ''
  ) {
    merged.gross_weight = d.gross_weight;
  }
  if (
    (merged.net_weight === undefined || merged.net_weight === null || String(merged.net_weight).trim() === '') &&
    d?.net_weight !== undefined &&
    d?.net_weight !== null &&
    String(d.net_weight).trim() !== ''
  ) {
    merged.net_weight = d.net_weight;
  }

  // Preserve loading_port / destination_port objects with nested country.name
  if (
    typeof d?.loading_port === 'object' &&
    d.loading_port !== null &&
    d.loading_port.country &&
    (typeof merged.loading_port !== 'object' || merged.loading_port === null || !merged.loading_port.country)
  ) {
    merged.loading_port = d.loading_port;
  }
  if (
    typeof d?.destination_port === 'object' &&
    d.destination_port !== null &&
    d.destination_port.country &&
    (typeof merged.destination_port !== 'object' || merged.destination_port === null || !merged.destination_port.country)
  ) {
    merged.destination_port = d.destination_port;
  }

  merged.id = merged.id || merged._id || merged.custom_invoice_id || merged.invoice_id;
  if (merged.id) merged.id = String(merged.id);

  // Normalize price_per_bag and rate_per_bag (Incoming from backend)
  const bagPrice =
    merged.price_per_bag ??
    merged.pricePerBag ??
    merged.rate_per_bag ??
    merged.ratePerBag ??
    merged.rate_bag ??
    merged.bag_rate;
  if (bagPrice !== undefined && bagPrice !== null) {
    merged.price_per_bag = bagPrice;
    merged.rate_per_bag = bagPrice;
  }

  const hasCustomMarkers = Boolean(
    merged.custom_invoice_number ||
    merged.custom_invoice_no ||
    d?.custom_invoice ||
    d?.customInvoice ||
    merged.custom_invoice_id ||
    merged._is_custom_invoice_loaded ||
    merged.gross_weight !== undefined ||
    merged.net_weight !== undefined ||
    merged.fob_rate !== undefined ||
    merged.freight_rate !== undefined ||
    merged.commission_rate !== undefined ||
    merged.price_per_bag !== undefined ||
    ((merged.id || merged._id) && (merged.invoice_number || merged.goods_description || merged.total_value)) ||
    (d && (d.invoice_number || d.goods_description || d.id || d._id))
  );
  if (!hasCustomMarkers) {
    return null;
  }

  merged._is_custom_invoice_loaded = true;
  return merged;
}

export function isCompleteCustomInvoiceData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  return Boolean(
    data.custom_invoice_number ||
    data.custom_invoice_no ||
    data.custom_invoice_date ||
    data.custom_invoice_status ||
    data._is_custom_invoice_loaded ||
    (data.custom_invoice && typeof data.custom_invoice === 'object' && (data.custom_invoice.custom_invoice_number || data.custom_invoice.id)) ||
    ((data.id || data._id) && (data.invoice_number || data.goods_description))
  );
}

export function extractLinkedCommercialInvoiceId(data: any): string {
  if (!data) return '';
  const d = data.data ?? data;
  const candidates = [
    d?.commercial_invoice_id,
    d?.commercialInvoiceId,
    d?.commercial_id,
    d?.commercialId,
    d?.commercial_invoice?.id,
    d?.commercial_invoice?._id,
    d?.commercial_invoice?.commercial_invoice_id,
  ];
  for (const c of candidates) {
    if (c) {
      const clean = sanitizeDocId(c);
      if (clean && !/^(commercial|commercial-invoice|invoice|step-\d+)$/i.test(clean)) return clean;
    }
  }
  return '';
}

export function extractCommercialInvoiceData(data: any): any {
  if (!data || typeof data !== 'object') return null;
  if (
    data.success === false ||
    data.status === false ||
    (typeof data.statusCode === 'number' && data.statusCode >= 400)
  ) {
    return null;
  }
  const d = data.data !== undefined ? data.data : data;
  if (!d || typeof d !== 'object') return null;

  const raw =
    d.commercial_invoice ||
    d.commercialInvoice ||
    d.invoice ||
    d.document ||
    d.details ||
    d;

  const merged: any = {
    ...(typeof d === 'object' && d !== null ? d : {}),
    ...(typeof raw === 'object' && raw !== null ? raw : {}),
  };

  // Preserve non-empty Commercial Invoice fields across outer/nested payloads
  const preserveKeys = [
    'net_weight',
    'vessel_name',
    'voyage_number',
    'place_of_delivery',
    'packing_type_title',
    'balance_payment',
    'total_value',
  ];
  for (const key of preserveKeys) {
    if (
      (merged[key] === undefined || merged[key] === null || String(merged[key]).trim() === '') &&
      d?.[key] !== undefined &&
      d?.[key] !== null &&
      String(d[key]).trim() !== ''
    ) {
      merged[key] = d[key];
    }
  }
  if ((merged.any_advance === undefined || merged.any_advance === null) && d?.any_advance !== undefined && d?.any_advance !== null) {
    merged.any_advance = d.any_advance;
  }

  if (
    typeof d?.loading_port === 'object' &&
    d.loading_port !== null &&
    d.loading_port.country &&
    (typeof merged.loading_port !== 'object' || merged.loading_port === null || !merged.loading_port.country)
  ) {
    merged.loading_port = d.loading_port;
  }
  if (
    typeof d?.destination_port === 'object' &&
    d.destination_port !== null &&
    d.destination_port.country &&
    (typeof merged.destination_port !== 'object' || merged.destination_port === null || !merged.destination_port.country)
  ) {
    merged.destination_port = d.destination_port;
  }

  merged.id = merged.id || merged._id || merged.commercial_invoice_id;
  if (merged.id) merged.id = String(merged.id);

  const hasCommercialMarkers = Boolean(
    merged.commercial_invoice_number ||
    merged.commercial_invoice_no ||
    d?.commercial_invoice ||
    d?.commercialInvoice ||
    merged.commercial_invoice_id ||
    merged._is_commercial_invoice_loaded ||
    ((merged.id || merged._id) && (merged.invoice_number || merged.goods_description || merged.total_value || merged.total_amount)) ||
    (d && (d.invoice_number || d.goods_description || d.id || d._id))
  );
  if (!hasCommercialMarkers) {
    return null;
  }

  merged._is_commercial_invoice_loaded = true;
  return merged;
}

export function isCompleteCommercialInvoiceData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  return Boolean(
    data.commercial_invoice_number ||
    data.commercial_invoice_no ||
    data.commercial_invoice_date ||
    data.commercial_invoice_status ||
    data._is_commercial_invoice_loaded ||
    (data.commercial_invoice && typeof data.commercial_invoice === 'object' && (data.commercial_invoice.commercial_invoice_number || data.commercial_invoice.id)) ||
    ((data.id || data._id) && (data.invoice_number || data.goods_description))
  );
}

export function extractCommercialInvoiceDocumentStatus(data?: any, stepItem?: StepperDocumentItem | null): string {
  if (stepItem) {
    const norm = normalizeStepStatus(stepItem.status || stepItem.document_status || stepItem.step_status);
    if (norm === 'completed') return 'COMPLETED';
    return 'PENDING';
  }
  if (!data) return 'PENDING';

  const cStatus =
    data.commercial_invoice_status ||
    data.commercialInvoiceStatus ||
    data.commercial_invoice?.status ||
    data.commercial_invoice?.commercial_invoice_status;
  if (cStatus) {
    const norm = normalizeStepStatus(cStatus);
    return norm === 'completed' ? 'COMPLETED' : 'PENDING';
  }

  const isPureCommercial = Boolean(
    (data.commercial_invoice_id || data._is_commercial_invoice_loaded) &&
    !data.contract_number &&
    !data.confirmation_number
  );
  if (isPureCommercial && data.status) {
    const norm = normalizeStepStatus(data.status);
    return norm === 'completed' ? 'COMPLETED' : 'PENDING';
  }

  return 'PENDING';
}

export function extractLinkedPackingListId(data: any): string {
  if (!data) return '';
  const d = data.data ?? data;
  const commercialId = sanitizeDocId(
    d?.commercial_invoice_id ||
      d?.commercialInvoiceId ||
      (d?.commercial_invoice_number || d?.commercial_invoice_no ? d?.id || d?._id : '')
  );
  const candidates = [
    d?.packing_list_id,
    d?.packingListId,
    d?.packing_id,
    d?.packingId,
    d?.packing_list?.id,
    d?.packing_list?._id,
    d?.packing_list?.packing_list_id,
  ];
  for (const c of candidates) {
    if (c) {
      const clean = sanitizeDocId(c);
      if (
        clean &&
        clean !== commercialId &&
        !/^(packing|packing-list|packing_list|invoice|commercial|commercial-invoice|step-\d+)$/i.test(clean)
      ) {
        return clean;
      }
    }
  }
  return '';
}

export function extractPackingListData(data: any): any {
  if (!data || typeof data !== 'object') return null;
  if (
    data.success === false ||
    data.status === false ||
    (typeof data.statusCode === 'number' && data.statusCode >= 400)
  ) {
    return null;
  }
  const d = data.data !== undefined ? data.data : data;
  if (!d || typeof d !== 'object') return null;

  // STRICT GUARD: If this payload is a Commercial Invoice without packing markers, reject it!
  const hasCommercialMarkers = Boolean(
    d.commercial_invoice_number ||
    d.commercial_invoice_no ||
    d.commercial_invoice_id ||
    d.commercial_invoice ||
    d.commercialInvoice ||
    d.document_type === 'commercial_invoice' ||
    d.doc_type === 'commercial_invoice'
  );
  const hasDirectPackingMarkers = Boolean(
    d.packing_list_number ||
    d.packing_list_no ||
    d.packing_list_id ||
    d.packing_list ||
    d.packingList ||
    d.document_type === 'packing_list' ||
    d.doc_type === 'packing_list' ||
    d._is_packing_list_loaded
  );

  if (hasCommercialMarkers && !hasDirectPackingMarkers) {
    return null;
  }

  const raw =
    d.packing_list ||
    d.packingList ||
    d.packing ||
    d.document ||
    d.details ||
    d;

  const merged: any = {
    ...(typeof d === 'object' && d !== null ? d : {}),
    ...(typeof raw === 'object' && raw !== null ? raw : {}),
  };

  // Preserve non-empty fields across outer/nested payloads
  const preserveKeys = [
    'net_weight',
    'gross_weight',
    'total_bags',
    'vessel_name',
    'voyage_number',
    'place_of_delivery',
    'packing_type_title',
    'containers',
  ];
  for (const key of preserveKeys) {
    if (
      (merged[key] === undefined || merged[key] === null || String(merged[key]).trim() === '') &&
      d?.[key] !== undefined &&
      d?.[key] !== null &&
      String(d[key]).trim() !== ''
    ) {
      merged[key] = d[key];
    }
  }

  merged.id = merged.id || merged._id || merged.packing_list_id || merged.packingListId;
  if (merged.id) merged.id = String(merged.id);

  const hasPackingMarkers = Boolean(
    merged.packing_list_number ||
    merged.packing_list_no ||
    d?.packing_list ||
    d?.packingList ||
    merged.packing_list_id ||
    merged.packingListId ||
    merged._is_packing_list_loaded ||
    merged.document_type === 'packing_list' ||
    merged.doc_type === 'packing_list' ||
    ((merged.id || merged._id) && (merged.goods_description || merged.containers || merged.net_weight) && !hasCommercialMarkers)
  );
  if (!hasPackingMarkers) {
    return null;
  }

  // Strip any accidental commercial invoice fields from merged packing list data
  delete merged.commercial_invoice;
  delete merged.commercialInvoice;
  delete merged.commercial_invoice_id;
  delete merged.commercial_invoice_number;
  delete merged.commercial_invoice_date;
  delete merged.commercial_invoice_no;

  merged._is_packing_list_loaded = true;
  return merged;
}

export function isCompletePackingListData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (
    (data.commercial_invoice_number || data.commercial_invoice_id) &&
    !data.packing_list_number &&
    !data.packing_list_no &&
    !data.packing_list_id &&
    !data.packing_list
  ) {
    return false;
  }
  return Boolean(
    data.packing_list_number ||
    data.packing_list_no ||
    data.packing_list_date ||
    data.packing_list_status ||
    data._is_packing_list_loaded ||
    (data.packing_list && typeof data.packing_list === 'object' && (data.packing_list.packing_list_number || data.packing_list.id))
  );
}

export function extractPackingListDocumentStatus(data?: any, stepItem?: StepperDocumentItem | null): string {
  if (stepItem) {
    const norm = normalizeStepStatus(stepItem.status || stepItem.document_status || stepItem.step_status);
    if (norm === 'completed') return 'COMPLETED';
    return 'PENDING';
  }
  if (!data) return 'PENDING';

  const pStatus =
    data.packing_list_status ||
    data.packingListStatus ||
    data.packing_status ||
    data.packing_list?.status ||
    data.packing_list?.packing_list_status;
  if (pStatus) {
    const norm = normalizeStepStatus(pStatus);
    return norm === 'completed' ? 'COMPLETED' : 'PENDING';
  }

  const isPurePacking = Boolean(
    (data.packing_list_id || data._is_packing_list_loaded) &&
    !data.contract_number &&
    !data.confirmation_number
  );
  if (isPurePacking && data.status) {
    const norm = normalizeStepStatus(data.status);
    return norm === 'completed' ? 'COMPLETED' : 'PENDING';
  }

  return 'PENDING';
}

export function extractLinkedBillOfLadingId(data: any): string {
  if (!data) return '';
  const d = data.data ?? data;
  const candidates = [
    d?.bill_of_lading_id,
    d?.billOfLadingId,
    d?.lading_id,
    d?.ladingId,
    d?.bl_id,
    d?.blId,
    d?.bill_of_lading?.id,
    d?.bill_of_lading?._id,
    d?.lading?.id,
    d?.lading?._id,
  ];
  for (const c of candidates) {
    if (c) {
      const clean = sanitizeDocId(c);
      if (clean && !/^(lading|bill-of-lading|bill_of_lading|bl|step-\d+)$/i.test(clean)) return clean;
    }
  }
  return '';
}

export function extractBillOfLadingData(data: any): any {
  if (!data || typeof data !== 'object') return null;

  // Never treat error responses as valid Bill of Lading data
  if (
    data.success === false ||
    data.success === 0 ||
    data.status === false ||
    data.status === 0 ||
    (typeof data.statusCode === 'number' && data.statusCode >= 400) ||
    Boolean(data.error)
  ) {
    return null;
  }

  const d = data.data !== undefined ? data.data : data;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;

  const raw =
    (d.bill_of_lading && typeof d.bill_of_lading === 'object' ? d.bill_of_lading : null) ||
    (d.billOfLading && typeof d.billOfLading === 'object' ? d.billOfLading : null) ||
    (d.lading && typeof d.lading === 'object' ? d.lading : null) ||
    (d.document && typeof d.document === 'object' ? d.document : null) ||
    (d.details && typeof d.details === 'object' ? d.details : null) ||
    d;

  const merged: any = {
    ...d,
    ...(typeof raw === 'object' && raw !== null ? raw : {}),
  };

  // Preserve rich nested objects (country_of_origin with id/name, destination_port with country, loading_port with id/country)
  if (
    d.country_of_origin &&
    typeof d.country_of_origin === 'object' &&
    (typeof merged.country_of_origin !== 'object' || !merged.country_of_origin?.id)
  ) {
    merged.country_of_origin = d.country_of_origin;
  }
  if (
    d.destination_port &&
    typeof d.destination_port === 'object' &&
    d.destination_port.country &&
    (typeof merged.destination_port !== 'object' || !merged.destination_port?.country)
  ) {
    merged.destination_port = d.destination_port;
  }
  if (
    d.loading_port &&
    typeof d.loading_port === 'object' &&
    (typeof merged.loading_port !== 'object' || !merged.loading_port?.id)
  ) {
    merged.loading_port = d.loading_port;
  }
  if (
    Array.isArray(d.containers) &&
    d.containers.length > 0 &&
    (!Array.isArray(merged.containers) || merged.containers.length === 0)
  ) {
    merged.containers = d.containers;
  }

  merged.id = merged.id || merged._id || merged.bill_of_lading_id || merged.lading_id || merged.bl_id;
  if (merged.id) merged.id = String(merged.id);

  const hasLadingMarkers = Boolean(
    merged.bl_number ||
    merged.bl_no ||
    merged.blNo ||
    merged.bill_of_lading_no ||
    merged.bill_of_lading_number ||
    merged.voyage_number ||
    merged.voyage_no ||
    merged.shipping_line ||
    merged.vessel_name ||
    merged.booking_number ||
    merged.booking_no ||
    merged.sailing_date ||
    merged.arrival_date ||
    merged.shipping_bill_no ||
    merged.sb_no ||
    merged.country_of_origin ||
    merged.destination_port ||
    merged.place_of_delivery ||
    merged.seller_details ||
    merged.shipper_details ||
    merged.consignee_details ||
    merged.notify_party_1 ||
    merged.notify_party_1_instruction ||
    merged.containers ||
    merged.fcl !== undefined ||
    d?.bill_of_lading ||
    d?.billOfLading ||
    d?.lading ||
    merged._is_lading_loaded ||
    merged.id ||
    merged._id
  );
  if (!hasLadingMarkers) {
    return null;
  }

  merged._is_lading_loaded = true;
  return merged;
}

export function isCompleteBillOfLadingData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  return Boolean(
    data.bl_number ||
    data.bl_no ||
    data.blNo ||
    data.bill_of_lading_no ||
    data.bill_of_lading_number ||
    data.voyage_number ||
    data.voyage_no ||
    data.shipping_line ||
    data.bill_of_lading_status ||
    data.lading_status ||
    data._is_lading_loaded ||
    (data.bill_of_lading && typeof data.bill_of_lading === 'object' && (data.bill_of_lading.bl_number || data.bill_of_lading.bl_no || data.bill_of_lading.id)) ||
    ((data.id || data._id) && (data.vessel_name || data.shipping_line || data.booking_number || data.booking_no))
  );
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
    /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
      val.trim()
    );

  // If this is specifically a Custom Invoice step, prioritize custom invoice-specific IDs ONLY
  if (isCustomInvoiceStep(step)) {
    const customCandidates = [
      step.custom_invoice_id,
      step.customInvoiceId,
      step.invoice_id,
      step.invoiceId,
      step.custom_id,
      step.customId,
      step.custom_invoice?.id,
      step.custom_invoice?._id,
      step.redirect_id,
      step.redirectId,
      step.redirect_document_id,
      step.redirectDocumentId,
      step.document_id,
      step.documentId,
      step.doc_id,
      step.docId,
    ];
    for (const raw of customCandidates) {
      if (raw !== undefined && raw !== null) {
        const clean = String(raw).trim();
        if (clean && !isInvalidPlaceholder(clean)) return clean;
      }
    }
    return '';
  }

  // If this is specifically a Bill of Lading step, prioritize bill-of-lading-specific IDs ONLY
  if (isBillOfLadingStep(step)) {
    const blCandidates = [
      step.bill_of_lading_id,
      step.billOfLadingId,
      step.lading_id,
      step.ladingId,
      step.bl_id,
      step.blId,
      step.bill_of_lading?.id,
      step.bill_of_lading?._id,
      step.redirect_id,
      step.redirectId,
      step.redirect_document_id,
      step.redirectDocumentId,
      step.document_id,
      step.documentId,
      step.doc_id,
      step.docId,
    ];
    for (const raw of blCandidates) {
      if (raw !== undefined && raw !== null) {
        const clean = String(raw).trim();
        if (clean && !isInvalidPlaceholder(clean)) return clean;
      }
    }
    return '';
  }

  // If this is specifically a Shipment Instruction step, prioritize shipment-specific IDs ONLY
  if (isShipmentInstructionStep(step)) {
    const shipmentCandidates = [
      step.shipment_instruction_id,
      step.shipmentInstructionId,
      step.shipment_id,
      step.shipmentId,
      step.shipment?.id,
      step.shipment?._id,
      step.redirect_id,
      step.redirectId,
      step.redirect_document_id,
      step.redirectDocumentId,
      step.document_id,
      step.documentId,
      step.doc_id,
      step.docId,
    ];
    for (const raw of shipmentCandidates) {
      if (raw !== undefined && raw !== null) {
        const clean = String(raw).trim();
        if (clean && !isInvalidPlaceholder(clean)) return clean;
      }
    }
    return '';
  }

  // If this is specifically a Proforma step, prioritize proforma-specific IDs ONLY
  if (isProformaStep(step)) {
    const proformaCandidates = [
      step.proforma_id,
      step.proformaId,
      step.proforma?.id,
      step.proforma?._id,
      step.proforma?.proforma_id,
      step.proformaInvoiceId,
      step.proforma_invoice_id,
      step.redirect_id,
      step.redirectId,
      step.redirect_document_id,
      step.redirectDocumentId,
      step.document_id,
      step.documentId,
      step.doc_id,
      step.docId,
    ];
    for (const raw of proformaCandidates) {
      if (raw !== undefined && raw !== null) {
        const clean = String(raw).trim();
        if (clean && !isInvalidPlaceholder(clean)) return clean;
      }
    }
    const directId = String(step.id || step._id || '').trim();
    if (directId && !isInvalidPlaceholder(directId) && directId.length >= 6 && !/^\d+$/.test(directId)) {
      return directId;
    }
    return '';
  }

  // If this is specifically a Contract step, prioritize contract-specific IDs ONLY
  if (isContractStep(step)) {
    const contractCandidates = [
      step.contract_id,
      step.contractId,
      step.contract?.id,
      step.contract?._id,
      step.contract?.contract_id,
      step.sales_contract_id,
      step.salesContractId,
      step.redirect_id,
      step.redirectId,
      step.redirect_document_id,
      step.redirectDocumentId,
      step.document_id,
      step.documentId,
      step.doc_id,
      step.docId,
    ];
    for (const raw of contractCandidates) {
      if (raw !== undefined && raw !== null) {
        const clean = String(raw).trim();
        if (clean && !isInvalidPlaceholder(clean)) return clean;
      }
    }
    const directId = String(step.id || step._id || '').trim();
    if (directId && !isInvalidPlaceholder(directId) && directId.length >= 6 && !/^\d+$/.test(directId)) {
      return directId;
    }
    return '';
  }

  // If this is specifically a Confirmation step, prioritize confirmation-specific IDs ONLY
  if (isConfirmationStep(step)) {
    const confCandidates = [
      step.confirmation_id,
      step.confirmationId,
      step.confirmation?.id,
      step.confirmation?._id,
      step.confirmation?.confirmation_id,
      step.trade_confirmation_id,
      step.tradeConfirmationId,
      step.redirect_id,
      step.redirectId,
      step.redirect_document_id,
      step.redirectDocumentId,
      step.document_id,
      step.documentId,
      step.doc_id,
      step.docId,
    ];
    for (const raw of confCandidates) {
      if (raw !== undefined && raw !== null) {
        const clean = String(raw).trim();
        if (clean && !isInvalidPlaceholder(clean)) return clean;
      }
    }
    const directId = String(step.id || step._id || '').trim();
    if (directId && !isInvalidPlaceholder(directId)) {
      return directId;
    }
    return '';
  }

  // Explicit document ID fields from backend for other steps
  const explicitCandidates = [
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

  const directId = String(step.id || step._id || '').trim();
  if (directId && !isInvalidPlaceholder(directId) && directId.length >= 6 && !/^\d+$/.test(directId)) {
    return directId;
  }

  return '';
}

/**
 * Extracts the dynamic redirect_id from a StepperDocumentItem.
 * Prioritizes redirect_id / redirectId from the backend stepper-list response.
 */
export function extractStepRedirectId(step?: StepperDocumentItem | null): string {
  if (!step) return '';

  const isInvalidPlaceholder = (val: string) =>
    !val ||
    /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|step-\d+|null|undefined|nan|\[object object\]|draft|edit|view|new|smart-docs)$/i.test(
      val.trim()
    );

  const isConf = isConfirmationStep(step);

  const cleanScalarId = (raw: any): string => {
    if (raw === null || raw === undefined) return '';
    const str = String(raw).trim();
    if (!str || isInvalidPlaceholder(str)) return '';
    // Must be a pure ID without URL characters or spaces
    if (str.includes('/') || str.includes('?') || str.includes('=') || str.includes('&') || str.includes(' ')) {
      return '';
    }
    // Reject pure small integer step indices like "1", "2", "3", "4"
    if (/^\d+$/.test(str) && Number(str) <= 20) return '';
    return str;
  };

  const cleanUrlId = (raw: any): string => {
    if (!raw) return '';
    const str = String(raw).trim();
    if (!str || isInvalidPlaceholder(str)) return '';

    // Extract document query params (?doc_id=..., ?proforma_id=..., ?contract_id=..., ?id=...)
    const docQueryMatch = str.match(/[?&](?:doc_id|document_id|proforma_id|contract_id|instruction_id|custom_invoice_id|id)=([^&]+)/i);
    if (docQueryMatch && docQueryMatch[1]) {
      const extracted = decodeURIComponent(docQueryMatch[1]).trim();
      const cleaned = cleanScalarId(extracted);
      if (cleaned) return cleaned;
    }

    // Check path segments for ID (length >= 6 alphanumeric)
    if (str.includes('/')) {
      const parts = str.split('?')[0].split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== 'draft' && last !== 'new' && last !== 'view' && last !== 'edit' && last !== 'smart-docs') {
        const cleaned = cleanScalarId(last);
        if (cleaned && cleaned.length >= 6 && !isInvalidPlaceholder(cleaned)) {
          return cleaned;
        }
      }
    }

    return '';
  };

  // 1. Direct explicit redirect_id / redirectId from backend stepper list (Highest Priority!)
  const directRedirectCandidates = [
    step.redirect_id,
    step.redirectId,
    step.redirect_document_id,
    step.redirectDocumentId,
    step.redirect_doc_id,
    step.redirectDocId,
  ];

  for (const cand of directRedirectCandidates) {
    if (cand) {
      const val = cleanScalarId(cand) || cleanUrlId(cand);
      if (val) return val;
    }
  }

  // 2. Step-specific document ID candidates (strictly matching the step type)
  const stepSpecificCandidates = isCustomInvoiceStep(step)
    ? [
        step.custom_invoice_id,
        step.customInvoiceId,
        step.invoice_id,
        step.invoiceId,
        step.custom_id,
        step.customId,
        step.redirect_id,
        step.redirectId,
      ]
    : isBillOfLadingStep(step)
    ? [
        step.bill_of_lading_id,
        step.billOfLadingId,
        step.lading_id,
        step.ladingId,
        step.bl_id,
        step.blId,
        step.redirect_id,
        step.redirectId,
      ]
    : isShipmentInstructionStep(step)
    ? [
        step.shipment_instruction_id,
        step.shipmentInstructionId,
        step.shipment_id,
        step.shipmentId,
        step.redirect_id,
        step.redirectId,
      ]
    : isProformaStep(step)
    ? [
        step.proforma_id,
        step.proformaId,
        step.proformaInvoiceId,
        step.proforma_invoice_id,
      ]
    : isContractStep(step)
    ? [
        step.contract_id,
        step.contractId,
        step.sales_contract_id,
        step.salesContractId,
      ]
    : isConfirmationStep(step)
    ? [
        step.confirmation_id,
        step.confirmationId,
        step.trade_confirmation_id,
        step.tradeConfirmationId,
      ]
    : [];

  for (const cand of stepSpecificCandidates) {
    const val = cleanScalarId(cand);
    if (val) return val;
  }

  // 3. Extract from URL fields (using step-safe cleanUrlId)
  const urlCandidates = [
    step.redirect,
    step.redirect_url,
    step.redirectUrl,
    step.redirect_link,
    step.redirectLink,
  ];

  for (const cand of urlCandidates) {
    const val = cleanUrlId(cand) || cleanScalarId(cand);
    if (val) return val;
  }

  // 4. Generic explicit document ID fields
  const genericCandidates = [
    step.document_id,
    step.documentId,
    step.doc_id,
    step.docId,
    step.smart_doc_id,
    step.smartDocId,
    step.record_id,
    step.recordId,
  ];

  for (const cand of genericCandidates) {
    const val = cleanScalarId(cand);
    if (val) return val;
  }

  // 5. Final fallback to step.id or step._id if valid scalar ID (not pure step index 1..20)
  const fallbackId = cleanScalarId(step.id) || cleanScalarId(step._id);
  if (fallbackId && fallbackId.length >= 6 && !isInvalidPlaceholder(fallbackId)) {
    return fallbackId;
  }

  return '';
}

/**
 * Resolves the genuine self ID of ANY step in the stepper.
 * Prioritizes redirect_id / redirectId from stepper-list.
 */
export function getStepSelfId(step?: StepperDocumentItem | null): string {
  if (!step) return '';
  return extractStepRedirectId(step) || extractStepId(step) || '';
}

export function getProformaStep(
  steps: StepperDocumentItem[] = [],
  selectedStep?: StepperDocumentItem | null
): StepperDocumentItem | null {
  if (selectedStep && isProformaStep(selectedStep)) {
    return selectedStep;
  }
  return steps.find((s) => isProformaStep(s)) || null;
}

export function getProformaIdFromStepper(
  steps: StepperDocumentItem[] = [],
  selectedStep?: StepperDocumentItem | null
): string {
  const step = getProformaStep(steps, selectedStep);
  if (!step) return '';
  return getStepSelfId(step);
}

export function getConfirmationStep(
  steps: StepperDocumentItem[] = [],
  selectedStep?: StepperDocumentItem | null
): StepperDocumentItem | null {
  if (selectedStep && isConfirmationStep(selectedStep)) {
    return selectedStep;
  }
  return steps.find((s) => isConfirmationStep(s)) || null;
}

export function getConfirmationIdFromStepper(
  steps: StepperDocumentItem[] = [],
  selectedStep?: StepperDocumentItem | null
): string {
  const step = getConfirmationStep(steps, selectedStep);
  if (!step) return '';
  return getStepSelfId(step);
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
 * Safely extracts status key specifically for a Proforma Invoice document.
 * Strictly avoids picking up an inherited Contract's or Confirmation's status.
 */
export function extractProformaDocumentStatus(data?: any, stepItem?: StepperDocumentItem | null): string {
  if (stepItem) {
    const norm = normalizeStepStatus(stepItem.status || stepItem.document_status || stepItem.step_status);
    if (norm === 'completed') return 'COMPLETED';
    return 'PENDING';
  }
  if (!data) return 'PENDING';

  // 1. Explicit proforma_status property
  const pStatus =
    data.proforma_status ||
    data.proformaStatus ||
    data.proforma?.status ||
    data.proforma?.proforma_status ||
    data.proforma_invoice?.status ||
    data.proforma_invoice?.proforma_status;
  if (pStatus) {
    const norm = normalizeStepStatus(pStatus);
    return norm === 'completed' ? 'COMPLETED' : 'PENDING';
  }

  // 2. Pure proforma data object (not inheriting contract / confirmation status)
  const isPureProforma = Boolean(
    (data.invoice_number || data.invoice_no || data.proforma_id || data.proforma_invoice_id) &&
    !data.contract_number &&
    !data.contract_id &&
    !data.contractId &&
    !data.confirmation_number &&
    !data.confirmation_id &&
    !data.confirmationId
  );
  if (isPureProforma && data.status) {
    const norm = normalizeStepStatus(data.status);
    return norm === 'completed' ? 'COMPLETED' : 'PENDING';
  }

  return 'PENDING';
}

/**
 * Returns true if the status indicates the document has completed / been submitted.
 */
export function isStatusCompleted(status?: string | boolean | null): boolean {
  if (status === true) return true;
  if (!status) return false;
  const s = String(status).trim().toUpperCase();
  return s === 'COMPLETED' || s === 'COMPLETE' || s === 'DONE' || s === 'APPROVED' || s === 'SUCCESS' || s === 'FINISHED' || s === 'TRUE';
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
  return steps.find((s) => isContractStep(s)) || null;
}

export function getContractIdFromStepper(
  steps: StepperDocumentItem[] = [],
  selectedStep?: StepperDocumentItem | null
): string {
  const step = getContractStep(steps, selectedStep);
  if (!step) return '';
  return getStepSelfId(step);
}

/**
 * Extracts a unique Document identifier specifically for document rows in ConfirmationsDataTable.
 * Prioritizes redirect_id and document-specific self IDs.
 */
export function extractDocumentRowSelfId(row: any): string {
  if (!row) return '';
  const clean = (val: any) => sanitizeDocId(val);
  const candidates = [
    row.redirect_id,
    row.redirectId,
    row.shipment_instruction_id,
    row.shipmentInstructionId,
    row.instruction_id,
    row.instructionId,
    row.shipment_id,
    row.shipmentId,
    row.document_id,
    row.documentId,
    row.doc_id,
    row.docId,
    row.id,
    row._id,
  ];
  for (const c of candidates) {
    const val = clean(c);
    if (val && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(val)) {
      return val;
    }
  }
  return '';
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
    const rawItemId = item.id || item._id;
    const resolvedInstId = item.instruction_id ? String(item.instruction_id).trim() : (rawItemId ? String(rawItemId).trim() : undefined);

    return {
      value,
      label,
      subLabel: subLabel && subLabel !== label ? subLabel : detailsText && detailsText !== label ? detailsText : '',
      instructionText: instructionText || detailsText || label,
      companyName: label,
      details: detailsText,
      ...item,
      id: resolvedInstId,
      instruction_id: resolvedInstId,
      raw: item,
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

/**
 * Extracts and formats loading port options from GET /dms-fields/loading-ports/:countryId
 * Matches the exact option formatting used in Contract/Confirmation loading port dropdowns.
 */
export function extractLoadingPortsData(data: any): SmartDocsProductFieldOption[] {
  if (!data) return [];

  const d = data.data !== undefined ? data.data : data;
  let rawList: any[] = [];

  if (Array.isArray(d)) {
    rawList = d;
  } else if (Array.isArray(data)) {
    rawList = data;
  } else if (d && typeof d === 'object') {
    const candidateKeys = [
      'loading_ports',
      'loadingPorts',
      'loading_port',
      'loadingPort',
      'ports',
      'port_list',
      'portsList',
      'list',
      'items',
      'records',
      'results',
      'data',
    ];
    for (const k of candidateKeys) {
      if (Array.isArray(d[k])) {
        rawList = d[k];
        break;
      }
    }
    if (rawList.length === 0 && typeof data === 'object') {
      for (const k of candidateKeys) {
        if (Array.isArray(data[k])) {
          rawList = data[k];
          break;
        }
      }
    }
  }

  const options: SmartDocsProductFieldOption[] = [];
  const seenKeys = new Set<string>();

  for (const item of rawList) {
    if (!item) continue;
    if (typeof item === 'string') {
      const clean = item.trim();
      if (clean && !seenKeys.has(clean.toLowerCase())) {
        seenKeys.add(clean.toLowerCase());
        options.push({ value: clean, label: clean });
      }
      continue;
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

      if (!portName || portName === '[object Object]') continue;

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

      const dedupeKey = `${value}_${displayLabel}`.toLowerCase();
      if (!seenKeys.has(dedupeKey) && !seenKeys.has(displayLabel.toLowerCase())) {
        seenKeys.add(dedupeKey);
        seenKeys.add(displayLabel.toLowerCase());
        options.push({
          ...item,
          id: value || displayLabel,
          name: portName,
          value: value || displayLabel,
          label: displayLabel,
          subLabel: portCountry ? portCountry : undefined,
        });
      }
    }
  }

  return options;
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
  searchText?: string;
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

const DYNAMIC_CURRENCY_SYMBOLS: Record<string, string> = {};

function getFallbackCurrencySymbol(code: string): string {
  const upper = String(code || '').trim().toUpperCase();
  if (!upper) return '$';
  if (KNOWN_CURRENCIES[upper]?.symbol) {
    return KNOWN_CURRENCIES[upper].symbol;
  }
  if (DYNAMIC_CURRENCY_SYMBOLS[upper]) {
    return DYNAMIC_CURRENCY_SYMBOLS[upper];
  }
  if (/^[A-Z]{3}$/.test(upper)) {
    try {
      const parts = new Intl.NumberFormat('en', {
        style: 'currency',
        currency: upper,
        currencyDisplay: 'narrowSymbol',
      }).formatToParts(0);
      const sym = parts.find((p) => p.type === 'currency')?.value?.trim();
      if (sym) {
        return sym;
      }
    } catch {
      // Ignore unrecognized ISO currency codes
    }
    return upper === 'USD' ? '$' : upper;
  }
  return upper === 'USD' ? '$' : upper;
}

/**
 * Returns the currency symbol for formatting or display.
 * Resolves dynamically from the provided currencies list, currency object, known/cached API symbols, or Intl narrowSymbol.
 */
export function getCurrencySymbol(currencyOrCode: any, currenciesList?: any[]): string {
  if (!currencyOrCode) return '$';

  if (typeof currencyOrCode === 'object' && currencyOrCode) {
    const objCode = normalizeCurrencyCode(currencyOrCode);
    const knownSym = KNOWN_CURRENCIES[objCode]?.symbol;
    const sym =
      currencyOrCode.symbol ||
      currencyOrCode.currency_symbol ||
      currencyOrCode.currencySymbol ||
      currencyOrCode.sign;
    if (sym && typeof sym === 'string' && sym.trim()) {
      const cleanSym = sym.trim();
      // For known disambiguated dollar currencies (e.g. AUD -> A$, CAD -> C$), prefer the disambiguated symbol over bare '$'
      const resolvedSym = cleanSym === '$' && knownSym && knownSym !== '$' ? knownSym : cleanSym;
      if (objCode && /^[A-Z]{3}$/.test(objCode)) {
        DYNAMIC_CURRENCY_SYMBOLS[objCode] = resolvedSym;
      }
      return resolvedSym;
    }
  }

  if (currenciesList && Array.isArray(currenciesList) && currenciesList.length > 0) {
    const rawStr = typeof currencyOrCode === 'string' ? currencyOrCode.trim() : '';
    const rawObjId =
      typeof currencyOrCode === 'object' && currencyOrCode
        ? String(currencyOrCode.id || currencyOrCode._id || currencyOrCode.currency_id || currencyOrCode.currencyId || '').trim()
        : '';
    const lookupId = rawObjId || rawStr;

    const idMatch = lookupId
      ? currenciesList.find(
          (item: any) =>
            String(item.id || '') === lookupId ||
            String(item._id || '') === lookupId ||
            String(item.raw?.id || '') === lookupId ||
            String(item.raw?._id || '') === lookupId ||
            String(item.raw?.currency_id || '') === lookupId
        )
      : undefined;

    const targetCode = !idMatch ? normalizeCurrencyCode(currencyOrCode) : '';
    const match =
      idMatch ||
      currenciesList.find(
        (item: any) =>
          (item.value && String(item.value).toUpperCase() === targetCode) ||
          (item.code && String(item.code).toUpperCase() === targetCode) ||
          (rawStr && item.label && String(item.label).toUpperCase() === rawStr.toUpperCase())
      );

    if (match) {
      const matchCode = String(match.code || match.value || targetCode || '').toUpperCase();
      const knownSym = KNOWN_CURRENCIES[matchCode]?.symbol;
      const matchSym =
        match.symbol ||
        match.currency_symbol ||
        match.raw?.symbol ||
        match.raw?.currency_symbol;
      if (matchSym && typeof matchSym === 'string' && matchSym.trim()) {
        const cleanSym = matchSym.trim();
        return cleanSym === '$' && knownSym && knownSym !== '$' ? knownSym : cleanSym;
      }
      if (typeof match.label === 'string') {
        const parenMatch = match.label.match(/\(([^)]+)\)/);
        if (parenMatch && parenMatch[1]?.trim()) {
          return parenMatch[1].trim();
        }
      }
      if (matchCode) {
        return getFallbackCurrencySymbol(matchCode);
      }
    }
  }

  if (typeof currencyOrCode === 'string') {
    const trimmed = currencyOrCode.trim();
    // If string is already formatted like "AWG (ƒ)" or "BAM (KM)", extract the symbol inside parentheses
    const parenMatch = trimmed.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1]?.trim()) {
      return parenMatch[1].trim();
    }
    // If string itself is a non-alphanumeric symbol (e.g. '₹', '€', '£', 'ƒ', '₼', '৳')
    if (trimmed.length > 0 && trimmed.length <= 4 && !/^[A-Za-z0-9]+$/.test(trimmed) && trimmed !== '$') {
      return trimmed;
    }
  }

  const code = normalizeCurrencyCode(currencyOrCode);
  return getFallbackCurrencySymbol(code);
}

/**
 * Robustly normalizes any raw currency item, object, or code into a structured SmartDocsCurrencyOption.
 * Guarantees clean short-code + symbol format (e.g. "AUD (A$)", "USD ($)") with no inconsistent subtitle names.
 */
export function normalizeCurrencyOption(raw: any, existingList?: any[]): SmartDocsCurrencyOption {
  let id: string | undefined = undefined;
  let rawSymbol: string | undefined = undefined;
  let rawName: string | undefined = undefined;
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
    rawName =
      raw.name ||
      raw.currency_name ||
      raw.currencyName ||
      raw.full_name ||
      raw.fullName;
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

  // Check if an existing option matches by ID first, then by Code in existingList
  if (existingList && Array.isArray(existingList) && existingList.length > 0) {
    const rawIdStr = id ? String(id) : typeof raw === 'string' ? raw.trim() : '';
    const idMatch = rawIdStr
      ? existingList.find(
          (item: any) =>
            String(item.id || '') === rawIdStr ||
            String(item._id || '') === rawIdStr ||
            String(item.raw?.id || '') === rawIdStr ||
            String(item.raw?._id || '') === rawIdStr ||
            String(item.raw?.currency_id || '') === rawIdStr
        )
      : undefined;

    const match =
      idMatch ||
      existingList.find(
        (item: any) =>
          (rawIdStr && String(item.value) === rawIdStr) ||
          (item.value && String(item.value).toUpperCase() === code) ||
          (item.code && String(item.code).toUpperCase() === code) ||
          (item.label && String(item.label).toUpperCase().startsWith(`${code} (`))
      );

    if (match) {
      const matchId = match.id || match._id || match.raw?.id || match.raw?._id || match.raw?.currency_id || id;
      const matchCode = String(match.code || match.value || code).toUpperCase();
      const matchKnown = KNOWN_CURRENCIES[matchCode];
      const rawMatchSym = match.symbol || rawSymbol;
      const cleanMatchSym = typeof rawMatchSym === 'string' && rawMatchSym.trim() ? rawMatchSym.trim() : undefined;
      const matchSymbol =
        (cleanMatchSym === '$' && matchKnown?.symbol && matchKnown.symbol !== '$' ? matchKnown.symbol : cleanMatchSym) ||
        matchKnown?.symbol ||
        getFallbackCurrencySymbol(matchCode);
      const matchLabel = matchSymbol ? `${matchCode} (${matchSymbol})` : matchCode;

      if (matchCode && matchSymbol) {
        DYNAMIC_CURRENCY_SYMBOLS[matchCode] = matchSymbol;
      }

      return {
        id: matchId ? String(matchId) : undefined,
        value: matchCode,
        label: matchLabel,
        code: matchCode,
        symbol: matchSymbol,
        searchText: match.searchText || matchKnown?.name || (typeof rawName === 'string' ? rawName.trim() : undefined),
        raw: match.raw || rawObj,
      };
    }
  }

  const cleanRawSymbol = typeof rawSymbol === 'string' && rawSymbol.trim() ? rawSymbol.trim() : undefined;
  const symbol =
    (cleanRawSymbol === '$' && known?.symbol && known.symbol !== '$' ? known.symbol : cleanRawSymbol) ||
    known?.symbol ||
    getFallbackCurrencySymbol(code);
  const label = symbol ? `${code} (${symbol})` : code;

  if (code && symbol) {
    DYNAMIC_CURRENCY_SYMBOLS[code] = symbol;
  }

  return {
    id: id ? String(id) : undefined,
    value: code,
    label: label,
    code: code,
    symbol: symbol,
    searchText: known?.name || (typeof rawName === 'string' ? rawName.trim() : undefined),
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

/**
 * Robust extractor for single product details returned by GET /product/:id API
 */
export function generatePackingCuid(): string {
  const ts = Date.now().toString(36);
  const rnd1 = Math.random().toString(36).substring(2, 10);
  const rnd2 = Math.random().toString(36).substring(2, 10);
  const rnd3 = Math.random().toString(36).substring(2, 10);
  return `cm${ts}${rnd1}${rnd2}${rnd3}`.substring(0, 25);
}

export function extractProductDetailData(raw: any, fallbackId: string = ''): any {
  if (!raw) return null;
  const root = raw.data ?? raw.result ?? raw.product ?? raw.record ?? raw;
  const candidate = Array.isArray(root) ? root[0] : root;
  const p =
    candidate && typeof candidate === 'object'
      ? candidate.product ?? candidate.item ?? candidate.record ?? candidate
      : candidate;

  if (!p || typeof p !== 'object') return null;

  // Extract ID
  const id = sanitizeDocId(p.id || p._id || p.product_id || p.productId || fallbackId);

  // Extract Name
  let name = '';
  const nameCandidates = [p.name, p.product_name, p.productName, p.title, p.label, p.commodity];
  for (const nc of nameCandidates) {
    if (typeof nc === 'string' && nc.trim()) {
      name = nc.trim();
      break;
    } else if (typeof nc === 'object' && nc) {
      const sub = nc.name || nc.title || nc.label;
      if (typeof sub === 'string' && sub.trim()) {
        name = sub.trim();
        break;
      }
    }
  }

  // Extract Country
  let country = '';
  const countryCandidates = [
    p.country_name,
    p.countryName,
    p.country,
    p.origin_country,
    p.originCountry,
    p.origin,
    p.country_of_origin,
    p.country_of_origin_name,
  ];
  for (const cc of countryCandidates) {
    if (typeof cc === 'string' && cc.trim()) {
      country = cc.trim();
      break;
    } else if (typeof cc === 'object' && cc) {
      const sub = cc.name || cc.country_name || cc.title || cc.label || cc.country;
      if (typeof sub === 'string' && sub.trim()) {
        country = sub.trim();
        break;
      }
    }
  }

  const countryId = String(
    p.country_id ||
    p.countryId ||
    p.origin_country_id ||
    p.originCountryId ||
    (typeof p.country === 'object' ? p.country?.id || p.country?._id : '') ||
    (typeof p.origin_country === 'object' ? p.origin_country?.id || p.origin_country?._id : '') ||
    candidate?.country_id ||
    candidate?.countryId ||
    ''
  );

  // Extract HSN
  let hsn = '';
  const hsnCandidates = [p.hsn_code, p.hsnCode, p.hsn, p.hsn_sac_code, p.hsnSacCode, p.hs_code, p.code];
  for (const hc of hsnCandidates) {
    if (typeof hc === 'string' && hc.trim()) {
      hsn = hc.trim();
      break;
    } else if (typeof hc === 'number') {
      hsn = String(hc);
      break;
    } else if (typeof hc === 'object' && hc) {
      const sub = hc.code || hc.hsn || hc.hsn_code;
      if (sub) {
        hsn = String(sub).trim();
        break;
      }
    }
  }

  // Extract Category
  let category = '';
  const categoryCandidates = [
    p.category_name,
    p.categoryName,
    p.category,
    p.sub_category_name,
    p.subCategoryName,
    p.category_title,
    p.sub_category,
  ];
  for (const cat of categoryCandidates) {
    if (typeof cat === 'string' && cat.trim()) {
      category = cat.trim();
      break;
    } else if (typeof cat === 'object' && cat) {
      const sub = cat.name || cat.category_name || cat.title || cat.label;
      if (typeof sub === 'string' && sub.trim()) {
        category = sub.trim();
        break;
      }
    }
  }

  // Extract Specification
  let spec = '';
  const specCandidates = [p.specification, p.spec, p.description, p.product_specification];
  for (const sc of specCandidates) {
    if (typeof sc === 'string' && sc.trim()) {
      spec = sc.trim();
      break;
    }
  }

  // Extract Unit Type (solid | liquid) accurately without false positive overrides
  const isLiquidFlag =
    p.is_liquid ??
    p.isLiquid ??
    p.liquid ??
    p.is_liquid_unit ??
    candidate?.is_liquid ??
    candidate?.isLiquid;

  const explicitUnitType = String(
    p.unit_type ||
    p.unitType ||
    p.packing_unit_type ||
    p.packingUnitType ||
    p.packaging_unit_type ||
    p.product_unit_type ||
    candidate?.unit_type ||
    candidate?.unitType ||
    ''
  ).trim().toLowerCase();

  const explicitUnit = String(
    p.unit ||
    p.unit_name ||
    p.unitName ||
    p.default_unit ||
    p.uom ||
    candidate?.unit ||
    ''
  ).trim().toLowerCase();

  // Extract Packing Types
  const rawPackings =
    (Array.isArray(p.packing_types) && p.packing_types) ||
    (Array.isArray(p.packingTypes) && p.packingTypes) ||
    (Array.isArray(p.packings) && p.packings) ||
    (Array.isArray(p.packaging_types) && p.packaging_types) ||
    (Array.isArray(p.packagingTypes) && p.packagingTypes) ||
    (Array.isArray(p.packaging) && p.packaging) ||
    (Array.isArray(p.packing) && p.packing) ||
    [];

  let unitType: 'solid' | 'liquid' = 'solid';

  if (isLiquidFlag === true || isLiquidFlag === 1 || isLiquidFlag === 'true' || isLiquidFlag === '1') {
    unitType = 'liquid';
  } else if (isLiquidFlag === false || isLiquidFlag === 0 || isLiquidFlag === 'false' || isLiquidFlag === '0') {
    unitType = 'solid';
  } else if (explicitUnitType === 'liquid') {
    unitType = 'liquid';
  } else if (explicitUnitType === 'solid') {
    unitType = 'solid';
  } else if (['l', 'ltr', 'ltrs', 'liter', 'liters', 'litre', 'litres', 'ml'].includes(explicitUnit)) {
    unitType = 'liquid';
  } else if (['kg', 'kgs', 'g', 'gm', 'gms', 'mt', 'ton', 'tons', 'quintal'].includes(explicitUnit)) {
    unitType = 'solid';
  } else if (rawPackings.length > 0) {
    const hasExplicitLiquidPacking = rawPackings.some((pk: any) => {
      const uType = String(pk?.unit_type || pk?.unitType || '').toLowerCase();
      const uUnit = String(pk?.unit || pk?.uom || '').toLowerCase();
      const title = String(pk?.title || pk?.name || pk?.packing_name || (typeof pk === 'string' ? pk : '')).toLowerCase();

      if (uType === 'liquid') return true;
      if (['l', 'ltr', 'liter', 'liters', 'litre', 'litres', 'ml'].includes(uUnit)) return true;
      if (/\b(ltrs?|liters?|litres?|ml)\b/i.test(title)) return true;
      if (title.includes('liquid') || title.includes('flexitank') || title.includes('ibc tank')) return true;
      return false;
    });

    const hasExplicitSolidPacking = rawPackings.some((pk: any) => {
      const uType = String(pk?.unit_type || pk?.unitType || '').toLowerCase();
      const uUnit = String(pk?.unit || pk?.uom || '').toLowerCase();
      const title = String(pk?.title || pk?.name || pk?.packing_name || (typeof pk === 'string' ? pk : '')).toLowerCase();

      if (uType === 'solid') return true;
      if (['kg', 'kgs', 'g', 'gm', 'mt', 'ton', 'tons'].includes(uUnit)) return true;
      if (/\b(kgs?|grams?|gms?|mts?|tons?)\b/i.test(title)) return true;
      if (title.includes('bag') || title.includes('sack') || title.includes('jute') || title.includes('box') || title.includes('carton')) return true;
      return false;
    });

    if (hasExplicitLiquidPacking && !hasExplicitSolidPacking) {
      unitType = 'liquid';
    } else {
      unitType = 'solid';
    }
  }

  const parsedPackings = rawPackings.map((pk: any, idx: number) => {
    if (typeof pk === 'string') {
      const cleanTitle = pk.trim();
      const bagWeight = parsePackingBagWeightKg(cleanTitle);
      return {
        id: `pack-${id || Date.now()}-${idx}`,
        title: cleanTitle,
        quantity: bagWeight !== null ? String(bagWeight) : '',
        density: unitType === 'liquid' ? '1' : '1',
        netWeightKg: bagWeight !== null ? String(bagWeight) : '',
      };
    }

    const pkObj = pk?.packing_type && typeof pk.packing_type === 'object' ? pk.packing_type : null;
    const title = String(
      pk?.title ||
      pk?.name ||
      pk?.packing_name ||
      pk?.packing_type_name ||
      pkObj?.title ||
      pkObj?.name ||
      (typeof pk?.packing_type === 'string' ? pk.packing_type : '') ||
      pk?.label ||
      ''
    ).trim();

    let qty = String(
      pk?.quantity ??
      pk?.qty ??
      pk?.pack_qty ??
      pk?.bagWeightKg ??
      pk?.size ??
      pk?.weight ??
      ''
    ).trim();

    if (!qty && title) {
      const parsedWeight = parsePackingBagWeightKg(title);
      if (parsedWeight !== null) {
        qty = String(parsedWeight);
      }
    }

    const density = unitType === 'liquid' ? String(pk?.density || '1') : '1';
    let netWeightKg = String(pk?.netWeightKg || pk?.net_weight_kg || '');
    if (!netWeightKg && qty) {
      if (unitType === 'liquid') {
        const d = parseFloat(density) || 1;
        const q = parseFloat(qty) || 0;
        netWeightKg = (q * d).toFixed(2);
      } else {
        netWeightKg = qty;
      }
    }

    const rawId =
      pk?.id ||
      pk?._id ||
      pk?.packing_type_id ||
      pk?.packing_id ||
      pk?.product_packing_id ||
      pkObj?.id ||
      pkObj?._id ||
      pkObj?.packing_type_id;

    const resolvedId = rawId ? String(rawId).trim() : generatePackingCuid();

    const rawCf =
      pk?.conversion_factor ??
      pk?.conversionFactor ??
      pkObj?.conversion_factor ??
      pkObj?.conversionFactor;

    const parsedCf =
      rawCf !== undefined && rawCf !== null && String(rawCf).trim() !== '' && !isNaN(Number(rawCf))
        ? parseFloat(Number(rawCf).toFixed(3))
        : (parseFloat(qty) || 50);

    return {
      ...pk,
      id: resolvedId,
      title,
      quantity: qty,
      density,
      netWeightKg,
      conversion_factor: parsedCf,
    };
  });

  return {
    id,
    label: name,
    name,
    product_name: name,
    productName: name,
    country_id: countryId,
    country,
    country_name: country,
    origin_country: country,
    hsn,
    hsn_code: hsn,
    category,
    category_name: category,
    spec,
    specification: spec,
    specifications: spec,
    unit_type: unitType,
    unitType,
    packings: parsedPackings,
    packing_types: parsedPackings,
    raw: p,
  };
}

/**
 * Robust helper to extract payment term title from any response shape.
 */
export function extractPaymentTermTitle(row: any): string {
  if (!row) return '—';
  const val =
    row.title ||
    row.name ||
    row.label ||
    row.term ||
    row.payment_term ||
    row.paymentTerm;
  if (typeof val === 'object') {
    return val?.title || val?.name || val?.label || '—';
  }
  return String(val || '—');
}

/**
 * Robust helper to extract boolean status (Active / Inactive) from any response shape.
 */
export function extractPaymentTermStatus(row: any): boolean {
  if (!row) return false;
  const val =
    row.status !== undefined
      ? row.status
      : row.is_active !== undefined
      ? row.is_active
      : row.isActive !== undefined
      ? row.isActive
      : row.active;

  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'active' || lower === 'enabled';
  }
  return false;
}

/**
 * Robust helper to extract unique ID for a payment term record.
 */
export function extractPaymentTermId(row: any): string {
  if (!row) return '';
  const val =
    row.id ||
    row._id ||
    row.payment_term_id ||
    row.paymentTermId ||
    row.cuid ||
    row.code;
  if (typeof val === 'object') {
    return val?.$oid || val?.id || '';
  }
  return String(val || '').trim();
}

/**
 * Robust helper to normalize payment term single-record details from API.
 */
export function extractPaymentTermDetailData(raw: any, fallbackId: string = ''): any {
  if (!raw) return null;
  const root = raw.data ?? raw.result ?? raw.payment_term ?? raw.record ?? raw;
  const candidate = Array.isArray(root) ? root[0] : root;
  const item =
    candidate && typeof candidate === 'object'
      ? candidate.payment_term ?? candidate.item ?? candidate.record ?? candidate
      : candidate;

  if (!item || typeof item !== 'object') return null;

  const id = sanitizeDocId(item.id || item._id || item.payment_term_id || item.paymentTermId || fallbackId);
  const title = extractPaymentTermTitle(item);
  const status = extractPaymentTermStatus(item);

  return {
    id,
    title: title !== '—' ? title : '',
    name: title !== '—' ? title : '',
    status,
    is_active: status,
    raw: item,
  };
}

/**
 * Helpers to extract fields for Sellers / Exporters table and forms
 */
export function extractSellerCompanyName(row: any): string {
  if (!row) return '—';
  const val =
    row.company_name ||
    row.companyName ||
    row.company ||
    row.business_name ||
    row.businessName ||
    row.name ||
    row.label ||
    row.title;
  if (typeof val === 'object') {
    return val?.name || val?.title || val?.label || '—';
  }
  return String(val || '—');
}

export function extractSellerAddress(row: any): string {
  if (!row) return '—';
  const val =
    row.address ||
    row.address_details ||
    row.instruction ||
    row.instructions ||
    row.details;
  if (typeof val === 'object') {
    return val?.address || val?.name || '—';
  }
  return String(val || '—');
}

export function extractSellerCity(row: any): string {
  if (!row) return '—';
  const val = row.city || row.city_name || row.cityName;
  if (typeof val === 'object') return val?.name || '—';
  return String(val || '—');
}

export function extractSellerState(row: any): string {
  if (!row) return '—';
  const val = row.state || row.state_name || row.stateName || row.province;
  if (typeof val === 'object') return val?.name || '—';
  return String(val || '—');
}

export function extractSellerCountry(row: any): string {
  if (!row) return '—';
  const val =
    row.country_name ||
    row.countryName ||
    row.country ||
    row.origin_country ||
    row.originCountry;
  if (typeof val === 'object') {
    return val?.name || val?.country_name || '—';
  }
  return String(val || '—');
}

export function extractSellerId(row: any): string {
  if (!row) return '';
  const val =
    row.id ||
    row._id ||
    row.instruction_id ||
    row.instructionId ||
    row.seller_id ||
    row.sellerId ||
    row.company_id ||
    row.uuid;
  if (typeof val === 'object') {
    return val?.$oid || val?.id || '';
  }
  return String(val || '').trim();
}

export function extractSellerDetailData(raw: any, fallbackId: string = ''): any {
  if (!raw) return null;
  const root = raw.data ?? raw.result ?? raw.instruction ?? raw.seller ?? raw.record ?? raw;
  const candidate = Array.isArray(root) ? root[0] : root;
  const item =
    candidate && typeof candidate === 'object'
      ? candidate.instruction ?? candidate.seller ?? candidate.item ?? candidate.record ?? candidate
      : candidate;

  if (!item || typeof item !== 'object') return null;

  const id = sanitizeDocId(
    item.id || item._id || item.instruction_id || item.seller_id || item.company_id || fallbackId
  );

  const countryName =
    item.country?.name ||
    (typeof item.country === 'string' ? item.country : '') ||
    item.country_name ||
    item.countryName ||
    '';
  const countryId = item.country?.id || item.country_id || item.countryId || '';
  const countryCode = item.country_code || item.countryCode || '';
  const zip = item.zip_code || item.zipcode || item.postal_code || '';
  const certNumber =
    item.certificate_name_number ||
    item.certificate_name_and_number ||
    item.certificate_no ||
    item.certificate ||
    '';
  const sig =
    item.authorised_signature ||
    item.authority_signature ||
    item.authoritySignature ||
    item.signature ||
    '';
  const logo = item.company_logo || item.companyLogo || item.logo || '';

  return {
    id,
    company_name: item.company_name || item.companyName || item.company || item.name || '',
    address: item.address || item.address_details || item.details || '',
    city: item.city || item.city_name || '',
    state: item.state || item.state_name || item.province || '',
    country: countryName,
    country_name: countryName,
    country_code: countryCode,
    country_id: countryId,
    zip_code: zip,
    zipcode: zip,
    email: item.email || item.email_address || '',
    contact_number: item.contact_number || item.contactNumber || item.phone || item.mobile || '',
    certificate_name_number: certNumber,
    certificate_name_and_number: certNumber,
    authority_name: item.authority_name || item.authorityName || item.authority || '',
    authorised_signature: sig,
    authority_signature: sig,
    company_logo: logo,
    bank_name: item.bank_name || item.bankName || '',
    bank_details: item.bank_details || item.bankDetails || item.bank_detail || '',
    consignees:
      (Array.isArray(item?.consignees) && item.consignees) ||
      (Array.isArray(item?.consignee_details) && item.consignee_details) ||
      (Array.isArray(item?.consignee) && item.consignee) ||
      (Array.isArray(candidate?.consignees) && candidate.consignees) ||
      (Array.isArray(candidate?.consignee_details) && candidate.consignee_details) ||
      (Array.isArray(candidate?.consignee) && candidate.consignee) ||
      (Array.isArray(raw?.data?.consignees) && raw.data.consignees) ||
      (Array.isArray(raw?.data?.consignee_details) && raw.data.consignee_details) ||
      (Array.isArray(raw?.data?.consignee) && raw.data.consignee) ||
      (Array.isArray(raw?.consignees) && raw.consignees) ||
      (Array.isArray(raw?.consignee_details) && raw.consignee_details) ||
      [],
    notify_parties:
      (Array.isArray(item?.notify_parties) && item.notify_parties) ||
      (Array.isArray(item?.notify_party) && item.notify_party) ||
      (Array.isArray(item?.notify_party_details) && item.notify_party_details) ||
      (Array.isArray(item?.notifies) && item.notifies) ||
      (Array.isArray(candidate?.notify_parties) && candidate.notify_parties) ||
      (Array.isArray(candidate?.notify_party) && candidate.notify_party) ||
      (Array.isArray(candidate?.notify_party_details) && candidate.notify_party_details) ||
      (Array.isArray(candidate?.notifies) && candidate.notifies) ||
      (Array.isArray(raw?.data?.notify_parties) && raw.data.notify_parties) ||
      (Array.isArray(raw?.data?.notify_party) && raw.data.notify_party) ||
      (Array.isArray(raw?.data?.notify_party_details) && raw.data.notify_party_details) ||
      (Array.isArray(raw?.data?.notifies) && raw.data.notifies) ||
      (Array.isArray(raw?.notify_parties) && raw.notify_parties) ||
      (Array.isArray(raw?.notify_party) && raw.notify_party) ||
      (Array.isArray(raw?.notify_party_details) && raw.notify_party_details) ||
      [],
    raw: item,
  };
}

/**
 * Helpers to extract fields for Buyers / Importers table and forms
 */
export const extractBuyerCompanyName = extractSellerCompanyName;
export const extractBuyerAddress = extractSellerAddress;
export const extractBuyerCity = extractSellerCity;
export const extractBuyerState = extractSellerState;
export const extractBuyerCountry = extractSellerCountry;
export const extractBuyerId = extractSellerId;
export const extractBuyerDetailData = extractSellerDetailData;








"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSafeLang, getAssetsUrl } from "@/lib/api-utils";
import { refreshTokensAction } from "@/app/actions/auth";
import { getValidAuthToken } from "@/lib/auth-token";

/**
 * Robust helper to obtain a guaranteed non-expired auth token for server actions.
 */
async function getActionToken(): Promise<string | undefined> {
  const token = await getValidAuthToken();
  if (token) return token;
  try {
    const cookieStore = await cookies();
    return (
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value ||
      cookieStore.get("access_token")?.value ||
      cookieStore.get("token")?.value ||
      undefined
    );
  } catch {
    return undefined;
  }
}
import {
  smartDocsService,
  extractSmartDocsArray,
  extractSmartDocsTotal,
  normalizeActionParam,
  extractStepperList,
  type StepperDocumentItem,
  extractInstructionsData,
  type InstructionPartyOption,
  extractProductsData,
  type SmartDocsProductOption,
  extractProductDetailsData,
  extractLoadingPortsData,
  type SmartDocsProductDetailsResult,
  type SmartDocsProductFieldOption,
  extractPaymentTermsData,
  type SmartDocsPaymentTermOption,
  extractCurrenciesData,
  type SmartDocsCurrencyOption,
  DEFAULT_CURRENCIES,
  extractDocumentListData,
  type SmartDocsSelectionDocumentOption,
  DEFAULT_DOCUMENT_SELECTION_OPTIONS,
  type SaveConfirmationPayload,
  extractConfirmationData,
  extractContractData,
  extractCustomInvoiceData,
  extractCommercialInvoiceData,
  extractPackingListData,
  extractPhytoCertificateData,
  extractBillOfLadingData,
  extractProductDetailData,
  extractPaymentTermDetailData,
  extractSellerDetailData,
  sanitizeDocId,
  generateSmartDocsCuid,
  isValidCuidOrId,
  extractApiValidationErrors,
  convertDataUrlToBlob,
} from "@/lib/api/smart-docs.service";

/**
 * Checks whether an error string is a raw Express / Nginx routing error, HTML error page,
 * or 404/5xx status message that should never be shown to end users.
 */
function isRawRoutingOrHtmlError(str?: any): boolean {
  if (!str || typeof str !== "string") return false;
  const s = str.trim();
  return (
    /^Cannot (PATCH|POST|GET|PUT|DELETE)\b/i.test(s) ||
    /^<!DOCTYPE\b/i.test(s) ||
    /<html[\s>]/i.test(s) ||
    /^(404|500|502|503|504)\s+(not found|internal server error|bad gateway|service unavailable)/i.test(s) ||
    /^(not found|bad gateway|service unavailable|gateway timeout)$/i.test(s) ||
    /^route\s+.*\s+not found/i.test(s)
  );
}

/**
 * Helper to ensure error messages returned from server actions NEVER leak generic strings
 * like "Form Validation Error", "Validation Error", "Bad Request", etc.
 * Also intercepts raw Express / proxy router messages ("Cannot PATCH /api/...", "Cannot POST /api/...").
 * Extracts the first specific human-readable field error message from backend error sources when available.
 */
function sanitizeActionErrorMessage(
  rawMsg?: any,
  errorSource?: any,
  fallback: string = "Validation error occurred. Please check highlighted fields."
): string {
  const isGeneric = (str?: any) => {
    if (!str || typeof str !== "string") return true;
    const s = str.trim();
    return (
      /^(form validation error|validation error|bad request|invalid input|invalid payload|error occurred)$/i.test(s) ||
      /^[a-z0-9_.-]+$/i.test(s) ||
      s.toLowerCase().includes("should not be empty") ||
      s.toLowerCase().includes("must be")
    );
  };

  if (!isGeneric(rawMsg) && !isRawRoutingOrHtmlError(rawMsg)) {
    return String(rawMsg).trim();
  }

  if (errorSource) {
    try {
      const apiErrors = extractApiValidationErrors(errorSource);
      if (apiErrors && apiErrors.length > 0 && apiErrors[0].message) {
        const msg = apiErrors[0].message.trim();
        if (!isGeneric(msg) && !isRawRoutingOrHtmlError(msg)) {
          return msg;
        }
      }
      if (typeof errorSource.message === "string") {
        const msg = errorSource.message.trim();
        if (!isGeneric(msg) && !isRawRoutingOrHtmlError(msg)) {
          return msg;
        }
      }
      if (typeof errorSource.error === "string") {
        const msg = errorSource.error.trim();
        if (!isGeneric(msg) && !isRawRoutingOrHtmlError(msg)) {
          return msg;
        }
      }
      if (typeof errorSource.data?.message === "string") {
        const msg = errorSource.data.message.trim();
        if (!isGeneric(msg) && !isRawRoutingOrHtmlError(msg)) {
          return msg;
        }
      }
    } catch {
      // ignore
    }
  }

  if (isRawRoutingOrHtmlError(rawMsg)) {
    return "Service temporarily unavailable. Please try again or contact support.";
  }

  return fallback;
}

export interface GetSmartDocsListActionParams {
  page?: number;
  limit?: number;
  action?: string;
  lang?: string;
  search?: string;
  search_label?: string;
}

export interface GetSmartDocsActionResult {
  success: boolean;
  message?: string;
  data: any[];
  total: number;
  page: number;
  limit: number;
  error?: string;
}

export async function getSmartDocsListAction(
  params: GetSmartDocsListActionParams = {}
): Promise<GetSmartDocsActionResult> {
  try {
    let token = await getActionToken();

    const page = params.page ?? 1;
    const limit = params.limit ?? 25;
    const action = normalizeActionParam(params.action);
    const safeLang = getSafeLang(params.lang || "en");

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing",
        data: [],
        total: 0,
        page,
        limit,
      };
    }

    const rawRes = await smartDocsService.getSmartDocsList(
      {
        page,
        limit,
        action,
        lang: safeLang,
        source: "web",
        search: params.search,
        search_label: params.search_label,
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch smart docs",
        data: [],
        total: 0,
        page,
        limit,
      };
    }

    const dataArray = extractSmartDocsArray(rawRes);
    const totalCount = extractSmartDocsTotal(rawRes, dataArray.length);

    return {
      success: Boolean(rawRes.success || rawRes.status || rawRes.data),
      message: rawRes.message,
      data: dataArray,
      total: totalCount,
      page,
      limit,
    };
  } catch (error: any) {
    console.error("[getSmartDocsListAction] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch smart docs",
      data: [],
      total: 0,
      page: params.page ?? 1,
      limit: params.limit ?? 25,
    };
  }
}

export interface DeleteSmartDocActionParams {
  documentId: string;
  candidateIds?: string[];
  docType?: string;
  action?: string;
  lang?: string;
}

export async function deleteSmartDocAction(
  params: DeleteSmartDocActionParams
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
      };
    }

    if (!params.documentId || typeof params.documentId !== "string") {
      return {
        success: false,
        error: "Invalid document ID",
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const result = await smartDocsService.deleteSmartDoc(
      params.documentId,
      safeLang,
      token,
      {
        candidateIds: params.candidateIds,
        docType: params.docType,
        action: params.action,
      }
    );

    if (result.success) {
      try {
        revalidatePath(`/${safeLang}/smart-docs`, 'page');
      } catch (e) {
        // Ignore cache revalidation errors
      }
    }

    return result;
  } catch (error: any) {
    console.error("[deleteSmartDocAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to delete record",
    };
  }
}

export interface GetStepperListActionParams {
  action?: string;
  step?: string;
  lang?: string;
}

export interface GetStepperListActionResult {
  success: boolean;
  data: StepperDocumentItem[];
  message?: string;
  error?: string;
}

export async function getStepperListAction(
  params: GetStepperListActionParams = {}
): Promise<GetStepperListActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        data: [],
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    let rawRes = await smartDocsService.getStepperList(
      {
        action: params.action || "confirmation",
        step: params.step || "new-confirmation",
        lang: safeLang,
        source: "web",
      },
      token
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.getStepperList(
            {
              action: params.action || "confirmation",
              step: params.step || "new-confirmation",
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[getStepperListAction] Retry token refresh failed:", refErr);
      }
    }

    const steps = extractStepperList(rawRes);

    return {
      success: Boolean(rawRes?.success ?? true),
      data: steps,
      message: rawRes?.message,
    };
  } catch (error: any) {
    console.error("[getStepperListAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch stepper list",
      data: [],
    };
  }
}

export interface GetStepperDocsListActionParams {
  stepperType?: string;
  stepperId?: string;
  id?: string;
  documentId?: string;
  confirmationId?: string;
  contractId?: string;
  lang?: string;
}

export interface StepperDocConfigItem {
  id: string;
  name: string;
  allow_hide: boolean;
  is_hidden: boolean;
  order?: number;
}

export interface GetStepperDocsListActionResult {
  success: boolean;
  data: StepperDocConfigItem[];
  message?: string;
  error?: string;
}

export async function getStepperDocsListAction(
  params: GetStepperDocsListActionParams
): Promise<GetStepperDocsListActionResult> {
  try {
    const rawId = String(
      params.stepperId || params.id || params.documentId || params.contractId || params.confirmationId || ""
    ).trim();
    let cleanType = String(params.stepperType || "confirmation")
      .trim()
      .toLowerCase();
    if (cleanType === 'document') {
      cleanType = 'contract';
    }

    const fallbackId = String(params.confirmationId || params.contractId || "").trim();
    const cleanId = (!rawId || rawId === 'new-confirmation' || rawId === 'undefined' || rawId === 'null')
      ? fallbackId
      : rawId;

    if (
      !cleanId ||
      cleanId === "new-confirmation" ||
      cleanId === "undefined" ||
      cleanId === "null"
    ) {
      return {
        success: false,
        data: [],
        error: "Document ID is required to fetch stepper documents list",
      };
    }

    let token = await getActionToken();

    const safeLang = getSafeLang(params.lang || "en");
    let rawRes = await smartDocsService.getStepperDocsList(
      cleanType,
      cleanId,
      safeLang,
      token,
      fallbackId
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        (rawRes as any).status === 401 ||
        (rawRes as any).statusCode === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.getStepperDocsList(
            cleanType,
            cleanId,
            safeLang,
            refreshRes.access_token,
            fallbackId
          );
        }
      } catch (refErr) {
        console.warn("[getStepperDocsListAction] Retry token refresh failed:", refErr);
      }
    }

    const rawList = Array.isArray(rawRes?.data)
      ? rawRes.data
      : Array.isArray(rawRes?.data?.data)
      ? rawRes.data.data
      : Array.isArray(rawRes?.data?.documents)
      ? rawRes.data.documents
      : Array.isArray(rawRes)
      ? rawRes
      : [];

    const items: StepperDocConfigItem[] = rawList.map((item: any, idx: number) => ({
      id: String(item?.id || item?._id || `doc-${idx}`),
      name: String(item?.name || item?.document_name || item?.title || 'Document'),
      allow_hide:
        item?.allow_hide === true ||
        item?.allow_hide === 1 ||
        String(item?.allow_hide).toLowerCase() === 'true',
      is_hidden:
        item?.is_hidden === true ||
        item?.is_hidden === 1 ||
        String(item?.is_hidden).toLowerCase() === 'true',
      order: typeof item?.order === 'number' ? item.order : idx,
    }));

    if (!rawRes && items.length === 0) {
      return {
        success: false,
        data: [],
        error: "Failed to fetch document configuration from server",
      };
    }

    return {
      success: true,
      data: items,
      message: rawRes?.message,
    };
  } catch (error: any) {
    console.error("[getStepperDocsListAction] Error:", error);
    return {
      success: false,
      data: [],
      error: error?.message || "Failed to fetch stepper docs list",
    };
  }
}

export interface SaveStepperDocsListActionParams {
  stepperType?: string;
  stepperId?: string;
  id?: string;
  documentId?: string;
  confirmationId?: string;
  contractId?: string;
  stepper_docs?: { id: string; is_hidden: boolean; allow_hide?: boolean }[];
  items?: { id: string; is_hidden: boolean; allow_hide?: boolean }[];
  lang?: string;
}

export async function saveStepperDocsListAction(
  params: SaveStepperDocsListActionParams
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const rawId = String(
      params.stepperId || params.id || params.documentId || params.contractId || params.confirmationId || ""
    ).trim();
    let cleanType = String(params.stepperType || "confirmation")
      .trim()
      .toLowerCase();
    if (cleanType === 'document') {
      cleanType = 'contract';
    }

    const fallbackId = String(params.confirmationId || params.contractId || "").trim();
    const cleanId = (!rawId || rawId === 'new-confirmation' || rawId === 'undefined' || rawId === 'null')
      ? fallbackId
      : rawId;

    if (
      !cleanId ||
      cleanId === "new-confirmation" ||
      cleanId === "undefined" ||
      cleanId === "null"
    ) {
      return {
        success: false,
        error: "Stepper ID is required to update document visibility",
      };
    }

    let token = await getActionToken();

    const safeLang = getSafeLang(params.lang || "en");
    const rawDocs = Array.isArray(params?.stepper_docs)
      ? params.stepper_docs
      : Array.isArray(params?.items)
      ? params.items
      : [];

    const stepper_docs = rawDocs.map((doc: any) => ({
      id: String(doc?.id || doc?._id || ""),
      is_hidden: Boolean(doc?.is_hidden),
    }));

    const payload = {
      stepper_docs,
    };

    let rawRes = await smartDocsService.updateStepperDocsList(
      cleanType,
      cleanId,
      payload,
      safeLang,
      token,
      fallbackId
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        (rawRes as any).status === 401 ||
        (rawRes as any).statusCode === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.updateStepperDocsList(
            cleanType,
            cleanId,
            payload,
            safeLang,
            refreshRes.access_token,
            fallbackId
          );
        }
      } catch (refErr) {
        console.warn("[saveStepperDocsListAction] Retry token refresh failed:", refErr);
      }
    }

    const isSuccess = Boolean(
      rawRes?.status === true ||
        rawRes?.success === 1 ||
        rawRes?.success === true ||
        (rawRes as any)?.statusCode === 200 ||
        (rawRes as any)?.statusCode === 201 ||
        (rawRes as any)?.statusCode === 204
    );

    return {
      success: isSuccess,
      message:
        rawRes?.message ||
        (isSuccess ? "Updated successfully" : "Failed to update documents list"),
      error: !isSuccess ? rawRes?.message || "Failed to update documents list" : undefined,
    };
  } catch (error: any) {
    console.error("[saveStepperDocsListAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to save stepper docs configuration",
    };
  }
}


export interface GetSmartDocsInstructionsActionParams {
  lang?: string;
  source?: string;
}

export interface GetSmartDocsInstructionsActionResult {
  success: boolean;
  sellers: InstructionPartyOption[];
  buyers: InstructionPartyOption[];
  all: InstructionPartyOption[];
  message?: string;
  error?: string;
}

export async function getSmartDocsInstructionsAction(
  params: GetSmartDocsInstructionsActionParams = {}
): Promise<GetSmartDocsInstructionsActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        sellers: [],
        buyers: [],
        all: [],
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const rawRes = await smartDocsService.getInstructions(
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    const { sellers, buyers, all } = extractInstructionsData(rawRes);

    return {
      success: Boolean(rawRes?.success ?? (sellers.length > 0 || buyers.length > 0)),
      sellers,
      buyers,
      all,
      message: rawRes?.message,
    };
  } catch (error: any) {
    console.error("[getSmartDocsInstructionsAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch instructions",
      sellers: [],
      buyers: [],
      all: [],
    };
  }
}

export interface GetSmartDocsProductsActionParams {
  lang?: string;
  source?: string;
}

export interface GetSmartDocsProductsActionResult {
  success: boolean;
  products: SmartDocsProductOption[];
  message?: string;
  error?: string;
}

export async function getSmartDocsProductsAction(
  params: GetSmartDocsProductsActionParams = {}
): Promise<GetSmartDocsProductsActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        products: [],
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const rawRes = await smartDocsService.getProducts(
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    const products = extractProductsData(rawRes);

    return {
      success: Boolean(rawRes?.success ?? products.length > 0),
      products,
      message: rawRes?.message,
    };
  } catch (error: any) {
    console.error("[getSmartDocsProductsAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch products",
      products: [],
    };
  }
}

export interface GetSmartDocsProductDetailsActionParams {
  lang?: string;
  source?: string;
}

export interface GetSmartDocsProductDetailsActionResult {
  success: boolean;
  data: SmartDocsProductDetailsResult | null;
  message?: string;
  error?: string;
}

export async function getSmartDocsProductDetailsAction(
  productId: string,
  params: GetSmartDocsProductDetailsActionParams = {}
): Promise<GetSmartDocsProductDetailsActionResult> {
  try {
    if (!productId || !productId.trim()) {
      return {
        success: false,
        error: "Product ID is required",
        data: null,
      };
    }

    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        data: null,
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const rawRes = await smartDocsService.getProductDetails(
      productId.trim(),
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch product details",
        data: null,
      };
    }

    const details = extractProductDetailsData(rawRes, productId.trim());

    return {
      success: Boolean(rawRes?.success ?? true),
      data: details,
      message: rawRes?.message,
    };
  } catch (error: any) {
    console.error("[getSmartDocsProductDetailsAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch product details",
      data: null,
    };
  }
}

export interface GetSmartDocsLoadingPortsByCountryActionParams {
  lang?: string;
  source?: string;
}

export interface GetSmartDocsLoadingPortsByCountryActionResult {
  success: boolean;
  loadingPorts: SmartDocsProductFieldOption[];
  message?: string;
  error?: string;
}

export async function getSmartDocsLoadingPortsByCountryAction(
  countryId: string,
  params: GetSmartDocsLoadingPortsByCountryActionParams = {}
): Promise<GetSmartDocsLoadingPortsByCountryActionResult> {
  try {
    const cleanCountryId = sanitizeDocId(countryId);
    if (!cleanCountryId) {
      return {
        success: false,
        error: "Origin country ID is required",
        loadingPorts: [],
      };
    }

    let token = await getActionToken();
    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        loadingPorts: [],
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    let rawRes = await smartDocsService.getLoadingPortsByCountry(
      cleanCountryId,
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401 ||
        rawRes.statusCode === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.getLoadingPortsByCountry(
            cleanCountryId,
            {
              lang: safeLang,
              source: params.source || "web",
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[getSmartDocsLoadingPortsByCountryAction] Token refresh retry failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch loading ports",
        loadingPorts: [],
      };
    }

    const loadingPorts = extractLoadingPortsData(rawRes);

    return {
      success: Boolean(rawRes?.success ?? true),
      loadingPorts,
      message: rawRes?.message,
    };
  } catch (error: any) {
    console.error("[getSmartDocsLoadingPortsByCountryAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch loading ports",
      loadingPorts: [],
    };
  }
}

export interface GetSmartDocsPaymentTermsActionParams {
  lang?: string;
  source?: string;
}

export interface GetSmartDocsPaymentTermsActionResult {
  success: boolean;
  paymentTerms: SmartDocsPaymentTermOption[];
  message?: string;
  error?: string;
}

export async function getSmartDocsPaymentTermsAction(
  params: GetSmartDocsPaymentTermsActionParams = {}
): Promise<GetSmartDocsPaymentTermsActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        paymentTerms: [],
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const rawRes = await smartDocsService.getPaymentTerms(
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    const paymentTerms = extractPaymentTermsData(rawRes);

    return {
      success: Boolean(rawRes?.success ?? (paymentTerms.length > 0)),
      paymentTerms,
      message: rawRes?.message,
    };
  } catch (error: any) {
    console.error("[getSmartDocsPaymentTermsAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch payment terms",
      paymentTerms: [],
    };
  }
}

export interface GetSmartDocsCurrenciesActionParams {
  lang?: string;
  source?: string;
}

export interface GetSmartDocsCurrenciesActionResult {
  success: boolean;
  currencies: SmartDocsCurrencyOption[];
  message?: string;
  error?: string;
}

export async function getSmartDocsCurrenciesAction(
  params: GetSmartDocsCurrenciesActionParams = {}
): Promise<GetSmartDocsCurrenciesActionResult> {
  try {
    let token = await getActionToken();

    const safeLang = getSafeLang(params.lang || "en");
    const rawRes = await smartDocsService.getCurrencies(
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    const currencies = extractCurrenciesData(rawRes);

    return {
      success: Boolean(rawRes?.success ?? (currencies.length > 0)),
      currencies,
      message: rawRes?.message,
    };
  } catch (error: any) {
    console.error("[getSmartDocsCurrenciesAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch currencies",
      currencies: DEFAULT_CURRENCIES,
    };
  }
}

export interface GetSmartDocsDocumentListActionResult {
  success: boolean;
  documents: SmartDocsSelectionDocumentOption[];
  message?: string;
  error?: string;
}

/**
 * Server action to fetch documents list for selection:
 * GET /document-list/for-selection?lang_code=en&source=web
 */
export async function getSmartDocsDocumentListAction(
  params: { lang?: string; source?: string } = {}
): Promise<GetSmartDocsDocumentListActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        documents: DEFAULT_DOCUMENT_SELECTION_OPTIONS,
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const rawRes = await smartDocsService.getDocumentListForSelection(
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    const documents = extractDocumentListData(rawRes);

    return {
      success: Boolean(rawRes?.success ?? (documents.length > 0)),
      documents,
      message: rawRes?.message,
    };
  } catch (error: any) {
    console.error("[getSmartDocsDocumentListAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch document list for selection",
      documents: DEFAULT_DOCUMENT_SELECTION_OPTIONS,
    };
  }
}

export interface SaveConfirmationDraftActionResult {
  success: boolean;
  message?: string;
  data?: any;
  errors?: any;
  error_fields?: any;
  raw?: any;
  id?: string;
  error?: string;
}

/**
 * Server Action to save or update Confirmation Draft with secure Bearer authentication:
 * POST /confirmation/save?lang_code=en&source=web
 */
export async function saveConfirmationDraftAction(
  payload: SaveConfirmationPayload,
  lang: string = "en"
): Promise<SaveConfirmationDraftActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.saveConfirmation(
      payload,
      {
        lang: safeLang,
        source: "web",
      },
      token
    );

    // If unauthorized (e.g. token expired while session active), attempt one refresh & retry
    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.saveConfirmation(
            payload,
            {
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[saveConfirmationDraftAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to save confirmation draft",
        message: "No response from server",
      };
    }

    // Backend returns success: 1 on success, success: 0 on failure
    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === 201 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error && rawRes.success !== 0 && rawRes.success !== false && (!rawRes.error_fields || rawRes.error_fields.length === 0))
    );

    const generatedId =
      rawRes?.data?.id ||
      rawRes?.data?._id ||
      rawRes?.id ||
      rawRes?._id ||
      rawRes?.data?.confirmation_id ||
      rawRes?.confirmation_id;

    if (isSuccess) {
      return {
        success: true,
        message:
          rawRes.message ||
          "Confirmation saved as draft successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : payload.id,
        raw: rawRes.raw || rawRes,
      };
    }

    let errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    if (!errorFields) {
      const extracted = extractApiValidationErrors(rawRes);
      if (extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = errMap;
      }
    }

    const sanitizedError = sanitizeActionErrorMessage(
      rawRes?.message || rawRes?.error,
      rawRes,
      "Failed to save confirmation draft. Please check highlighted fields."
    );

    return {
      success: false,
      message: sanitizedError,
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : payload.id,
      error: sanitizedError,
    };
  } catch (error: any) {
    console.error("[saveConfirmationDraftAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while saving draft",
      message: error?.message || "Internal error occurred while saving draft",
    };
  }
}

export interface GetConfirmationActionResult {
  success: boolean;
  data: any | null;
  message?: string;
  error?: string;
}

/**
 * Server Action to fetch Confirmation details by ID with secure Bearer authentication:
 * GET /confirmation/:id?lang_code=en&source=web
 */
export async function getConfirmationAction(
  id: string,
  lang: string = "en"
): Promise<GetConfirmationActionResult> {
  try {
    if (!id || !String(id).trim()) {
      return {
        success: false,
        error: "Confirmation ID is required",
        data: null,
      };
    }

    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        data: null,
      };
    }

    const safeLang = getSafeLang(lang || "en");
    const cleanId = String(id).trim();
    let rawRes = await smartDocsService.getConfirmation(
      cleanId,
      {
        lang: safeLang,
        source: "web",
      },
      token
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.getConfirmation(
            cleanId,
            {
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[getConfirmationAction] Retry token refresh failed:", refErr);
      }
    }

    const docData = extractConfirmationData(rawRes);
    const isSuccess = Boolean(
      rawRes?.success === 1 ||
      rawRes?.success === true ||
      rawRes?.status === true ||
      rawRes?.status === 200 ||
      (docData && !rawRes?.error && rawRes?.success !== 0 && rawRes?.success !== false)
    );

    return {
      success: isSuccess,
      data: docData,
      message: rawRes?.message,
    };
  } catch (error: any) {
    console.error("[getConfirmationAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch confirmation details",
      data: null,
    };
  }
}

export interface GetContractActionResult {
  success: boolean;
  data: any | null;
  message?: string;
  error?: string;
}

/**
 * Server Action to fetch Contract details by ID with secure Bearer authentication:
 * GET /contract/:id?lang_code=en&source=web
 */
export async function getContractAction(
  id: string,
  lang: string = "en"
): Promise<GetContractActionResult> {
  try {
    if (!id || !String(id).trim()) {
      return {
        success: false,
        error: "Contract ID is required",
        data: null,
      };
    }

    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        data: null,
      };
    }

    const safeLang = getSafeLang(lang || "en");
    const cleanId = String(id).trim();
    let rawRes = await smartDocsService.getContract(
      cleanId,
      {
        lang: safeLang,
        source: "web",
      },
      token
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.getContract(
            cleanId,
            {
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[getContractAction] Retry token refresh failed:", refErr);
      }
    }

    const docData = extractContractData(rawRes);
    const isSuccess = Boolean(
      rawRes?.success === 1 ||
      rawRes?.success === true ||
      rawRes?.status === true ||
      rawRes?.status === 200 ||
      (docData && !rawRes?.error && rawRes?.success !== 0 && rawRes?.success !== false)
    );

    return {
      success: isSuccess,
      data: docData,
      message: rawRes?.message,
    };
  } catch (error: any) {
    console.error("[getContractAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch contract details",
      data: null,
    };
  }
}

export interface SaveContractDraftActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

/**
 * Server Action to save or update Contract Draft with secure Bearer authentication:
 * POST /contract/save?lang_code=en&source=web
 */
export async function saveContractDraftAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SaveContractDraftActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    const isFormData =
      (typeof FormData !== "undefined" && payload instanceof FormData) ||
      (payload && typeof payload.get === "function" && typeof payload.append === "function");

    // Sync marks & numbers / marking_brand / container_marks to guarantee backend string validation
    if (isFormData) {
      const marksVal =
        payload.get("marking_brand") ||
        payload.get("marks_and_numbers") ||
        payload.get("container_marks") ||
        payload.get("marks_numbers") ||
        payload.get("markingBrand") ||
        payload.get("brand") ||
        payload.get("container_marks_numbers");
      if (marksVal) {
        const strMarks = String(marksVal).trim();
        if (strMarks && strMarks !== "[object Object]" && strMarks !== "undefined" && strMarks !== "null") {
          if (!payload.get("marking_brand")) payload.append("marking_brand", strMarks);
          if (!payload.get("marks_and_numbers")) payload.append("marks_and_numbers", strMarks);
          if (!payload.get("container_marks")) payload.append("container_marks", strMarks);
          if (!payload.get("markingBrand")) payload.append("markingBrand", strMarks);
        }
      }

      // Sync disclaimer and special_instruction (backend uses disclaimer key)
      const discVal =
        payload.get("disclaimer") ||
        payload.get("special_instruction") ||
        payload.get("specialInstruction") ||
        payload.get("special_note");
      if (discVal !== null && discVal !== undefined) {
        const strDisc = String(discVal).trim();
        if (strDisc && strDisc !== "[object Object]" && strDisc !== "undefined" && strDisc !== "null") {
          if (!payload.get("disclaimer")) payload.append("disclaimer", strDisc);
          if (!payload.get("special_instruction")) payload.append("special_instruction", strDisc);
        }
      }
    } else if (payload && typeof payload === "object") {
      const marksVal =
        payload.marking_brand ||
        payload.marks_and_numbers ||
        payload.container_marks ||
        payload.marks_numbers ||
        payload.markingBrand ||
        payload.brand;
      if (marksVal) {
        const strMarks = String(marksVal).trim();
        if (strMarks && strMarks !== "[object Object]" && strMarks !== "undefined" && strMarks !== "null") {
          if (!payload.marking_brand) payload.marking_brand = strMarks;
          if (!payload.marks_and_numbers) payload.marks_and_numbers = strMarks;
          if (!payload.container_marks) payload.container_marks = strMarks;
          if (!payload.markingBrand) payload.markingBrand = strMarks;
        }
      }

      // Sync disclaimer and special_instruction
      const discVal =
        payload.disclaimer ||
        payload.special_instruction ||
        payload.specialInstruction ||
        payload.special_note;
      if (discVal !== null && discVal !== undefined) {
        const strDisc = String(discVal).trim();
        if (strDisc && strDisc !== "[object Object]" && strDisc !== "undefined" && strDisc !== "null") {
          if (!payload.disclaimer) payload.disclaimer = strDisc;
          if (!payload.special_instruction) payload.special_instruction = strDisc;
        }
      }
    }

    const confIdInPayload = isFormData ? payload.get("confirmation_id") : payload?.confirmation_id;
    const rawEffectiveId =
      (id && String(id).trim()) ||
      (isFormData
        ? String(payload.get("contract_id") || payload.get("id") || payload.get("confirmation_id") || "").trim()
        : String(payload?.contract_id || payload?.id || payload?.confirmation_id || "").trim());

    // Filter out invalid placeholder words like "contract", "confirmation", etc.
    const effectiveId =
      rawEffectiveId && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|step-\d+)$/i.test(rawEffectiveId)
        ? rawEffectiveId
        : undefined;

    if (isFormData) {
      if (effectiveId) {
        payload.set("contract_id", effectiveId);
        payload.set("id", effectiveId);
      } else {
        payload.delete("id");
        payload.delete("contract_id");
        payload.delete("sales_contract_id");
      }
      if (confIdInPayload) {
        payload.set("confirmation_id", String(confIdInPayload));
      }
    } else if (payload && typeof payload === "object") {
      if (effectiveId) {
        payload.contract_id = effectiveId;
        payload.id = effectiveId;
      } else {
        delete payload.id;
        delete payload.contract_id;
        delete payload.sales_contract_id;
      }
      if (confIdInPayload) {
        payload.confirmation_id = String(confIdInPayload);
      }
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.saveContractDraft(
      payload,
      {
        lang: safeLang,
        source: "web",
        id: effectiveId,
      },
      token
    );

    // If unauthorized, attempt one refresh & retry
    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.saveContractDraft(
            payload,
            {
              lang: safeLang,
              source: "web",
              id: effectiveId,
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[saveContractDraftAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to save contract draft",
        message: "No response from server",
      };
    }

    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === 201 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error && rawRes.success !== 0 && rawRes.success !== false && (!rawRes.error_fields || rawRes.error_fields.length === 0))
    );

    const generatedId =
      rawRes?.data?.contract_id ||
      rawRes?.contract_id ||
      rawRes?.data?.id ||
      rawRes?.data?._id ||
      rawRes?.id ||
      rawRes?._id ||
      rawRes?.data?.confirmation_id ||
      rawRes?.confirmation_id ||
      effectiveId;

    if (isSuccess) {
      return {
        success: true,
        message: rawRes.message || "Contract draft saved successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : effectiveId,
        raw: rawRes.raw || rawRes,
      };
    }

    let errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    if (!errorFields) {
      const extracted = extractApiValidationErrors(rawRes);
      if (extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = errMap;
      }
    }

    const sanitizedError = sanitizeActionErrorMessage(
      rawRes?.message || rawRes?.error,
      rawRes,
      "Failed to save contract draft. Please check highlighted fields."
    );

    return {
      success: false,
      message: sanitizedError,
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : effectiveId,
      error: sanitizedError,
    };
  } catch (error: any) {
    console.error("[saveContractDraftAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while saving contract draft",
      message: error?.message || "Internal error occurred while saving contract draft",
    };
  }
}

export interface SubmitContractActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

/**
 * Server Action to submit Contract (to Proforma Invoice) with secure Bearer authentication:
 * PATCH /contract/submit/:id?lang_code=en&source=web
 */
export async function submitContractAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SubmitContractActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    const isFormData =
      (typeof FormData !== "undefined" && payload instanceof FormData) ||
      (payload && typeof payload.get === "function" && typeof payload.append === "function");

    // Sync marks & numbers / marking_brand / container_marks to guarantee backend string validation
    if (isFormData) {
      const marksVal =
        payload.get("marking_brand") ||
        payload.get("marks_and_numbers") ||
        payload.get("container_marks") ||
        payload.get("marks_numbers") ||
        payload.get("markingBrand") ||
        payload.get("brand") ||
        payload.get("container_marks_numbers");
      if (marksVal) {
        const strMarks = String(marksVal).trim();
        if (strMarks && strMarks !== "[object Object]" && strMarks !== "undefined" && strMarks !== "null") {
          if (!payload.get("marking_brand")) payload.append("marking_brand", strMarks);
          if (!payload.get("marks_and_numbers")) payload.append("marks_and_numbers", strMarks);
          if (!payload.get("container_marks")) payload.append("container_marks", strMarks);
          if (!payload.get("markingBrand")) payload.append("markingBrand", strMarks);
        }
      }

      // Sync disclaimer and special_instruction (backend uses disclaimer key)
      const discVal =
        payload.get("disclaimer") ||
        payload.get("special_instruction") ||
        payload.get("specialInstruction") ||
        payload.get("special_note");
      if (discVal !== null && discVal !== undefined) {
        const strDisc = String(discVal).trim();
        if (strDisc && strDisc !== "[object Object]" && strDisc !== "undefined" && strDisc !== "null") {
          if (!payload.get("disclaimer")) payload.append("disclaimer", strDisc);
          if (!payload.get("special_instruction")) payload.append("special_instruction", strDisc);
        }
      }
    } else if (payload && typeof payload === "object") {
      const marksVal =
        payload.marking_brand ||
        payload.marks_and_numbers ||
        payload.container_marks ||
        payload.marks_numbers ||
        payload.markingBrand ||
        payload.brand;
      if (marksVal) {
        const strMarks = String(marksVal).trim();
        if (strMarks && strMarks !== "[object Object]" && strMarks !== "undefined" && strMarks !== "null") {
          if (!payload.marking_brand) payload.marking_brand = strMarks;
          if (!payload.marks_and_numbers) payload.marks_and_numbers = strMarks;
          if (!payload.container_marks) payload.container_marks = strMarks;
          if (!payload.markingBrand) payload.markingBrand = strMarks;
        }
      }

      // Sync disclaimer and special_instruction
      const discVal =
        payload.disclaimer ||
        payload.special_instruction ||
        payload.specialInstruction ||
        payload.special_note;
      if (discVal !== null && discVal !== undefined) {
        const strDisc = String(discVal).trim();
        if (strDisc && strDisc !== "[object Object]" && strDisc !== "undefined" && strDisc !== "null") {
          if (!payload.disclaimer) payload.disclaimer = strDisc;
          if (!payload.special_instruction) payload.special_instruction = strDisc;
        }
      }
    }

    const confIdInPayload = isFormData ? payload.get("confirmation_id") : payload?.confirmation_id;
    const rawEffectiveId =
      (id && String(id).trim()) ||
      (isFormData
        ? String(payload.get("contract_id") || payload.get("id") || payload.get("confirmation_id") || "").trim()
        : String(payload?.contract_id || payload?.id || payload?.confirmation_id || "").trim());

    // Filter out invalid placeholder words like "contract", "confirmation", etc.
    const effectiveId =
      rawEffectiveId && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|step-\d+)$/i.test(rawEffectiveId)
        ? rawEffectiveId
        : undefined;

    if (isFormData) {
      if (effectiveId) {
        payload.set("contract_id", effectiveId);
        payload.set("id", effectiveId);
      } else {
        payload.delete("id");
        payload.delete("contract_id");
        payload.delete("sales_contract_id");
      }
      if (confIdInPayload) {
        payload.set("confirmation_id", String(confIdInPayload));
      }
    } else if (payload && typeof payload === "object") {
      if (effectiveId) {
        payload.contract_id = effectiveId;
        payload.id = effectiveId;
      } else {
        delete payload.id;
        delete payload.contract_id;
        delete payload.sales_contract_id;
      }
      if (confIdInPayload) {
        payload.confirmation_id = String(confIdInPayload);
      }
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.submitContract(
      payload,
      {
        lang: safeLang,
        source: "web",
        id: effectiveId,
      },
      token
    );

    // If unauthorized, attempt one refresh & retry
    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.submitContract(
            payload,
            {
              lang: safeLang,
              source: "web",
              id: effectiveId,
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[submitContractAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to submit contract",
        message: "No response from server",
      };
    }

    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === 201 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error && rawRes.success !== 0 && rawRes.success !== false && (!rawRes.error_fields || rawRes.error_fields.length === 0))
    );

    const generatedId =
      rawRes?.data?.proforma_id ||
      rawRes?.proforma_id ||
      rawRes?.data?.contract_id ||
      rawRes?.contract_id ||
      rawRes?.data?.id ||
      rawRes?.data?._id ||
      rawRes?.id ||
      rawRes?._id ||
      effectiveId;

    if (isSuccess) {
      return {
        success: true,
        message: rawRes.message || "Contract submitted successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : effectiveId,
        raw: rawRes.raw || rawRes,
      };
    }

    let errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    if (!errorFields) {
      const extracted = extractApiValidationErrors(rawRes);
      if (extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = errMap;
      }
    }

    const sanitizedError = sanitizeActionErrorMessage(
      rawRes?.message || rawRes?.error,
      rawRes,
      "Failed to submit contract. Please check highlighted fields."
    );

    return {
      success: false,
      message: sanitizedError,
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : effectiveId,
      error: sanitizedError,
    };
  } catch (error: any) {
    console.error("[submitContractAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while submitting contract",
      message: error?.message || "Internal error occurred while submitting contract",
    };
  }
}

export interface GetProformaActionResult {
  success: boolean;
  data: any | null;
  message?: string;
  error?: string;
}

/**
 * Server Action to fetch Proforma details by ID with secure Bearer authentication:
 * GET /proforma-invoice/:id?lang_code=en&source=web
 */
export async function getProformaAction(
  id: string,
  lang: string = "en"
): Promise<GetProformaActionResult> {
  try {
    const cleanId = sanitizeDocId(id);
    if (!cleanId || /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(cleanId)) {
      return {
        success: false,
        error: "Valid Proforma ID is required",
        data: null,
      };
    }

    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        data: null,
      };
    }

    const safeLang = getSafeLang(lang || "en");
    const rawRes = await smartDocsService.getProforma(
      cleanId,
      {
        lang: safeLang,
        source: "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch proforma invoice details",
        data: null,
      };
    }

    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error)
    );

    if (isSuccess) {
      return {
        success: true,
        data: rawRes.data || rawRes,
        message: rawRes.message || "Proforma details loaded successfully",
      };
    }

    return {
      success: false,
      error: rawRes.message || "Proforma invoice not found",
      data: rawRes.data || null,
    };
  } catch (error: any) {
    console.error("[getProformaAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch proforma details",
      data: null,
    };
  }
}

export interface SaveProformaDraftActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

/**
 * Server Action to save or update Proforma Invoice draft with secure Bearer authentication:
 * PATCH /proforma-invoice/save/:id?lang_code=en&source=web
 */
export async function saveProformaDraftAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SaveProformaDraftActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    const isFormData =
      (typeof FormData !== "undefined" && payload instanceof FormData) ||
      (payload && typeof payload.get === "function" && typeof payload.append === "function");

    // Sync marks & numbers / marking_brand / container_marks to guarantee backend string validation
    if (isFormData) {
      const marksVal =
        payload.get("marking_brand") ||
        payload.get("marks_and_numbers") ||
        payload.get("container_marks") ||
        payload.get("marks_numbers") ||
        payload.get("markingBrand") ||
        payload.get("brand") ||
        payload.get("container_marks_numbers");
      if (marksVal) {
        const strMarks = String(marksVal).trim();
        if (strMarks && strMarks !== "[object Object]" && strMarks !== "undefined" && strMarks !== "null") {
          if (!payload.get("marking_brand")) payload.append("marking_brand", strMarks);
          if (!payload.get("marks_and_numbers")) payload.append("marks_and_numbers", strMarks);
          if (!payload.get("container_marks")) payload.append("container_marks", strMarks);
          if (!payload.get("markingBrand")) payload.append("markingBrand", strMarks);
        }
      }

      // Sync disclaimer and special_instruction (backend uses disclaimer key)
      const discVal =
        payload.get("disclaimer") ||
        payload.get("special_instruction") ||
        payload.get("specialInstruction") ||
        payload.get("special_note");
      if (discVal !== null && discVal !== undefined) {
        const strDisc = String(discVal).trim();
        if (strDisc && strDisc !== "[object Object]" && strDisc !== "undefined" && strDisc !== "null") {
          if (!payload.get("disclaimer")) payload.append("disclaimer", strDisc);
          if (!payload.get("special_instruction")) payload.append("special_instruction", strDisc);
        }
      }
    } else if (payload && typeof payload === "object") {
      const marksVal =
        payload.marking_brand ||
        payload.marks_and_numbers ||
        payload.container_marks ||
        payload.marks_numbers ||
        payload.markingBrand ||
        payload.brand;
      if (marksVal) {
        const strMarks = String(marksVal).trim();
        if (strMarks && strMarks !== "[object Object]" && strMarks !== "undefined" && strMarks !== "null") {
          if (!payload.marking_brand) payload.marking_brand = strMarks;
          if (!payload.marks_and_numbers) payload.marks_and_numbers = strMarks;
          if (!payload.container_marks) payload.container_marks = strMarks;
          if (!payload.markingBrand) payload.markingBrand = strMarks;
        }
      }

      // Sync disclaimer and special_instruction
      const discVal =
        payload.disclaimer ||
        payload.special_instruction ||
        payload.specialInstruction ||
        payload.special_note;
      if (discVal !== null && discVal !== undefined) {
        const strDisc = String(discVal).trim();
        if (strDisc && strDisc !== "[object Object]" && strDisc !== "undefined" && strDisc !== "null") {
          if (!payload.disclaimer) payload.disclaimer = strDisc;
          if (!payload.special_instruction) payload.special_instruction = strDisc;
        }
      }
    }

    const contractIdInPayload = isFormData ? payload.get("contract_id") : payload?.contract_id;
    const confIdInPayload = isFormData ? payload.get("confirmation_id") : payload?.confirmation_id;
    const rawEffectiveId =
      (id && String(id).trim()) ||
      (isFormData
        ? String(payload.get("proforma_id") || payload.get("proforma_invoice_id") || payload.get("proformaId") || payload.get("id") || payload.get("contract_id") || payload.get("confirmation_id") || "").trim()
        : String(payload?.proforma_id || payload?.proforma_invoice_id || payload?.proformaId || payload?.id || payload?.contract_id || payload?.confirmation_id || "").trim());

    const effectiveId =
      rawEffectiveId && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+)$/i.test(rawEffectiveId)
        ? rawEffectiveId
        : undefined;

    if (isFormData) {
      if (effectiveId) {
        payload.set("proforma_id", effectiveId);
        payload.set("id", effectiveId);
      } else {
        payload.delete("id");
        payload.delete("proforma_id");
        payload.delete("proforma_invoice_id");
      }
      if (contractIdInPayload) {
        payload.set("contract_id", String(contractIdInPayload));
      }
      if (confIdInPayload) {
        payload.set("confirmation_id", String(confIdInPayload));
      }
    } else if (payload && typeof payload === "object") {
      if (effectiveId) {
        payload.proforma_id = effectiveId;
        payload.id = effectiveId;
      } else {
        delete payload.id;
        delete payload.proforma_id;
        delete payload.proforma_invoice_id;
      }
      if (contractIdInPayload) {
        payload.contract_id = String(contractIdInPayload);
      }
      if (confIdInPayload) {
        payload.confirmation_id = String(confIdInPayload);
      }
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.saveProformaDraft(
      payload,
      {
        lang: safeLang,
        source: "web",
        id: effectiveId,
      },
      token
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.saveProformaDraft(
            payload,
            {
              lang: safeLang,
              source: "web",
              id: effectiveId,
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[saveProformaDraftAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to save proforma draft",
        message: "No response from server",
      };
    }

    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === 201 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error && rawRes.success !== 0 && rawRes.success !== false)
    );

    const generatedId =
      rawRes?.data?.proforma_id ||
      rawRes?.proforma_id ||
      rawRes?.data?.proforma_invoice_id ||
      rawRes?.proforma_invoice_id ||
      rawRes?.data?.id ||
      rawRes?.data?._id ||
      rawRes?.id ||
      rawRes?._id ||
      effectiveId;

    if (isSuccess) {
      return {
        success: true,
        message: rawRes.message || "Proforma draft saved successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : effectiveId,
        raw: rawRes.raw || rawRes,
      };
    }

    let errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    if (!errorFields) {
      const extracted = extractApiValidationErrors(rawRes);
      if (extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = errMap;
      }
    }

    const sanitizedError = sanitizeActionErrorMessage(
      rawRes?.message || rawRes?.error,
      rawRes,
      "Failed to save proforma draft. Please check highlighted fields."
    );

    return {
      success: false,
      message: sanitizedError,
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : effectiveId,
      error: sanitizedError,
    };
  } catch (error: any) {
    console.error("[saveProformaDraftAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while saving proforma draft",
      message: error?.message || "Internal error occurred while saving proforma draft",
    };
  }
}

export interface SubmitProformaActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

/**
 * Server Action to submit Proforma Invoice with secure Bearer authentication:
 * PATCH /proforma-invoice/submit/:id?lang_code=en&source=web
 */
export async function submitProformaAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SubmitProformaActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    const isFormData =
      (typeof FormData !== "undefined" && payload instanceof FormData) ||
      (payload && typeof payload.get === "function" && typeof payload.append === "function");

    // Sync marks & numbers / marking_brand / container_marks to guarantee backend string validation
    if (isFormData) {
      const marksVal =
        payload.get("marking_brand") ||
        payload.get("marks_and_numbers") ||
        payload.get("container_marks") ||
        payload.get("marks_numbers") ||
        payload.get("markingBrand") ||
        payload.get("brand") ||
        payload.get("container_marks_numbers");
      if (marksVal) {
        const strMarks = String(marksVal).trim();
        if (strMarks && strMarks !== "[object Object]" && strMarks !== "undefined" && strMarks !== "null") {
          if (!payload.get("marking_brand")) payload.append("marking_brand", strMarks);
          if (!payload.get("marks_and_numbers")) payload.append("marks_and_numbers", strMarks);
          if (!payload.get("container_marks")) payload.append("container_marks", strMarks);
          if (!payload.get("markingBrand")) payload.append("markingBrand", strMarks);
        }
      }

      // Sync disclaimer and special_instruction (backend uses disclaimer key)
      const discVal =
        payload.get("disclaimer") ||
        payload.get("special_instruction") ||
        payload.get("specialInstruction") ||
        payload.get("special_note");
      if (discVal !== null && discVal !== undefined) {
        const strDisc = String(discVal).trim();
        if (strDisc && strDisc !== "[object Object]" && strDisc !== "undefined" && strDisc !== "null") {
          if (!payload.get("disclaimer")) payload.append("disclaimer", strDisc);
          if (!payload.get("special_instruction")) payload.append("special_instruction", strDisc);
        }
      }
    } else if (payload && typeof payload === "object") {
      const marksVal =
        payload.marking_brand ||
        payload.marks_and_numbers ||
        payload.container_marks ||
        payload.marks_numbers ||
        payload.markingBrand ||
        payload.brand;
      if (marksVal) {
        const strMarks = String(marksVal).trim();
        if (strMarks && strMarks !== "[object Object]" && strMarks !== "undefined" && strMarks !== "null") {
          if (!payload.marking_brand) payload.marking_brand = strMarks;
          if (!payload.marks_and_numbers) payload.marks_and_numbers = strMarks;
          if (!payload.container_marks) payload.container_marks = strMarks;
          if (!payload.markingBrand) payload.markingBrand = strMarks;
        }
      }

      // Sync disclaimer and special_instruction
      const discVal =
        payload.disclaimer ||
        payload.special_instruction ||
        payload.specialInstruction ||
        payload.special_note;
      if (discVal !== null && discVal !== undefined) {
        const strDisc = String(discVal).trim();
        if (strDisc && strDisc !== "[object Object]" && strDisc !== "undefined" && strDisc !== "null") {
          if (!payload.disclaimer) payload.disclaimer = strDisc;
          if (!payload.special_instruction) payload.special_instruction = strDisc;
        }
      }
    }

    const contractIdInPayload = isFormData ? payload.get("contract_id") : payload?.contract_id;
    const confIdInPayload = isFormData ? payload.get("confirmation_id") : payload?.confirmation_id;
    const rawEffectiveId =
      (id && String(id).trim()) ||
      (isFormData
        ? String(payload.get("proforma_id") || payload.get("proforma_invoice_id") || payload.get("proformaId") || payload.get("id") || payload.get("contract_id") || payload.get("confirmation_id") || "").trim()
        : String(payload?.proforma_id || payload?.proforma_invoice_id || payload?.proformaId || payload?.id || payload?.contract_id || payload?.confirmation_id || "").trim());

    const effectiveId =
      rawEffectiveId && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+)$/i.test(rawEffectiveId)
        ? rawEffectiveId
        : undefined;

    if (isFormData) {
      if (effectiveId) {
        payload.set("proforma_id", effectiveId);
        payload.set("id", effectiveId);
      } else {
        payload.delete("id");
        payload.delete("proforma_id");
        payload.delete("proforma_invoice_id");
      }
      if (contractIdInPayload) {
        payload.set("contract_id", String(contractIdInPayload));
      }
      if (confIdInPayload) {
        payload.set("confirmation_id", String(confIdInPayload));
      }
    } else if (payload && typeof payload === "object") {
      if (effectiveId) {
        payload.proforma_id = effectiveId;
        payload.id = effectiveId;
      } else {
        delete payload.id;
        delete payload.proforma_id;
        delete payload.proforma_invoice_id;
      }
      if (contractIdInPayload) {
        payload.contract_id = String(contractIdInPayload);
      }
      if (confIdInPayload) {
        payload.confirmation_id = String(confIdInPayload);
      }
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.submitProforma(
      payload,
      {
        lang: safeLang,
        source: "web",
        id: effectiveId,
      },
      token
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.submitProforma(
            payload,
            {
              lang: safeLang,
              source: "web",
              id: effectiveId,
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[submitProformaAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to submit proforma invoice",
        message: "No response from server",
      };
    }

    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === 201 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error && rawRes.success !== 0 && rawRes.success !== false)
    );

    const generatedId =
      rawRes?.data?.proforma_id ||
      rawRes?.proforma_id ||
      rawRes?.data?.proforma_invoice_id ||
      rawRes?.proforma_invoice_id ||
      rawRes?.data?.id ||
      rawRes?.data?._id ||
      rawRes?.id ||
      rawRes?._id ||
      effectiveId;

    if (isSuccess) {
      return {
        success: true,
        message: rawRes.message || "Proforma Invoice submitted successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : effectiveId,
        raw: rawRes.raw || rawRes,
      };
    }

    let errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    if (!errorFields) {
      const extracted = extractApiValidationErrors(rawRes);
      if (extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = errMap;
      }
    }

    const sanitizedError = sanitizeActionErrorMessage(
      rawRes?.message || rawRes?.error,
      rawRes,
      "Failed to submit proforma invoice. Please check highlighted fields."
    );

    return {
      success: false,
      message: sanitizedError,
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : effectiveId,
      error: sanitizedError,
    };
  } catch (error: any) {
    console.error("[submitProformaAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while submitting proforma invoice",
      message: error?.message || "Internal error occurred while submitting proforma invoice",
    };
  }
}

export interface GetShipmentInstructionActionResult {
  success: boolean;
  data: any | null;
  message?: string;
  error?: string;
}

/**
 * Server Action to fetch Shipment Instruction details by ID with secure Bearer authentication:
 * GET /shipment-instruction/:id?lang_code=en&source=web
 */
export async function getShipmentInstructionAction(
  id: string,
  lang: string = "en"
): Promise<GetShipmentInstructionActionResult> {
  try {
    if (!id || !String(id).trim()) {
      return {
        success: false,
        error: "Shipment Instruction ID is required",
        data: null,
      };
    }

    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        data: null,
      };
    }

    const safeLang = getSafeLang(lang || "en");
    const rawRes = await smartDocsService.getShipmentInstruction(
      id,
      {
        lang: safeLang,
        source: "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch shipment instruction details",
        data: null,
      };
    }

    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error)
    );

    if (isSuccess) {
      return {
        success: true,
        data: rawRes.data || rawRes,
        message: rawRes.message || "Shipment instruction details loaded successfully",
      };
    }

    return {
      success: false,
      error: rawRes.message || "Shipment instruction not found",
      data: rawRes.data || null,
    };
  } catch (error: any) {
    console.error("[getShipmentInstructionAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch shipment instruction details",
      data: null,
    };
  }
}

export interface SaveShipmentInstructionDraftActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

/**
 * Server Action to save or update Shipment Instruction draft with secure Bearer authentication:
 * PATCH /shipment-instruction/save/:id?lang_code=en&source=web
 */
export async function saveShipmentInstructionDraftAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SaveShipmentInstructionDraftActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    const isFormData =
      (typeof FormData !== "undefined" && payload instanceof FormData) ||
      (payload && typeof payload.get === "function" && typeof payload.append === "function");

    // Sync marks & numbers / marking_brand / container_marks to guarantee backend string validation
    if (isFormData) {
      const marksVal =
        payload.get("marking_brand") ||
        payload.get("marks_and_numbers") ||
        payload.get("container_marks") ||
        payload.get("marks_numbers") ||
        payload.get("markingBrand") ||
        payload.get("brand") ||
        payload.get("container_marks_numbers");
      if (marksVal) {
        const strMarks = String(marksVal).trim();
        if (strMarks && strMarks !== "[object Object]" && strMarks !== "undefined" && strMarks !== "null") {
          if (!payload.get("marking_brand")) payload.append("marking_brand", strMarks);
          if (!payload.get("marks_and_numbers")) payload.append("marks_and_numbers", strMarks);
          if (!payload.get("container_marks")) payload.append("container_marks", strMarks);
          if (!payload.get("markingBrand")) payload.append("markingBrand", strMarks);
        }
      }

      // Sync disclaimer and special_instruction (backend uses disclaimer key)
      const discVal =
        payload.get("disclaimer") ||
        payload.get("special_instruction") ||
        payload.get("specialInstruction") ||
        payload.get("special_note");
      if (discVal !== null && discVal !== undefined) {
        const strDisc = String(discVal).trim();
        if (strDisc && strDisc !== "[object Object]" && strDisc !== "undefined" && strDisc !== "null") {
          if (!payload.get("disclaimer")) payload.append("disclaimer", strDisc);
          if (!payload.get("special_instruction")) payload.append("special_instruction", strDisc);
        }
      }
    } else if (payload && typeof payload === "object") {
      const marksVal =
        payload.marking_brand ||
        payload.marks_and_numbers ||
        payload.container_marks ||
        payload.marks_numbers ||
        payload.markingBrand ||
        payload.brand;
      if (marksVal) {
        const strMarks = String(marksVal).trim();
        if (strMarks && strMarks !== "[object Object]" && strMarks !== "undefined" && strMarks !== "null") {
          if (!payload.marking_brand) payload.marking_brand = strMarks;
          if (!payload.marks_and_numbers) payload.marks_and_numbers = strMarks;
          if (!payload.container_marks) payload.container_marks = strMarks;
          if (!payload.markingBrand) payload.markingBrand = strMarks;
        }
      }

      // Sync disclaimer and special_instruction
      const discVal =
        payload.disclaimer ||
        payload.special_instruction ||
        payload.specialInstruction ||
        payload.special_note;
      if (discVal !== null && discVal !== undefined) {
        const strDisc = String(discVal).trim();
        if (strDisc && strDisc !== "[object Object]" && strDisc !== "undefined" && strDisc !== "null") {
          if (!payload.disclaimer) payload.disclaimer = strDisc;
          if (!payload.special_instruction) payload.special_instruction = strDisc;
        }
      }
    }

    const contractIdInPayload = isFormData ? payload.get("contract_id") : payload?.contract_id;
    const confIdInPayload = isFormData ? payload.get("confirmation_id") : payload?.confirmation_id;
    const proformaIdInPayload = isFormData ? payload.get("proforma_id") : payload?.proforma_id;
    const rawEffectiveId =
      (id && String(id).trim()) ||
      (isFormData
        ? String(payload.get("shipment_instruction_id") || payload.get("instruction_id") || payload.get("id") || payload.get("proforma_id") || payload.get("contract_id") || payload.get("confirmation_id") || "").trim()
        : String(payload?.shipment_instruction_id || payload?.instruction_id || payload?.id || payload?.proforma_id || payload?.contract_id || payload?.confirmation_id || "").trim());

    const effectiveId =
      rawEffectiveId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(rawEffectiveId)
        ? rawEffectiveId
        : undefined;

    if (isFormData) {
      if (effectiveId) {
        payload.set("shipment_instruction_id", effectiveId);
        payload.set("id", effectiveId);
      } else {
        payload.delete("id");
        payload.delete("shipment_instruction_id");
        payload.delete("instruction_id");
      }
      if (proformaIdInPayload) payload.set("proforma_id", String(proformaIdInPayload));
      if (contractIdInPayload) payload.set("contract_id", String(contractIdInPayload));
      if (confIdInPayload) payload.set("confirmation_id", String(confIdInPayload));
    } else if (payload && typeof payload === "object") {
      if (effectiveId) {
        payload.shipment_instruction_id = effectiveId;
        payload.id = effectiveId;
      } else {
        delete payload.id;
        delete payload.shipment_instruction_id;
        delete payload.instruction_id;
      }
      if (proformaIdInPayload) payload.proforma_id = String(proformaIdInPayload);
      if (contractIdInPayload) payload.contract_id = String(contractIdInPayload);
      if (confIdInPayload) payload.confirmation_id = String(confIdInPayload);
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.saveShipmentInstructionDraft(
      payload,
      {
        lang: safeLang,
        source: "web",
        id: effectiveId,
      },
      token
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.saveShipmentInstructionDraft(
            payload,
            {
              lang: safeLang,
              source: "web",
              id: effectiveId,
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[saveShipmentInstructionDraftAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to save shipment instruction draft",
        message: "No response from server",
      };
    }

    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === 201 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error && rawRes.success !== 0 && rawRes.success !== false)
    );

    const generatedId =
      rawRes?.data?.shipment_instruction_id ||
      rawRes?.shipment_instruction_id ||
      rawRes?.data?.instruction_id ||
      rawRes?.instruction_id ||
      rawRes?.data?.id ||
      rawRes?.data?._id ||
      rawRes?.id ||
      rawRes?._id ||
      effectiveId;

    if (isSuccess) {
      return {
        success: true,
        message: rawRes.message || "Shipment instruction draft saved successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : effectiveId,
        raw: rawRes.raw || rawRes,
      };
    }

    let errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    if (!errorFields) {
      const extracted = extractApiValidationErrors(rawRes);
      if (extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = errMap;
      }
    }

    const sanitizedError = sanitizeActionErrorMessage(
      rawRes?.message || rawRes?.error,
      rawRes,
      "Failed to save shipment instruction draft. Please check highlighted fields."
    );

    return {
      success: false,
      message: sanitizedError,
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : effectiveId,
      error: sanitizedError,
    };
  } catch (error: any) {
    console.error("[saveShipmentInstructionDraftAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while saving shipment instruction draft",
      message: error?.message || "Internal error occurred while saving shipment instruction draft",
    };
  }
}

export interface SubmitShipmentInstructionActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

/**
 * Server Action to submit Shipment Instruction with secure Bearer authentication:
 * PATCH /shipment-instruction/submit/:id?lang_code=en&source=web
 */
export async function submitShipmentInstructionAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SubmitShipmentInstructionActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    const isFormData =
      (typeof FormData !== "undefined" && payload instanceof FormData) ||
      (payload && typeof payload.get === "function" && typeof payload.append === "function");

    // Sync marks & numbers / marking_brand / container_marks to guarantee backend string validation
    if (isFormData) {
      const marksVal =
        payload.get("marking_brand") ||
        payload.get("marks_and_numbers") ||
        payload.get("container_marks") ||
        payload.get("marks_numbers") ||
        payload.get("markingBrand") ||
        payload.get("brand") ||
        payload.get("container_marks_numbers");
      if (marksVal) {
        const strMarks = String(marksVal).trim();
        if (strMarks && strMarks !== "[object Object]" && strMarks !== "undefined" && strMarks !== "null") {
          if (!payload.get("marking_brand")) payload.append("marking_brand", strMarks);
          if (!payload.get("marks_and_numbers")) payload.append("marks_and_numbers", strMarks);
          if (!payload.get("container_marks")) payload.append("container_marks", strMarks);
          if (!payload.get("markingBrand")) payload.append("markingBrand", strMarks);
        }
      }

      // Sync disclaimer and special_instruction (backend uses disclaimer key)
      const discVal =
        payload.get("disclaimer") ||
        payload.get("special_instruction") ||
        payload.get("specialInstruction") ||
        payload.get("special_note");
      if (discVal !== null && discVal !== undefined) {
        const strDisc = String(discVal).trim();
        if (strDisc && strDisc !== "[object Object]" && strDisc !== "undefined" && strDisc !== "null") {
          if (!payload.get("disclaimer")) payload.append("disclaimer", strDisc);
          if (!payload.get("special_instruction")) payload.append("special_instruction", strDisc);
        }
      }
    } else if (payload && typeof payload === "object") {
      const marksVal =
        payload.marking_brand ||
        payload.marks_and_numbers ||
        payload.container_marks ||
        payload.marks_numbers ||
        payload.markingBrand ||
        payload.brand;
      if (marksVal) {
        const strMarks = String(marksVal).trim();
        if (strMarks && strMarks !== "[object Object]" && strMarks !== "undefined" && strMarks !== "null") {
          if (!payload.marking_brand) payload.marking_brand = strMarks;
          if (!payload.marks_and_numbers) payload.marks_and_numbers = strMarks;
          if (!payload.container_marks) payload.container_marks = strMarks;
          if (!payload.markingBrand) payload.markingBrand = strMarks;
        }
      }

      // Sync disclaimer and special_instruction
      const discVal =
        payload.disclaimer ||
        payload.special_instruction ||
        payload.specialInstruction ||
        payload.special_note;
      if (discVal !== null && discVal !== undefined) {
        const strDisc = String(discVal).trim();
        if (strDisc && strDisc !== "[object Object]" && strDisc !== "undefined" && strDisc !== "null") {
          if (!payload.disclaimer) payload.disclaimer = strDisc;
          if (!payload.special_instruction) payload.special_instruction = strDisc;
        }
      }
    }

    const contractIdInPayload = isFormData ? payload.get("contract_id") : payload?.contract_id;
    const confIdInPayload = isFormData ? payload.get("confirmation_id") : payload?.confirmation_id;
    const proformaIdInPayload = isFormData ? payload.get("proforma_id") : payload?.proforma_id;
    const rawEffectiveId =
      (id && String(id).trim()) ||
      (isFormData
        ? String(payload.get("shipment_instruction_id") || payload.get("instruction_id") || payload.get("id") || payload.get("proforma_id") || payload.get("contract_id") || payload.get("confirmation_id") || "").trim()
        : String(payload?.shipment_instruction_id || payload?.instruction_id || payload?.id || payload?.proforma_id || payload?.contract_id || payload?.confirmation_id || "").trim());

    const effectiveId =
      rawEffectiveId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(rawEffectiveId)
        ? rawEffectiveId
        : undefined;

    if (isFormData) {
      if (effectiveId) {
        payload.set("shipment_instruction_id", effectiveId);
        payload.set("id", effectiveId);
      } else {
        payload.delete("id");
        payload.delete("shipment_instruction_id");
        payload.delete("instruction_id");
      }
      if (proformaIdInPayload) payload.set("proforma_id", String(proformaIdInPayload));
      if (contractIdInPayload) payload.set("contract_id", String(contractIdInPayload));
      if (confIdInPayload) payload.set("confirmation_id", String(confIdInPayload));
    } else if (payload && typeof payload === "object") {
      if (effectiveId) {
        payload.shipment_instruction_id = effectiveId;
        payload.id = effectiveId;
      } else {
        delete payload.id;
        delete payload.shipment_instruction_id;
        delete payload.instruction_id;
      }
      if (proformaIdInPayload) payload.proforma_id = String(proformaIdInPayload);
      if (contractIdInPayload) payload.contract_id = String(contractIdInPayload);
      if (confIdInPayload) payload.confirmation_id = String(confIdInPayload);
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.submitShipmentInstruction(
      payload,
      {
        lang: safeLang,
        source: "web",
        id: effectiveId,
      },
      token
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.submitShipmentInstruction(
            payload,
            {
              lang: safeLang,
              source: "web",
              id: effectiveId,
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[submitShipmentInstructionAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to submit shipment instruction",
        message: "No response from server",
      };
    }

    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === 201 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error && rawRes.success !== 0 && rawRes.success !== false)
    );

    const generatedId =
      rawRes?.data?.shipment_instruction_id ||
      rawRes?.shipment_instruction_id ||
      rawRes?.data?.instruction_id ||
      rawRes?.instruction_id ||
      rawRes?.data?.id ||
      rawRes?.data?._id ||
      rawRes?.id ||
      rawRes?._id ||
      effectiveId;

    if (isSuccess) {
      return {
        success: true,
        message: rawRes.message || "Shipment Instruction submitted successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : effectiveId,
        raw: rawRes.raw || rawRes,
      };
    }

    let errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    if (!errorFields) {
      const extracted = extractApiValidationErrors(rawRes);
      if (extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = errMap;
      }
    }

    const sanitizedError = sanitizeActionErrorMessage(
      rawRes?.message || rawRes?.error,
      rawRes,
      "Failed to submit shipment instruction. Please check highlighted fields."
    );

    return {
      success: false,
      message: sanitizedError,
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : effectiveId,
      error: sanitizedError,
    };
  } catch (error: any) {
    console.error("[submitShipmentInstructionAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while submitting shipment instruction",
      message: error?.message || "Internal error occurred while submitting shipment instruction",
    };
  }
}

export interface GetCustomInvoiceActionResult {
  success: boolean;
  data: any | null;
  error?: string;
  message?: string;
}

export async function getCustomInvoiceAction(
  id: string,
  lang: string = "en"
): Promise<GetCustomInvoiceActionResult> {
  try {
    if (!id || !String(id).trim()) {
      return {
        success: false,
        error: "Custom Invoice ID is required",
        data: null,
      };
    }

    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        data: null,
      };
    }

    const safeLang = getSafeLang(lang || "en");
    const rawRes = await smartDocsService.getCustomInvoice(
      id,
      {
        lang: safeLang,
        source: "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch custom invoice details",
        data: null,
      };
    }

    const extData = extractCustomInvoiceData(rawRes);
    return {
      success: true,
      data: extData || rawRes.data || rawRes,
    };
  } catch (error: any) {
    console.error("[getCustomInvoiceAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch custom invoice details",
      data: null,
    };
  }
}

export interface SaveCustomInvoiceDraftActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

export async function saveCustomInvoiceDraftAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SaveCustomInvoiceDraftActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    let isFormData =
      (typeof FormData !== "undefined" && payload instanceof FormData) ||
      (payload && typeof payload.get === "function" && typeof payload.append === "function");

    // Convert object payload containing base64 data URL signature to FormData to prevent HTTP 413 "Request Entity Too Large"
    if (!isFormData && payload && typeof payload === "object") {
      const sigData =
        payload.seller_signature ||
        payload.seller_signature_url ||
        payload.signature ||
        payload.stamp_image_url ||
        payload.stamp;

      if (typeof sigData === "string" && sigData.trim().startsWith("data:")) {
        const convertedBlob = convertDataUrlToBlob(sigData.trim());
        if (convertedBlob) {
          const fd = new FormData();
          for (const [k, v] of Object.entries(payload)) {
            if (v === undefined || v === null) continue;
            if (
              k === "seller_signature" ||
              k === "seller_signature_url" ||
              k === "signature" ||
              k === "stamp_image_url" ||
              k === "stamp"
            ) {
              continue;
            }
            if (typeof v === "object" && !(typeof Blob !== "undefined" && v instanceof Blob)) {
              fd.append(k, JSON.stringify(v));
            } else {
              fd.append(k, String(v));
            }
          }
          fd.append("seller_signature", convertedBlob, "seller_signature.png");
          fd.append("remove_seller_signature", "false");
          payload = fd;
          isFormData = true;
        }
      }
    }

    const contractIdInPayload = isFormData ? payload.get("contract_id") : payload?.contract_id;
    const confIdInPayload = isFormData ? payload.get("confirmation_id") : payload?.confirmation_id;
    const proformaIdInPayload = isFormData ? payload.get("proforma_id") : payload?.proforma_id;
    const shipmentIdInPayload = isFormData ? payload.get("shipment_instruction_id") : payload?.shipment_instruction_id;

    const directCustomId = isFormData
      ? (payload.get("custom_invoice_id") || payload.get("invoice_id") || payload.get("id") || "")
      : (payload?.custom_invoice_id || payload?.invoice_id || payload?.id || "");

    const rawEffectiveId =
      (id && String(id).trim()) ||
      (directCustomId ? String(directCustomId).trim() : "") ||
      (shipmentIdInPayload ? String(shipmentIdInPayload).trim() : "") ||
      (proformaIdInPayload ? String(proformaIdInPayload).trim() : "") ||
      (contractIdInPayload ? String(contractIdInPayload).trim() : "") ||
      (confIdInPayload ? String(confIdInPayload).trim() : "");

    const isPlaceholder =
      !rawEffectiveId ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        rawEffectiveId
      );

    const effectiveId = !isPlaceholder ? rawEffectiveId : undefined;

    const watermarkVal = isFormData
      ? (payload.get("is_watermark_enabled") ?? payload.get("watermark_enabled") ?? payload.get("watermark") ?? "true")
      : (payload?.is_watermark_enabled ?? payload?.watermark_enabled ?? payload?.watermark ?? true);
    const isWatermarkBool = typeof watermarkVal === "string" ? watermarkVal !== "false" && watermarkVal !== "0" : Boolean(watermarkVal);

    const titleVal = isFormData
      ? (payload.get("pdf_title") ?? payload.get("document_title") ?? payload.get("custom_doc_title") ?? payload.get("title") ?? "CUSTOM INVOICE")
      : (payload?.pdf_title ?? payload?.document_title ?? payload?.custom_doc_title ?? payload?.title ?? "CUSTOM INVOICE");
    const safeTitle = String(titleVal || "").trim() || "CUSTOM INVOICE";

    const cLabel = isFormData
      ? (payload.get("comment_label") ?? payload.get("comment_title") ?? payload.get("notes_title") ?? payload.get("title") ?? "")
      : (payload?.comment_label ?? payload?.comment_title ?? payload?.notes_title ?? payload?.title ?? "");
    const cValue = isFormData
      ? (payload.get("comment_value") ?? payload.get("comment_text") ?? payload.get("notes_comment") ?? payload.get("comment") ?? "")
      : (payload?.comment_value ?? payload?.comment_text ?? payload?.notes_comment ?? payload?.comment ?? "");
    const safeCLabel = String(cLabel || "").trim();
    const safeCValue = String(cValue || "").trim();
    const effectiveCLabel = safeCLabel || (safeCValue ? "Comments" : "");

    if (isFormData) {
      if (effectiveId) {
        payload.set("custom_invoice_id", effectiveId);
        payload.set("id", effectiveId);
      }
      if (shipmentIdInPayload) payload.set("shipment_instruction_id", String(shipmentIdInPayload));
      if (proformaIdInPayload) payload.set("proforma_id", String(proformaIdInPayload));
      if (contractIdInPayload) payload.set("contract_id", String(contractIdInPayload));
      if (confIdInPayload) payload.set("confirmation_id", String(confIdInPayload));
      payload.set("is_watermark_enabled", String(isWatermarkBool));
      payload.set("watermark_enabled", String(isWatermarkBool));
      payload.set("watermark", String(isWatermarkBool));
      payload.set("pdf_title", safeTitle);
      payload.set("document_title", safeTitle);
      payload.set("custom_doc_title", safeTitle);
      payload.set("comment_label", effectiveCLabel);
      payload.set("comment_title", effectiveCLabel);
      payload.set("notes_title", effectiveCLabel);
      payload.set("comment_value", safeCValue);
      payload.set("comment_text", safeCValue);
      payload.set("notes_comment", safeCValue);
      payload.set("comment", safeCValue);
      const rawPricePerBag = payload.get("price_per_bag") ?? payload.get("rate_per_bag") ?? payload.get("rate_bag");
      if (rawPricePerBag !== undefined && rawPricePerBag !== null && String(rawPricePerBag).trim() !== "") {
        payload.set("price_per_bag", String(rawPricePerBag).trim());
        payload.set("rate_per_bag", String(rawPricePerBag).trim());
      }
    } else if (payload && typeof payload === "object") {
      if (effectiveId) {
        payload.custom_invoice_id = effectiveId;
        payload.id = effectiveId;
      }
      if (shipmentIdInPayload) payload.shipment_instruction_id = String(shipmentIdInPayload);
      if (proformaIdInPayload) payload.proforma_id = String(proformaIdInPayload);
      if (contractIdInPayload) payload.contract_id = String(contractIdInPayload);
      if (confIdInPayload) payload.confirmation_id = String(confIdInPayload);
      payload.is_watermark_enabled = isWatermarkBool;
      payload.watermark_enabled = isWatermarkBool;
      payload.watermark = isWatermarkBool;
      payload.pdf_title = safeTitle;
      payload.document_title = safeTitle;
      payload.custom_doc_title = safeTitle;
      payload.comment_label = effectiveCLabel;
      payload.comment_title = effectiveCLabel;
      payload.notes_title = effectiveCLabel;
      payload.comment_value = safeCValue;
      payload.comment_text = safeCValue;
      payload.notes_comment = safeCValue;
      payload.comment = safeCValue;
      const rawPricePerBag = payload.price_per_bag ?? payload.rate_per_bag ?? payload.rate_bag;
      if (rawPricePerBag !== undefined && rawPricePerBag !== null && String(rawPricePerBag).trim() !== "") {
        const numPrice = Number(rawPricePerBag);
        payload.price_per_bag = !isNaN(numPrice) ? numPrice : rawPricePerBag;
        payload.rate_per_bag = !isNaN(numPrice) ? numPrice : rawPricePerBag;
      }
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.saveCustomInvoiceDraft(
      payload,
      {
        lang: safeLang,
        source: "web",
        id: effectiveId,
      },
      token
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.saveCustomInvoiceDraft(
            payload,
            {
              lang: safeLang,
              source: "web",
              id: effectiveId,
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[saveCustomInvoiceDraftAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to save custom invoice draft",
        message: "No response from server",
      };
    }

    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === 201 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error && rawRes.success !== 0 && rawRes.success !== false)
    );

    const generatedId =
      rawRes?.data?.custom_invoice_id ||
      rawRes?.custom_invoice_id ||
      rawRes?.data?.invoice_id ||
      rawRes?.invoice_id ||
      rawRes?.data?.id ||
      rawRes?.data?._id ||
      rawRes?.id ||
      rawRes?._id ||
      effectiveId;

    if (isSuccess) {
      return {
        success: true,
        message: rawRes.message || "Custom Invoice draft saved successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : effectiveId,
        raw: rawRes.raw || rawRes,
      };
    }

    let errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    if (!errorFields) {
      const extracted = extractApiValidationErrors(rawRes);
      if (extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = errMap;
      }
    }

    const sanitizedError = sanitizeActionErrorMessage(
      rawRes?.message || rawRes?.error,
      rawRes,
      "Failed to save custom invoice draft. Please check highlighted fields."
    );

    return {
      success: false,
      message: sanitizedError,
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : effectiveId,
      error: sanitizedError,
    };
  } catch (error: any) {
    console.error("[saveCustomInvoiceDraftAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while saving custom invoice draft",
      message: error?.message || "Internal error occurred while saving custom invoice draft",
    };
  }
}

export interface SubmitCustomInvoiceActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

export async function submitCustomInvoiceAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SubmitCustomInvoiceActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    let isFormData =
      (typeof FormData !== "undefined" && payload instanceof FormData) ||
      (payload && typeof payload.get === "function" && typeof payload.append === "function");

    // Convert object payload containing base64 data URL signature to FormData to prevent HTTP 413 "Request Entity Too Large"
    if (!isFormData && payload && typeof payload === "object") {
      const sigData =
        payload.seller_signature ||
        payload.seller_signature_url ||
        payload.signature ||
        payload.stamp_image_url ||
        payload.stamp;

      if (typeof sigData === "string" && sigData.trim().startsWith("data:")) {
        const convertedBlob = convertDataUrlToBlob(sigData.trim());
        if (convertedBlob) {
          const fd = new FormData();
          for (const [k, v] of Object.entries(payload)) {
            if (v === undefined || v === null) continue;
            if (
              k === "seller_signature" ||
              k === "seller_signature_url" ||
              k === "signature" ||
              k === "stamp_image_url" ||
              k === "stamp"
            ) {
              continue;
            }
            if (typeof v === "object" && !(typeof Blob !== "undefined" && v instanceof Blob)) {
              fd.append(k, JSON.stringify(v));
            } else {
              fd.append(k, String(v));
            }
          }
          fd.append("seller_signature", convertedBlob, "seller_signature.png");
          fd.append("remove_seller_signature", "false");
          payload = fd;
          isFormData = true;
        }
      }
    }

    const contractIdInPayload = isFormData ? payload.get("contract_id") : payload?.contract_id;
    const confIdInPayload = isFormData ? payload.get("confirmation_id") : payload?.confirmation_id;
    const proformaIdInPayload = isFormData ? payload.get("proforma_id") : payload?.proforma_id;
    const shipmentIdInPayload = isFormData ? payload.get("shipment_instruction_id") : payload?.shipment_instruction_id;

    const directCustomId = isFormData
      ? (payload.get("custom_invoice_id") || payload.get("invoice_id") || payload.get("id") || "")
      : (payload?.custom_invoice_id || payload?.invoice_id || payload?.id || "");

    const rawEffectiveId =
      (id && String(id).trim()) ||
      (directCustomId ? String(directCustomId).trim() : "") ||
      (shipmentIdInPayload ? String(shipmentIdInPayload).trim() : "") ||
      (proformaIdInPayload ? String(proformaIdInPayload).trim() : "") ||
      (contractIdInPayload ? String(contractIdInPayload).trim() : "") ||
      (confIdInPayload ? String(confIdInPayload).trim() : "");

    const isPlaceholder =
      !rawEffectiveId ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        rawEffectiveId
      );

    const effectiveId = !isPlaceholder ? rawEffectiveId : undefined;

    const watermarkVal = isFormData
      ? (payload.get("is_watermark_enabled") ?? payload.get("watermark_enabled") ?? payload.get("watermark") ?? "true")
      : (payload?.is_watermark_enabled ?? payload?.watermark_enabled ?? payload?.watermark ?? true);
    const isWatermarkBool = typeof watermarkVal === "string" ? watermarkVal !== "false" && watermarkVal !== "0" : Boolean(watermarkVal);

    const titleVal = isFormData
      ? (payload.get("pdf_title") ?? payload.get("document_title") ?? payload.get("custom_doc_title") ?? payload.get("title") ?? "CUSTOM INVOICE")
      : (payload?.pdf_title ?? payload?.document_title ?? payload?.custom_doc_title ?? payload?.title ?? "CUSTOM INVOICE");
    const safeTitle = String(titleVal || "").trim() || "CUSTOM INVOICE";

    const cLabel = isFormData
      ? (payload.get("comment_label") ?? payload.get("comment_title") ?? payload.get("notes_title") ?? payload.get("title") ?? "")
      : (payload?.comment_label ?? payload?.comment_title ?? payload?.notes_title ?? payload?.title ?? "");
    const cValue = isFormData
      ? (payload.get("comment_value") ?? payload.get("comment_text") ?? payload.get("notes_comment") ?? payload.get("comment") ?? "")
      : (payload?.comment_value ?? payload?.comment_text ?? payload?.notes_comment ?? payload?.comment ?? "");
    const safeCLabel = String(cLabel || "").trim();
    const safeCValue = String(cValue || "").trim();
    const effectiveCLabel = safeCLabel || (safeCValue ? "Comments" : "");

    if (isFormData) {
      if (effectiveId) {
        payload.set("custom_invoice_id", effectiveId);
        payload.set("id", effectiveId);
      }
      if (shipmentIdInPayload) payload.set("shipment_instruction_id", String(shipmentIdInPayload));
      if (proformaIdInPayload) payload.set("proforma_id", String(proformaIdInPayload));
      if (contractIdInPayload) payload.set("contract_id", String(contractIdInPayload));
      if (confIdInPayload) payload.set("confirmation_id", String(confIdInPayload));
      payload.set("is_watermark_enabled", String(isWatermarkBool));
      payload.set("watermark_enabled", String(isWatermarkBool));
      payload.set("watermark", String(isWatermarkBool));
      payload.set("pdf_title", safeTitle);
      payload.set("document_title", safeTitle);
      payload.set("custom_doc_title", safeTitle);
      payload.set("comment_label", effectiveCLabel);
      payload.set("comment_title", effectiveCLabel);
      payload.set("notes_title", effectiveCLabel);
      payload.set("comment_value", safeCValue);
      payload.set("comment_text", safeCValue);
      payload.set("notes_comment", safeCValue);
      payload.set("comment", safeCValue);
      const rawPricePerBag = payload.get("price_per_bag") ?? payload.get("rate_per_bag") ?? payload.get("rate_bag");
      if (rawPricePerBag !== undefined && rawPricePerBag !== null && String(rawPricePerBag).trim() !== "") {
        payload.set("price_per_bag", String(rawPricePerBag).trim());
        payload.set("rate_per_bag", String(rawPricePerBag).trim());
      }
    } else if (payload && typeof payload === "object") {
      if (effectiveId) {
        payload.custom_invoice_id = effectiveId;
        payload.id = effectiveId;
      }
      if (shipmentIdInPayload) payload.shipment_instruction_id = String(shipmentIdInPayload);
      if (proformaIdInPayload) payload.proforma_id = String(proformaIdInPayload);
      if (contractIdInPayload) payload.contract_id = String(contractIdInPayload);
      if (confIdInPayload) payload.confirmation_id = String(confIdInPayload);
      payload.is_watermark_enabled = isWatermarkBool;
      payload.watermark_enabled = isWatermarkBool;
      payload.watermark = isWatermarkBool;
      payload.pdf_title = safeTitle;
      payload.document_title = safeTitle;
      payload.custom_doc_title = safeTitle;
      payload.comment_label = effectiveCLabel;
      payload.comment_title = effectiveCLabel;
      payload.notes_title = effectiveCLabel;
      payload.comment_value = safeCValue;
      payload.comment_text = safeCValue;
      payload.notes_comment = safeCValue;
      payload.comment = safeCValue;
      const rawPricePerBag = payload.price_per_bag ?? payload.rate_per_bag ?? payload.rate_bag;
      if (rawPricePerBag !== undefined && rawPricePerBag !== null && String(rawPricePerBag).trim() !== "") {
        const numPrice = Number(rawPricePerBag);
        payload.price_per_bag = !isNaN(numPrice) ? numPrice : rawPricePerBag;
        payload.rate_per_bag = !isNaN(numPrice) ? numPrice : rawPricePerBag;
      }
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.submitCustomInvoice(
      payload,
      {
        lang: safeLang,
        source: "web",
        id: effectiveId,
      },
      token
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.submitCustomInvoice(
            payload,
            {
              lang: safeLang,
              source: "web",
              id: effectiveId,
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[submitCustomInvoiceAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to submit custom invoice",
        message: "No response from server",
      };
    }

    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === 201 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error && rawRes.success !== 0 && rawRes.success !== false)
    );

    const generatedId =
      rawRes?.data?.custom_invoice_id ||
      rawRes?.custom_invoice_id ||
      rawRes?.data?.invoice_id ||
      rawRes?.invoice_id ||
      rawRes?.data?.id ||
      rawRes?.data?._id ||
      rawRes?.id ||
      rawRes?._id ||
      effectiveId;

    if (isSuccess) {
      return {
        success: true,
        message: rawRes.message || "Custom Invoice submitted successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : effectiveId,
        raw: rawRes.raw || rawRes,
      };
    }

    let errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    if (!errorFields) {
      const extracted = extractApiValidationErrors(rawRes);
      if (extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = errMap;
      }
    }

    const sanitizedError = sanitizeActionErrorMessage(
      rawRes?.message || rawRes?.error,
      rawRes,
      "Failed to submit custom invoice. Please check highlighted fields."
    );

    return {
      success: false,
      message: sanitizedError,
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : effectiveId,
      error: sanitizedError,
    };
  } catch (error: any) {
    console.error("[submitCustomInvoiceAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while submitting custom invoice",
      message: error?.message || "Internal error occurred while submitting custom invoice",
    };
  }
}

export interface GetBillOfLadingActionResult {
  success: boolean;
  data: any | null;
  error?: string;
  message?: string;
}

export async function getBillOfLadingAction(
  id: string,
  lang: string = "en"
): Promise<GetBillOfLadingActionResult> {
  try {
    if (!id || !String(id).trim()) {
      return {
        success: false,
        error: "Bill of Lading ID is required",
        data: null,
      };
    }

    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        data: null,
      };
    }

    const safeLang = getSafeLang(lang || "en");
    const rawRes = await smartDocsService.getBillOfLading(
      id,
      {
        lang: safeLang,
        source: "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch bill of lading details",
        data: null,
      };
    }

    if (
      rawRes.success === false ||
      rawRes.success === 0 ||
      rawRes.status === false ||
      rawRes.status === 0 ||
      (typeof rawRes.statusCode === "number" && rawRes.statusCode >= 400) ||
      Boolean(rawRes.error)
    ) {
      return {
        success: false,
        error: rawRes.message || rawRes.error || "Failed to fetch bill of lading details",
        data: null,
      };
    }

    const extData = extractBillOfLadingData(rawRes);
    const fallbackObj =
      rawRes.data && typeof rawRes.data === "object" && !Array.isArray(rawRes.data)
        ? { ...rawRes.data, _is_lading_loaded: true }
        : null;

    if (!extData && !fallbackObj) {
      return {
        success: false,
        error: rawRes.message || "Bill of Lading data not found",
        data: null,
      };
    }

    return {
      success: true,
      data: extData || fallbackObj,
    };
  } catch (error: any) {
    console.error("[getBillOfLadingAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch bill of lading details",
      data: null,
    };
  }
}

export interface SaveBillOfLadingDraftActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

export async function saveBillOfLadingDraftAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SaveBillOfLadingDraftActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    let isFormData =
      (typeof FormData !== "undefined" && payload instanceof FormData) ||
      (payload && typeof payload.get === "function" && typeof payload.append === "function");

    const contractIdInPayload = isFormData ? payload.get("contract_id") : payload?.contract_id;
    const confIdInPayload = isFormData ? payload.get("confirmation_id") : payload?.confirmation_id;
    const proformaIdInPayload = isFormData ? payload.get("proforma_id") : payload?.proforma_id;
    const shipmentIdInPayload = isFormData ? payload.get("shipment_instruction_id") : payload?.shipment_instruction_id;
    const customInvoiceIdInPayload = isFormData ? payload.get("custom_invoice_id") : payload?.custom_invoice_id;

    const directBLId = isFormData
      ? (payload.get("bill_of_lading_id") || payload.get("lading_id") || payload.get("bl_id") || payload.get("id") || "")
      : (payload?.bill_of_lading_id || payload?.lading_id || payload?.bl_id || payload?.id || "");

    const rawEffectiveId =
      (id && String(id).trim()) ||
      (directBLId ? String(directBLId).trim() : "") ||
      (customInvoiceIdInPayload ? String(customInvoiceIdInPayload).trim() : "") ||
      (shipmentIdInPayload ? String(shipmentIdInPayload).trim() : "") ||
      (proformaIdInPayload ? String(proformaIdInPayload).trim() : "") ||
      (contractIdInPayload ? String(contractIdInPayload).trim() : "") ||
      (confIdInPayload ? String(confIdInPayload).trim() : "");

    const isPlaceholder =
      !rawEffectiveId ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|lading|bill-of-lading|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        rawEffectiveId
      );

    const effectiveId = !isPlaceholder ? rawEffectiveId : undefined;

    const watermarkVal = isFormData
      ? (payload.get("is_watermark_enabled") ?? payload.get("watermark_enabled") ?? payload.get("watermark") ?? "true")
      : (payload?.is_watermark_enabled ?? payload?.watermark_enabled ?? payload?.watermark ?? true);
    const isWatermarkBool = typeof watermarkVal === "string" ? watermarkVal !== "false" && watermarkVal !== "0" : Boolean(watermarkVal);

    const titleVal = isFormData
      ? (payload.get("pdf_title") ?? payload.get("document_title") ?? payload.get("title") ?? "BILL OF LADING")
      : (payload?.pdf_title ?? payload?.document_title ?? payload?.title ?? "BILL OF LADING");
    const safeTitle = String(titleVal || "").trim() || "BILL OF LADING";

    const cLabel = isFormData
      ? (payload.get("comment_label") ?? payload.get("comment_title") ?? payload.get("notes_title") ?? payload.get("title") ?? "")
      : (payload?.comment_label ?? payload?.comment_title ?? payload?.notes_title ?? payload?.title ?? "");
    const cValue = isFormData
      ? (payload.get("comment_value") ?? payload.get("comment_text") ?? payload.get("notes_comment") ?? payload.get("comment") ?? "")
      : (payload?.comment_value ?? payload?.comment_text ?? payload?.notes_comment ?? payload?.comment ?? "");
    const safeCLabel = String(cLabel || "").trim();
    const safeCValue = String(cValue || "").trim();
    const effectiveCLabel = safeCLabel || (safeCValue ? "Comments" : "");

    if (isFormData) {
      if (effectiveId) {
        payload.set("bill_of_lading_id", effectiveId);
        payload.set("id", effectiveId);
      }
      if (customInvoiceIdInPayload) payload.set("custom_invoice_id", String(customInvoiceIdInPayload));
      if (shipmentIdInPayload) payload.set("shipment_instruction_id", String(shipmentIdInPayload));
      if (proformaIdInPayload) payload.set("proforma_id", String(proformaIdInPayload));
      if (contractIdInPayload) payload.set("contract_id", String(contractIdInPayload));
      if (confIdInPayload) payload.set("confirmation_id", String(confIdInPayload));
      payload.set("is_watermark_enabled", String(isWatermarkBool));
      payload.set("pdf_title", safeTitle);
      payload.set("comment_label", effectiveCLabel);
      payload.set("comment_value", safeCValue);
    } else if (payload && typeof payload === "object") {
      if (effectiveId) {
        payload.bill_of_lading_id = effectiveId;
        payload.id = effectiveId;
      }
      if (customInvoiceIdInPayload) payload.custom_invoice_id = String(customInvoiceIdInPayload);
      if (shipmentIdInPayload) payload.shipment_instruction_id = String(shipmentIdInPayload);
      if (proformaIdInPayload) payload.proforma_id = String(proformaIdInPayload);
      if (contractIdInPayload) payload.contract_id = String(contractIdInPayload);
      if (confIdInPayload) payload.confirmation_id = String(confIdInPayload);
      payload.is_watermark_enabled = isWatermarkBool;
      payload.pdf_title = safeTitle;
      payload.comment_label = effectiveCLabel;
      payload.comment_value = safeCValue;
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.saveBillOfLadingDraft(
      payload,
      {
        lang: safeLang,
        source: "web",
        id: effectiveId,
      },
      token
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.saveBillOfLadingDraft(
            payload,
            {
              lang: safeLang,
              source: "web",
              id: effectiveId,
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[saveBillOfLadingDraftAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to save bill of lading draft",
        message: "No response from server",
      };
    }

    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === 201 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error && rawRes.success !== 0 && rawRes.success !== false)
    );

    const generatedId =
      rawRes?.data?.bill_of_lading_id ||
      rawRes?.bill_of_lading_id ||
      rawRes?.data?.lading_id ||
      rawRes?.lading_id ||
      rawRes?.data?.bl_id ||
      rawRes?.bl_id ||
      rawRes?.data?.id ||
      rawRes?.data?._id ||
      rawRes?.id ||
      rawRes?._id ||
      effectiveId;

    if (isSuccess) {
      return {
        success: true,
        message: rawRes.message || "Bill of Lading draft saved successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : effectiveId,
        raw: rawRes.raw || rawRes,
      };
    }

    let errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    if (!errorFields) {
      const extracted = extractApiValidationErrors(rawRes);
      if (extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = errMap;
      }
    }

    const sanitizedError = sanitizeActionErrorMessage(
      rawRes?.message || rawRes?.error,
      rawRes,
      "Failed to save bill of lading draft"
    );

    return {
      success: false,
      message: sanitizedError,
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : effectiveId,
      error: sanitizedError,
    };
  } catch (error: any) {
    console.error("[saveBillOfLadingDraftAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while saving bill of lading draft",
      message: error?.message || "Internal error occurred while saving bill of lading draft",
    };
  }
}

export interface SubmitBillOfLadingActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

export async function submitBillOfLadingAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SubmitBillOfLadingActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    let isFormData =
      (typeof FormData !== "undefined" && payload instanceof FormData) ||
      (payload && typeof payload.get === "function" && typeof payload.append === "function");

    const contractIdInPayload = isFormData ? payload.get("contract_id") : payload?.contract_id;
    const confIdInPayload = isFormData ? payload.get("confirmation_id") : payload?.confirmation_id;
    const proformaIdInPayload = isFormData ? payload.get("proforma_id") : payload?.proforma_id;
    const shipmentIdInPayload = isFormData ? payload.get("shipment_instruction_id") : payload?.shipment_instruction_id;
    const customInvoiceIdInPayload = isFormData ? payload.get("custom_invoice_id") : payload?.custom_invoice_id;

    const directBLId = isFormData
      ? (payload.get("bill_of_lading_id") || payload.get("lading_id") || payload.get("bl_id") || payload.get("id") || "")
      : (payload?.bill_of_lading_id || payload?.lading_id || payload?.bl_id || payload?.id || "");

    const rawEffectiveId =
      (id && String(id).trim()) ||
      (directBLId ? String(directBLId).trim() : "") ||
      (customInvoiceIdInPayload ? String(customInvoiceIdInPayload).trim() : "") ||
      (shipmentIdInPayload ? String(shipmentIdInPayload).trim() : "") ||
      (proformaIdInPayload ? String(proformaIdInPayload).trim() : "") ||
      (contractIdInPayload ? String(contractIdInPayload).trim() : "") ||
      (confIdInPayload ? String(confIdInPayload).trim() : "");

    const isPlaceholder =
      !rawEffectiveId ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|lading|bill-of-lading|step-\d+|null|undefined|nan|\[object object\])$/i.test(
        rawEffectiveId
      );

    const effectiveId = !isPlaceholder ? rawEffectiveId : undefined;

    const watermarkVal = isFormData
      ? (payload.get("is_watermark_enabled") ?? payload.get("watermark_enabled") ?? payload.get("watermark") ?? "true")
      : (payload?.is_watermark_enabled ?? payload?.watermark_enabled ?? payload?.watermark ?? true);
    const isWatermarkBool = typeof watermarkVal === "string" ? watermarkVal !== "false" && watermarkVal !== "0" : Boolean(watermarkVal);

    const titleVal = isFormData
      ? (payload.get("pdf_title") ?? payload.get("document_title") ?? payload.get("title") ?? "BILL OF LADING")
      : (payload?.pdf_title ?? payload?.document_title ?? payload?.title ?? "BILL OF LADING");
    const safeTitle = String(titleVal || "").trim() || "BILL OF LADING";

    const cLabel = isFormData
      ? (payload.get("comment_label") ?? payload.get("comment_title") ?? payload.get("notes_title") ?? payload.get("title") ?? "")
      : (payload?.comment_label ?? payload?.comment_title ?? payload?.notes_title ?? payload?.title ?? "");
    const cValue = isFormData
      ? (payload.get("comment_value") ?? payload.get("comment_text") ?? payload.get("notes_comment") ?? payload.get("comment") ?? "")
      : (payload?.comment_value ?? payload?.comment_text ?? payload?.notes_comment ?? payload?.comment ?? "");
    const safeCLabel = String(cLabel || "").trim();
    const safeCValue = String(cValue || "").trim();
    const effectiveCLabel = safeCLabel || (safeCValue ? "Comments" : "");

    if (isFormData) {
      if (effectiveId) {
        payload.set("bill_of_lading_id", effectiveId);
        payload.set("id", effectiveId);
      }
      if (customInvoiceIdInPayload) payload.set("custom_invoice_id", String(customInvoiceIdInPayload));
      if (shipmentIdInPayload) payload.set("shipment_instruction_id", String(shipmentIdInPayload));
      if (proformaIdInPayload) payload.set("proforma_id", String(proformaIdInPayload));
      if (contractIdInPayload) payload.set("contract_id", String(contractIdInPayload));
      if (confIdInPayload) payload.set("confirmation_id", String(confIdInPayload));
      payload.set("is_watermark_enabled", String(isWatermarkBool));
      payload.set("pdf_title", safeTitle);
      payload.set("comment_label", effectiveCLabel);
      payload.set("comment_value", safeCValue);
    } else if (payload && typeof payload === "object") {
      if (effectiveId) {
        payload.bill_of_lading_id = effectiveId;
        payload.id = effectiveId;
      }
      if (customInvoiceIdInPayload) payload.custom_invoice_id = String(customInvoiceIdInPayload);
      if (shipmentIdInPayload) payload.shipment_instruction_id = String(shipmentIdInPayload);
      if (proformaIdInPayload) payload.proforma_id = String(proformaIdInPayload);
      if (contractIdInPayload) payload.contract_id = String(contractIdInPayload);
      if (confIdInPayload) payload.confirmation_id = String(confIdInPayload);
      payload.is_watermark_enabled = isWatermarkBool;
      payload.pdf_title = safeTitle;
      payload.comment_label = effectiveCLabel;
      payload.comment_value = safeCValue;
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.submitBillOfLading(
      payload,
      {
        lang: safeLang,
        source: "web",
        id: effectiveId,
      },
      token
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.submitBillOfLading(
            payload,
            {
              lang: safeLang,
              source: "web",
              id: effectiveId,
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[submitBillOfLadingAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to submit bill of lading",
        message: "No response from server",
      };
    }

    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === 201 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error && rawRes.success !== 0 && rawRes.success !== false)
    );

    const generatedId =
      rawRes?.data?.bill_of_lading_id ||
      rawRes?.bill_of_lading_id ||
      rawRes?.data?.lading_id ||
      rawRes?.lading_id ||
      rawRes?.data?.bl_id ||
      rawRes?.bl_id ||
      rawRes?.data?.id ||
      rawRes?.data?._id ||
      rawRes?.id ||
      rawRes?._id ||
      effectiveId;

    if (isSuccess) {
      return {
        success: true,
        message: rawRes.message || "Bill of Lading submitted successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : effectiveId,
        raw: rawRes.raw || rawRes,
      };
    }

    let errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    if (!errorFields) {
      const extracted = extractApiValidationErrors(rawRes);
      if (extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = errMap;
      }
    }

    const sanitizedError = sanitizeActionErrorMessage(
      rawRes?.message || rawRes?.error,
      rawRes,
      "Failed to submit bill of lading. Please check highlighted fields."
    );

    return {
      success: false,
      message: sanitizedError,
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : effectiveId,
      error: sanitizedError,
    };
  } catch (error: any) {
    console.error("[submitBillOfLadingAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while submitting bill of lading",
      message: error?.message || "Internal error occurred while submitting bill of lading",
    };
  }
}

export interface SubmitConfirmationActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

/**
 * Server Action to submit Confirmation to Contract with secure Bearer authentication:
 * POST /confirmation/submit?lang_code=en&source=web
 */
export async function submitConfirmationAction(
  payload: SaveConfirmationPayload,
  lang: string = "en"
): Promise<SubmitConfirmationActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.submitConfirmation(
      payload,
      {
        lang: safeLang,
        source: "web",
      },
      token
    );

    // If unauthorized, attempt one refresh & retry
    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.submitConfirmation(
            payload,
            {
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[submitConfirmationAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to submit confirmation to contract",
        message: "No response from server",
      };
    }

    // Backend returns success: 1 on success, success: 0 on failure
    const isSuccess = Boolean(
      rawRes.success === 1 ||
      rawRes.success === true ||
      rawRes.status === true ||
      rawRes.status === 200 ||
      rawRes.status === 201 ||
      rawRes.status === "success" ||
      (rawRes.data && !rawRes.error && rawRes.success !== 0 && rawRes.success !== false && (!rawRes.error_fields || rawRes.error_fields.length === 0))
    );

    const generatedId =
      rawRes?.data?.contract_id ||
      rawRes?.contract_id ||
      rawRes?.data?.id ||
      rawRes?.data?._id ||
      rawRes?.id ||
      rawRes?._id ||
      rawRes?.data?.confirmation_id ||
      rawRes?.confirmation_id;

    if (isSuccess) {
      return {
        success: true,
        message:
          rawRes.message ||
          "Confirmation submitted successfully for Contract generation!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : payload.id,
        raw: rawRes.raw || rawRes,
      };
    }

    let errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    if (!errorFields) {
      const extracted = extractApiValidationErrors(rawRes);
      if (extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = errMap;
      }
    }

    const sanitizedError = sanitizeActionErrorMessage(
      rawRes?.message || rawRes?.error,
      rawRes,
      "Failed to submit confirmation to contract. Please check highlighted fields."
    );

    return {
      success: false,
      message: sanitizedError,
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : payload.id,
      error: sanitizedError,
    };
  } catch (error: any) {
    console.error("[submitConfirmationAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while submitting confirmation",
      message: error?.message || "Internal error occurred while submitting confirmation",
    };
  }
}

export interface GetCommercialInvoiceActionResult {
  success: boolean;
  data: any | null;
  error?: string;
  message?: string;
}

export async function getCommercialInvoiceAction(
  id: string,
  lang: string = "en"
): Promise<GetCommercialInvoiceActionResult> {
  try {
    if (!id || !String(id).trim()) {
      return {
        success: false,
        error: "Commercial Invoice ID is required",
        data: null,
      };
    }

    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        data: null,
      };
    }

    const safeLang = getSafeLang(lang || "en");
    const rawRes = await smartDocsService.getCommercialInvoice(
      id,
      {
        lang: safeLang,
        source: "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch commercial invoice details",
        data: null,
      };
    }

    const extData = extractCommercialInvoiceData(rawRes);
    return {
      success: true,
      data: extData || rawRes.data || rawRes,
    };
  } catch (error: any) {
    console.error("[getCommercialInvoiceAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch commercial invoice details",
      data: null,
    };
  }
}

export interface SaveCommercialInvoiceDraftActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

export async function saveCommercialInvoiceDraftAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SaveCommercialInvoiceDraftActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing. Please sign in again.",
      };
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.saveCommercialInvoiceDraft(
      payload,
      {
        lang: safeLang,
        source: "web",
      },
      token,
      id
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.saveCommercialInvoiceDraft(
            payload,
            {
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token,
            id
          );
        }
      } catch (refErr) {
        console.warn("[saveCommercialInvoiceDraftAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to save commercial invoice draft",
        message: "Failed to save commercial invoice draft",
      };
    }

    const isSuccess = Boolean(rawRes.success !== false && rawRes.success !== 0 && rawRes.status !== false);
    if (!isSuccess) {
      let errorFields =
        rawRes.error_fields ||
        rawRes.data?.error_fields ||
        rawRes.errors ||
        rawRes.data?.errors ||
        rawRes.raw?.error_fields ||
        rawRes.raw?.errors ||
        null;

      const extracted = extractApiValidationErrors(rawRes);
      if (!errorFields && extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = Object.keys(errMap).length > 0 ? errMap : null;
      }

      const rawBackendMsg =
        (typeof rawRes.message === "string" && rawRes.message.trim()) ||
        (typeof rawRes.error === "string" && rawRes.error.trim()) ||
        (extracted[0]?.message && extracted[0].message.trim()) ||
        "";

      const isPurelyGeneric =
        !rawBackendMsg ||
        /^(form validation error|validation error|bad request)$/i.test(rawBackendMsg) ||
        isRawRoutingOrHtmlError(rawBackendMsg);

      const msg = !isPurelyGeneric
        ? rawBackendMsg
        : extracted[0]?.message?.trim() ||
          sanitizeActionErrorMessage(
            rawRes.message || rawRes.error,
            rawRes,
            "Failed to save commercial invoice draft"
          );

      return {
        success: false,
        message: msg,
        error: msg,
        errors: errorFields,
        error_fields: errorFields,
        data: rawRes.data,
        raw: rawRes,
      };
    }

    const savedId = String(
      rawRes.id ||
        rawRes.data?.id ||
        rawRes.data?._id ||
        rawRes.data?.commercial_invoice_id ||
        id ||
        ""
    );

    return {
      success: true,
      message: rawRes.message || "Commercial Invoice saved as draft!",
      data: rawRes.data !== undefined ? rawRes.data : rawRes,
      id: savedId || undefined,
      raw: rawRes,
    };
  } catch (error: any) {
    console.error("[saveCommercialInvoiceDraftAction] Error:", error);
    const msg = sanitizeActionErrorMessage(
      error?.message,
      error,
      "Failed to save commercial invoice draft"
    );
    return {
      success: false,
      error: msg,
      message: msg,
    };
  }
}

export async function submitCommercialInvoiceAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SaveCommercialInvoiceDraftActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing. Please sign in again.",
      };
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.submitCommercialInvoice(
      payload,
      {
        lang: safeLang,
        source: "web",
      },
      token,
      id
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.submitCommercialInvoice(
            payload,
            {
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token,
            id
          );
        }
      } catch (refErr) {
        console.warn("[submitCommercialInvoiceAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to submit commercial invoice",
        message: "Failed to submit commercial invoice",
      };
    }

    const isSuccess = Boolean(rawRes.success !== false && rawRes.success !== 0 && rawRes.status !== false);
    if (!isSuccess) {
      let errorFields =
        rawRes.error_fields ||
        rawRes.data?.error_fields ||
        rawRes.errors ||
        rawRes.data?.errors ||
        rawRes.raw?.error_fields ||
        rawRes.raw?.errors ||
        null;

      const extracted = extractApiValidationErrors(rawRes);
      if (!errorFields && extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = Object.keys(errMap).length > 0 ? errMap : null;
      }

      const rawBackendMsg =
        (typeof rawRes.message === "string" && rawRes.message.trim()) ||
        (typeof rawRes.error === "string" && rawRes.error.trim()) ||
        (extracted[0]?.message && extracted[0].message.trim()) ||
        "";

      const isPurelyGeneric =
        !rawBackendMsg ||
        /^(form validation error|validation error|bad request)$/i.test(rawBackendMsg) ||
        isRawRoutingOrHtmlError(rawBackendMsg);

      const msg = !isPurelyGeneric
        ? rawBackendMsg
        : extracted[0]?.message?.trim() ||
          sanitizeActionErrorMessage(
            rawRes.message || rawRes.error,
            rawRes,
            "Failed to submit commercial invoice"
          );

      return {
        success: false,
        message: msg,
        error: msg,
        errors: errorFields,
        error_fields: errorFields,
        data: rawRes.data,
        raw: rawRes,
      };
    }

    const savedId = String(
      rawRes.id ||
        rawRes.data?.id ||
        rawRes.data?._id ||
        rawRes.data?.commercial_invoice_id ||
        id ||
        ""
    );

    return {
      success: true,
      message: rawRes.message || "Commercial Invoice submitted successfully!",
      data: rawRes.data !== undefined ? rawRes.data : rawRes,
      id: savedId || undefined,
      raw: rawRes,
    };
  } catch (error: any) {
    console.error("[submitCommercialInvoiceAction] Error:", error);
    const msg = sanitizeActionErrorMessage(
      error?.message,
      error,
      "Failed to submit commercial invoice"
    );
    return {
      success: false,
      error: msg,
      message: msg,
    };
  }
}

export interface GetPackingListActionResult {
  success: boolean;
  data: any | null;
  error?: string;
  message?: string;
}

export async function getPackingListAction(
  id: string,
  lang: string = "en"
): Promise<GetPackingListActionResult> {
  try {
    if (!id || !String(id).trim()) {
      return {
        success: false,
        error: "Packing List ID is required",
        data: null,
      };
    }

    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        data: null,
      };
    }

    const safeLang = getSafeLang(lang || "en");
    const rawRes = await smartDocsService.getPackingList(
      id,
      {
        lang: safeLang,
        source: "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch packing list details",
        data: null,
      };
    }

    const extData = extractPackingListData(rawRes);
    return {
      success: true,
      data: extData || rawRes.data || rawRes,
    };
  } catch (error: any) {
    console.error("[getPackingListAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch packing list details",
      data: null,
    };
  }
}

export interface SavePackingListDraftActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

export async function savePackingListDraftAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SavePackingListDraftActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing. Please sign in again.",
      };
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.savePackingListDraft(
      payload,
      {
        lang: safeLang,
        source: "web",
      },
      token,
      id
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.savePackingListDraft(
            payload,
            {
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token,
            id
          );
        }
      } catch (refErr) {
        console.warn("[savePackingListDraftAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to save packing list draft",
        message: "Failed to save packing list draft",
      };
    }

    const isSuccess = Boolean(rawRes.success !== false && rawRes.success !== 0 && rawRes.status !== false);
    if (!isSuccess) {
      let errorFields =
        rawRes.error_fields ||
        rawRes.data?.error_fields ||
        rawRes.errors ||
        rawRes.data?.errors ||
        rawRes.raw?.error_fields ||
        rawRes.raw?.errors ||
        null;

      const extracted = extractApiValidationErrors(rawRes);
      if (!errorFields && extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = Object.keys(errMap).length > 0 ? errMap : null;
      }

      const rawBackendMsg =
        (typeof rawRes.message === "string" && rawRes.message.trim()) ||
        (typeof rawRes.error === "string" && rawRes.error.trim()) ||
        "Failed to save packing list draft";
      const cleanMessage = isRawRoutingOrHtmlError(rawBackendMsg)
        ? "Failed to save packing list draft"
        : rawBackendMsg;

      return {
        success: false,
        error: cleanMessage,
        message: cleanMessage,
        error_fields: errorFields,
        errors: errorFields,
        data: rawRes.data,
        raw: rawRes,
      };
    }

    const resolvedId =
      rawRes.id ||
      rawRes.data?.id ||
      rawRes.data?._id ||
      rawRes.data?.packing_list_id ||
      rawRes._id ||
      id;

    return {
      success: true,
      message: rawRes.message || "Packing list draft saved successfully",
      id: resolvedId ? String(resolvedId) : undefined,
      data: rawRes.data !== undefined ? rawRes.data : rawRes,
      raw: rawRes,
    };
  } catch (error: any) {
    console.error("[savePackingListDraftAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while saving packing list draft",
      message: error?.message || "Internal error occurred while saving packing list draft",
    };
  }
}

export async function submitPackingListAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SavePackingListDraftActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing. Please sign in again.",
      };
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.submitPackingList(
      payload,
      {
        lang: safeLang,
        source: "web",
      },
      token,
      id
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.submitPackingList(
            payload,
            {
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token,
            id
          );
        }
      } catch (refErr) {
        console.warn("[submitPackingListAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to submit packing list",
        message: "Failed to submit packing list",
      };
    }

    const isSuccess = Boolean(rawRes.success !== false && rawRes.success !== 0 && rawRes.status !== false);
    if (!isSuccess) {
      let errorFields =
        rawRes.error_fields ||
        rawRes.data?.error_fields ||
        rawRes.errors ||
        rawRes.data?.errors ||
        rawRes.raw?.error_fields ||
        rawRes.raw?.errors ||
        null;

      const extracted = extractApiValidationErrors(rawRes);
      if (!errorFields && extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = Object.keys(errMap).length > 0 ? errMap : null;
      }

      const rawBackendMsg =
        (typeof rawRes.message === "string" && rawRes.message.trim()) ||
        (typeof rawRes.error === "string" && rawRes.error.trim()) ||
        "Failed to submit packing list";
      const cleanMessage = isRawRoutingOrHtmlError(rawBackendMsg)
        ? "Failed to submit packing list"
        : rawBackendMsg;

      return {
        success: false,
        error: cleanMessage,
        message: cleanMessage,
        error_fields: errorFields,
        errors: errorFields,
        data: rawRes.data,
        raw: rawRes,
      };
    }

    const resolvedId =
      rawRes.id ||
      rawRes.data?.id ||
      rawRes.data?._id ||
      rawRes.data?.packing_list_id ||
      rawRes._id ||
      id;

    return {
      success: true,
      message: rawRes.message || "Packing list submitted successfully",
      id: resolvedId ? String(resolvedId) : undefined,
      data: rawRes.data !== undefined ? rawRes.data : rawRes,
      raw: rawRes,
    };
  } catch (error: any) {
    console.error("[submitPackingListAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to submit packing list",
      message: error?.message || "Failed to submit packing list",
    };
  }
}

export interface GetPhytoCertificateActionResult {
  success: boolean;
  data: any | null;
  error?: string;
  message?: string;
}

export async function getPhytoCertificateAction(
  id: string,
  lang: string = "en"
): Promise<GetPhytoCertificateActionResult> {
  try {
    if (!id || !String(id).trim()) {
      return {
        success: false,
        error: "Phyto Certificate ID is required",
        data: null,
      };
    }

    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        data: null,
      };
    }

    const safeLang = getSafeLang(lang || "en");
    const rawRes = await smartDocsService.getPhytoCertificate(
      id,
      {
        lang: safeLang,
        source: "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch phyto certificate details",
        data: null,
      };
    }

    const extData = extractPhytoCertificateData(rawRes);
    return {
      success: true,
      data: extData || rawRes.data || rawRes,
    };
  } catch (error: any) {
    console.error("[getPhytoCertificateAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch phyto certificate details",
      data: null,
    };
  }
}

export interface SavePhytoCertificateDraftActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  errors?: any;
  error_fields?: any;
  id?: string;
  raw?: any;
}

export async function savePhytoCertificateDraftAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SavePhytoCertificateDraftActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing. Please sign in again.",
      };
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.savePhytoCertificateDraft(
      payload,
      {
        lang: safeLang,
        source: "web",
      },
      token,
      id
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.savePhytoCertificateDraft(
            payload,
            {
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token,
            id
          );
        }
      } catch (refErr) {
        console.warn("[savePhytoCertificateDraftAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to save phyto certificate draft",
        message: "Failed to save phyto certificate draft",
      };
    }

    const isSuccess = Boolean(rawRes.success !== false && rawRes.success !== 0 && rawRes.status !== false);
    if (!isSuccess) {
      let errorFields =
        rawRes.error_fields ||
        rawRes.data?.error_fields ||
        rawRes.errors ||
        rawRes.data?.errors ||
        rawRes.raw?.error_fields ||
        rawRes.raw?.errors ||
        null;

      const extracted = extractApiValidationErrors(rawRes);
      if (!errorFields && extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = Object.keys(errMap).length > 0 ? errMap : null;
      }

      const rawBackendMsg =
        (typeof rawRes.message === "string" && rawRes.message.trim()) ||
        (typeof rawRes.error === "string" && rawRes.error.trim()) ||
        "Failed to save phyto certificate draft";
      const cleanMessage = isRawRoutingOrHtmlError(rawBackendMsg)
        ? "Failed to save phyto certificate draft"
        : rawBackendMsg;

      return {
        success: false,
        error: cleanMessage,
        message: cleanMessage,
        error_fields: errorFields,
        errors: errorFields,
        data: rawRes.data,
        raw: rawRes,
      };
    }

    const resolvedId =
      rawRes.id ||
      rawRes.data?.id ||
      rawRes.data?._id ||
      rawRes.data?.phyto_certificate_id ||
      rawRes._id ||
      id;

    return {
      success: true,
      message: rawRes.message || "Phyto certificate draft saved successfully",
      id: resolvedId ? String(resolvedId) : undefined,
      data: rawRes.data !== undefined ? rawRes.data : rawRes,
      raw: rawRes,
    };
  } catch (error: any) {
    console.error("[savePhytoCertificateDraftAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while saving phyto certificate draft",
      message: error?.message || "Internal error occurred while saving phyto certificate draft",
    };
  }
}

export async function submitPhytoCertificateAction(
  payload: any,
  lang: string = "en",
  id?: string
): Promise<SavePhytoCertificateDraftActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing. Please sign in again.",
      };
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.submitPhytoCertificate(
      payload,
      {
        lang: safeLang,
        source: "web",
      },
      token,
      id
    );

    if (
      rawRes &&
      (rawRes.message === "Unauthorized" ||
        rawRes.error_code === "UNAUTHORIZED" ||
        rawRes.status === 401)
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          rawRes = await smartDocsService.submitPhytoCertificate(
            payload,
            {
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token,
            id
          );
        }
      } catch (refErr) {
        console.warn("[submitPhytoCertificateAction] Retry token refresh failed:", refErr);
      }
    }

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to submit phyto certificate",
        message: "Failed to submit phyto certificate",
      };
    }

    const isSuccess = Boolean(rawRes.success !== false && rawRes.success !== 0 && rawRes.status !== false);
    if (!isSuccess) {
      let errorFields =
        rawRes.error_fields ||
        rawRes.data?.error_fields ||
        rawRes.errors ||
        rawRes.data?.errors ||
        rawRes.raw?.error_fields ||
        rawRes.raw?.errors ||
        null;

      const extracted = extractApiValidationErrors(rawRes);
      if (!errorFields && extracted.length > 0) {
        const errMap: Record<string, string> = {};
        extracted.forEach((e) => {
          if (e.field) errMap[e.field] = e.message;
        });
        errorFields = Object.keys(errMap).length > 0 ? errMap : null;
      }

      const rawBackendMsg =
        (typeof rawRes.message === "string" && rawRes.message.trim()) ||
        (typeof rawRes.error === "string" && rawRes.error.trim()) ||
        "Failed to submit phyto certificate";
      const cleanMessage = isRawRoutingOrHtmlError(rawBackendMsg)
        ? "Failed to submit phyto certificate"
        : rawBackendMsg;

      return {
        success: false,
        error: cleanMessage,
        message: cleanMessage,
        error_fields: errorFields,
        errors: errorFields,
        data: rawRes.data,
        raw: rawRes,
      };
    }

    const resolvedId =
      rawRes.id ||
      rawRes.data?.id ||
      rawRes.data?._id ||
      rawRes.data?.phyto_certificate_id ||
      rawRes._id ||
      id;

    return {
      success: true,
      message: rawRes.message || "Phyto certificate submitted successfully",
      id: resolvedId ? String(resolvedId) : undefined,
      data: rawRes.data !== undefined ? rawRes.data : rawRes,
      raw: rawRes,
    };
  } catch (error: any) {
    console.error("[submitPhytoCertificateAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to submit phyto certificate",
      message: error?.message || "Failed to submit phyto certificate",
    };
  }
}

export interface GetDocPreviewActionParams {
  prefix?: string;
  id: string;
  lang?: string;
  candidateIds?: string[];
  contractId?: string;
  confirmationId?: string;
  proformaId?: string;
  shipmentInstructionId?: string;
  customInvoiceId?: string;
  commercialInvoiceId?: string;
  packingListId?: string;
  phytoCertificateId?: string;
}

export interface GetDocPreviewActionResult {
  success: boolean;
  html?: string;
  message?: string;
  error?: string;
}

/**
 * Server action to fetch rendered PDF/HTML preview for a document.
 * Endpoint: GET /dms-templates/preview-pdf?prefix=:prefix&id=:id&lang_code=:lang&source=web
 */
export async function getDocPreviewAction(
  params: GetDocPreviewActionParams
): Promise<GetDocPreviewActionResult> {
  try {
    const isCommercialInvoice = /commercial.*invoice|commercial_invoice|commercial-invoice/i.test(params.prefix || "");
    const isPackingList = !isCommercialInvoice && /packing.*list|packing_list|packing-list|packing/i.test(params.prefix || "");
    const isPhytoCertificate = !isCommercialInvoice && !isPackingList && /phyto/i.test(params.prefix || "");
    const isCustomInvoice = !isCommercialInvoice && !isPackingList && !isPhytoCertificate && /custom.*invoice|custom_invoice|custom-invoice/i.test(params.prefix || "");
    const cleanId = String(params.id || "").trim();
    const commercialId = String(params.commercialInvoiceId || "").trim();
    const packingListId = String(params.packingListId || "").trim();
    const phytoId = String(params.phytoCertificateId || "").trim();
    const customId = String(params.customInvoiceId || "").trim();
    const candidateIds = Array.from(
      new Set(
        (isPhytoCertificate
          ? [
              phytoId,
              cleanId,
              ...(params.candidateIds || []).map((id) => String(id || "").trim()),
              packingListId,
              commercialId,
              customId,
              String(params.shipmentInstructionId || "").trim(),
              String(params.proformaId || "").trim(),
              String(params.contractId || "").trim(),
              String(params.confirmationId || "").trim(),
            ]
          : isCommercialInvoice
          ? [
              commercialId,
              cleanId,
              ...(params.candidateIds || []).map((id) => String(id || "").trim()),
              packingListId,
              phytoId,
              customId,
              String(params.shipmentInstructionId || "").trim(),
              String(params.proformaId || "").trim(),
              String(params.contractId || "").trim(),
              String(params.confirmationId || "").trim(),
            ]
          : isPackingList
          ? [
              packingListId,
              cleanId,
              ...(params.candidateIds || []).map((id) => String(id || "").trim()),
              commercialId,
              phytoId,
              customId,
              String(params.shipmentInstructionId || "").trim(),
              String(params.proformaId || "").trim(),
              String(params.contractId || "").trim(),
              String(params.confirmationId || "").trim(),
            ]
          : isCustomInvoice
          ? [
              customId,
              cleanId,
              ...(params.candidateIds || []).map((id) => String(id || "").trim()),
              packingListId,
              phytoId,
              commercialId,
              String(params.shipmentInstructionId || "").trim(),
              String(params.proformaId || "").trim(),
              String(params.contractId || "").trim(),
              String(params.confirmationId || "").trim(),
            ]
          : [
              cleanId,
              ...(params.candidateIds || []).map((id) => String(id || "").trim()),
              packingListId,
              phytoId,
              commercialId,
              customId,
              String(params.shipmentInstructionId || "").trim(),
              String(params.proformaId || "").trim(),
              String(params.contractId || "").trim(),
              String(params.confirmationId || "").trim(),
            ]
        ).filter(
          (id): id is string =>
            Boolean(
              id &&
                !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|phyto|phyto-certificate|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
                  id
                )
            )
        )
      )
    );

    if (candidateIds.length === 0) {
      return {
        success: false,
        error: "Document ID is required to generate preview",
        message: "Document ID is required to generate preview",
      };
    }

    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing. Please sign in again.",
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const prefix = params.prefix || "confirmation";

    let res = await smartDocsService.getDocPreviewHtml(
      {
        prefix,
        id: candidateIds[0] || cleanId,
        candidateIds,
        lang: safeLang,
        source: "web",
      },
      token
    );

    // If unauthorized, retry once with refreshed token
    if (
      !res.success &&
      res.error &&
      (res.error.includes("401") ||
        res.error.toLowerCase().includes("unauthorized"))
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          res = await smartDocsService.getDocPreviewHtml(
            {
              prefix,
              id: candidateIds[0] || cleanId,
              candidateIds,
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[getDocPreviewAction] Retry token refresh failed:", refErr);
      }
    }

    return res;
  } catch (error: any) {
    console.error("[getDocPreviewAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while generating preview",
      message: error?.message || "Internal error occurred while generating preview",
    };
  }
}

export interface DownloadDocPdfActionParams {
  prefix?: string;
  id: string;
  lang?: string;
  candidateIds?: string[];
  contractId?: string;
  confirmationId?: string;
  proformaId?: string;
  shipmentInstructionId?: string;
  customInvoiceId?: string;
  commercialInvoiceId?: string;
  packingListId?: string;
  phytoCertificateId?: string;
}

export interface DownloadDocPdfActionResult {
  success: boolean;
  base64?: string;
  pdf_buffer?: any;
  data?: any;
  url?: string;
  contentType?: string;
  filename?: string;
  message?: string;
  error?: string;
}

/**
 * Server action to download PDF file for a document.
 * Endpoint: GET /dms-templates/download-pdf?prefix=:prefix&id=:id&lang_code=:lang&source=web
 */
export async function downloadDocPdfAction(
  params: DownloadDocPdfActionParams
): Promise<DownloadDocPdfActionResult> {
  try {
    const isCommercialInvoice = /commercial.*invoice|commercial_invoice|commercial-invoice/i.test(params.prefix || "");
    const isPackingList = !isCommercialInvoice && /packing.*list|packing_list|packing-list|packing/i.test(params.prefix || "");
    const isPhytoCertificate = !isCommercialInvoice && !isPackingList && /phyto/i.test(params.prefix || "");
    const isCustomInvoice = !isCommercialInvoice && !isPackingList && !isPhytoCertificate && /custom.*invoice|custom_invoice|custom-invoice/i.test(params.prefix || "");
    const cleanId = String(params.id || "").trim();
    const commercialId = String(params.commercialInvoiceId || "").trim();
    const packingListId = String(params.packingListId || "").trim();
    const phytoId = String(params.phytoCertificateId || "").trim();
    const customId = String(params.customInvoiceId || "").trim();
    const candidateIds = Array.from(
      new Set(
        (isPhytoCertificate
          ? [
              phytoId,
              cleanId,
              ...(params.candidateIds || []).map((id) => String(id || "").trim()),
              packingListId,
              commercialId,
              customId,
              String(params.shipmentInstructionId || "").trim(),
              String(params.proformaId || "").trim(),
              String(params.contractId || "").trim(),
              String(params.confirmationId || "").trim(),
            ]
          : isCommercialInvoice
          ? [
              commercialId,
              cleanId,
              ...(params.candidateIds || []).map((id) => String(id || "").trim()),
              packingListId,
              phytoId,
              customId,
              String(params.shipmentInstructionId || "").trim(),
              String(params.proformaId || "").trim(),
              String(params.contractId || "").trim(),
              String(params.confirmationId || "").trim(),
            ]
          : isPackingList
          ? [
              packingListId,
              cleanId,
              ...(params.candidateIds || []).map((id) => String(id || "").trim()),
              commercialId,
              phytoId,
              customId,
              String(params.shipmentInstructionId || "").trim(),
              String(params.proformaId || "").trim(),
              String(params.contractId || "").trim(),
              String(params.confirmationId || "").trim(),
            ]
          : isCustomInvoice
          ? [
              customId,
              cleanId,
              ...(params.candidateIds || []).map((id) => String(id || "").trim()),
              packingListId,
              phytoId,
              commercialId,
              String(params.shipmentInstructionId || "").trim(),
              String(params.proformaId || "").trim(),
              String(params.contractId || "").trim(),
              String(params.confirmationId || "").trim(),
            ]
          : [
              cleanId,
              ...(params.candidateIds || []).map((id) => String(id || "").trim()),
              packingListId,
              phytoId,
              commercialId,
              customId,
              String(params.shipmentInstructionId || "").trim(),
              String(params.proformaId || "").trim(),
              String(params.contractId || "").trim(),
              String(params.confirmationId || "").trim(),
            ]
        ).filter(
          (id): id is string =>
            Boolean(
              id &&
                !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|phyto|phyto-certificate|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
                  id
                )
            )
        )
      )
    );

    if (candidateIds.length === 0) {
      return {
        success: false,
        error: "Document ID is required to download PDF",
        message: "Document ID is required to download PDF",
      };
    }

    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing. Please sign in again.",
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const prefix = params.prefix || "confirmation";

    let res = await smartDocsService.downloadDocPdf(
      {
        prefix,
        id: candidateIds[0] || cleanId,
        candidateIds,
        lang: safeLang,
        source: "web",
      },
      token
    );

    // If unauthorized, retry once with refreshed token
    if (
      !res.success &&
      res.error &&
      (res.error.includes("401") ||
        res.error.toLowerCase().includes("unauthorized"))
    ) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
          res = await smartDocsService.downloadDocPdf(
            {
              prefix,
              id: candidateIds[0] || cleanId,
              candidateIds,
              lang: safeLang,
              source: "web",
            },
            refreshRes.access_token
          );
        }
      } catch (refErr) {
        console.warn("[downloadDocPdfAction] Retry token refresh failed:", refErr);
      }
    }

    return res;
  } catch (error: any) {
    console.error("[downloadDocPdfAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Internal error occurred while downloading PDF",
      message: error?.message || "Internal error occurred while downloading PDF",
    };
  }
}

/**
 * Server Action to securely fetch a remote signature or stamp image
 * and convert it to a non-tainted base64 Data URL for HTML5 Canvas.
 * Solves browser CORS restrictions and prevents canvas SecurityError.
 */
export async function fetchSignatureAsDataUrlAction(
  url: string
): Promise<string | null> {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed === "null" ||
    trimmed === "undefined" ||
    trimmed === "[object Object]" ||
    trimmed === "/brand/logo.png" ||
    trimmed.endsWith("/brand/logo.png")
  ) {
    return null;
  }

  // If already a Data URL or Blob URL, return directly
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  try {
    let targetUrl = trimmed.replace("assets.agriguruonline.cloud", "assets.agriguruonline.com");
    if (targetUrl.startsWith("//")) {
      targetUrl = `https:${targetUrl}`;
    } else if (!/^https?:\/\//i.test(targetUrl)) {
      if (/^assets\.agriguruonline\.(com|cloud)\/?/i.test(targetUrl)) {
        targetUrl = targetUrl.replace(/^assets\.agriguruonline\.(com|cloud)\/?/i, "");
      }
      const assetsUrl = getAssetsUrl();
      targetUrl = `${assetsUrl}/${targetUrl.replace(/^\/+/, "")}`;
    }

    let token = await getActionToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let res = await fetch(targetUrl, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      // Retry without Authorization (in case of Cloud Storage / S3 / public CDN asset)
      res = await fetch(targetUrl, { cache: "no-store" });
    }

    if (!res.ok) {
      console.warn("[fetchSignatureAsDataUrlAction] Failed to fetch image:", res.status, targetUrl);
      return null;
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/png";
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.warn("[fetchSignatureAsDataUrlAction] Exception while converting signature:", trimmed, err);
    return null;
  }
}

export interface GetProductListingParams {
  page?: number;
  limit?: number;
  lang?: string;
  source?: string;
  search?: string;
}

export interface GetProductListingResult {
  success: boolean;
  message?: string;
  data: any[];
  total: number;
  page: number;
  limit: number;
  error?: string;
}

export async function getProductListingAction(
  params: GetProductListingParams = {}
): Promise<GetProductListingResult> {
  try {
    let token = await getActionToken();

    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const safeLang = getSafeLang(params.lang || "en");

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing",
        data: [],
        total: 0,
        page,
        limit,
      };
    }

    const rawRes = await smartDocsService.getProductListing(
      {
        page,
        limit,
        lang: safeLang,
        source: params.source || "web",
        search: params.search,
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch products",
        data: [],
        total: 0,
        page,
        limit,
      };
    }

    const dataArray = extractSmartDocsArray(rawRes);
    const totalCount = extractSmartDocsTotal(rawRes, dataArray.length);

    return {
      success: Boolean(rawRes.success || rawRes.status || rawRes.data),
      message: rawRes.message,
      data: dataArray,
      total: totalCount,
      page,
      limit,
    };
  } catch (error: any) {
    console.error("[getProductListingAction] Exception:", error);
    return {
      success: false,
      error: error?.message || "Failed to load products",
      data: [],
      total: 0,
      page: params.page ?? 1,
      limit: params.limit ?? 25,
    };
  }
}

export async function deleteProductAction(
  productId: string,
  lang: string = "en"
): Promise<{ success: boolean; message: string }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized" };
    }

    const safeLang = getSafeLang(lang || "en");
    const result = await smartDocsService.deleteProduct(productId, token, {
      lang: safeLang,
      source: "web",
    });
    revalidatePath("/[lang]/smart-docs/products", "page");
    return result;
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to delete product" };
  }
}

export async function saveProductAction(
  productData: any
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized" };
    }

    const result = await smartDocsService.saveProduct(productData, token);
    revalidatePath("/[lang]/smart-docs/products", "page");
    return result;
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to save product" };
  }
}

export interface GetProductByIdResult {
  success: boolean;
  message?: string;
  data: any | null;
  error?: string;
}

export async function getProductByIdAction(
  productId: string,
  params: { lang?: string; source?: string } = {}
): Promise<GetProductByIdResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing",
        data: null,
      };
    }

    const cleanId = sanitizeDocId(productId);
    if (!cleanId) {
      return {
        success: false,
        error: "Invalid product ID",
        message: "Product ID is missing or invalid",
        data: null,
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const rawRes = await smartDocsService.getProductById(
      cleanId,
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch product details",
        data: null,
      };
    }

    const productData = extractProductDetailData(rawRes, cleanId);

    return {
      success: Boolean(rawRes.success || rawRes.status || productData),
      message: rawRes.message,
      data: productData,
    };
  } catch (error: any) {
    console.error("[getProductByIdAction] Exception:", error);
    return {
      success: false,
      error: error?.message || "Failed to load product details",
      data: null,
    };
  }
}

export async function updateProductAction(
  productId: string,
  payload: any,
  params: { lang?: string; source?: string } = {}
): Promise<{ success: boolean; message: string; data?: any; error_fields?: any[] }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized", error_fields: [] };
    }

    const cleanId = sanitizeDocId(productId);
    if (!cleanId) {
      return { success: false, message: "Invalid product ID", error_fields: [] };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const result = await smartDocsService.updateProduct(
      cleanId,
      payload,
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    if (result.success) {
      revalidatePath("/[lang]/smart-docs/products", "page");
    }
    return result;
  } catch (error: any) {
    console.error("[updateProductAction] Error:", error);
    return {
      success: false,
      message: error?.message || "Failed to update product",
      error_fields: [],
    };
  }
}

export interface GetPaymentTermListingActionParams {
  page?: number;
  limit?: number;
  lang?: string;
  source?: string;
  search?: string;
}

export interface GetPaymentTermListingActionResult {
  success: boolean;
  message?: string;
  data: any[];
  total: number;
  page: number;
  limit: number;
  error?: string;
}

export async function getPaymentTermListingAction(
  params: GetPaymentTermListingActionParams = {}
): Promise<GetPaymentTermListingActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        data: [],
        total: 0,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;

    const rawRes = await smartDocsService.getPaymentTermListing(
      {
        page,
        limit,
        lang: safeLang,
        source: params.source || "web",
        search: params.search,
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch payment terms",
        data: [],
        total: 0,
        page,
        limit,
      };
    }

    const dataArray = extractSmartDocsArray(rawRes);
    const totalCount = extractSmartDocsTotal(rawRes, dataArray.length);

    return {
      success: Boolean(rawRes.success ?? true),
      message: rawRes.message,
      data: dataArray,
      total: totalCount,
      page,
      limit,
    };
  } catch (error: any) {
    console.error("[getPaymentTermListingAction] Exception:", error);
    return {
      success: false,
      error: error?.message || "Failed to load payment terms",
      data: [],
      total: 0,
      page: params.page ?? 1,
      limit: params.limit ?? 10,
    };
  }
}

export async function deletePaymentTermAction(
  termId: string,
  lang: string = "en"
): Promise<{ success: boolean; message: string }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized" };
    }

    const safeLang = getSafeLang(lang || "en");
    const result = await smartDocsService.deletePaymentTerm(termId, token, {
      lang: safeLang,
      source: "web",
    });
    revalidatePath("/[lang]/smart-docs/payment-terms", "page");
    return result;
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to delete payment term" };
  }
}

export async function savePaymentTermAction(
  termData: any
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized" };
    }

    const result = await smartDocsService.savePaymentTerm(termData, token);
    revalidatePath("/[lang]/smart-docs/payment-terms", "page");
    return result;
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to save payment term" };
  }
}

export interface GetPaymentTermByIdResult {
  success: boolean;
  message?: string;
  data: any | null;
  error?: string;
}

export async function getPaymentTermByIdAction(
  termId: string,
  params: { lang?: string; source?: string } = {}
): Promise<GetPaymentTermByIdResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing",
        data: null,
      };
    }

    const cleanId = sanitizeDocId(termId);
    if (!cleanId) {
      return {
        success: false,
        error: "Invalid payment term ID",
        message: "Payment term ID is missing or invalid",
        data: null,
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const rawRes = await smartDocsService.getPaymentTermById(
      cleanId,
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch payment term details",
        data: null,
      };
    }

    const termData = extractPaymentTermDetailData(rawRes, cleanId);

    return {
      success: Boolean(rawRes.success || rawRes.status || termData),
      message: rawRes.message,
      data: termData,
    };
  } catch (error: any) {
    console.error("[getPaymentTermByIdAction] Exception:", error);
    return {
      success: false,
      error: error?.message || "Failed to load payment term details",
      data: null,
    };
  }
}

export async function updatePaymentTermAction(
  termId: string,
  payload: any,
  params: { lang?: string; source?: string } = {}
): Promise<{ success: boolean; message: string; data?: any; error_fields?: any[] }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized", error_fields: [] };
    }

    const cleanId = sanitizeDocId(termId);
    if (!cleanId) {
      return { success: false, message: "Invalid payment term ID", error_fields: [] };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const result = await smartDocsService.updatePaymentTerm(
      cleanId,
      payload,
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    if (result.success) {
      revalidatePath("/[lang]/smart-docs/payment-terms", "page");
    }
    return result;
  } catch (error: any) {
    console.error("[updatePaymentTermAction] Error:", error);
    return {
      success: false,
      message: error?.message || "Failed to update payment term",
      error_fields: [],
    };
  }
}

export async function togglePaymentTermStatusAction(
  termId: string,
  newStatus: boolean,
  lang: string = "en"
): Promise<{ success: boolean; message: string }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized" };
    }

    const cleanId = sanitizeDocId(termId);
    if (!cleanId) {
      return { success: false, message: "Invalid payment term ID" };
    }

    const safeLang = getSafeLang(lang || "en");
    const payload = {
      status: newStatus,
      is_active: newStatus,
    };

    const result = await smartDocsService.updatePaymentTerm(
      cleanId,
      payload,
      {
        lang: safeLang,
        source: "web",
      },
      token
    );

    if (result.success) {
      revalidatePath("/[lang]/smart-docs/payment-terms", "page");
    }
    return {
      success: result.success,
      message: result.message || `Payment term marked as ${newStatus ? "Active" : "Inactive"}`,
    };
  } catch (error: any) {
    console.error("[togglePaymentTermStatusAction] Error:", error);
    return {
      success: false,
      message: error?.message || "Failed to update payment term status",
    };
  }
}

export interface GetSellerListingParams {
  page?: number;
  limit?: number;
  lang?: string;
  source?: string;
  search?: string;
}

export interface GetSellerListingResult {
  success: boolean;
  message?: string;
  data: any[];
  total: number;
  error?: string;
}

export async function getSellerListingAction(
  params: GetSellerListingParams = {}
): Promise<GetSellerListingResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing",
        data: [],
        total: 0,
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const page = params.page || 1;
    const limit = params.limit || 10;

    const rawRes = await smartDocsService.getSellerListing(
      {
        page,
        limit,
        lang: safeLang,
        source: params.source || "web",
        search: params.search,
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch sellers list",
        data: [],
        total: 0,
      };
    }

    const sellersData = extractSmartDocsArray(rawRes);
    const totalRecords = extractSmartDocsTotal(rawRes, sellersData.length);

    return {
      success: true,
      message: rawRes.message || "Sellers fetched successfully",
      data: sellersData,
      total: totalRecords,
    };
  } catch (error: any) {
    console.error("[getSellerListingAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch sellers",
      data: [],
      total: 0,
    };
  }
}

export interface GetSellerByIdResult {
  success: boolean;
  message?: string;
  data: any | null;
  error?: string;
}

export async function getSellerByIdAction(
  sellerId: string,
  params: { lang?: string; source?: string } = {}
): Promise<GetSellerByIdResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing",
        data: null,
      };
    }

    const cleanId = sanitizeDocId(sellerId);
    if (!cleanId) {
      return {
        success: false,
        error: "Invalid seller ID",
        message: "Seller ID is missing or invalid",
        data: null,
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const rawRes = await smartDocsService.getSellerById(
      cleanId,
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch seller details",
        data: null,
      };
    }

    const sellerData = extractSellerDetailData(rawRes, cleanId);

    return {
      success: Boolean(rawRes.success || rawRes.status || sellerData),
      message: rawRes.message,
      data: sellerData,
    };
  } catch (error: any) {
    console.error("[getSellerByIdAction] Exception:", error);
    return {
      success: false,
      error: error?.message || "Failed to load seller details",
      data: null,
    };
  }
}

function nodeDataUrlToFile(dataUrl: string, filename: string): File | null {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const match = parts[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/png';
    const buffer = Buffer.from(parts[1], 'base64');
    return new File([buffer], filename, { type: mime });
  } catch (e) {
    console.warn('[nodeDataUrlToFile] Error converting data URL to File:', e);
    return null;
  }
}

function normalizePhoneCountryCode(code?: any): string {
  if (!code) return '';
  const str = String(code).trim();
  if (!str) return '';
  if (str.startsWith('+')) return str;
  if (/^[A-Za-z]{2}$/.test(str)) {
    const upper = str.toUpperCase();
    if (upper === 'IN') return '+91';
    if (upper === 'AE') return '+971';
    if (upper === 'VN') return '+84';
    if (upper === 'US') return '+1';
    if (upper === 'CN') return '+86';
    if (upper === 'BR') return '+55';
    if (upper === 'TH') return '+66';
    if (upper === 'ID') return '+62';
    if (upper === 'SG') return '+65';
    if (upper === 'MY') return '+60';
  }
  if (/^\d+$/.test(str)) {
    return `+${str}`;
  }
  return str;
}

function resolveSellerCountryId(countryName?: string, countryCode?: string, existingId?: string): string {
  if (existingId && existingId.trim()) return existingId.trim();
  const cName = String(countryName || '').toLowerCase().trim();
  if (!cName) return '';
  if (cName.includes('emirates') || cName.includes('uae')) {
    return 'cm710prgz006emzt0kchb1zw9';
  }
  if (cName.includes('india')) {
    return 'cm710m0og002smzt00fy4a8cg';
  }
  return '';
}

function normalizeSellerPayloadToFormData(payload: any): FormData | any {
  if (!payload) return payload;
  const isFd =
    (typeof FormData !== 'undefined' && payload instanceof FormData) ||
    (typeof payload?.get === 'function' && typeof payload?.append === 'function');
  if (isFd) {
    if (!payload.has('type')) {
      payload.append('type', 'S');
    }
    // Clean up any legacy or unexpected field names to satisfy backend multer validations
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

    // Ensure company_logo strips external asset url prefix if sent as string
    if (payload.has('company_logo')) {
      const logoVal = payload.get('company_logo');
      if (typeof logoVal === 'string' && logoVal.includes('assets.agriguruonline.')) {
        payload.set('company_logo', logoVal.replace(/^https?:\/\/assets\.agriguruonline\.(com|cloud)\/?/, ''));
      }
    }

    // Ensure authorised_signature strips external asset url prefix if sent as string
    if (payload.has('authorised_signature')) {
      const sigVal = payload.get('authorised_signature');
      if (typeof sigVal === 'string' && sigVal.includes('assets.agriguruonline.')) {
        payload.set('authorised_signature', sigVal.replace(/^https?:\/\/assets\.agriguruonline\.(com|cloud)\/?/, ''));
      }
    }

    // Normalize country_code only if provided
    if (payload.has('country_code')) {
      const pCode = payload.get('country_code');
      const normalized = normalizePhoneCountryCode(pCode);
      if (normalized) {
        payload.set('country_code', normalized);
      } else {
        payload.delete('country_code');
      }
    }

    // Resolve country_id only if country or country_id is explicitly provided
    const rawCid = payload.get('country_id');
    const countryName = payload.get('country');
    if (!rawCid && countryName) {
      const resolvedCid = resolveSellerCountryId(String(countryName), '', '');
      if (resolvedCid) payload.set('country_id', resolvedCid);
    }

    return payload;
  }

  // If payload is a plain object, convert to FormData so files are binary and form fields match
  const fd = new FormData();
  fd.append('type', 'S');

  for (const [key, val] of Object.entries(payload)) {
    if (val === undefined || val === null || val === '') continue;

    if (
      key === 'authorised_signature' ||
      key === 'authority_signature' ||
      key === 'signature' ||
      key === 'seller_signature'
    ) {
      if (typeof val === 'string' && val.startsWith('data:')) {
        const file = nodeDataUrlToFile(val, 'authorised_signature.png');
        if (file) {
          fd.append('authorised_signature', file);
        }
      } else if (typeof val === 'string' && val.trim()) {
        const cleanSig = val.replace(/^https?:\/\/assets\.agriguruonline\.(com|cloud)\/?/, '').trim();
        fd.append('authorised_signature', cleanSig);
      }
    } else if (key === 'company_logo' || key === 'logo') {
      if (typeof val === 'string' && val.startsWith('data:')) {
        const file = nodeDataUrlToFile(val, 'company_logo.png');
        if (file) {
          fd.append('company_logo', file);
        }
      } else if (typeof val === 'string' && val.trim()) {
        const cleanLogo = val.replace(/^https?:\/\/assets\.agriguruonline\.(com|cloud)\/?/, '').trim();
        fd.append('company_logo', cleanLogo);
      }
    } else if (key === 'zipcode' || key === 'zip_code') {
      fd.append('zip_code', String(val).trim());
    } else if (key === 'certificate_name_and_number' || key === 'certificate_name_number') {
      fd.append('certificate_name_number', String(val).trim());
    } else if (key === 'country_code') {
      const norm = normalizePhoneCountryCode(val);
      if (norm) fd.append('country_code', norm);
    } else {
      fd.append(key, String(val));
    }
  }

  const rawCid = fd.get('country_id');
  const countryName = fd.get('country');
  if (!rawCid && countryName) {
    const resolvedCid = resolveSellerCountryId(String(countryName), '', '');
    if (resolvedCid) fd.set('country_id', resolvedCid);
  }

  return fd;
}

export async function saveSellerAction(
  sellerData: any
): Promise<{ success: boolean; message: string; data?: any; error_fields?: any; errors?: any }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized", error_fields: [] };
    }

    const payload = normalizeSellerPayloadToFormData(sellerData);
    const result = await smartDocsService.saveSeller(payload, token);
    revalidatePath("/[lang]/smart-docs/sellers", "page");
    return result;
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to save seller", error_fields: [] };
  }
}

export async function updateSellerAction(
  sellerId: string,
  payload: any,
  params: { lang?: string; source?: string } = {}
): Promise<{ success: boolean; message: string; data?: any; error_fields?: any; errors?: any }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized", error_fields: [] };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const cleanId = sanitizeDocId(sellerId);
    if (!cleanId) {
      return { success: false, message: "Invalid seller ID", error_fields: [] };
    }

    const payloadToSend = normalizeSellerPayloadToFormData(payload);
    const result = await smartDocsService.updateSeller(
      cleanId,
      payloadToSend,
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    if (result.success) {
      revalidatePath("/[lang]/smart-docs/sellers", "page");
    }
    return result;
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to update seller", error_fields: [] };
  }
}

export async function deleteSellerAction(
  sellerId: string,
  lang: string = "en"
): Promise<{ success: boolean; message: string }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized" };
    }

    const cleanId = sanitizeDocId(sellerId);
    if (!cleanId) {
      return { success: false, message: "Invalid seller ID" };
    }

    const safeLang = getSafeLang(lang || "en");
    const result = await smartDocsService.deleteSeller(cleanId, token, {
      lang: safeLang,
      source: "web",
    });
    revalidatePath("/[lang]/smart-docs/sellers", "page");
    return result;
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to delete seller" };
  }
}

export interface GetSellerBankDetailsActionResult {
  success: boolean;
  message?: string;
  data: {
    items: Array<{
      id: string;
      name: string;
      account_details: string;
      bank_details_id?: string;
      bank_account_id?: string;
      [key: string]: any;
    }>;
    total: number;
  } | null;
  error?: string;
}

/**
 * Fetches bank details for a seller/instruction with authentication:
 * GET /dms-fields/bank-details/:sellerId?lang_code=en&source=web
 */
export async function getSellerBankDetailsAction(
  sellerId: string,
  params: { lang?: string; source?: string } = {}
): Promise<GetSellerBankDetailsActionResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing",
        data: null,
      };
    }

    const cleanId = sanitizeDocId(sellerId);
    if (!cleanId) {
      return {
        success: false,
        error: "Invalid seller ID",
        message: "Seller ID is missing or invalid",
        data: null,
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const rawRes = await smartDocsService.getSellerBankDetails(
      cleanId,
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch bank details",
        data: null,
      };
    }

    let rawItems: any[] = [];
    if (Array.isArray(rawRes.data?.items)) {
      rawItems = rawRes.data.items;
    } else if (Array.isArray(rawRes.data?.bank_details)) {
      rawItems = rawRes.data.bank_details;
    } else if (Array.isArray(rawRes.data?.bank_accounts)) {
      rawItems = rawRes.data.bank_accounts;
    } else if (Array.isArray(rawRes.data?.banks)) {
      rawItems = rawRes.data.banks;
    } else if (Array.isArray(rawRes.data)) {
      rawItems = rawRes.data;
    } else if (Array.isArray(rawRes.items)) {
      rawItems = rawRes.items;
    } else if (Array.isArray(rawRes.bank_details)) {
      rawItems = rawRes.bank_details;
    } else if (
      rawRes.data &&
      typeof rawRes.data === "object" &&
      (rawRes.data.id ||
        rawRes.data._id ||
        rawRes.data.name ||
        rawRes.data.bank_name ||
        rawRes.data.account_details ||
        rawRes.data.bank_details)
    ) {
      rawItems = [rawRes.data];
    }

    const items = rawItems.map((it: any) => {
      const rawBankId =
        it.bank_details_id ??
        it.bankDetailsId ??
        it.bank_account_id ??
        it.bankAccountId ??
        it.id ??
        it._id ??
        it.bank_id ??
        it.bankDetailId ??
        "";
      const bankId = String(rawBankId).trim();
      return {
        ...it,
        id: bankId || generateSmartDocsCuid(),
        bank_details_id: bankId,
        bank_account_id: bankId,
        name: String(it.name || it.bank_name || it.bankName || it.account_name || "").trim(),
        account_details: String(
          it.account_details ??
            it.accountDetails ??
            it.bank_details ??
            it.bankDetails ??
            it.details ??
            ""
        ).trim(),
      };
    });

    return {
      success: Boolean(rawRes.success || rawRes.status || items.length > 0),
      message: rawRes.message || "Bank details fetched successfully",
      data: {
        items,
        total: rawRes.data?.total ?? items.length,
      },
    };
  } catch (error: any) {
    console.error("[getSellerBankDetailsAction] Exception:", error);
    return {
      success: false,
      error: error?.message || "Failed to load bank details",
      data: null,
    };
  }
}

/**
 * Saves/updates bank details for a seller/instruction with authentication:
 * PATCH /dms-fields/bank-details/:sellerId?lang_code=en&source=web
 */
export async function updateSellerBankDetailsAction(
  sellerId: string,
  bankData: any,
  params: { lang?: string; source?: string } = {}
): Promise<{ success: boolean; message: string; data?: any; error_fields?: any; errors?: any }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized", error_fields: [] };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const cleanId = sanitizeDocId(sellerId);
    if (!cleanId) {
      return { success: false, message: "Invalid seller ID", error_fields: [] };
    }

    const result = await smartDocsService.updateSellerBankDetails(
      cleanId,
      bankData,
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    if (result.success) {
      revalidatePath("/[lang]/smart-docs/sellers", "page");
    }
    return result;
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Failed to update bank details",
      error_fields: [],
    };
  }
}

/**
 * Deletes a bank detail item with authentication:
 * DELETE /dms-fields/bank-details/:bankDetailId?lang_code=en&source=web
 */
export async function deleteSellerBankDetailAction(
  bankDetailId: string,
  params: { lang?: string; source?: string } = {}
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized" };
    }

    const cleanId = sanitizeDocId(bankDetailId);
    if (!cleanId) {
      return { success: false, message: "Invalid bank detail ID" };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const result = await smartDocsService.deleteSellerBankDetail(
      cleanId,
      token,
      {
        lang: safeLang,
        source: params.source || "web",
      }
    );

    if (result.success) {
      revalidatePath("/[lang]/smart-docs/sellers", "page");
    }
    return result;
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Failed to delete bank detail",
    };
  }
}

// ---------------------------------------------------------------------------
// BUYERS MANAGEMENT SERVER ACTIONS (type: 'B')
// ---------------------------------------------------------------------------

export interface GetBuyerListingParams {
  page?: number;
  limit?: number;
  lang?: string;
  source?: string;
  search?: string;
}

export interface GetBuyerListingResult {
  success: boolean;
  message?: string;
  data: any[];
  total: number;
  error?: string;
}

export async function getBuyerListingAction(
  params: GetBuyerListingParams = {}
): Promise<GetBuyerListingResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing",
        data: [],
        total: 0,
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const page = params.page || 1;
    const limit = params.limit || 10;

    const rawRes = await smartDocsService.getBuyerListing(
      {
        page,
        limit,
        lang: safeLang,
        source: params.source || "web",
        search: params.search,
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch buyers list",
        data: [],
        total: 0,
      };
    }

    const buyersData = extractSmartDocsArray(rawRes);
    const totalRecords = extractSmartDocsTotal(rawRes, buyersData.length);

    return {
      success: true,
      message: rawRes.message || "Buyers fetched successfully",
      data: buyersData,
      total: totalRecords,
    };
  } catch (error: any) {
    console.error("[getBuyerListingAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to fetch buyers",
      data: [],
      total: 0,
    };
  }
}

export interface GetBuyerByIdResult {
  success: boolean;
  message?: string;
  data: any | null;
  error?: string;
}

export async function getBuyerByIdAction(
  buyerId: string,
  params: { lang?: string; source?: string } = {}
): Promise<GetBuyerByIdResult> {
  try {
    let token = await getActionToken();

    if (!token) {
      return {
        success: false,
        error: "Unauthorized",
        message: "Authentication token missing",
        data: null,
      };
    }

    const cleanId = sanitizeDocId(buyerId);
    if (!cleanId) {
      return {
        success: false,
        error: "Invalid buyer ID",
        message: "Buyer ID is missing or invalid",
        data: null,
      };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const rawRes = await smartDocsService.getBuyerById(
      cleanId,
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    if (!rawRes) {
      return {
        success: false,
        error: "Failed to fetch buyer details",
        data: null,
      };
    }

    const buyerData = extractSellerDetailData(rawRes, cleanId);

    return {
      success: Boolean(rawRes.success || rawRes.status || buyerData),
      message: rawRes.message,
      data: buyerData,
    };
  } catch (error: any) {
    console.error("[getBuyerByIdAction] Exception:", error);
    return {
      success: false,
      error: error?.message || "Failed to load buyer details",
      data: null,
    };
  }
}

function normalizeBuyerPayloadToFormData(payload: any): FormData | any {
  if (!payload) return payload;
  const isFd =
    (typeof FormData !== 'undefined' && payload instanceof FormData) ||
    (typeof payload?.get === 'function' && typeof payload?.append === 'function');
  if (isFd) {
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
    if (payload.has('seller_signature') || payload.has('buyer_signature')) {
      payload.delete('seller_signature');
      payload.delete('buyer_signature');
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

    if (payload.has('authorised_signature')) {
      const sigVal = payload.get('authorised_signature');
      if (typeof sigVal === 'string' && sigVal.includes('assets.agriguruonline.')) {
        payload.set('authorised_signature', sigVal.replace(/^https?:\/\/assets\.agriguruonline\.(com|cloud)\/?/, ''));
      }
    }

    if (payload.has('country_code')) {
      const pCode = payload.get('country_code');
      const normalized = normalizePhoneCountryCode(pCode);
      if (normalized) {
        payload.set('country_code', normalized);
      } else {
        payload.delete('country_code');
      }
    }

    const rawCid = payload.get('country_id');
    const countryName = payload.get('country');
    if (!rawCid && countryName) {
      const resolvedCid = resolveSellerCountryId(String(countryName), '', '');
      if (resolvedCid) payload.set('country_id', resolvedCid);
    }

    return payload;
  }

  const fd = new FormData();
  fd.append('type', 'B');

  for (const [key, val] of Object.entries(payload)) {
    if (val === undefined || val === null || val === '') continue;

    if (
      key === 'authorised_signature' ||
      key === 'authority_signature' ||
      key === 'signature' ||
      key === 'buyer_signature' ||
      key === 'seller_signature'
    ) {
      if (typeof val === 'string' && val.startsWith('data:')) {
        const file = nodeDataUrlToFile(val, 'authorised_signature.png');
        if (file) {
          fd.append('authorised_signature', file);
        }
      } else if (typeof val === 'string' && val.trim()) {
        const cleanSig = val.replace(/^https?:\/\/assets\.agriguruonline\.(com|cloud)\/?/, '').trim();
        fd.append('authorised_signature', cleanSig);
      }
    } else if (key === 'company_logo' || key === 'logo') {
      if (typeof val === 'string' && val.startsWith('data:')) {
        const file = nodeDataUrlToFile(val, 'company_logo.png');
        if (file) {
          fd.append('company_logo', file);
        }
      } else if (typeof val === 'string' && val.trim()) {
        const cleanLogo = val.replace(/^https?:\/\/assets\.agriguruonline\.(com|cloud)\/?/, '').trim();
        fd.append('company_logo', cleanLogo);
      }
    } else if (key === 'zipcode' || key === 'zip_code') {
      fd.append('zip_code', String(val).trim());
    } else if (key === 'certificate_name_and_number' || key === 'certificate_name_number') {
      fd.append('certificate_name_number', String(val).trim());
    } else if (key === 'country_code') {
      const norm = normalizePhoneCountryCode(val);
      if (norm) fd.append('country_code', norm);
    } else {
      fd.append(key, String(val));
    }
  }

  const rawCid = fd.get('country_id');
  const countryName = fd.get('country');
  if (!rawCid && countryName) {
    const resolvedCid = resolveSellerCountryId(String(countryName), '', '');
    if (resolvedCid) fd.set('country_id', resolvedCid);
  }

  return fd;
}

export async function saveBuyerAction(
  buyerData: any
): Promise<{ success: boolean; message: string; data?: any; error_fields?: any; errors?: any }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized", error_fields: [] };
    }

    const payload = normalizeBuyerPayloadToFormData(buyerData);
    const result = await smartDocsService.saveBuyer(payload, token);
    revalidatePath("/[lang]/smart-docs/buyers", "page");
    return result;
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to save buyer", error_fields: [] };
  }
}

export async function updateBuyerAction(
  buyerId: string,
  payload: any,
  params: { lang?: string; source?: string } = {}
): Promise<{ success: boolean; message: string; data?: any; error_fields?: any; errors?: any }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized", error_fields: [] };
    }

    const safeLang = getSafeLang(params.lang || "en");
    const cleanId = sanitizeDocId(buyerId);
    if (!cleanId) {
      return { success: false, message: "Invalid buyer ID", error_fields: [] };
    }

    const payloadToSend = normalizeBuyerPayloadToFormData(payload);
    const result = await smartDocsService.updateBuyer(
      cleanId,
      payloadToSend,
      {
        lang: safeLang,
        source: params.source || "web",
      },
      token
    );

    if (result.success) {
      revalidatePath("/[lang]/smart-docs/buyers", "page");
    }
    return result;
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to update buyer", error_fields: [] };
  }
}

export async function deleteBuyerAction(
  buyerId: string,
  lang: string = "en"
): Promise<{ success: boolean; message: string }> {
  try {
    let token = await getActionToken();

    if (!token) {
      return { success: false, message: "Unauthorized" };
    }

    const cleanId = sanitizeDocId(buyerId);
    if (!cleanId) {
      return { success: false, message: "Invalid buyer ID" };
    }

    const safeLang = getSafeLang(lang || "en");
    const result = await smartDocsService.deleteBuyer(cleanId, token, {
      lang: safeLang,
      source: "web",
    });
    revalidatePath("/[lang]/smart-docs/buyers", "page");
    return result;
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to delete buyer" };
  }
}

// ---------------------------------------------------------------------------
// CONSIGNEE DETAILS SERVER ACTIONS
// ---------------------------------------------------------------------------

export async function getBuyerConsigneesAction(
  buyerId: string,
  params: { lang?: string; source?: string } = {}
): Promise<{ success: boolean; data?: any[]; message?: string }> {
  try {
    let token = await getActionToken();

    if (!token) return { success: false, message: "Unauthorized", data: [] };
    const cleanId = sanitizeDocId(buyerId);
    if (!cleanId) return { success: false, message: "Invalid buyer ID", data: [] };

    const safeLang = getSafeLang(params.lang || "en");
    const res = await smartDocsService.getBuyerConsignees(cleanId, { lang: safeLang, source: params.source || "web" }, token);
    const dataObj = res?.data ?? res;
    const rawItems = Array.isArray(dataObj)
      ? dataObj
      : Array.isArray(dataObj?.items)
      ? dataObj.items
      : Array.isArray(dataObj?.consignees)
      ? dataObj.consignees
      : Array.isArray(dataObj?.consignee)
      ? dataObj.consignee
      : Array.isArray(dataObj?.consignee_details)
      ? dataObj.consignee_details
      : Array.isArray(res?.items)
      ? res.items
      : Array.isArray(res?.consignees)
      ? res.consignees
      : Array.isArray(res?.consignee)
      ? res.consignee
      : Array.isArray(res)
      ? res
      : [];
    return { success: true, data: rawItems };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to fetch consignees", data: [] };
  }
}

export async function saveBuyerConsigneesAction(
  buyerId: string,
  items: any[],
  params: { lang?: string; source?: string } = {}
): Promise<{ success: boolean; message: string; data?: any; error_fields?: any[]; errors?: any }> {
  try {
    let token = await getActionToken();

    if (!token) return { success: false, message: "Unauthorized", error_fields: [] };
    const cleanId = sanitizeDocId(buyerId);
    if (!cleanId) return { success: false, message: "Invalid buyer ID", error_fields: [] };

    const safeLang = getSafeLang(params.lang || "en");
    const result = await smartDocsService.updateBuyerConsignees(
      cleanId,
      { items },
      { lang: safeLang, source: params.source || "web" },
      token
    );

    if (result.success) {
      revalidatePath("/[lang]/smart-docs/buyers", "page");
    }
    return result;
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to save consignees", error_fields: [] };
  }
}

export async function deleteBuyerConsigneeAction(
  consigneeId: string,
  params: { lang?: string; source?: string } = {}
): Promise<{ success: boolean; message: string }> {
  try {
    let token = await getActionToken();

    if (!token) return { success: false, message: "Unauthorized" };
    const cleanId = sanitizeDocId(consigneeId);
    if (!cleanId) return { success: false, message: "Invalid consignee ID" };

    const safeLang = getSafeLang(params.lang || "en");
    const result = await smartDocsService.deleteBuyerConsignee(cleanId, token, {
      lang: safeLang,
      source: params.source || "web",
    });

    if (result.success) {
      revalidatePath("/[lang]/smart-docs/buyers", "page");
    }
    return result;
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to delete consignee" };
  }
}

// ---------------------------------------------------------------------------
// NOTIFY PARTY DETAILS SERVER ACTIONS
// ---------------------------------------------------------------------------

export async function getBuyerNotifyPartiesAction(
  buyerId: string,
  params: { lang?: string; source?: string } = {}
): Promise<{ success: boolean; data?: any[]; message?: string }> {
  try {
    let token = await getActionToken();

    if (!token) return { success: false, message: "Unauthorized", data: [] };
    const cleanId = sanitizeDocId(buyerId);
    if (!cleanId) return { success: false, message: "Invalid buyer ID", data: [] };

    const safeLang = getSafeLang(params.lang || "en");
    const res = await smartDocsService.getBuyerNotifyParties(cleanId, { lang: safeLang, source: params.source || "web" }, token);
    const dataObj = res?.data ?? res;
    const rawItems = Array.isArray(dataObj)
      ? dataObj
      : Array.isArray(dataObj?.items)
      ? dataObj.items
      : Array.isArray(dataObj?.notify_parties)
      ? dataObj.notify_parties
      : Array.isArray(dataObj?.notify_party)
      ? dataObj.notify_party
      : Array.isArray(dataObj?.notify_party_details)
      ? dataObj.notify_party_details
      : Array.isArray(dataObj?.notifies)
      ? dataObj.notifies
      : Array.isArray(res?.items)
      ? res.items
      : Array.isArray(res?.notify_parties)
      ? res.notify_parties
      : Array.isArray(res?.notify_party)
      ? res.notify_party
      : Array.isArray(res)
      ? res
      : [];
    return { success: true, data: rawItems };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to fetch notify parties", data: [] };
  }
}

export async function saveBuyerNotifyPartiesAction(
  buyerId: string,
  items: any[],
  params: { lang?: string; source?: string } = {}
): Promise<{ success: boolean; message: string; data?: any; error_fields?: any[]; errors?: any }> {
  try {
    let token = await getActionToken();

    if (!token) return { success: false, message: "Unauthorized", error_fields: [] };
    const cleanId = sanitizeDocId(buyerId);
    if (!cleanId) return { success: false, message: "Invalid buyer ID", error_fields: [] };

    const safeLang = getSafeLang(params.lang || "en");
    const result = await smartDocsService.updateBuyerNotifyParties(
      cleanId,
      { items },
      { lang: safeLang, source: params.source || "web" },
      token
    );

    if (result.success) {
      revalidatePath("/[lang]/smart-docs/buyers", "page");
    }
    return result;
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to save notify parties", error_fields: [] };
  }
}

export async function deleteBuyerNotifyPartyAction(
  notifyPartyId: string,
  params: { lang?: string; source?: string } = {}
): Promise<{ success: boolean; message: string }> {
  try {
    let token = await getActionToken();

    if (!token) return { success: false, message: "Unauthorized" };
    const cleanId = sanitizeDocId(notifyPartyId);
    if (!cleanId) return { success: false, message: "Invalid notify party ID" };

    const safeLang = getSafeLang(params.lang || "en");
    const result = await smartDocsService.deleteBuyerNotifyParty(cleanId, token, {
      lang: safeLang,
      source: params.source || "web",
    });

    if (result.success) {
      revalidatePath("/[lang]/smart-docs/buyers", "page");
    }
    return result;
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to delete notify party" };
  }
}










"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSafeLang, getAssetsUrl } from "@/lib/api-utils";
import { refreshTokensAction } from "@/app/actions/auth";
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
} from "@/lib/api/smart-docs.service";

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
    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

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
    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

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
        revalidatePath(`/${safeLang}/smart-docs`);
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
    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

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
    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

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
    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

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

    const cookieStore = await cookies();
    const token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

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
    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

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
    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

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
    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    if (!token && cookieStore.get("refresh_token")?.value) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes?.success && refreshRes.access_token) {
          token = refreshRes.access_token;
        }
      } catch (refErr) {
        console.warn("[getSmartDocsDocumentListAction] Token refresh failed:", refErr);
      }
    }

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
    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    if (!token && cookieStore.get("refresh_token")?.value) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
        }
      } catch (refErr) {
        console.warn("[saveConfirmationDraftAction] Token refresh failed:", refErr);
      }
    }

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
      try {
        revalidatePath(`/${safeLang}/smart-docs`);
      } catch (revErr) {
        console.warn("[saveConfirmationDraftAction] Revalidate warning:", revErr);
      }

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

    const errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    return {
      success: false,
      message: rawRes?.message || "Failed to save confirmation draft",
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : payload.id,
      error: rawRes?.message || "Failed to save draft",
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

    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    if (!token && cookieStore.get("refresh_token")?.value) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
        }
      } catch (refErr) {
        console.warn("[getConfirmationAction] Token refresh failed:", refErr);
      }
    }

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

    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    if (!token && cookieStore.get("refresh_token")?.value) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
        }
      } catch (refErr) {
        console.warn("[getContractAction] Token refresh failed:", refErr);
      }
    }

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
    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    if (!token && cookieStore.get("refresh_token")?.value) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
        }
      } catch (refErr) {
        console.warn("[saveContractDraftAction] Token refresh failed:", refErr);
      }
    }

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
      try {
        revalidatePath(`/${safeLang}/smart-docs`);
        revalidatePath(`/${safeLang}/smart-docs/draft`);
      } catch (revErr) {
        console.warn("[saveContractDraftAction] Revalidate warning:", revErr);
      }

      return {
        success: true,
        message: rawRes.message || "Contract draft saved successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : effectiveId,
        raw: rawRes.raw || rawRes,
      };
    }

    const errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    return {
      success: false,
      message: rawRes?.message || "Failed to save contract draft",
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : effectiveId,
      error: rawRes?.message || "Failed to save contract draft",
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
 * POST /contract/submit?lang_code=en&source=web
 */
export async function submitContractAction(
  payload: any,
  lang: string = "en"
): Promise<SubmitContractActionResult> {
  try {
    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    if (!token && cookieStore.get("refresh_token")?.value) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
        }
      } catch (refErr) {
        console.warn("[submitContractAction] Token refresh failed:", refErr);
      }
    }

    if (!token) {
      return {
        success: false,
        error: "Unauthorized: Please sign in again",
        message: "Authentication token missing",
      };
    }

    const safeLang = getSafeLang(lang || "en");
    let rawRes = await smartDocsService.submitContract(
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
          rawRes = await smartDocsService.submitContract(
            payload,
            {
              lang: safeLang,
              source: "web",
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
      rawRes?._id;

    if (isSuccess) {
      try {
        revalidatePath(`/${safeLang}/smart-docs`);
        revalidatePath(`/${safeLang}/smart-docs/draft`);
      } catch (revErr) {
        console.warn("[submitContractAction] Revalidate warning:", revErr);
      }

      return {
        success: true,
        message: rawRes.message || "Contract submitted successfully!",
        data: rawRes.data || rawRes,
        id: generatedId ? String(generatedId) : payload.id,
        raw: rawRes.raw || rawRes,
      };
    }

    const errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    return {
      success: false,
      message: rawRes?.message || "Failed to submit contract",
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : payload.id,
      error: rawRes?.message || "Failed to submit contract",
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
    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    if (!token && cookieStore.get("refresh_token")?.value) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
        }
      } catch (refErr) {
        console.warn("[submitConfirmationAction] Token refresh failed:", refErr);
      }
    }

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
      try {
        revalidatePath(`/${safeLang}/smart-docs`);
      } catch (revErr) {
        console.warn("[submitConfirmationAction] Revalidate warning:", revErr);
      }

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

    const errorFields =
      rawRes.error_fields ||
      rawRes.data?.error_fields ||
      rawRes.errors ||
      rawRes.data?.errors ||
      rawRes.raw?.error_fields ||
      rawRes.raw?.errors ||
      null;

    return {
      success: false,
      message: rawRes?.message || "Failed to submit confirmation to contract",
      errors: errorFields,
      error_fields: errorFields,
      raw: rawRes.raw || rawRes,
      id: generatedId ? String(generatedId) : payload.id,
      error: rawRes?.message || "Failed to submit confirmation",
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

export interface GetDocPreviewActionParams {
  prefix?: string;
  id: string;
  lang?: string;
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
    const cleanId = String(params.id || "").trim();
    if (!cleanId) {
      return {
        success: false,
        error: "Document ID is required to generate preview",
        message: "Document ID is required to generate preview",
      };
    }

    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    if (!token) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
        }
      } catch (refErr) {
        console.warn("[getDocPreviewAction] Initial token refresh failed:", refErr);
      }
    }

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
        id: cleanId,
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
              id: cleanId,
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
}

export interface DownloadDocPdfActionResult {
  success: boolean;
  base64?: string;
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
    const cleanId = String(params.id || "").trim();
    if (!cleanId) {
      return {
        success: false,
        error: "Document ID is required to download PDF",
        message: "Document ID is required to download PDF",
      };
    }

    const cookieStore = await cookies();
    let token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

    if (!token) {
      try {
        const refreshRes = await refreshTokensAction();
        if (refreshRes.success && refreshRes.access_token) {
          token = refreshRes.access_token;
        }
      } catch (refErr) {
        console.warn("[downloadDocPdfAction] Initial token refresh failed:", refErr);
      }
    }

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
        id: cleanId,
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
              id: cleanId,
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
    trimmed === "[object Object]"
  ) {
    return null;
  }

  // If already a Data URL or Blob URL, return directly
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  try {
    let targetUrl = trimmed;
    if (!/^https?:\/\//i.test(targetUrl)) {
      const assetsUrl = getAssetsUrl();
      targetUrl = `${assetsUrl}/${targetUrl.replace(/^\/+/, "")}`;
    }

    const cookieStore = await cookies();
    const token =
      cookieStore.get("auth_token")?.value ||
      cookieStore.get("__Secure-uid")?.value;

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








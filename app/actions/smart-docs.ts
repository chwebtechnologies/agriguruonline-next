"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSafeLang } from "@/lib/api-utils";
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
  type SaveConfirmationPayload,
  extractConfirmationData,
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





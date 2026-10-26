"use server";

import { cookies } from "next/headers";
import { getSafeLang } from "@/lib/api-utils";
import {
  smartDocsService,
  extractSmartDocsArray,
  extractSmartDocsTotal,
  normalizeActionParam,
  extractStepperList,
  type StepperDocumentItem,
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
    const token =
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
  lang?: string;
}

export async function deleteSmartDocAction(
  params: DeleteSmartDocActionParams
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const cookieStore = await cookies();
    const token =
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
    return await smartDocsService.deleteSmartDoc(params.documentId, safeLang, token);
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
    const token =
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
    const rawRes = await smartDocsService.getStepperList(
      {
        action: params.action || "confirmation",
        step: params.step || "new-confirmation",
        lang: safeLang,
        source: "web",
      },
      token
    );

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



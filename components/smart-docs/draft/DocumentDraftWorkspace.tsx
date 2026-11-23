'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  type StepperDocumentItem,
  type InstructionPartyOption,
  type SmartDocsProductOption,
  type SmartDocsSelectionDocumentOption,
  extractContractData,
  extractConfirmationData,
  extractProformaData,
  normalizeStepStatus,
  extractStepId,
  extractStepRedirectId,
  getStepSelfId,
  extractLinkedConfirmationId,
  extractLinkedContractId,
  extractLinkedProformaId,
  extractLinkedShipmentInstructionId,
  isConfirmationStep,
  isContractStep,
  isProformaStep,
  isShipmentInstructionStep,
  isBillOfLadingStep,
  isCustomInvoiceStep,
  isCommercialInvoiceStep,
  isPackingListStep,
  isPhytoCertificateStep,
  getContractStep,
  getProformaStep,
  getShipmentInstructionStep,
  getBillOfLadingStep,
  getCustomInvoiceStep,
  getCommercialInvoiceStep,
  getPackingListStep,
  getPhytoCertificateStep,
  getContractIdFromStepper,
  getProformaIdFromStepper,
  getConfirmationIdFromStepper,
  getShipmentInstructionIdFromStepper,
  getBillOfLadingIdFromStepper,
  getCustomInvoiceIdFromStepper,
  getCommercialInvoiceIdFromStepper,
  getPackingListIdFromStepper,
  getPhytoCertificateIdFromStepper,
  extractShipmentInstructionData,
  extractBillOfLadingData,
  isCompleteBillOfLadingData,
  extractLinkedBillOfLadingId,
  extractCustomInvoiceData,
  isCompleteCustomInvoiceData,
  extractLinkedCustomInvoiceId,
  extractCommercialInvoiceData,
  isCompleteCommercialInvoiceData,
  extractLinkedCommercialInvoiceId,
  extractPackingListData,
  isCompletePackingListData,
  extractLinkedPackingListId,
  extractPhytoCertificateData,
  isCompletePhytoCertificateData,
  extractLinkedPhytoCertificateId,
  sanitizeDocId,
  isRealStepperList,
  isStatusCompleted,
  DEFAULT_WORKFLOW_STEPPER_ITEMS,
  isVisibleWorkflowStep,
  isSameWorkflowStep,
  mergeStepperWithHidden,
  getWorkflowSubmitButtonInfo,
} from '@/lib/api/smart-docs.service';
import DocumentStatusStepper, { cleanDocNumber, isPureDbId, isPlaceholderDocNumber, isLikelyInvoiceNumber, cleanBaseContractNumber } from './DocumentStatusStepper';
import ConfirmationDocumentForm, { FormOptionItem } from './form/ConfirmationDocumentForm';
import ContractDocumentForm from './form/ContractDocumentForm';
import ProformaDocumentForm from './form/ProformaDocumentForm';
import ShipmentInstructionDocumentForm from './form/ShipmentInstructionDocumentForm';
import BillOfLadingDocumentForm from './form/BillOfLadingDocumentForm';
import CustomInvoiceDocumentForm from './form/CustomInvoiceDocumentForm';
import CommercialInvoiceDocumentForm from './form/CommercialInvoiceDocumentForm';
import PackingListDocumentForm from './form/PackingListDocumentForm';
import PhytoCertificateDocumentForm from './form/PhytoCertificateDocumentForm';
import DocumentDraftSkeleton from './DocumentDraftSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  saveConfirmationDraftAction,
  submitConfirmationAction,
  saveContractDraftAction,
  submitContractAction,
  getContractAction,
  getConfirmationAction,
  getStepperListAction,
  getProformaAction,
  saveProformaDraftAction,
  submitProformaAction,
  getShipmentInstructionAction,
  saveShipmentInstructionDraftAction,
  submitShipmentInstructionAction,
  getBillOfLadingAction,
  saveBillOfLadingDraftAction,
  submitBillOfLadingAction,
  getCustomInvoiceAction,
  saveCustomInvoiceDraftAction,
  submitCustomInvoiceAction,
  getCommercialInvoiceAction,
  saveCommercialInvoiceDraftAction,
  submitCommercialInvoiceAction,
  getPackingListAction,
  savePackingListDraftAction,
  submitPackingListAction,
  getPhytoCertificateAction,
  savePhytoCertificateDraftAction,
  submitPhytoCertificateAction,
} from '@/app/actions/smart-docs';

export function getSafeDisplayString(val: any, fallback = 'N/A'): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null') {
      return fallback;
    }
    return trimmed;
  }
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    const text =
      val.name ||
      val.product_name ||
      val.commodity ||
      val.title ||
      val.label ||
      val.port_name ||
      val.portName ||
      val.company_name ||
      val.instruction ||
      val.instructionText ||
      val.details ||
      val.code ||
      val.incoterm ||
      val.payment_term ||
      val.text ||
      '';
    if (typeof text === 'string' && text.trim()) {
      return text.trim();
    }
    if (typeof text === 'object' && text !== null) {
      return getSafeDisplayString(text, fallback);
    }
    return fallback;
  }
  return String(val) || fallback;
}

export function safeString(val: any, fallback = ''): string {
  return getSafeDisplayString(val, fallback);
}

export function getSafeInstructionString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null') return '';
    return trimmed;
  }
  if (typeof val === 'object') {
    const text = val.instruction || val.instructionText || val.details || val.text || val.description || '';
    if (typeof text === 'string') return text.trim();
  }
  return '';
}

export { isPureDbId, isPlaceholderDocNumber, isLikelyInvoiceNumber, cleanBaseContractNumber };

export function isInvalidPlaceholder(val?: string | null): boolean {
  if (!val) return true;
  const clean = String(val).trim().toLowerCase();
  return (
    clean === '' ||
    /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|phyto|phyto-certificate|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(
      clean
    )
  );
}

/**
 * Extracts contract number or contract_id from Shipment Instruction response.
 * "also SI ka form open hua to uske resposnse me contract_id mile vo dikhani hai"
 */
export function extractContractFromSiResponse(data: any): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data;
  const rawSub = d.shipment_instruction || d.shipmentInstruction || d.document || d.details;

  const rawSplit =
    d.split_number ??
    d.splitNumber ??
    d.split_code ??
    d.splitCode ??
    d.partial_number ??
    d.partialNumber ??
    d.partial_code ??
    d.split_letter ??
    d.splitLetter ??
    d.partial ??
    d.split ??
    (typeof rawSub === 'object' && rawSub !== null ? rawSub.split_number ?? rawSub.partial_number ?? rawSub.split : undefined) ??
    data.split_number ??
    data.split;

  const formatWithSplit = (candidate: any): string | null => {
    if (!candidate) return null;
    const clean = cleanDocNumber(candidate);
    if (!clean || isPlaceholderDocNumber(clean) || isLikelyInvoiceNumber(clean)) return null;
    if (rawSplit !== undefined && rawSplit !== null && String(rawSplit).trim()) {
      const splitStr = String(rawSplit).trim();
      const splitLetter = /^\d+$/.test(splitStr)
        ? String.fromCharCode(65 + (parseInt(splitStr, 10) - 1))
        : splitStr.toUpperCase();
      // Strip any existing trailing split suffix(es) so we never get /A/A or /A/B
      const baseClean = clean.replace(/(\s*[\/\-][A-Za-z]{1,2})+$/, '');
      return `${baseClean}/${splitLetter}`;
    }
    // If no split is active, clean any repeated split suffixes like /A/A
    return clean.replace(/(\s*[\/\-][A-Za-z]{1,2}){2,}$/, '');
  };

  // 1. Explicit partial
  const explicitPartial =
    d.partial_contract_number ||
    d.partial_contract_no ||
    d.partialContractNumber ||
    d.split_contract_number ||
    (typeof rawSub === 'object' && rawSub !== null ? rawSub.partial_contract_number || rawSub.partial_contract_no : undefined) ||
    data.partial_contract_number ||
    data.partial_contract_no;
  if (explicitPartial) {
    const formatted = formatWithSplit(explicitPartial);
    if (formatted) return formatted;
  }

  // 2. Direct contract number fields
  const directNum =
    d.contract_number ||
    d.contract_no ||
    d.contractNumber ||
    d.contractNo ||
    d.sales_contract_number ||
    d.contract?.contract_number ||
    d.contract?.contract_no ||
    d.contract?.contractNumber ||
    (typeof rawSub === 'object' && rawSub !== null ? rawSub.contract_number || rawSub.contract_no || rawSub.contract?.contract_number : undefined) ||
    data.contract_number ||
    data.contract_no;
  if (directNum) {
    const formatted = formatWithSplit(directNum);
    if (formatted) return formatted;
  }

  // 3. Response contract_id: "also SI ka form open hua to uske resposnse me contract_id mile vo dikhani hai"
  const contractIdVal =
    d.contract_id ||
    d.contractId ||
    d.contract?.contract_id ||
    d.contract?.id ||
    d.contract?._id ||
    (typeof rawSub === 'object' && rawSub !== null ? rawSub.contract_id || rawSub.contractId || rawSub.contract?.id : undefined) ||
    data.contract_id ||
    data.contractId;
  if (contractIdVal) {
    const formatted = formatWithSplit(contractIdVal);
    if (formatted) return formatted;
  }

  return null;
}

/**
 * Checks if a contract number is a partial contract number with split letter suffix (e.g. CONT/00001/A, PO-100/B).
 * Strictly requires alphabetic split letter (/A, /B, -A, -B) so main contracts ending in numbers (/00142) are NOT mistaken for partials.
 */
export function isPartialContractNumber(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (isPureDbId(trimmed)) return false;
  if (isLikelyInvoiceNumber(trimmed)) return false;
  return (
    /\/[A-Za-z]{1,2}$/i.test(trimmed) ||
    /-[A-Za-z]{1,2}$/i.test(trimmed) ||
    /\/(?:partial|split)[ -]?[A-Za-z0-9]+$/i.test(trimmed)
  );
}

/**
 * Extracts the contract number from any Smart Docs document API response.
 * Follows backend property patterns across SI, BL, Custom Invoice, Commercial Invoice, Packing List, Contract, Confirmation.
 */
export function extractDocContractNumber(data: any): string | null {
  if (!data || typeof data !== 'object') return null;

  // Support both raw response ({ success: true, data: { ... } }) and extracted payload
  const d =
    data.data && typeof data.data === 'object' && !Array.isArray(data.data)
      ? data.data
      : data;

  const rawSub =
    d.shipment_instruction ||
    d.shipmentInstruction ||
    d.bill_of_lading ||
    d.billOfLading ||
    d.custom_invoice ||
    d.customInvoice ||
    d.commercial_invoice ||
    d.commercialInvoice ||
    d.packing_list ||
    d.packingList ||
    d.document ||
    d.details;

  // Split indicator (e.g. 'A', 'B', '1', '2')
  const rawSplit =
    d.split_number ??
    d.splitNumber ??
    d.split_code ??
    d.splitCode ??
    d.partial_number ??
    d.partialNumber ??
    d.partial_code ??
    d.partialCode ??
    d.split_letter ??
    d.splitLetter ??
    d.partial ??
    d.split ??
    (typeof rawSub === 'object' && rawSub !== null
      ? rawSub.split_number ?? rawSub.split ?? rawSub.partial_number
      : undefined) ??
    data.split_number ??
    data.split;

  const formatWithSplit = (candidate: any): string | null => {
    if (!candidate) return null;
    const clean = cleanDocNumber(candidate);
    if (!clean || isPureDbId(clean) || isLikelyInvoiceNumber(clean)) return null;

    if (rawSplit !== undefined && rawSplit !== null && String(rawSplit).trim()) {
      const splitStr = String(rawSplit).trim();
      const splitLetter = /^\d+$/.test(splitStr)
        ? String.fromCharCode(65 + (parseInt(splitStr, 10) - 1))
        : splitStr.toUpperCase();
      // Strip any existing trailing split suffix(es) so we never get /A/A or /A/B
      const baseClean = clean.replace(/(\s*[\/\-][A-Za-z]{1,2})+$/, '');
      return `${baseClean}/${splitLetter}`;
    }

    // If no split is active, clean any repeated split suffixes like /A/A
    return clean.replace(/(\s*[\/\-][A-Za-z]{1,2}){2,}$/, '');
  };

  // 1. Explicit partial contract number fields:
  const explicitPartial =
    d.partial_contract_number ||
    d.partial_contract_no ||
    d.partialContractNumber ||
    d.partialContractNo ||
    d.split_contract_number ||
    d.split_contract_no ||
    d.contract_split_number ||
    d.contract_split_no ||
    (typeof rawSub === 'object' && rawSub !== null
      ? rawSub.partial_contract_number || rawSub.partial_contract_no || rawSub.split_contract_number
      : undefined) ||
    data.partial_contract_number ||
    data.partial_contract_no;

  if (explicitPartial) {
    const formatted = formatWithSplit(explicitPartial);
    if (formatted) return formatted;
  }

  // 2. Direct document-level contract number fields:
  const directContract =
    d.contract_number ||
    d.contract_no ||
    d.contractNumber ||
    d.contractNo ||
    d.sales_contract_number ||
    d.sales_contract_no ||
    (typeof rawSub === 'object' && rawSub !== null
      ? rawSub.contract_number || rawSub.contract_no || rawSub.contractNumber || rawSub.sales_contract_number
      : undefined) ||
    data.contract_number ||
    data.contract_no ||
    data.contractNumber;

  if (directContract) {
    const cleanCand = cleanDocNumber(directContract);
    const parentId = String(d.contract_id || d.contract?.id || data.contract_id || '').trim();
    if (cleanCand && !isPureDbId(cleanCand) && !isLikelyInvoiceNumber(cleanCand) && (!parentId || cleanCand !== parentId)) {
      const formatted = formatWithSplit(cleanCand);
      if (formatted) return formatted;
    }
  }

  // 3. Nested contract entity
  const nestedContractPartial =
    d.contract?.partial_contract_number ||
    d.contract?.partial_contract_no ||
    d.contract?.split_contract_number ||
    (typeof rawSub === 'object' && rawSub !== null && rawSub.contract
      ? rawSub.contract.partial_contract_number || rawSub.contract.partial_contract_no
      : undefined);

  if (nestedContractPartial) {
    const formatted = formatWithSplit(nestedContractPartial);
    if (formatted) return formatted;
  }

  const nestedContractDirect =
    d.contract?.contract_number ||
    d.contract?.contractNumber ||
    d.contract?.contract_no ||
    d.contract?.sales_contract_number ||
    (typeof rawSub === 'object' && rawSub !== null && rawSub.contract
      ? rawSub.contract.contract_number || rawSub.contract.contract_no
      : undefined);

  if (nestedContractDirect) {
    const cleanCand = cleanDocNumber(nestedContractDirect);
    const parentId = String(d.contract_id || d.contract?.id || data.contract_id || '').trim();
    if (cleanCand && !isPureDbId(cleanCand) && !isLikelyInvoiceNumber(cleanCand) && (!parentId || cleanCand !== parentId)) {
      const formatted = formatWithSplit(cleanCand);
      if (formatted) return formatted;
    }
  }

  // 4. Confirmation-level fallback
  const confirmationContract =
    d.confirmation?.contract_number ||
    d.confirmation?.contract_no ||
    data.confirmation?.contract_number;

  if (confirmationContract) {
    const cleanCand = cleanDocNumber(confirmationContract);
    const parentId = String(d.contract_id || d.contract?.id || data.contract_id || '').trim();
    if (cleanCand && !isPureDbId(cleanCand) && !isLikelyInvoiceNumber(cleanCand) && (!parentId || cleanCand !== parentId)) {
      return formatWithSplit(cleanCand);
    }
  }

  // 5. Response contract_id / contractId fallback
  const fallbackContractId =
    d.contract_id ||
    d.contractId ||
    d.contract?.contract_id ||
    d.contract?.id ||
    d.contract?._id ||
    data.contract_id ||
    data.contractId;

  if (fallbackContractId) {
    const cleanCand = cleanDocNumber(fallbackContractId);
    if (cleanCand && !isPureDbId(cleanCand) && !isLikelyInvoiceNumber(cleanCand)) {
      return formatWithSplit(cleanCand);
    }
  }

  return null;
}

export function isCompleteProformaData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  return Boolean(
    data.invoice_number ||
    data.invoice_no ||
    data.invoice_date ||
    data.proforma_invoice_number ||
    data.proforma_number ||
    data.proforma_status ||
    data.proforma_invoice_id ||
    data._is_proforma_loaded ||
    (data.proforma && typeof data.proforma === 'object' && (data.proforma.invoice_number || data.proforma.id))
  );
}

export function isCompleteContractData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  return Boolean(
    data.contract_number ||
    data.contractNumber ||
    data.contract_no ||
    data.contract_date ||
    data.contractDate ||
    data.contract_status ||
    data.sales_contract_id ||
    data._is_contract_loaded ||
    (data.contract && typeof data.contract === 'object' && (data.contract.contract_number || data.contract.id))
  );
}

export function isCompleteConfirmationData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  return Boolean(
    data.confirmation_number ||
    data.confirmationNumber ||
    data.confirmation_date ||
    data.confirmationDate ||
    data.confirmation_status ||
    data.trade_confirmation_number ||
    data._is_confirmation_loaded ||
    (data.confirmation && typeof data.confirmation === 'object' && (data.confirmation.confirmation_number || data.confirmation.id))
  );
}

export function isCompleteShipmentInstructionData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  // If object is a contract or confirmation without shipment instruction markers, it is NOT shipment data
  if (data.contract_number && !data.shipment_instruction_number && !data.booking_no && !data.booking_number) {
    return false;
  }
  if (data.confirmation_number && !data.shipment_instruction_number && !data.booking_no && !data.booking_number) {
    return false;
  }
  return Boolean(
    data.shipment_instruction_number ||
    data.booking_no ||
    data.booking_number ||
    data.shipping_bill_number ||
    data.shipping_bill_no ||
    data.sb_no ||
    data.shipment_instruction_status ||
    data.shipment_status ||
    data._is_shipment_loaded ||
    data.shipment_instruction_id ||
    (data.shipment_instruction && typeof data.shipment_instruction === 'object' && (data.shipment_instruction.shipment_instruction_number || data.shipment_instruction.booking_no || data.shipment_instruction.id || data.shipment_instruction.shipment_instruction_id))
  );
}

export interface DocumentDraftWorkspaceProps {
  lang?: string;
  dict?: any;
  initialSteps?: StepperDocumentItem[];
  initialSellers?: InstructionPartyOption[];
  initialBuyers?: InstructionPartyOption[];
  initialProducts?: SmartDocsProductOption[];
  initialPaymentTerms?: FormOptionItem[];
  initialCurrencies?: FormOptionItem[];
  shippingTerms?: FormOptionItem[];
  initialDocumentList?: SmartDocsSelectionDocumentOption[];
  initialData?: any;
  initialContractData?: any;
  initialProformaData?: any;
  initialShipmentInstructionData?: any;
  initialBillOfLadingData?: any;
  initialCustomInvoiceData?: any;
  initialCommercialInvoiceData?: any;
  initialPackingListData?: any;
  initialPhytoCertificateData?: any;
  initialConsignees?: any[];
  initialNotifyParties?: any[];
  initialConsigneesBuyerId?: string;
  initialId?: string;
  initialStepParam?: string;
}

export function getStepSlug(step?: StepperDocumentItem | null, index?: number): string {
  if (isConfirmationStep(step)) return 'confirmation';
  if (isContractStep(step)) return 'contract';
  if (isProformaStep(step)) return 'proforma';
  if (isShipmentInstructionStep(step)) return 'shipment';
  if (isBillOfLadingStep(step)) return 'bill-of-lading';
  if (isCustomInvoiceStep(step)) return 'custom-invoice';
  if (isCommercialInvoiceStep(step)) return 'commercial-invoice';
  if (isPackingListStep(step)) return 'packing-list';
  if (isPhytoCertificateStep(step)) return 'phyto-certificate';

  if (step) {
    const name = String(step.document_name || step.name || step.title || '').trim().toLowerCase();
    if (name.includes('lading') || name.includes('bl')) return 'bill-of-lading';
    if (name.includes('commercial')) return 'commercial-invoice';
    if (name.includes('packing')) return 'packing-list';
    if (name.includes('phyto')) return 'phyto-certificate';
    if (name.includes('fumigation')) return 'fumigation-certificate';
    if (name.includes('origin')) return 'certificate-of-origin';
    if (name.includes('w & q') || name.includes('w&q')) return 'wq-certificate';
    if (step.slug) return String(step.slug);
    if (step.id) return String(step.id);
  }

  if (typeof index === 'number') {
    if (index === 0) return 'confirmation';
    if (index === 1) return 'contract';
    if (index === 2) return 'proforma';
    if (index === 3) return 'shipment';
    if (index === 4) return 'bill-of-lading';
    if (index === 5) return 'custom-invoice';
    if (index === 6) return 'commercial-invoice';
    if (index === 7) return 'packing-list';
    if (index === 8) return 'phyto-certificate';
    return `step-${index + 1}`;
  }
  return 'confirmation';
}

/**
 * Finds the latest open/active step in workflow.
 * The first incomplete step is considered the latest open step.
 */
export function findLatestOpenStepIndex(stepList: StepperDocumentItem[]): number {
  if (!stepList || stepList.length === 0) return 0;
  const incompleteIdx = stepList.findIndex(
    (s) => normalizeStepStatus(s.status || s.document_status || s.step_status) !== 'completed'
  );
  return incompleteIdx >= 0 ? incompleteIdx : Math.max(0, stepList.length - 1);
}

export function resolveInitialStepIndex(
  stepList: StepperDocumentItem[],
  stepParam?: string
): number {
  // 1. If explicit step param in URL, match requested step
  if (stepParam && stepParam.trim()) {
    const clean = stepParam.trim().toLowerCase();
    if (clean === 'confirmation' || clean === '1') {
      return 0;
    }
    if (clean === 'contract' || clean === '2') {
      if (!stepList || stepList.length === 0) return 0;
      const contractIdx = stepList.findIndex((s) => isContractStep(s));
      return contractIdx >= 0 ? contractIdx : (stepList.length > 1 ? 1 : 0);
    }
    if (clean === 'proforma' || clean === '3') {
      if (!stepList || stepList.length === 0) return 0;
      const proformaIdx = stepList.findIndex((s) => isProformaStep(s));
      return proformaIdx >= 0 ? proformaIdx : (stepList.length > 2 ? 2 : 0);
    }
    if (clean === 'shipment' || clean === 'shipment_instruction' || clean === 'shipment-instruction' || clean === 'instruction' || clean === 'document' || clean === '4') {
      if (!stepList || stepList.length === 0) return 0;
      const shipmentIdx = stepList.findIndex((s) => isShipmentInstructionStep(s));
      return shipmentIdx >= 0 ? shipmentIdx : (stepList.length > 3 ? 3 : 0);
    }
    if (clean === 'bill-of-lading' || clean === 'bill_of_lading' || clean === 'lading' || clean === 'bl' || clean === '5') {
      if (!stepList || stepList.length === 0) return 0;
      const ladingIdx = stepList.findIndex((s) => isBillOfLadingStep(s));
      return ladingIdx >= 0 ? ladingIdx : (stepList.length > 4 ? 4 : 0);
    }
    if (clean === 'custom-invoice' || clean === 'custom_invoice' || clean === 'custom' || clean === 'invoice' || clean === '6') {
      if (!stepList || stepList.length === 0) return 0;
      const customIdx = stepList.findIndex((s) => isCustomInvoiceStep(s));
      return customIdx >= 0 ? customIdx : (stepList.length > 5 ? 5 : 0);
    }
    if (clean === 'commercial-invoice' || clean === 'commercial_invoice' || clean === 'commercial' || clean === '7') {
      if (!stepList || stepList.length === 0) return 0;
      const commercialIdx = stepList.findIndex((s) => isCommercialInvoiceStep(s));
      return commercialIdx >= 0 ? commercialIdx : (stepList.length > 6 ? 6 : 0);
    }
    if (clean === 'packing-list' || clean === 'packing_list' || clean === 'packing' || clean === '8') {
      if (!stepList || stepList.length === 0) return 0;
      const packingIdx = stepList.findIndex((s) => isPackingListStep(s));
      return packingIdx >= 0 ? packingIdx : (stepList.length > 7 ? 7 : 0);
    }
    if (clean === 'phyto-certificate' || clean === 'phyto_certificate' || clean === 'phyto' || clean === 'phytosanitary' || clean === '9') {
      if (!stepList || stepList.length === 0) return 0;
      const phytoIdx = stepList.findIndex((s) => isPhytoCertificateStep(s));
      return phytoIdx >= 0 ? phytoIdx : (stepList.length > 8 ? 8 : 0);
    }
    if (stepList && stepList.length > 0) {
      const matchedIdx = stepList.findIndex((s, i) => {
        const id = String(s.id || '').toLowerCase();
        const name = String(s.document_name || s.name || '').toLowerCase();
        return id === clean || name === clean || String(i + 1) === clean;
      });
      if (matchedIdx >= 0) return matchedIdx;
    }
  }

  if (!stepList || stepList.length === 0) return 0;

  // 2. Default: Open the latest open step! ("ek cheese stepper me proper hai ki open latest open ho raha hai")
  return findLatestOpenStepIndex(stepList);
}

export function DocumentDraftWorkspace({
  lang = 'en',
  dict,
  initialSteps = [],
  initialSellers = [],
  initialBuyers = [],
  initialProducts = [],
  initialPaymentTerms = [],
  initialCurrencies = [],
  shippingTerms,
  initialDocumentList = [],
  initialData,
  initialContractData,
  initialProformaData,
  initialShipmentInstructionData,
  initialBillOfLadingData,
  initialCustomInvoiceData,
  initialCommercialInvoiceData,
  initialPackingListData,
  initialPhytoCertificateData,
  initialConsignees = [],
  initialNotifyParties = [],
  initialConsigneesBuyerId = '',
  initialId,
  initialStepParam,
}: DocumentDraftWorkspaceProps) {
  const [steps, setSteps] = useState<StepperDocumentItem[]>(() => {
    if (initialSteps && initialSteps.length > 0) return initialSteps;
    return DEFAULT_WORKFLOW_STEPPER_ITEMS;
  });
  const [draftId, setDraftId] = useState<string>(
    initialId ||
    initialData?.id ||
    initialData?._id ||
    initialData?.confirmation_id ||
    initialData?.confirmationId ||
    initialContractData?.confirmation_id ||
    initialContractData?.confirmationId ||
    initialContractData?.id ||
    initialContractData?._id ||
    ''
  );
  const [confirmationData, setConfirmationData] = useState<any>(
    initialData ||
    (initialShipmentInstructionData?.confirmation && typeof initialShipmentInstructionData.confirmation === 'object'
      ? initialShipmentInstructionData.confirmation
      : null)
  );
  const [isLoadingConfirmation, setIsLoadingConfirmation] = useState<boolean>(false);
  const [contractData, setContractData] = useState<any>(
    initialContractData ||
    (initialShipmentInstructionData?.contract && typeof initialShipmentInstructionData.contract === 'object'
      ? initialShipmentInstructionData.contract
      : null)
  );
  const [isLoadingContract, setIsLoadingContract] = useState<boolean>(false);
  const [proformaData, setProformaData] = useState<any>(
    initialProformaData ||
    (initialShipmentInstructionData?.proforma && typeof initialShipmentInstructionData.proforma === 'object'
      ? initialShipmentInstructionData.proforma
      : null)
  );
  const [isLoadingProforma, setIsLoadingProforma] = useState<boolean>(false);
  const [shipmentInstructionData, setShipmentInstructionData] = useState<any>(initialShipmentInstructionData || null);
  const [isLoadingShipmentInstruction, setIsLoadingShipmentInstruction] = useState<boolean>(false);
  const [billOfLadingData, setBillOfLadingData] = useState<any>(initialBillOfLadingData || null);
  const [isLoadingBillOfLading, setIsLoadingBillOfLading] = useState<boolean>(false);
  const [customInvoiceData, setCustomInvoiceData] = useState<any>(initialCustomInvoiceData || null);
  const [isLoadingCustomInvoice, setIsLoadingCustomInvoice] = useState<boolean>(false);
  const [commercialInvoiceData, setCommercialInvoiceData] = useState<any>(initialCommercialInvoiceData || null);
  const [isLoadingCommercialInvoice, setIsLoadingCommercialInvoice] = useState<boolean>(false);
  const [packingListData, setPackingListData] = useState<any>(initialPackingListData || null);
  const [isLoadingPackingList, setIsLoadingPackingList] = useState<boolean>(false);
  const [phytoCertificateData, setPhytoCertificateData] = useState<any>(initialPhytoCertificateData || null);
  const [isLoadingPhytoCertificate, setIsLoadingPhytoCertificate] = useState<boolean>(false);
  const [phytoCertificateVersion, setPhytoCertificateVersion] = useState<number>(0);

  // Pinned workflow partial contract number:
  // When a workflow is opened for a specific partial split (e.g. Split B's Shipment Instruction),
  // lock that partial contract number (e.g. AGC/2024-25/00142/B) across the entire session!
  // Prevents navigating to Contract or Proforma from resetting/falling back to Split A or main contract!
  const [pinnedWorkflowContractNumber, setPinnedWorkflowContractNumber] = useState<string | null>(() => {
    const initialCandidates = [
      extractContractFromSiResponse(initialShipmentInstructionData),
      extractDocContractNumber(initialShipmentInstructionData),
      extractDocContractNumber(initialBillOfLadingData),
      extractDocContractNumber(initialCustomInvoiceData),
      extractDocContractNumber(initialCommercialInvoiceData),
      extractDocContractNumber(initialPackingListData),
      extractDocContractNumber(initialProformaData),
      extractDocContractNumber(initialContractData),
    ];
    for (const rawC of initialCandidates) {
      if (rawC) {
        const c = rawC.replace(/(\s*[\/\-][A-Za-z]{1,2}){2,}$/, '');
        if (c && isPartialContractNumber(c)) return c;
      }
    }
    for (const rawC of initialCandidates) {
      if (rawC) {
        const c = rawC.replace(/(\s*[\/\-][A-Za-z]{1,2}){2,}$/, '');
        if (c && !isPureDbId(c) && !isLikelyInvoiceNumber(c)) return c;
      }
    }
    return null;
  });

  useEffect(() => {
    const liveCandidates = [
      extractContractFromSiResponse(shipmentInstructionData),
      extractContractFromSiResponse(initialShipmentInstructionData),
      extractDocContractNumber(shipmentInstructionData),
      extractDocContractNumber(initialShipmentInstructionData),
      extractDocContractNumber(billOfLadingData),
      extractDocContractNumber(initialBillOfLadingData),
      extractDocContractNumber(customInvoiceData),
      extractDocContractNumber(initialCustomInvoiceData),
      extractDocContractNumber(commercialInvoiceData),
      extractDocContractNumber(initialCommercialInvoiceData),
      extractDocContractNumber(packingListData),
      extractDocContractNumber(initialPackingListData),
      extractDocContractNumber(proformaData),
      extractDocContractNumber(initialProformaData),
      extractDocContractNumber(contractData),
      extractDocContractNumber(initialContractData),
    ];
    for (const rawC of liveCandidates) {
      if (rawC) {
        const c = rawC.replace(/(\s*[\/\-][A-Za-z]{1,2}){2,}$/, '');
        if (c && isPartialContractNumber(c)) {
          setPinnedWorkflowContractNumber((prev) => (prev !== c ? c : prev));
          return;
        }
      }
    }
    if (!pinnedWorkflowContractNumber) {
      for (const rawC of liveCandidates) {
        if (rawC) {
          const c = rawC.replace(/(\s*[\/\-][A-Za-z]{1,2}){2,}$/, '');
          if (c && !isPureDbId(c) && !isLikelyInvoiceNumber(c)) {
            setPinnedWorkflowContractNumber(c);
            return;
          }
        }
      }
    }
  }, [
    shipmentInstructionData,
    initialShipmentInstructionData,
    billOfLadingData,
    initialBillOfLadingData,
    customInvoiceData,
    initialCustomInvoiceData,
    commercialInvoiceData,
    initialCommercialInvoiceData,
    packingListData,
    initialPackingListData,
    proformaData,
    initialProformaData,
    contractData,
    initialContractData,
    pinnedWorkflowContractNumber,
  ]);

  // Session Anchor Pinning:
  // When a workflow is opened for a specific partial document (e.g. Split B's Shipment Instruction),
  // lock the workflow anchor type to 'document' and anchor ID to that document's ID across the entire session!
  // "har bar usme jo form hai us form pe vo nahi karna hai hume kya bolte hai id change nahi karni hai stepper me just vo har form move karne par refresh karavani hai properly"
  // "and contract ke step me move hone par stepper me id change nahi karvani hai vaha sirf refresh hi karvana hai to solve proper ho jayega"
  const isInitialDocWorkflow = useMemo(() => {
    const stepParam = (initialStepParam || '').toLowerCase().trim();
    const docSlugs = [
      'shipment',
      'shipment_instruction',
      'shipment-instruction',
      'instruction',
      'document',
      'bill-of-lading',
      'bill_of_lading',
      'lading',
      'bl',
      'custom-invoice',
      'custom_invoice',
      'custom',
      'commercial-invoice',
      'commercial_invoice',
      'commercial',
      'packing-list',
      'packing_list',
      'packing',
      'invoice',
      '4',
      '5',
      '6',
      '7',
      '8',
    ];
    if (docSlugs.includes(stepParam)) return true;
    if (
      initialShipmentInstructionData?.id ||
      initialShipmentInstructionData?._id ||
      initialShipmentInstructionData?.shipment_instruction_id
    ) {
      return true;
    }
    return false;
  }, [initialStepParam, initialShipmentInstructionData]);

  const [pinnedWorkflowAnchorId, setPinnedWorkflowAnchorId] = useState<string>(() => {
    if (isInitialDocWorkflow && initialId && !isPureDbId(initialId)) {
      return initialId;
    }
    const cand = sanitizeDocId(
      initialShipmentInstructionData?.id ||
      initialShipmentInstructionData?._id ||
      initialShipmentInstructionData?.shipment_instruction_id ||
      initialShipmentInstructionData?.shipment_id ||
      initialContractData?.id ||
      initialContractData?._id ||
      initialData?.id ||
      initialData?._id ||
      initialId
    );
    return cand && !isPureDbId(cand) ? cand : '';
  });

  const [pinnedWorkflowAnchorType, setPinnedWorkflowAnchorType] = useState<string>(() => {
    if (isInitialDocWorkflow) return 'document';
    if (initialStepParam === 'contract' || initialStepParam === '2') return 'contract';
    return 'confirmation';
  });

  // Step data version counters to signal forms on stepper navigation and fresh API fetch
  const [confirmationVersion, setConfirmationVersion] = useState<number>(0);
  const [contractVersion, setContractVersion] = useState<number>(0);
  const [proformaVersion, setProformaVersion] = useState<number>(0);
  const [shipmentVersion, setShipmentVersion] = useState<number>(0);
  const [billOfLadingVersion, setBillOfLadingVersion] = useState<number>(0);
  const [customInvoiceVersion, setCustomInvoiceVersion] = useState<number>(0);
  const [commercialInvoiceVersion, setCommercialInvoiceVersion] = useState<number>(0);
  const [packingListVersion, setPackingListVersion] = useState<number>(0);

  // Compute initial selected step (honoring explicit URL param or defaulting to latest open step)
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(() =>
    resolveInitialStepIndex(initialSteps && initialSteps.length > 0 ? initialSteps : steps, initialStepParam)
  );
  const [selectedStep, setSelectedStep] = useState<StepperDocumentItem | null>(() => {
    const list = initialSteps && initialSteps.length > 0 ? initialSteps : steps;
    const idx = resolveInitialStepIndex(list, initialStepParam);
    return list && list.length > 0 ? list[idx] || list[0] : null;
  });

  const [isMobileStepperOpen, setIsMobileStepperOpen] = useState<boolean>(false);

  const fallbackStep =
    selectedStep ||
    (steps && steps[selectedStepIndex]) ||
    (steps && steps[0]) ||
    DEFAULT_WORKFLOW_STEPPER_ITEMS[selectedStepIndex] ||
    DEFAULT_WORKFLOW_STEPPER_ITEMS[0];

  const isConfirmation = isConfirmationStep(fallbackStep);
  const isContract = !isConfirmation && isContractStep(fallbackStep);
  const isProforma = !isConfirmation && !isContract && isProformaStep(fallbackStep);
  const isShipmentInstruction = !isConfirmation && !isContract && !isProforma && isShipmentInstructionStep(fallbackStep);
  const isBillOfLading = !isConfirmation && !isContract && !isProforma && !isShipmentInstruction && isBillOfLadingStep(fallbackStep);
  const isCustomInvoice = !isConfirmation && !isContract && !isProforma && !isShipmentInstruction && !isBillOfLading && isCustomInvoiceStep(fallbackStep);
  const isCommercialInvoice = !isConfirmation && !isContract && !isProforma && !isShipmentInstruction && !isBillOfLading && !isCustomInvoice && isCommercialInvoiceStep(fallbackStep);
  const isPackingList = !isConfirmation && !isContract && !isProforma && !isShipmentInstruction && !isBillOfLading && !isCustomInvoice && !isCommercialInvoice && isPackingListStep(fallbackStep);
  const isPhytoCertificate = !isConfirmation && !isContract && !isProforma && !isShipmentInstruction && !isBillOfLading && !isCustomInvoice && !isCommercialInvoice && !isPackingList && isPhytoCertificateStep(fallbackStep);

  // Contract ID extracted strictly from Stepper list / selectedStep (user: "id tumhe stepper se milegi")
  const contractIdFromStepper = useMemo(() => {
    return getContractIdFromStepper(steps, selectedStep);
  }, [steps, selectedStep]);

  // Confirmation ID for Stepper workflow operations (strictly confirmation, NEVER contract ID or SI/PI ID)
  const effectiveConfirmationId = useMemo(() => {
    // 1. Direct confirmation data
    const directConfId = sanitizeDocId(
      confirmationData?.id ||
      confirmationData?._id ||
      confirmationData?.confirmation_id ||
      confirmationData?.confirmationId ||
      initialData?.id ||
      initialData?._id ||
      initialData?.confirmation_id ||
      initialData?.confirmationId
    );
    if (directConfId && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(directConfId)) {
      return directConfId;
    }

    // 2. Stepper list Step 0 (Trade Confirmation) redirect_id
    const stepperConfStep = steps.find((s) => isConfirmationStep(s)) || null;
    const stepperConfId = sanitizeDocId(
      getConfirmationIdFromStepper(steps) ||
      getStepSelfId(stepperConfStep) ||
      stepperConfStep?.redirect_id ||
      stepperConfStep?.redirectId
    );
    if (stepperConfId && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(stepperConfId)) {
      return stepperConfId;
    }

    // 3. Linked confirmation IDs from other documents (contract, proforma, shipment instruction)
    const linked = sanitizeDocId(
      extractLinkedConfirmationId(contractData) ||
      extractLinkedConfirmationId(initialContractData) ||
      extractLinkedConfirmationId(proformaData) ||
      extractLinkedConfirmationId(initialProformaData) ||
      extractLinkedConfirmationId(shipmentInstructionData) ||
      extractLinkedConfirmationId(initialShipmentInstructionData)
    );
    if (linked && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(linked)) {
      return linked;
    }

    // 4. Fallback to initialId or draftId ONLY if not in contract/proforma/shipment mode
    const cleanInitial = sanitizeDocId(initialId);
    if (
      cleanInitial &&
      !isContract &&
      !isProforma &&
      !isShipmentInstruction &&
      !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(cleanInitial)
    ) {
      return cleanInitial;
    }

    const cleanDraft = sanitizeDocId(draftId);
    if (
      cleanDraft &&
      !isContract &&
      !isProforma &&
      !isShipmentInstruction &&
      !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(cleanDraft)
    ) {
      return cleanDraft;
    }

    return '';
  }, [
    confirmationData,
    initialData,
    steps,
    contractData,
    initialContractData,
    proformaData,
    initialProformaData,
    shipmentInstructionData,
    initialShipmentInstructionData,
    initialId,
    draftId,
    isContract,
    isProforma,
    isShipmentInstruction,
  ]);

  // Canonical Contract Document ID (strictly contract)
  const canonicalContractId = useMemo(() => {
    const hasContractMarkers = (data: any) =>
      Boolean(data && (data.contract_number || data.contract_no || data.sales_contract_id || data._is_contract_loaded));

    // 1. Direct contract data
    const directContractId = sanitizeDocId(
      (hasContractMarkers(contractData) ? contractData?.id || contractData?._id : '') ||
      contractData?.contract_id ||
      contractData?.contractId ||
      (hasContractMarkers(initialContractData) ? initialContractData?.id || initialContractData?._id : '') ||
      initialContractData?.contract_id ||
      initialContractData?.contractId
    );
    if (
      directContractId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(directContractId)
    ) {
      return directContractId;
    }

    // 2. Stepper list Step 1 (Sales Contract) redirect_id / contract_id
    const stepperContractStep = steps.find((s) => isContractStep(s)) || null;
    const stepperContractId = sanitizeDocId(
      stepperContractStep?.contract_id ||
      (stepperContractStep as any)?.contractId ||
      stepperContractStep?.sales_contract_id ||
      stepperContractStep?.redirect_id ||
      (stepperContractStep as any)?.redirectId
    );
    if (
      stepperContractId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(stepperContractId)
    ) {
      return stepperContractId;
    }

    // 3. Linked contract ID from other documents (confirmation, proforma, shipment instruction)
    const linked = sanitizeDocId(
      extractLinkedContractId(initialData) ||
      extractLinkedContractId(confirmationData) ||
      extractLinkedContractId(proformaData) ||
      extractLinkedContractId(initialProformaData) ||
      extractLinkedContractId(shipmentInstructionData) ||
      extractLinkedContractId(initialShipmentInstructionData)
    );
    if (
      linked &&
      !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(linked)
    ) {
      return linked;
    }

    // 4. Fallback to draftId or confirmation ID if isContract is true
    const cleanDraft = sanitizeDocId(draftId);
    if (
      isContract &&
      cleanDraft &&
      !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(cleanDraft)
    ) {
      return cleanDraft;
    }

    if (isContract && effectiveConfirmationId) {
      return effectiveConfirmationId;
    }

    return '';
  }, [
    contractData,
    initialContractData,
    steps,
    contractIdFromStepper,
    effectiveConfirmationId,
    initialData,
    confirmationData,
    proformaData,
    initialProformaData,
    shipmentInstructionData,
    initialShipmentInstructionData,
    isContract,
    draftId,
    initialId,
  ]);

  // Canonical Proforma Document ID (strictly proforma)
  const canonicalProformaId = useMemo(() => {
    const hasProformaMarkers = (data: any) =>
      Boolean(
        data &&
        (data.invoice_number || data.invoice_no || data._is_proforma_loaded || data.proforma_invoice_id)
      );

    // 1. Direct proforma data
    const directProformaId = sanitizeDocId(
      (hasProformaMarkers(proformaData) ? proformaData?.id || proformaData?._id : '') ||
      proformaData?.proforma_id ||
      proformaData?.proformaId ||
      (hasProformaMarkers(initialProformaData) ? initialProformaData?.id || initialProformaData?._id : '') ||
      initialProformaData?.proforma_id ||
      initialProformaData?.proformaId
    );
    if (
      directProformaId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(directProformaId)
    ) {
      return directProformaId;
    }

    // 2. From Stepper step (current selection or proforma step)
    const proformaStep = getProformaStep(steps, selectedStep);
    const fromStepper = sanitizeDocId(
      getStepSelfId(proformaStep) ||
      getProformaIdFromStepper(steps, selectedStep) ||
      proformaStep?.proforma_id ||
      (proformaStep as any)?.proformaId ||
      proformaStep?.proforma_invoice_id ||
      (proformaStep as any)?.proformaInvoiceId ||
      proformaStep?.redirect_id ||
      (proformaStep as any)?.redirectId
    );
    if (
      fromStepper &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(fromStepper)
    ) {
      return fromStepper;
    }

    // 3. Linked proforma IDs from other documents
    const linkedCandidate = sanitizeDocId(
      extractLinkedProformaId(shipmentInstructionData) ||
      extractLinkedProformaId(initialShipmentInstructionData) ||
      extractLinkedProformaId(contractData) ||
      extractLinkedProformaId(initialContractData) ||
      extractLinkedProformaId(confirmationData) ||
      extractLinkedProformaId(initialData)
    );
    if (
      linkedCandidate &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(linkedCandidate)
    ) {
      return linkedCandidate;
    }

    // 4. Fallback to cleanDraftId or parent workflow ID if isProforma
    const cleanDraftId = sanitizeDocId(draftId);
    if (
      isProforma &&
      cleanDraftId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(cleanDraftId)
    ) {
      return cleanDraftId;
    }

    if (isProforma && (canonicalContractId || effectiveConfirmationId)) {
      return canonicalContractId || effectiveConfirmationId;
    }

    return '';
  }, [
    proformaData,
    initialProformaData,
    steps,
    selectedStep,
    effectiveConfirmationId,
    canonicalContractId,
    shipmentInstructionData,
    initialShipmentInstructionData,
    contractData,
    initialContractData,
    confirmationData,
    initialData,
    isProforma,
    draftId,
    initialId,
  ]);

  // Canonical Shipment Instruction Document ID
  const canonicalShipmentInstructionId = useMemo(() => {
    const hasShipmentMarkers = (data: any) =>
      Boolean(
        data &&
        (data.shipment_instruction_number || data.booking_number || data.booking_no || data.shipping_bill_number || data.shipping_bill_no || data.bl_number || data._is_shipment_loaded || data.shipment_instruction_id)
      );

    // 1. Direct shipment instruction data
    const directShipmentId = sanitizeDocId(
      (hasShipmentMarkers(shipmentInstructionData) ? shipmentInstructionData?.id || shipmentInstructionData?._id : '') ||
      shipmentInstructionData?.shipment_instruction_id ||
      shipmentInstructionData?.shipment_id ||
      (hasShipmentMarkers(initialShipmentInstructionData) ? initialShipmentInstructionData?.id || initialShipmentInstructionData?._id : '') ||
      initialShipmentInstructionData?.shipment_instruction_id ||
      initialShipmentInstructionData?.shipment_id
    );
    if (
      directShipmentId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(directShipmentId)
    ) {
      return directShipmentId;
    }

    // 2. From Stepper step (current selection or shipment step)
    const shipmentStep = getShipmentInstructionStep(steps, selectedStep);
    const fromStepper = sanitizeDocId(
      extractStepRedirectId(shipmentStep) ||
      getShipmentInstructionIdFromStepper(steps, selectedStep) ||
      shipmentStep?.shipment_instruction_id ||
      (shipmentStep as any)?.shipmentInstructionId ||
      shipmentStep?.shipment_id ||
      (shipmentStep as any)?.shipmentId ||
      shipmentStep?.redirect_id ||
      (shipmentStep as any)?.redirectId
    );
    if (
      fromStepper &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(fromStepper)
    ) {
      return fromStepper;
    }

    // 3. Linked shipment IDs from other documents (strictly shipment_instruction_id, NEVER party instruction_id)
    const linkedCandidate = sanitizeDocId(
      extractLinkedShipmentInstructionId(proformaData) ||
      extractLinkedShipmentInstructionId(initialProformaData) ||
      extractLinkedShipmentInstructionId(contractData) ||
      extractLinkedShipmentInstructionId(initialContractData) ||
      extractLinkedShipmentInstructionId(confirmationData) ||
      extractLinkedShipmentInstructionId(initialData)
    );
    if (
      linkedCandidate &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(linkedCandidate)
    ) {
      return linkedCandidate;
    }

    // 4. Fallback to cleanDraftId or parent workflow ID if isShipmentInstruction
    const cleanDraftId = sanitizeDocId(draftId);
    if (
      (isShipmentInstruction || isInitialDocWorkflow) &&
      cleanDraftId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(cleanDraftId)
    ) {
      return cleanDraftId;
    }

    if ((isShipmentInstruction || isInitialDocWorkflow) && (canonicalProformaId || canonicalContractId || effectiveConfirmationId)) {
      return canonicalProformaId || canonicalContractId || effectiveConfirmationId;
    }

    return '';
  }, [
    shipmentInstructionData,
    initialShipmentInstructionData,
    steps,
    selectedStep,
    effectiveConfirmationId,
    canonicalContractId,
    canonicalProformaId,
    proformaData,
    initialProformaData,
    contractData,
    initialContractData,
    confirmationData,
    initialData,
    isShipmentInstruction,
    isInitialDocWorkflow,
    draftId,
    initialId,
  ]);

  // Canonical Bill of Lading Document ID
  const canonicalBillOfLadingId = useMemo(() => {
    const hasLadingMarkers = (data: any) =>
      Boolean(
        data &&
        (data.bl_no || data.bill_of_lading_number || data.vessel_name || data._is_lading_loaded || data.bill_of_lading_id)
      );

    // 1. Direct bill of lading data
    const directLadingId = sanitizeDocId(
      (hasLadingMarkers(billOfLadingData) ? billOfLadingData?.id || billOfLadingData?._id : '') ||
      billOfLadingData?.bill_of_lading_id ||
      billOfLadingData?.lading_id ||
      (hasLadingMarkers(initialBillOfLadingData) ? initialBillOfLadingData?.id || initialBillOfLadingData?._id : '') ||
      initialBillOfLadingData?.bill_of_lading_id ||
      initialBillOfLadingData?.lading_id
    );
    if (
      directLadingId &&
      !(/^\d+$/.test(directLadingId) && Number(directLadingId) <= 20) &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|invoice|step-\d+)$/i.test(directLadingId)
    ) {
      return directLadingId;
    }

    // 2. From Stepper step (current selection or bill of lading step)
    const ladingStep = getBillOfLadingStep(steps, selectedStep);
    const fromStepper = sanitizeDocId(
      getStepSelfId(ladingStep) ||
      getBillOfLadingIdFromStepper(steps, selectedStep) ||
      ladingStep?.bill_of_lading_id ||
      (ladingStep as any)?.billOfLadingId ||
      ladingStep?.lading_id ||
      (ladingStep as any)?.ladingId ||
      ladingStep?.redirect_id ||
      (ladingStep as any)?.redirectId
    );
    if (
      fromStepper &&
      !(/^\d+$/.test(fromStepper) && Number(fromStepper) <= 20) &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|invoice|step-\d+)$/i.test(fromStepper)
    ) {
      return fromStepper;
    }

    // 3. Linked bill of lading IDs from other documents
    const linkedCandidate = sanitizeDocId(
      extractLinkedBillOfLadingId(billOfLadingData) ||
      extractLinkedBillOfLadingId(initialBillOfLadingData) ||
      extractLinkedBillOfLadingId(shipmentInstructionData) ||
      extractLinkedBillOfLadingId(initialShipmentInstructionData) ||
      extractLinkedBillOfLadingId(proformaData) ||
      extractLinkedBillOfLadingId(contractData) ||
      extractLinkedBillOfLadingId(confirmationData)
    );
    if (
      linkedCandidate &&
      linkedCandidate !== effectiveConfirmationId &&
      linkedCandidate !== canonicalContractId &&
      linkedCandidate !== canonicalProformaId &&
      linkedCandidate !== canonicalShipmentInstructionId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|step-\d+)$/i.test(linkedCandidate)
    ) {
      return linkedCandidate;
    }

    const cleanDraftId = sanitizeDocId(draftId);
    if (
      isBillOfLading &&
      cleanDraftId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|step-\d+)$/i.test(cleanDraftId)
    ) {
      return cleanDraftId;
    }

    if (isBillOfLading && (canonicalShipmentInstructionId || effectiveConfirmationId)) {
      return canonicalShipmentInstructionId || effectiveConfirmationId;
    }

    return '';
  }, [
    billOfLadingData,
    initialBillOfLadingData,
    steps,
    selectedStep,
    effectiveConfirmationId,
    canonicalContractId,
    canonicalProformaId,
    canonicalShipmentInstructionId,
    shipmentInstructionData,
    initialShipmentInstructionData,
    proformaData,
    contractData,
    confirmationData,
    isBillOfLading,
    draftId,
  ]);

  // Custom Invoice ID extracted strictly from Stepper list / selectedStep or linked discovery
  const canonicalCustomInvoiceId = useMemo(() => {
    const hasCustomMarkers = (data: any) =>
      Boolean(
        data &&
        (data.custom_invoice_number || data.custom_invoice_id || data._is_custom_invoice_loaded)
      );

    // 1. Direct custom invoice data
    const directCustomId = sanitizeDocId(
      (hasCustomMarkers(customInvoiceData) ? customInvoiceData?.id || customInvoiceData?._id : '') ||
      customInvoiceData?.custom_invoice_id ||
      customInvoiceData?.invoice_id ||
      (hasCustomMarkers(initialCustomInvoiceData) ? initialCustomInvoiceData?.id || initialCustomInvoiceData?._id : '') ||
      initialCustomInvoiceData?.custom_invoice_id ||
      initialCustomInvoiceData?.invoice_id
    );
    if (
      directCustomId &&
      directCustomId !== effectiveConfirmationId &&
      directCustomId !== canonicalContractId &&
      directCustomId !== canonicalProformaId &&
      directCustomId !== canonicalShipmentInstructionId &&
      directCustomId !== canonicalBillOfLadingId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|invoice|step-\d+)$/i.test(directCustomId)
    ) {
      return directCustomId;
    }

    // 2. From Stepper step (current selection or custom invoice step)
    const customStep = getCustomInvoiceStep(steps, selectedStep);
    const fromStepper = sanitizeDocId(
      getStepSelfId(customStep) ||
      getCustomInvoiceIdFromStepper(steps, selectedStep) ||
      customStep?.custom_invoice_id ||
      (customStep as any)?.customInvoiceId ||
      customStep?.invoice_id ||
      (customStep as any)?.invoiceId ||
      customStep?.redirect_id ||
      (customStep as any)?.redirectId
    );
    if (
      fromStepper &&
      !(/^\d+$/.test(fromStepper) && Number(fromStepper) <= 20) &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|invoice|step-\d+)$/i.test(fromStepper)
    ) {
      return fromStepper;
    }

    // 3. Linked custom invoice IDs from other documents
    const linkedCandidate = sanitizeDocId(
      extractLinkedCustomInvoiceId(customInvoiceData) ||
      extractLinkedCustomInvoiceId(initialCustomInvoiceData) ||
      extractLinkedCustomInvoiceId(billOfLadingData) ||
      extractLinkedCustomInvoiceId(initialBillOfLadingData) ||
      extractLinkedCustomInvoiceId(shipmentInstructionData) ||
      extractLinkedCustomInvoiceId(initialShipmentInstructionData) ||
      extractLinkedCustomInvoiceId(proformaData) ||
      extractLinkedCustomInvoiceId(contractData) ||
      extractLinkedCustomInvoiceId(confirmationData)
    );
    if (
      linkedCandidate &&
      linkedCandidate !== effectiveConfirmationId &&
      linkedCandidate !== canonicalContractId &&
      linkedCandidate !== canonicalProformaId &&
      linkedCandidate !== canonicalShipmentInstructionId &&
      linkedCandidate !== canonicalBillOfLadingId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|invoice|step-\d+)$/i.test(linkedCandidate)
    ) {
      return linkedCandidate;
    }

    const cleanDraftId = sanitizeDocId(draftId);
    if (
      isCustomInvoice &&
      cleanDraftId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|invoice|step-\d+)$/i.test(cleanDraftId)
    ) {
      return cleanDraftId;
    }

    if (isCustomInvoice && (canonicalBillOfLadingId || canonicalShipmentInstructionId || effectiveConfirmationId)) {
      return canonicalBillOfLadingId || canonicalShipmentInstructionId || effectiveConfirmationId;
    }

    return '';
  }, [
    customInvoiceData,
    initialCustomInvoiceData,
    steps,
    selectedStep,
    effectiveConfirmationId,
    canonicalContractId,
    canonicalProformaId,
    canonicalShipmentInstructionId,
    canonicalBillOfLadingId,
    billOfLadingData,
    initialBillOfLadingData,
    shipmentInstructionData,
    initialShipmentInstructionData,
    proformaData,
    contractData,
    confirmationData,
    isCustomInvoice,
    draftId,
    initialId,
  ]);

  // Canonical Commercial Invoice Document ID
  const canonicalCommercialInvoiceId = useMemo(() => {
    const hasCommercialMarkers = (data: any) =>
      Boolean(
        data &&
        (data.commercial_invoice_number || data.commercial_invoice_id || data._is_commercial_invoice_loaded)
      );

    const directCommercialId = sanitizeDocId(
      (hasCommercialMarkers(commercialInvoiceData) ? commercialInvoiceData?.id || commercialInvoiceData?._id : '') ||
      commercialInvoiceData?.commercial_invoice_id ||
      (hasCommercialMarkers(initialCommercialInvoiceData) ? initialCommercialInvoiceData?.id || initialCommercialInvoiceData?._id : '') ||
      initialCommercialInvoiceData?.commercial_invoice_id
    );
    if (
      directCommercialId &&
      directCommercialId !== effectiveConfirmationId &&
      directCommercialId !== canonicalContractId &&
      directCommercialId !== canonicalProformaId &&
      directCommercialId !== canonicalShipmentInstructionId &&
      directCommercialId !== canonicalBillOfLadingId &&
      directCommercialId !== canonicalCustomInvoiceId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|invoice|step-\d+)$/i.test(directCommercialId)
    ) {
      return directCommercialId;
    }

    const commercialStep = getCommercialInvoiceStep(steps, selectedStep);
    const fromStepper = sanitizeDocId(
      getStepSelfId(commercialStep) ||
      getCommercialInvoiceIdFromStepper(steps, selectedStep) ||
      commercialStep?.commercial_invoice_id ||
      (commercialStep as any)?.commercialInvoiceId ||
      commercialStep?.redirect_id ||
      (commercialStep as any)?.redirectId
    );
    if (
      fromStepper &&
      !(/^\d+$/.test(fromStepper) && Number(fromStepper) <= 20) &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|invoice|step-\d+)$/i.test(fromStepper)
    ) {
      return fromStepper;
    }

    const linkedCandidate = sanitizeDocId(
      extractLinkedCommercialInvoiceId(commercialInvoiceData) ||
      extractLinkedCommercialInvoiceId(initialCommercialInvoiceData) ||
      extractLinkedCommercialInvoiceId(customInvoiceData) ||
      extractLinkedCommercialInvoiceId(initialCustomInvoiceData) ||
      extractLinkedCommercialInvoiceId(billOfLadingData) ||
      extractLinkedCommercialInvoiceId(shipmentInstructionData) ||
      extractLinkedCommercialInvoiceId(proformaData) ||
      extractLinkedCommercialInvoiceId(contractData) ||
      extractLinkedCommercialInvoiceId(confirmationData)
    );
    if (
      linkedCandidate &&
      linkedCandidate !== effectiveConfirmationId &&
      linkedCandidate !== canonicalContractId &&
      linkedCandidate !== canonicalProformaId &&
      linkedCandidate !== canonicalShipmentInstructionId &&
      linkedCandidate !== canonicalBillOfLadingId &&
      linkedCandidate !== canonicalCustomInvoiceId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|invoice|step-\d+)$/i.test(linkedCandidate)
    ) {
      return linkedCandidate;
    }

    const cleanDraftId = sanitizeDocId(draftId);
    if (
      isCommercialInvoice &&
      cleanDraftId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|invoice|step-\d+)$/i.test(cleanDraftId)
    ) {
      return cleanDraftId;
    }

    if (isCommercialInvoice && (canonicalCustomInvoiceId || canonicalBillOfLadingId || canonicalShipmentInstructionId || effectiveConfirmationId)) {
      return canonicalCustomInvoiceId || canonicalBillOfLadingId || canonicalShipmentInstructionId || effectiveConfirmationId;
    }

    return '';
  }, [
    commercialInvoiceData,
    initialCommercialInvoiceData,
    steps,
    selectedStep,
    effectiveConfirmationId,
    canonicalContractId,
    canonicalProformaId,
    canonicalShipmentInstructionId,
    canonicalBillOfLadingId,
    canonicalCustomInvoiceId,
    customInvoiceData,
    initialCustomInvoiceData,
    billOfLadingData,
    shipmentInstructionData,
    proformaData,
    contractData,
    confirmationData,
    isCommercialInvoice,
    draftId,
  ]);

  // Canonical Packing List ID
  const canonicalPackingListId = useMemo(() => {
    const hasPackingMarkers = (d: any) =>
      Boolean(
        d?.packing_list_number ||
        d?.packing_list_no ||
        d?.packing_list ||
        d?.packingList ||
        d?.packing_list_id ||
        d?._is_packing_list_loaded
      );

    const directPackingId = sanitizeDocId(
      (hasPackingMarkers(packingListData) ? packingListData?.id || packingListData?._id : '') ||
      packingListData?.packing_list_id ||
      (hasPackingMarkers(initialPackingListData) ? initialPackingListData?.id || initialPackingListData?._id : '') ||
      initialPackingListData?.packing_list_id
    );
    if (
      directPackingId &&
      directPackingId !== effectiveConfirmationId &&
      directPackingId !== canonicalContractId &&
      directPackingId !== canonicalProformaId &&
      directPackingId !== canonicalShipmentInstructionId &&
      directPackingId !== canonicalBillOfLadingId &&
      directPackingId !== canonicalCustomInvoiceId &&
      directPackingId !== canonicalCommercialInvoiceId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|invoice|step-\d+)$/i.test(directPackingId)
    ) {
      return directPackingId;
    }

    const packingStep = getPackingListStep(steps, selectedStep);
    const fromStepper = sanitizeDocId(
      getStepSelfId(packingStep) ||
      getPackingListIdFromStepper(steps, selectedStep) ||
      packingStep?.packing_list_id ||
      (packingStep as any)?.packingListId ||
      packingStep?.redirect_id ||
      (packingStep as any)?.redirectId
    );
    if (
      fromStepper &&
      !(/^\d+$/.test(fromStepper) && Number(fromStepper) <= 20) &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|invoice|step-\d+)$/i.test(fromStepper)
    ) {
      return fromStepper;
    }

    const linkedCandidate = sanitizeDocId(
      extractLinkedPackingListId(packingListData) ||
      extractLinkedPackingListId(initialPackingListData) ||
      extractLinkedPackingListId(commercialInvoiceData) ||
      extractLinkedPackingListId(customInvoiceData) ||
      extractLinkedPackingListId(billOfLadingData) ||
      extractLinkedPackingListId(shipmentInstructionData) ||
      extractLinkedPackingListId(proformaData) ||
      extractLinkedPackingListId(contractData) ||
      extractLinkedPackingListId(confirmationData)
    );
    if (
      linkedCandidate &&
      linkedCandidate !== effectiveConfirmationId &&
      linkedCandidate !== canonicalContractId &&
      linkedCandidate !== canonicalProformaId &&
      linkedCandidate !== canonicalShipmentInstructionId &&
      linkedCandidate !== canonicalBillOfLadingId &&
      linkedCandidate !== canonicalCustomInvoiceId &&
      linkedCandidate !== canonicalCommercialInvoiceId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|invoice|step-\d+)$/i.test(linkedCandidate)
    ) {
      return linkedCandidate;
    }

    const cleanDraftId = sanitizeDocId(draftId);
    if (
      isPackingList &&
      cleanDraftId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|invoice|step-\d+)$/i.test(cleanDraftId)
    ) {
      return cleanDraftId;
    }

    if (isPackingList && (canonicalCommercialInvoiceId || canonicalCustomInvoiceId || canonicalShipmentInstructionId || effectiveConfirmationId)) {
      return canonicalCommercialInvoiceId || canonicalCustomInvoiceId || canonicalShipmentInstructionId || effectiveConfirmationId;
    }

    return '';
  }, [
    packingListData,
    initialPackingListData,
    steps,
    selectedStep,
    effectiveConfirmationId,
    canonicalContractId,
    canonicalProformaId,
    canonicalShipmentInstructionId,
    canonicalBillOfLadingId,
    canonicalCustomInvoiceId,
    canonicalCommercialInvoiceId,
    commercialInvoiceData,
    customInvoiceData,
    billOfLadingData,
    shipmentInstructionData,
    proformaData,
    contractData,
    confirmationData,
    isPackingList,
    draftId,
  ]);

  // Canonical Phyto Certificate ID
  const canonicalPhytoCertificateId = useMemo(() => {
    const hasPhytoMarkers = (d: any) =>
      Boolean(
        d?.phyto_certificate_number ||
        d?.phyto_certificate_no ||
        d?.phyto_number ||
        d?.phyto_certificate ||
        d?.phytoCertificate ||
        d?.phyto_certificate_id ||
        d?._is_phyto_certificate_loaded
      );

    const directPhytoId = sanitizeDocId(
      (hasPhytoMarkers(phytoCertificateData) ? phytoCertificateData?.id || phytoCertificateData?._id : '') ||
      phytoCertificateData?.phyto_certificate_id ||
      (hasPhytoMarkers(initialPhytoCertificateData) ? initialPhytoCertificateData?.id || initialPhytoCertificateData?._id : '') ||
      initialPhytoCertificateData?.phyto_certificate_id
    );
    if (
      directPhytoId &&
      directPhytoId !== effectiveConfirmationId &&
      directPhytoId !== canonicalContractId &&
      directPhytoId !== canonicalProformaId &&
      directPhytoId !== canonicalShipmentInstructionId &&
      directPhytoId !== canonicalBillOfLadingId &&
      directPhytoId !== canonicalCustomInvoiceId &&
      directPhytoId !== canonicalCommercialInvoiceId &&
      directPhytoId !== canonicalPackingListId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|phyto|phyto-certificate|invoice|step-\d+)$/i.test(directPhytoId)
    ) {
      return directPhytoId;
    }

    const phytoStep = getPhytoCertificateStep(steps, selectedStep);
    const fromStepper = sanitizeDocId(
      getStepSelfId(phytoStep) ||
      getPhytoCertificateIdFromStepper(steps, selectedStep) ||
      phytoStep?.phyto_certificate_id ||
      (phytoStep as any)?.phytoCertificateId ||
      phytoStep?.redirect_id ||
      (phytoStep as any)?.redirectId
    );
    if (
      fromStepper &&
      !(/^\d+$/.test(fromStepper) && Number(fromStepper) <= 20) &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|phyto|phyto-certificate|invoice|step-\d+)$/i.test(fromStepper)
    ) {
      return fromStepper;
    }

    const linkedCandidate = sanitizeDocId(
      extractLinkedPhytoCertificateId(phytoCertificateData) ||
      extractLinkedPhytoCertificateId(initialPhytoCertificateData) ||
      extractLinkedPhytoCertificateId(packingListData) ||
      extractLinkedPhytoCertificateId(commercialInvoiceData) ||
      extractLinkedPhytoCertificateId(customInvoiceData) ||
      extractLinkedPhytoCertificateId(billOfLadingData) ||
      extractLinkedPhytoCertificateId(shipmentInstructionData) ||
      extractLinkedPhytoCertificateId(proformaData) ||
      extractLinkedPhytoCertificateId(contractData) ||
      extractLinkedPhytoCertificateId(confirmationData)
    );
    if (
      linkedCandidate &&
      linkedCandidate !== effectiveConfirmationId &&
      linkedCandidate !== canonicalContractId &&
      linkedCandidate !== canonicalProformaId &&
      linkedCandidate !== canonicalShipmentInstructionId &&
      linkedCandidate !== canonicalBillOfLadingId &&
      linkedCandidate !== canonicalCustomInvoiceId &&
      linkedCandidate !== canonicalCommercialInvoiceId &&
      linkedCandidate !== canonicalPackingListId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|phyto|phyto-certificate|invoice|step-\d+)$/i.test(linkedCandidate)
    ) {
      return linkedCandidate;
    }

    const cleanDraftId = sanitizeDocId(draftId);
    if (
      isPhytoCertificate &&
      cleanDraftId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|phyto|phyto-certificate|invoice|step-\d+)$/i.test(cleanDraftId)
    ) {
      return cleanDraftId;
    }

    if (isPhytoCertificate && (canonicalPackingListId || canonicalCommercialInvoiceId || canonicalCustomInvoiceId || canonicalShipmentInstructionId || effectiveConfirmationId)) {
      return canonicalPackingListId || canonicalCommercialInvoiceId || canonicalCustomInvoiceId || canonicalShipmentInstructionId || effectiveConfirmationId;
    }

    return '';
  }, [
    phytoCertificateData,
    initialPhytoCertificateData,
    steps,
    selectedStep,
    effectiveConfirmationId,
    canonicalContractId,
    canonicalProformaId,
    canonicalShipmentInstructionId,
    canonicalBillOfLadingId,
    canonicalCustomInvoiceId,
    canonicalCommercialInvoiceId,
    canonicalPackingListId,
    packingListData,
    commercialInvoiceData,
    customInvoiceData,
    billOfLadingData,
    shipmentInstructionData,
    proformaData,
    contractData,
    confirmationData,
    isPhytoCertificate,
    draftId,
  ]);

  // Buyer Instruction ID for Shipment Instruction (passed to consignee and notify party APIs).
  // Strictly prioritizes buyer_instruction_id from the SI response, falling back only to this trade's Importer.
  const buyerInstructionIdForShipment = useMemo(() => {
    const candidates = [
      // 1. Primary: SI response buyer_instruction_id
      shipmentInstructionData?.buyer_instruction_id,
      shipmentInstructionData?.buyerInstructionId,
      shipmentInstructionData?.shipment_instruction?.buyer_instruction_id,
      shipmentInstructionData?.shipment_instruction?.buyerInstructionId,
      shipmentInstructionData?.data?.buyer_instruction_id,
      shipmentInstructionData?.buyer?.buyer_instruction_id,
      typeof shipmentInstructionData?.buyer_instruction === 'object' && shipmentInstructionData?.buyer_instruction !== null
        ? shipmentInstructionData.buyer_instruction.id || shipmentInstructionData.buyer_instruction._id || shipmentInstructionData.buyer_instruction.buyer_instruction_id
        : '',
      initialShipmentInstructionData?.buyer_instruction_id,
      initialShipmentInstructionData?.buyerInstructionId,
      initialShipmentInstructionData?.shipment_instruction?.buyer_instruction_id,
      initialShipmentInstructionData?.data?.buyer_instruction_id,
      initialShipmentInstructionData?.buyer?.buyer_instruction_id,
      // 2. Fallback: Trade's own Importer buyer_instruction_id from upstream documents
      proformaData?.buyer_instruction_id,
      proformaData?.buyerInstructionId,
      initialProformaData?.buyer_instruction_id,
      contractData?.buyer_instruction_id,
      contractData?.buyerInstructionId,
      initialContractData?.buyer_instruction_id,
      confirmationData?.buyer_instruction_id,
      confirmationData?.buyerInstructionId,
      initialData?.buyer_instruction_id,
      // 3. Last resort: buyer_id on SI or upstream trade documents
      shipmentInstructionData?.buyer_id,
      shipmentInstructionData?.buyerId,
      shipmentInstructionData?.buyer?.id,
      shipmentInstructionData?.buyer?._id,
      initialShipmentInstructionData?.buyer_id,
      initialShipmentInstructionData?.buyerId,
      proformaData?.buyer_id,
      contractData?.buyer_id,
      confirmationData?.buyer_id,
      initialData?.buyer_id,
    ];
    for (const c of candidates) {
      const clean = sanitizeDocId(c);
      if (clean) return clean;
    }
    return '';
  }, [
    shipmentInstructionData,
    initialShipmentInstructionData,
    proformaData,
    initialProformaData,
    contractData,
    initialContractData,
    confirmationData,
    initialData,
  ]);

  // Resolved Confirmation Number:
  // "Jab tak confirmation save as draft nahi hota tab tak kucch nahi aayega save as draft karoge to Confirmation ki api response me confirmation_number me null ki jagah value mile to usko stepper ke uper me confirmation number dikhana hai"
  const resolvedConfirmationNumber = useMemo(() => {
    return cleanDocNumber(
      confirmationData?.confirmation_number ||
      confirmationData?.confirmationNumber ||
      confirmationData?.confirmation?.confirmation_number ||
      initialData?.confirmation_number ||
      initialData?.confirmationNumber ||
      initialData?.confirmation?.confirmation_number ||
      contractData?.confirmation_number ||
      contractData?.confirmationNumber ||
      contractData?.confirmation?.confirmation_number ||
      initialContractData?.confirmation_number ||
      initialContractData?.confirmationNumber ||
      initialContractData?.confirmation?.confirmation_number ||
      steps.find((s) => isConfirmationStep(s))?.confirmation_number
    );
  }, [confirmationData, initialData, contractData, initialContractData, steps]);

  // Resolved Contract Number:
  // "and if contract vale hai to usme jab tak contract_number contract ke response me null aaye to tab tak confirmation number and contract number dikhe to tab se vaha contract number dikhana hai"
  const resolvedContractNumber = useMemo(() => {
    if (pinnedWorkflowContractNumber && !isPureDbId(pinnedWorkflowContractNumber) && !isLikelyInvoiceNumber(pinnedWorkflowContractNumber)) {
      return pinnedWorkflowContractNumber;
    }
    const candidates = [
      extractDocContractNumber(contractData),
      extractDocContractNumber(initialContractData),
      cleanDocNumber(contractData?.contract_number),
      cleanDocNumber(contractData?.contractNumber),
      cleanDocNumber(contractData?.contract_no),
      cleanDocNumber(contractData?.contract?.contract_number),
      cleanDocNumber(contractData?.contract?.contract_no),
      cleanDocNumber(initialContractData?.contract_number),
      cleanDocNumber(initialContractData?.contractNumber),
      cleanDocNumber(initialContractData?.contract_no),
      cleanDocNumber(initialContractData?.contract?.contract_number),
      cleanDocNumber(initialContractData?.contract?.contract_no),
      cleanDocNumber(steps.find((s) => isContractStep(s))?.contract_number),
    ];
    for (const c of candidates) {
      if (c && !isPureDbId(c) && !isLikelyInvoiceNumber(c)) {
        return c;
      }
    }
    return null;
  }, [contractData, initialContractData, steps, pinnedWorkflowContractNumber]);

  // Check if Shipment Instruction is completed:
  // "if SI complete ho gya hai to si ki id use karke Stepper karna hai"
  const isShipmentInstructionComplete = useMemo(() => {
    const shipmentStep = steps.find((s) => isShipmentInstructionStep(s));
    if (shipmentStep) {
      const norm = normalizeStepStatus(
        shipmentStep.status || (shipmentStep as any).document_status || (shipmentStep as any).step_status,
        shipmentStep
      );
      if (norm === 'completed') return true;
    }
    const normData = normalizeStepStatus(
      shipmentInstructionData?.status ||
      shipmentInstructionData?.shipment_status ||
      shipmentInstructionData?.document_status ||
      shipmentInstructionData?.step_status,
      shipmentInstructionData
    );
    if (normData === 'completed') return true;
    const normInit = normalizeStepStatus(
      initialShipmentInstructionData?.status ||
      initialShipmentInstructionData?.shipment_status ||
      initialShipmentInstructionData?.document_status ||
      initialShipmentInstructionData?.step_status,
      initialShipmentInstructionData
    );
    if (normInit === 'completed') return true;
    return false;
  }, [steps, shipmentInstructionData, initialShipmentInstructionData]);

  // The concrete Shipment Instruction ID:
  const effectiveShipmentInstructionId = useMemo(() => {
    const step = steps.find((s) => isShipmentInstructionStep(s));
    const candStep = sanitizeDocId(
      extractStepRedirectId(step) ||
      getStepSelfId(step) ||
      step?.shipment_instruction_id ||
      (step as any)?.shipmentInstructionId ||
      step?.shipment_id ||
      (step as any)?.shipmentId ||
      step?.redirect_id ||
      (step as any)?.redirectId
    );
    if (candStep && !isPureDbId(candStep)) return candStep;

    const candData = sanitizeDocId(
      shipmentInstructionData?.shipment_instruction_id ||
      shipmentInstructionData?.id ||
      shipmentInstructionData?._id ||
      shipmentInstructionData?.shipment_id ||
      initialShipmentInstructionData?.shipment_instruction_id ||
      initialShipmentInstructionData?.id ||
      initialShipmentInstructionData?._id ||
      initialShipmentInstructionData?.shipment_id
    );
    if (candData && !isPureDbId(candData)) return candData;

    if (canonicalShipmentInstructionId && !isPureDbId(canonicalShipmentInstructionId)) {
      return canonicalShipmentInstructionId;
    }

    if (isInitialDocWorkflow && initialId && !isPureDbId(initialId)) {
      return initialId;
    }

    return '';
  }, [
    steps,
    shipmentInstructionData,
    initialShipmentInstructionData,
    canonicalShipmentInstructionId,
    isInitialDocWorkflow,
    initialId,
  ]);

  // Keep pinned anchor synchronized if SI completes or real doc ID becomes available
  useEffect(() => {
    if (isInitialDocWorkflow) {
      const liveDocId = sanitizeDocId(
        effectiveShipmentInstructionId ||
        canonicalShipmentInstructionId ||
        initialId ||
        shipmentInstructionData?.id ||
        shipmentInstructionData?._id ||
        shipmentInstructionData?.shipment_instruction_id
      );
      if (liveDocId && !isPureDbId(liveDocId)) {
        if (pinnedWorkflowAnchorId !== liveDocId) {
          setPinnedWorkflowAnchorId(liveDocId);
        }
        if (pinnedWorkflowAnchorType !== 'document') {
          setPinnedWorkflowAnchorType('document');
        }
      }
    } else if (isShipmentInstructionComplete && effectiveShipmentInstructionId) {
      // "if SI complete ho gya hai to si ki id use karke Stepper karna hai and har bar usme jo form hai us form pe id change nahi karni hai stepper me just vo har form move karne par refresh karavani hai properly"
      if (pinnedWorkflowAnchorId !== effectiveShipmentInstructionId) {
        setPinnedWorkflowAnchorId(effectiveShipmentInstructionId);
      }
      if (pinnedWorkflowAnchorType !== 'document') {
        setPinnedWorkflowAnchorType('document');
      }
    }
  }, [
    isInitialDocWorkflow,
    effectiveShipmentInstructionId,
    canonicalShipmentInstructionId,
    initialId,
    shipmentInstructionData,
    isShipmentInstructionComplete,
    pinnedWorkflowAnchorId,
    pinnedWorkflowAnchorType,
  ]);

  // Check if this workflow is for a specific partial shipment / document:
  const isDocumentWorkflow = useMemo(() => {
    if (pinnedWorkflowAnchorType === 'document' && pinnedWorkflowAnchorId) return true;
    if (isInitialDocWorkflow) return true;

    const stepParam = (initialStepParam || '').toLowerCase().trim();
    const isDocStepParam = [
      'shipment',
      'shipment_instruction',
      'shipment-instruction',
      'instruction',
      'document',
      'bill-of-lading',
      'bill_of_lading',
      'lading',
      'bl',
      'custom-invoice',
      'custom_invoice',
      'custom',
      'commercial-invoice',
      'commercial_invoice',
      'commercial',
      'packing-list',
      'packing_list',
      'packing',
      'phyto-certificate',
      'phyto_certificate',
      'phyto',
      'invoice',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ].includes(stepParam);

    return Boolean(
      (isShipmentInstructionComplete && effectiveShipmentInstructionId) ||
      isDocStepParam ||
      isShipmentInstruction ||
      isBillOfLading ||
      isCustomInvoice ||
      isCommercialInvoice ||
      isPackingList ||
      isPhytoCertificate ||
      (canonicalShipmentInstructionId && !canonicalContractId && !effectiveConfirmationId)
    );
  }, [
    pinnedWorkflowAnchorType,
    pinnedWorkflowAnchorId,
    isInitialDocWorkflow,
    initialStepParam,
    isShipmentInstructionComplete,
    effectiveShipmentInstructionId,
    isShipmentInstruction,
    isBillOfLading,
    isCustomInvoice,
    isCommercialInvoice,
    isPackingList,
    isPhytoCertificate,
    canonicalShipmentInstructionId,
    canonicalContractId,
    effectiveConfirmationId,
  ]);

  // Active document ID and type for stepper:
  // "if SI complete ho gya hai to si ki id use karke Stepper karna hai and har bar usme jo form hai us form pe vo nahi karna hai hume kya bolte hai id change nahi karni hai stepper me just vo har form move karne par refresh karavani hai properly and also SI ka form open hua to uske resposnse me contract_id mile vo dikhani hai and if contract vala status hai to vo to proper solve hi hai and contract ke step me move hone par stepper me id change nahi karvani hai vaha sirf refresh hi karvana hai"
  const workflowAnchorType = useMemo(() => {
    // 1. If pinned to a document workflow, strictly keep 'document'
    if (pinnedWorkflowAnchorType === 'document' && pinnedWorkflowAnchorId) {
      return 'document';
    }
    // 2. If SI is complete, strictly anchor stepper to 'document' (SI)
    if (isShipmentInstructionComplete && effectiveShipmentInstructionId) {
      return 'document';
    }
    // 3. If opened as a document workflow with an active SI ID
    if (isDocumentWorkflow && (effectiveShipmentInstructionId || initialId)) {
      return 'document';
    }
    // 4. If confirmation workflow, strictly keep 'confirmation'
    if (effectiveConfirmationId) {
      return 'confirmation';
    }
    // 5. If pinned to contract
    if (pinnedWorkflowAnchorType === 'contract') {
      return 'contract';
    }
    // 6. If contract workflow / contract status
    if (canonicalContractId || isContract) {
      return 'contract';
    }
    // 7. Default to confirmation
    return 'confirmation';
  }, [
    pinnedWorkflowAnchorType,
    pinnedWorkflowAnchorId,
    isShipmentInstructionComplete,
    effectiveShipmentInstructionId,
    isDocumentWorkflow,
    initialId,
    effectiveConfirmationId,
    canonicalContractId,
    isContract,
  ]);

  const workflowAnchorId = useMemo(() => {
    // 1. If pinned to a document workflow, strictly keep pinnedWorkflowAnchorId
    if (pinnedWorkflowAnchorType === 'document' && pinnedWorkflowAnchorId) {
      return pinnedWorkflowAnchorId;
    }
    // 2. If SI is complete, stepper strictly uses SI's ID
    if (isShipmentInstructionComplete && effectiveShipmentInstructionId) {
      return effectiveShipmentInstructionId;
    }
    // 3. If opened as a document workflow with an active SI ID
    if (isDocumentWorkflow && (effectiveShipmentInstructionId || initialId)) {
      return effectiveShipmentInstructionId || initialId;
    }
    // 4. If confirmation workflow, strictly anchor to confirmation ID!
    if (effectiveConfirmationId) {
      return effectiveConfirmationId;
    }
    // 5. If pinned to contract
    if (pinnedWorkflowAnchorType === 'contract' && pinnedWorkflowAnchorId) {
      return pinnedWorkflowAnchorId;
    }
    if (canonicalContractId) {
      return canonicalContractId;
    }
    if (isContract) {
      const cleanDraft = sanitizeDocId(draftId);
      return canonicalContractId || sanitizeDocId(initialId) || (cleanDraft && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(cleanDraft) ? cleanDraft : '');
    }
    // 6. Confirmation / general fallback
    const cleanDraft = sanitizeDocId(draftId);
    return (
      pinnedWorkflowAnchorId ||
      effectiveConfirmationId ||
      canonicalContractId ||
      sanitizeDocId(initialId) ||
      (cleanDraft && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(cleanDraft) ? cleanDraft : '') ||
      ''
    );
  }, [
    pinnedWorkflowAnchorType,
    pinnedWorkflowAnchorId,
    isShipmentInstructionComplete,
    effectiveShipmentInstructionId,
    isDocumentWorkflow,
    effectiveConfirmationId,
    canonicalContractId,
    isContract,
    initialId,
    draftId,
  ]);

  const activeStepperType = workflowAnchorType;
  const activeStepperId = workflowAnchorId;
  const rootWorkflowId = workflowAnchorId;

  useEffect(() => {
    if (initialSteps && initialSteps.length > 0) {
      setSteps(initialSteps);
    }
  }, [initialSteps]);

  useEffect(() => {
    if (initialId) {
      setDraftId(initialId);
    }
  }, [initialId]);

  useEffect(() => {
    if (steps.length > 0) {
      const visibleList = steps.filter(isVisibleWorkflowStep);
      const targetList = visibleList.length > 0 ? visibleList : steps;
      if (selectedStep) {
        const found = targetList.find((s) => isSameWorkflowStep(s, selectedStep));
        if (found) {
          const idx = targetList.indexOf(found);
          if (idx !== selectedStepIndex) setSelectedStepIndex(idx);
          if (found !== selectedStep) setSelectedStep(found);
          return;
        }
      }
      const active = targetList[selectedStepIndex] || targetList[0];
      setSelectedStep(active);
    }
  }, [steps, selectedStepIndex]);

  // Synchronize step status and redirect IDs in stepper based on loaded/completed document data
  useEffect(() => {
    setSteps((prevSteps) => {
      let changed = false;
      const updated = prevSteps.map((step) => {
        let newStep = { ...step };

        // Step 0: Confirmation
        if (isConfirmationStep(step)) {
          const confId = sanitizeDocId(
            confirmationData?.id ||
            confirmationData?._id ||
            confirmationData?.confirmation_id ||
            initialData?.id ||
            initialData?._id ||
            shipmentInstructionData?.confirmation?.id ||
            shipmentInstructionData?.confirmation?._id ||
            shipmentInstructionData?.confirmation?.confirmation_id ||
            initialShipmentInstructionData?.confirmation?.id ||
            initialShipmentInstructionData?.confirmation?._id
          );
          if (confId && (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))) {
            newStep.redirect_id = confId;
            newStep.redirectId = confId;
            changed = true;
          }
          const isDone = isStatusCompleted(
            confirmationData?.status ||
            confirmationData?.document_status ||
            confirmationData?.confirmation_status ||
            initialData?.status ||
            initialData?.document_status ||
            initialData?.confirmation_status ||
            shipmentInstructionData?.confirmation?.status ||
            initialShipmentInstructionData?.confirmation?.status ||
            shipmentInstructionData?.confirmation_status ||
            initialShipmentInstructionData?.confirmation_status
          );
          if (isDone && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          }
        }

        // Step 1: Contract
        else if (isContractStep(step)) {
          const contractId = sanitizeDocId(
            contractData?.id ||
            contractData?._id ||
            contractData?.contract_id ||
            initialContractData?.id ||
            initialContractData?._id ||
            shipmentInstructionData?.contract?.id ||
            shipmentInstructionData?.contract?._id ||
            shipmentInstructionData?.contract?.contract_id ||
            initialShipmentInstructionData?.contract?.id ||
            initialShipmentInstructionData?.contract?._id
          );
          if (contractId && (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))) {
            newStep.redirect_id = contractId;
            newStep.redirectId = contractId;
            changed = true;
          }
          const isDone = isStatusCompleted(
            contractData?.status ||
            contractData?.document_status ||
            contractData?.contract_status ||
            initialContractData?.status ||
            initialContractData?.document_status ||
            initialContractData?.contract_status ||
            shipmentInstructionData?.contract?.status ||
            initialShipmentInstructionData?.contract?.status ||
            shipmentInstructionData?.contract_status ||
            initialShipmentInstructionData?.contract_status
          );
          if (isDone && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          }
        }

        // Step 2: Proforma
        else if (isProformaStep(step)) {
          const proformaId = sanitizeDocId(
            proformaData?.id ||
            proformaData?._id ||
            proformaData?.proforma_id ||
            initialProformaData?.id ||
            initialProformaData?._id ||
            shipmentInstructionData?.proforma?.id ||
            shipmentInstructionData?.proforma?._id ||
            shipmentInstructionData?.proforma?.proforma_id ||
            initialShipmentInstructionData?.proforma?.id ||
            initialShipmentInstructionData?.proforma?._id
          );
          if (proformaId && (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))) {
            newStep.redirect_id = proformaId;
            newStep.redirectId = proformaId;
            changed = true;
          }
          const isDone = isStatusCompleted(
            proformaData?.status ||
            proformaData?.document_status ||
            proformaData?.proforma_status ||
            initialProformaData?.status ||
            initialProformaData?.document_status ||
            initialProformaData?.proforma_status ||
            shipmentInstructionData?.proforma?.status ||
            initialShipmentInstructionData?.proforma?.status ||
            shipmentInstructionData?.proforma_status ||
            initialShipmentInstructionData?.proforma_status
          );
          if (isDone && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          }
        }

        // Step 3: Shipment Instruction
        else if (isShipmentInstructionStep(step)) {
          const shipmentId = sanitizeDocId(
            shipmentInstructionData?.id ||
            shipmentInstructionData?._id ||
            shipmentInstructionData?.shipment_instruction_id ||
            shipmentInstructionData?.shipment_id ||
            initialShipmentInstructionData?.id ||
            initialShipmentInstructionData?._id ||
            initialShipmentInstructionData?.shipment_instruction_id
          );
          if (shipmentId && (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))) {
            newStep.redirect_id = shipmentId;
            newStep.redirectId = shipmentId;
            changed = true;
          }
          const isDone = isStatusCompleted(
            shipmentInstructionData?.status ||
            shipmentInstructionData?.document_status ||
            shipmentInstructionData?.shipment_instruction_status ||
            initialShipmentInstructionData?.status ||
            initialShipmentInstructionData?.document_status ||
            initialShipmentInstructionData?.shipment_instruction_status
          );
          if (isDone && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          }
        }

        // Step 4: Bill of Lading
        else if (isBillOfLadingStep(step)) {
          const ladingId = sanitizeDocId(
            billOfLadingData?.id ||
            billOfLadingData?._id ||
            billOfLadingData?.bill_of_lading_id ||
            billOfLadingData?.lading_id ||
            initialBillOfLadingData?.id ||
            initialBillOfLadingData?._id ||
            initialBillOfLadingData?.bill_of_lading_id ||
            initialBillOfLadingData?.lading_id
          );
          if (
            ladingId &&
            ladingId !== effectiveConfirmationId &&
            ladingId !== canonicalContractId &&
            ladingId !== canonicalProformaId &&
            ladingId !== canonicalShipmentInstructionId &&
            (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))
          ) {
            newStep.redirect_id = ladingId;
            newStep.redirectId = ladingId;
            changed = true;
          }
          const isDone = isStatusCompleted(
            billOfLadingData?.status ||
            billOfLadingData?.document_status ||
            billOfLadingData?.bill_of_lading_status ||
            billOfLadingData?.lading_status ||
            initialBillOfLadingData?.status ||
            initialBillOfLadingData?.document_status ||
            initialBillOfLadingData?.bill_of_lading_status ||
            initialBillOfLadingData?.lading_status
          );
          if (isDone && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          }
        }

        // Step 5: Custom Invoice
        else if (isCustomInvoiceStep(step)) {
          const customId = sanitizeDocId(
            customInvoiceData?.id ||
            customInvoiceData?._id ||
            customInvoiceData?.custom_invoice_id ||
            initialCustomInvoiceData?.id ||
            initialCustomInvoiceData?._id ||
            initialCustomInvoiceData?.custom_invoice_id
          );
          if (
            customId &&
            customId !== effectiveConfirmationId &&
            customId !== canonicalContractId &&
            customId !== canonicalProformaId &&
            customId !== canonicalShipmentInstructionId &&
            customId !== canonicalBillOfLadingId &&
            (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))
          ) {
            newStep.redirect_id = customId;
            newStep.redirectId = customId;
            changed = true;
          }
          const isDone = isStatusCompleted(
            customInvoiceData?.status ||
            customInvoiceData?.document_status ||
            customInvoiceData?.custom_invoice_status ||
            initialCustomInvoiceData?.status ||
            initialCustomInvoiceData?.document_status ||
            initialCustomInvoiceData?.custom_invoice_status
          );
          if (isDone && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          }
        }

        // Step 6: Commercial Invoice
        else if (isCommercialInvoiceStep(step)) {
          const commercialId = sanitizeDocId(
            commercialInvoiceData?.id ||
            commercialInvoiceData?._id ||
            commercialInvoiceData?.commercial_invoice_id ||
            initialCommercialInvoiceData?.id ||
            initialCommercialInvoiceData?._id ||
            initialCommercialInvoiceData?.commercial_invoice_id
          );
          if (
            commercialId &&
            commercialId !== effectiveConfirmationId &&
            commercialId !== canonicalContractId &&
            commercialId !== canonicalProformaId &&
            commercialId !== canonicalShipmentInstructionId &&
            commercialId !== canonicalBillOfLadingId &&
            commercialId !== canonicalCustomInvoiceId &&
            (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))
          ) {
            newStep.redirect_id = commercialId;
            newStep.redirectId = commercialId;
            changed = true;
          }
          const isDone = isStatusCompleted(
            commercialInvoiceData?.status ||
            commercialInvoiceData?.document_status ||
            commercialInvoiceData?.commercial_invoice_status ||
            initialCommercialInvoiceData?.status ||
            initialCommercialInvoiceData?.document_status ||
            initialCommercialInvoiceData?.commercial_invoice_status
          );
          if (isDone && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          }
        }

        // Step 8: Packing List
        else if (isPackingListStep(step)) {
          const packingId = sanitizeDocId(
            packingListData?.id ||
            packingListData?._id ||
            packingListData?.packing_list_id ||
            initialPackingListData?.id ||
            initialPackingListData?._id ||
            initialPackingListData?.packing_list_id
          );
          if (
            packingId &&
            packingId !== effectiveConfirmationId &&
            packingId !== canonicalContractId &&
            packingId !== canonicalProformaId &&
            packingId !== canonicalShipmentInstructionId &&
            packingId !== canonicalBillOfLadingId &&
            packingId !== canonicalCustomInvoiceId &&
            packingId !== canonicalCommercialInvoiceId &&
            (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))
          ) {
            newStep.redirect_id = packingId;
            newStep.redirectId = packingId;
            changed = true;
          }
          const isDone = isStatusCompleted(
            packingListData?.status ||
            packingListData?.document_status ||
            packingListData?.packing_list_status ||
            initialPackingListData?.status ||
            initialPackingListData?.document_status ||
            initialPackingListData?.packing_list_status
          );
          if (isDone && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          }
        }

        // Step 9: Phyto Certificate
        else if (isPhytoCertificateStep(step)) {
          const phytoId = sanitizeDocId(
            phytoCertificateData?.id ||
            phytoCertificateData?._id ||
            phytoCertificateData?.phyto_certificate_id ||
            phytoCertificateData?.phyto_id ||
            initialPhytoCertificateData?.id ||
            initialPhytoCertificateData?._id ||
            initialPhytoCertificateData?.phyto_certificate_id ||
            initialPhytoCertificateData?.phyto_id
          );
          if (
            phytoId &&
            phytoId !== effectiveConfirmationId &&
            phytoId !== canonicalContractId &&
            phytoId !== canonicalProformaId &&
            phytoId !== canonicalShipmentInstructionId &&
            phytoId !== canonicalBillOfLadingId &&
            phytoId !== canonicalCustomInvoiceId &&
            phytoId !== canonicalCommercialInvoiceId &&
            phytoId !== canonicalPackingListId &&
            (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))
          ) {
            newStep.redirect_id = phytoId;
            newStep.redirectId = phytoId;
            changed = true;
          }
          const isDone = isStatusCompleted(
            phytoCertificateData?.status ||
            phytoCertificateData?.document_status ||
            phytoCertificateData?.phyto_certificate_status ||
            initialPhytoCertificateData?.status ||
            initialPhytoCertificateData?.document_status ||
            initialPhytoCertificateData?.phyto_certificate_status
          );
          if (isDone && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          }
        }

        return newStep;
      });

      return changed ? updated : prevSteps;
    });
  }, [
    confirmationData,
    initialData,
    contractData,
    initialContractData,
    proformaData,
    initialProformaData,
    shipmentInstructionData,
    initialShipmentInstructionData,
    billOfLadingData,
    initialBillOfLadingData,
    customInvoiceData,
    initialCustomInvoiceData,
    commercialInvoiceData,
    initialCommercialInvoiceData,
    packingListData,
    initialPackingListData,
    phytoCertificateData,
    initialPhytoCertificateData,
    effectiveConfirmationId,
    canonicalContractId,
    canonicalProformaId,
    canonicalShipmentInstructionId,
    canonicalBillOfLadingId,
    canonicalCustomInvoiceId,
    canonicalCommercialInvoiceId,
    canonicalPackingListId,
    canonicalPhytoCertificateId,
  ]);

  // Active Step Self ID: strictly the current active step's own ID from redirect_id / stepper
  const activeStepSelfId = useMemo(() => {
    const fromSelected = getStepSelfId(selectedStep);
    if (fromSelected) return fromSelected;

    if (isConfirmation) {
      return (
        effectiveConfirmationId ||
        confirmationData?.id ||
        confirmationData?._id ||
        ''
      );
    }
    if (isContract) {
      return (
        canonicalContractId ||
        contractData?.id ||
        contractData?._id ||
        ''
      );
    }
    if (isProforma) {
      return (
        canonicalProformaId ||
        proformaData?.id ||
        proformaData?._id ||
        ''
      );
    }
    if (isShipmentInstruction) {
      return (
        canonicalShipmentInstructionId ||
        shipmentInstructionData?.id ||
        shipmentInstructionData?._id ||
        ''
      );
    }
    if (isBillOfLading) {
      return (
        canonicalBillOfLadingId ||
        billOfLadingData?.bill_of_lading_id ||
        billOfLadingData?.lading_id ||
        billOfLadingData?.id ||
        billOfLadingData?._id ||
        ''
      );
    }
    if (isCustomInvoice) {
      return (
        canonicalCustomInvoiceId ||
        customInvoiceData?.custom_invoice_id ||
        customInvoiceData?.id ||
        customInvoiceData?._id ||
        ''
      );
    }
    if (isCommercialInvoice) {
      return (
        canonicalCommercialInvoiceId ||
        commercialInvoiceData?.commercial_invoice_id ||
        commercialInvoiceData?.id ||
        commercialInvoiceData?._id ||
        ''
      );
    }
    if (isPackingList) {
      return (
        canonicalPackingListId ||
        packingListData?.packing_list_id ||
        packingListData?.id ||
        packingListData?._id ||
        ''
      );
    }
    if (isPhytoCertificate) {
      return (
        canonicalPhytoCertificateId ||
        phytoCertificateData?.phyto_certificate_id ||
        phytoCertificateData?.phyto_id ||
        phytoCertificateData?.id ||
        phytoCertificateData?._id ||
        ''
      );
    }
    return '';
  }, [
    selectedStep,
    isConfirmation,
    isContract,
    isProforma,
    isShipmentInstruction,
    isBillOfLading,
    isCustomInvoice,
    isCommercialInvoice,
    isPackingList,
    isPhytoCertificate,
    effectiveConfirmationId,
    confirmationData,
    canonicalContractId,
    contractData,
    canonicalProformaId,
    proformaData,
    canonicalShipmentInstructionId,
    shipmentInstructionData,
    canonicalBillOfLadingId,
    billOfLadingData,
    canonicalCustomInvoiceId,
    customInvoiceData,
    canonicalCommercialInvoiceId,
    commercialInvoiceData,
    canonicalPackingListId,
    packingListData,
    canonicalPhytoCertificateId,
    phytoCertificateData,
  ]);

  // Ensure the browser URL query parameter 'step' mirrors the current view
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    let shouldUpdate = false;

    const currentUrlStep = url.searchParams.get('step');
    const targetStep = isConfirmation
      ? 'confirmation'
      : isContract
      ? 'contract'
      : isProforma
      ? 'proforma'
      : isShipmentInstruction
      ? 'shipment'
      : isBillOfLading
      ? 'bill-of-lading'
      : getStepSlug(selectedStep, selectedStepIndex);

    if (targetStep && currentUrlStep !== targetStep) {
      url.searchParams.set('step', targetStep);
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      window.history.replaceState(null, '', url.toString());
    }
  }, [
    isConfirmation,
    isContract,
    isProforma,
    isShipmentInstruction,
    isBillOfLading,
    selectedStep,
    selectedStepIndex,
  ]);

  const attemptedContractFetchRef = useRef<string | null>(null);
  const attemptedProformaFetchRef = useRef<string | null>(null);
  const attemptedShipmentFetchRef = useRef<string | null>(null);
  const attemptedBillOfLadingFetchRef = useRef<string | null>(null);
  const attemptedCustomInvoiceFetchRef = useRef<string | null>(null);
  const isInitialBillOfLadingSsrFreshRef = useRef<boolean>(
    Boolean(
      initialBillOfLadingData &&
      initialStepParam &&
      /lading|\bbl\b/i.test(String(initialStepParam))
    )
  );
  const isInitialCustomInvoiceSsrFreshRef = useRef<boolean>(
    Boolean(
      initialCustomInvoiceData &&
      initialStepParam &&
      /custom/i.test(String(initialStepParam))
    )
  );
  const attemptedCommercialInvoiceFetchRef = useRef<string | null>(null);
  const isInitialCommercialInvoiceSsrFreshRef = useRef<boolean>(
    Boolean(
      initialCommercialInvoiceData &&
      initialStepParam &&
      /commercial/i.test(String(initialStepParam))
    )
  );
  const attemptedPackingListFetchRef = useRef<string | null>(null);
  const isInitialPackingListSsrFreshRef = useRef<boolean>(
    Boolean(
      initialPackingListData &&
      initialStepParam &&
      /packing/i.test(String(initialStepParam))
    )
  );
  const attemptedPhytoCertificateFetchRef = useRef<string | null>(null);
  const isInitialPhytoCertificateSsrFreshRef = useRef<boolean>(
    Boolean(
      initialPhytoCertificateData &&
      initialStepParam &&
      /phyto/i.test(String(initialStepParam))
    )
  );
  const activeFetchSeqRef = useRef<number>(0);

  // Centralized step data fetcher: fetches the latest document data and refreshes stepper metadata
  const fetchLatestStepData = useCallback(
    async (targetStep: StepperDocumentItem | null | undefined, targetIndex: number, currentSeq: number) => {
      const isTargetConfirmation = isConfirmationStep(targetStep);
      const isTargetContract = !isTargetConfirmation && isContractStep(targetStep);
      const isTargetProforma = !isTargetConfirmation && !isTargetContract && isProformaStep(targetStep);
      const isTargetShipment = !isTargetConfirmation && !isTargetContract && !isTargetProforma && isShipmentInstructionStep(targetStep);
      const isTargetBillOfLading = !isTargetConfirmation && !isTargetContract && !isTargetProforma && !isTargetShipment && isBillOfLadingStep(targetStep);
      const isTargetCustomInvoice = !isTargetConfirmation && !isTargetContract && !isTargetProforma && !isTargetShipment && !isTargetBillOfLading && isCustomInvoiceStep(targetStep);
      const isTargetCommercialInvoice = !isTargetConfirmation && !isTargetContract && !isTargetProforma && !isTargetShipment && !isTargetBillOfLading && !isTargetCustomInvoice && isCommercialInvoiceStep(targetStep);
      const isTargetPackingList = !isTargetConfirmation && !isTargetContract && !isTargetProforma && !isTargetShipment && !isTargetBillOfLading && !isTargetCustomInvoice && !isTargetCommercialInvoice && isPackingListStep(targetStep);
      const isTargetPhytoCertificate = !isTargetConfirmation && !isTargetContract && !isTargetProforma && !isTargetShipment && !isTargetBillOfLading && !isTargetCustomInvoice && !isTargetCommercialInvoice && !isTargetPackingList && isPhytoCertificateStep(targetStep);

      const stepSelfId = getStepSelfId(targetStep);

      // PROFORMA INVOICE (Index 2)
      if (isTargetProforma) {
        setIsLoadingProforma(true);

        const candidateId = sanitizeDocId(
          (stepSelfId && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(stepSelfId) ? stepSelfId : '') ||
          targetStep?.proforma_id ||
          (targetStep as any)?.proformaId ||
          targetStep?.proforma_invoice_id ||
          extractStepRedirectId(targetStep) ||
          extractStepId(targetStep) ||
          getProformaIdFromStepper(steps, targetStep) ||
          canonicalProformaId ||
          extractLinkedProformaId(shipmentInstructionData) ||
          extractLinkedProformaId(contractData) ||
          extractLinkedProformaId(initialContractData) ||
          (proformaData?.invoice_number ? proformaData?.id || proformaData?.proforma_id : '')
        );

        // Concurrently refresh stepper list from backend so we have the absolute latest redirect_id & status
        const stepperAction = workflowAnchorType;
        const stepperParam = workflowAnchorId;
        getStepperListAction({
          action: stepperAction,
          step: String(stepperParam),
          lang,
        })
          .then((sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps((prevSteps) => mergeStepperWithHidden(sRes.data, prevSteps));
              const freshProformaStep = getProformaStep(sRes.data);
              const freshProformaId = sanitizeDocId(
                getStepSelfId(freshProformaStep) ||
                getProformaIdFromStepper(sRes.data, freshProformaStep) ||
                freshProformaStep?.proforma_id ||
                (freshProformaStep as any)?.proformaId ||
                freshProformaStep?.proforma_invoice_id ||
                freshProformaStep?.redirect_id ||
                (freshProformaStep as any)?.redirectId
              );
              if (
                freshProformaId &&
                !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(freshProformaId) &&
                (!candidateId || /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(candidateId))
              ) {
                getProformaAction(freshProformaId, lang)
                  .then((freshRes) => {
                    if (activeFetchSeqRef.current === currentSeq && freshRes?.success && freshRes.data) {
                      const extracted = extractProformaData(freshRes.data) || freshRes.data;
                      if (extracted) {
                        if (pinnedWorkflowContractNumber && isPartialContractNumber(pinnedWorkflowContractNumber)) {
                          extracted.contract_number = pinnedWorkflowContractNumber;
                          extracted.contractNumber = pinnedWorkflowContractNumber;
                          extracted.contract_no = pinnedWorkflowContractNumber;
                          if (extracted.contract && typeof extracted.contract === 'object') {
                            extracted.contract.contract_number = pinnedWorkflowContractNumber;
                            extracted.contract.contractNumber = pinnedWorkflowContractNumber;
                            extracted.contract.contract_no = pinnedWorkflowContractNumber;
                          }
                        }
                        setProformaData(extracted);
                      }
                      setIsLoadingProforma(false);
                    }
                  })
                  .catch(() => {});
              }
            }
          })
          .catch((err) => {
            console.warn('[DocumentDraftWorkspace] Stepper list refresh error in proforma fetch:', err);
          });

        if (candidateId && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(candidateId)) {
          try {
            const res = await getProformaAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq) {
              if (res?.success && res.data) {
                const extracted = extractProformaData(res.data) || res.data;
                if (extracted) {
                  if (pinnedWorkflowContractNumber && isPartialContractNumber(pinnedWorkflowContractNumber)) {
                    extracted.contract_number = pinnedWorkflowContractNumber;
                    extracted.contractNumber = pinnedWorkflowContractNumber;
                    extracted.contract_no = pinnedWorkflowContractNumber;
                    if (extracted.contract && typeof extracted.contract === 'object') {
                      extracted.contract.contract_number = pinnedWorkflowContractNumber;
                      extracted.contract.contractNumber = pinnedWorkflowContractNumber;
                      extracted.contract.contract_no = pinnedWorkflowContractNumber;
                    }
                  }
                  setProformaData(extracted);
                  setProformaVersion((v) => v + 1);
                }
              }
            }
          } catch (err) {
            console.warn('[DocumentDraftWorkspace] Error fetching latest proforma:', err);
          } finally {
            if (activeFetchSeqRef.current === currentSeq) {
              setIsLoadingProforma(false);
            }
          }
        } else {
          if (activeFetchSeqRef.current === currentSeq) {
            setIsLoadingProforma(false);
            setProformaVersion((v) => v + 1);
          }
        }
        return;
      }

      // SALES CONTRACT (Index 1)
      if (isTargetContract) {
        setIsLoadingContract(true);

        const candidateId = sanitizeDocId(
          (stepSelfId && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(stepSelfId) ? stepSelfId : '') ||
          targetStep?.contract_id ||
          (targetStep as any)?.contractId ||
          targetStep?.sales_contract_id ||
          extractStepRedirectId(targetStep) ||
          extractStepId(targetStep) ||
          getContractIdFromStepper(steps, targetStep) ||
          canonicalContractId ||
          extractLinkedContractId(proformaData) ||
          extractLinkedContractId(shipmentInstructionData) ||
          (contractData?.contract_number ? contractData?.id || contractData?.contract_id : '')
        );

        const stepperAction = workflowAnchorType;
        const stepperParam = workflowAnchorId;
        getStepperListAction({
          action: stepperAction,
          step: String(stepperParam),
          lang,
        })
          .then((sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps((prevSteps) => mergeStepperWithHidden(sRes.data, prevSteps));
            }
          })
          .catch(() => {});

        if (candidateId && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(candidateId)) {
          try {
            const res = await getContractAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq) {
              if (res?.success && res.data) {
                const extracted = extractContractData(res.data) || res.data;
                if (extracted) {
                  const hasSplits = Boolean(
                    (extracted.splits && Array.isArray(extracted.splits) && extracted.splits.length > 0) ||
                    extracted.has_splits ||
                    extracted.is_split ||
                    extracted.is_partial ||
                    extracted.partial_shipment_allowed
                  );
                  const baseContNum = cleanBaseContractNumber(
                    extracted.contract_number || extracted.contractNumber || extracted.contract_no,
                    hasSplits
                  );
                  if (baseContNum) {
                    extracted.contract_number = baseContNum;
                    extracted.contractNumber = baseContNum;
                    extracted.contract_no = baseContNum;
                    if (extracted.contract && typeof extracted.contract === 'object') {
                      extracted.contract.contract_number = baseContNum;
                      extracted.contract.contractNumber = baseContNum;
                      extracted.contract.contract_no = baseContNum;
                    }
                  }
                  setContractData(extracted);
                  setContractVersion((v) => v + 1);
                }
              }
            }
          } catch (err) {
            console.warn('[DocumentDraftWorkspace] Error fetching latest contract:', err);
          } finally {
            if (activeFetchSeqRef.current === currentSeq) {
              setIsLoadingContract(false);
            }
          }
        } else {
          if (activeFetchSeqRef.current === currentSeq) {
            setIsLoadingContract(false);
            setContractVersion((v) => v + 1);
          }
        }
        return;
      }

      // TRADE CONFIRMATION (Index 0)
      if (isTargetConfirmation) {
        let candidateId = sanitizeDocId(
          stepSelfId ||
          targetStep?.redirect_id ||
          (targetStep as any)?.redirectId ||
          getConfirmationIdFromStepper(steps, targetStep) ||
          effectiveConfirmationId ||
          rootWorkflowId ||
          initialId ||
          (confirmationData?.id || confirmationData?.confirmation_id)
        );

        if (
          isDocumentWorkflow &&
          (candidateId === pinnedWorkflowAnchorId ||
            candidateId === effectiveShipmentInstructionId ||
            candidateId === canonicalShipmentInstructionId)
        ) {
          candidateId = sanitizeDocId(
            stepSelfId ||
            targetStep?.redirect_id ||
            (targetStep as any)?.redirectId ||
            getConfirmationIdFromStepper(steps, targetStep) ||
            extractLinkedConfirmationId(shipmentInstructionData) ||
            extractLinkedConfirmationId(initialShipmentInstructionData) ||
            extractLinkedConfirmationId(contractData) ||
            extractLinkedConfirmationId(initialContractData) ||
            effectiveConfirmationId
          );
        }

        if (/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(candidateId)) {
          candidateId = '';
        }

        if (!isCompleteConfirmationData(confirmationData)) {
          setIsLoadingConfirmation(true);
        }

        const stepperAction = workflowAnchorType;
        const stepperParam = workflowAnchorId;
        getStepperListAction({
          action: stepperAction,
          step: String(stepperParam),
          lang,
        })
          .then((sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps((prevSteps) => mergeStepperWithHidden(sRes.data, prevSteps));
            }
          })
          .catch(() => {});

        if (candidateId) {
          try {
            const res = await getConfirmationAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq) {
              if (res?.success && res.data) {
                const extracted = extractConfirmationData(res.data);
                if (extracted && isCompleteConfirmationData(extracted)) {
                  setConfirmationData(extracted);
                  setConfirmationVersion((v) => v + 1);
                } else if (res.data && typeof res.data === 'object') {
                  setConfirmationData(res.data);
                  setConfirmationVersion((v) => v + 1);
                }
              }
            }
          } catch (err) {
            console.warn('[DocumentDraftWorkspace] Error fetching latest confirmation:', err);
          } finally {
            if (activeFetchSeqRef.current === currentSeq) {
              setIsLoadingConfirmation(false);
            }
          }
        } else {
          if (activeFetchSeqRef.current === currentSeq) {
            setIsLoadingConfirmation(false);
            setConfirmationVersion((v) => v + 1);
          }
        }
        return;
      }

      // SHIPMENT INSTRUCTION (Index 3)
      if (isTargetShipment) {
        setIsLoadingShipmentInstruction(true);

        const candidateId = sanitizeDocId(
          (stepSelfId && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(stepSelfId) ? stepSelfId : '') ||
          targetStep?.shipment_instruction_id ||
          (targetStep as any)?.shipmentInstructionId ||
          targetStep?.shipment_id ||
          extractStepRedirectId(targetStep) ||
          getShipmentInstructionIdFromStepper(steps, targetStep) ||
          canonicalShipmentInstructionId ||
          extractLinkedShipmentInstructionId(proformaData) ||
          extractLinkedShipmentInstructionId(contractData) ||
          (shipmentInstructionData?.shipment_instruction_number ? shipmentInstructionData?.id || shipmentInstructionData?.shipment_instruction_id : '')
        );

        const stepperAction = workflowAnchorType;
        const stepperParam = workflowAnchorId;
        getStepperListAction({
          action: stepperAction,
          step: String(stepperParam),
          lang,
        })
          .then((sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps((prevSteps) => mergeStepperWithHidden(sRes.data, prevSteps));
            }
          })
          .catch(() => {});

        if (candidateId && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(candidateId)) {
          try {
            const res = await getShipmentInstructionAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq) {
              if (res?.success && res.data) {
                const extracted =
                  extractShipmentInstructionData(res.data) ||
                  { ...res.data, _is_shipment_loaded: true };
                setShipmentInstructionData(extracted);
                setShipmentVersion((v) => v + 1);

                // If shipment instruction response contains linked contract / proforma / confirmation, seed missing states
                if (extracted?.contract && typeof extracted.contract === 'object') {
                  const extContract = extractContractData(extracted.contract);
                  if (extContract) {
                    setContractData((prev: any) => prev || extContract);
                  }
                }
                if (extracted?.proforma && typeof extracted.proforma === 'object') {
                  const extProforma = extractProformaData(extracted.proforma);
                  if (extProforma) {
                    setProformaData((prev: any) => prev || extProforma);
                  }
                }
                if (extracted?.confirmation && typeof extracted.confirmation === 'object') {
                  const extConf = extractConfirmationData(extracted.confirmation);
                  if (extConf) {
                    setConfirmationData((prev: any) => prev || extConf);
                  }
                }
              }
            }
          } catch (err) {
            console.warn('[DocumentDraftWorkspace] Error fetching latest shipment instruction:', err);
          } finally {
            if (activeFetchSeqRef.current === currentSeq) {
              setIsLoadingShipmentInstruction(false);
            }
          }
        } else {
          if (activeFetchSeqRef.current === currentSeq) {
            setIsLoadingShipmentInstruction(false);
            setShipmentVersion((v) => v + 1);
          }
        }
        return;
      }

      // BILL OF LADING (Index 4)
      if (isTargetBillOfLading) {
        setIsLoadingBillOfLading(true);

        const isPlaceholderLadingId = (val: string) =>
          !val ||
          (/^\d+$/.test(val) && Number(val) <= 20) ||
          /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|invoice|step-\d+)$/i.test(val);

        const candidateId = sanitizeDocId(
          (stepSelfId && !isPlaceholderLadingId(stepSelfId) ? stepSelfId : '') ||
          targetStep?.bill_of_lading_id ||
          (targetStep as any)?.billOfLadingId ||
          targetStep?.lading_id ||
          extractStepRedirectId(targetStep) ||
          extractStepId(targetStep) ||
          getBillOfLadingIdFromStepper(steps, targetStep) ||
          canonicalBillOfLadingId ||
          extractLinkedBillOfLadingId(billOfLadingData) ||
          extractLinkedBillOfLadingId(shipmentInstructionData) ||
          extractLinkedBillOfLadingId(proformaData) ||
          extractLinkedBillOfLadingId(contractData) ||
          (billOfLadingData?.bl_no || billOfLadingData?.vessel_name || billOfLadingData?._is_lading_loaded ? billOfLadingData?.id || billOfLadingData?.bill_of_lading_id : '')
        );

        const applyFreshBillOfLading = (rawPayload: any): boolean => {
          if (!rawPayload || typeof rawPayload !== 'object') return false;
          const extracted =
            extractBillOfLadingData(rawPayload) ||
            { ...rawPayload, _is_lading_loaded: true };
          if (extracted && typeof extracted === 'object') {
            setBillOfLadingData({ ...extracted, _is_lading_loaded: true });
            setBillOfLadingVersion((v) => v + 1);
            return true;
          }
          return false;
        };

        let didPrimaryFetchSucceed = false;

        const stepperAction = workflowAnchorType;
        const stepperParam = workflowAnchorId;
        const stepperPromise = getStepperListAction({
          action: stepperAction,
          step: String(stepperParam),
          lang,
        })
          .then(async (sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps((prevSteps) => mergeStepperWithHidden(sRes.data, prevSteps));
              const freshLadingStep = getBillOfLadingStep(sRes.data);
              const freshLadingId = sanitizeDocId(
                freshLadingStep?.bill_of_lading_id ||
                (freshLadingStep as any)?.billOfLadingId ||
                freshLadingStep?.lading_id ||
                getStepSelfId(freshLadingStep) ||
                getBillOfLadingIdFromStepper(sRes.data, freshLadingStep) ||
                freshLadingStep?.redirect_id ||
                (freshLadingStep as any)?.redirectId
              );
              if (
                freshLadingId &&
                !isPlaceholderLadingId(freshLadingId) &&
                (!candidateId || isPlaceholderLadingId(candidateId))
              ) {
                try {
                  const freshRes = await getBillOfLadingAction(freshLadingId, lang);
                  if (activeFetchSeqRef.current === currentSeq && freshRes?.success && freshRes.data) {
                    attemptedBillOfLadingFetchRef.current = freshLadingId;
                    applyFreshBillOfLading(freshRes.data);
                  }
                } catch (freshErr) {
                  console.warn('[DocumentDraftWorkspace] Error fetching fresh bill of lading from stepper:', freshErr);
                }
              }
            }
          })
          .catch(() => {});

        if (candidateId && !isPlaceholderLadingId(candidateId)) {
          try {
            attemptedBillOfLadingFetchRef.current = candidateId;
            const res = await getBillOfLadingAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq && res?.success && res.data) {
              didPrimaryFetchSucceed = applyFreshBillOfLading(res.data);
            }
          } catch (err) {
            console.warn('[DocumentDraftWorkspace] Error fetching latest bill of lading:', err);
          } finally {
            if (!didPrimaryFetchSucceed) {
              await stepperPromise;
            }
            if (activeFetchSeqRef.current === currentSeq) {
              setIsLoadingBillOfLading(false);
            }
          }
        } else {
          await stepperPromise;
          if (activeFetchSeqRef.current === currentSeq) {
            setIsLoadingBillOfLading(false);
            setBillOfLadingVersion((v) => v + 1);
          }
        }
        return;
      }

      if (isTargetCustomInvoice) {
        setIsLoadingCustomInvoice(true);

        const isPlaceholderCustomId = (val: string) =>
          !val ||
          (/^\d+$/.test(val) && Number(val) <= 20) ||
          /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|invoice|step-\d+)$/i.test(val);

        const candidateId = sanitizeDocId(
          (stepSelfId && !isPlaceholderCustomId(stepSelfId) ? stepSelfId : '') ||
          targetStep?.custom_invoice_id ||
          (targetStep as any)?.customInvoiceId ||
          targetStep?.invoice_id ||
          extractStepRedirectId(targetStep) ||
          extractStepId(targetStep) ||
          getCustomInvoiceIdFromStepper(steps, targetStep) ||
          canonicalCustomInvoiceId ||
          extractLinkedCustomInvoiceId(customInvoiceData) ||
          extractLinkedCustomInvoiceId(billOfLadingData) ||
          extractLinkedCustomInvoiceId(shipmentInstructionData) ||
          extractLinkedCustomInvoiceId(proformaData) ||
          extractLinkedCustomInvoiceId(contractData) ||
          (customInvoiceData?.custom_invoice_number ? customInvoiceData?.id || customInvoiceData?.custom_invoice_id : '')
        );

        const applyFreshCustomInvoice = (rawPayload: any): boolean => {
          if (!rawPayload || typeof rawPayload !== 'object') return false;
          const extracted =
            extractCustomInvoiceData(rawPayload) ||
            { ...rawPayload, _is_custom_invoice_loaded: true };
          if (extracted && typeof extracted === 'object') {
            setCustomInvoiceData(extracted);
            setCustomInvoiceVersion((v) => v + 1);
            return true;
          }
          return false;
        };

        let didPrimaryFetchSucceed = false;

        // Concurrently refresh stepper list so we always have the absolute latest redirect_id & status
        const stepperAction = workflowAnchorType;
        const stepperParam = workflowAnchorId;
        const stepperPromise = getStepperListAction({
          action: stepperAction,
          step: String(stepperParam),
          lang,
        })
          .then(async (sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps((prevSteps) => mergeStepperWithHidden(sRes.data, prevSteps));
              const freshCustomStep = getCustomInvoiceStep(sRes.data);
              const freshCustomId = sanitizeDocId(
                freshCustomStep?.custom_invoice_id ||
                (freshCustomStep as any)?.customInvoiceId ||
                freshCustomStep?.invoice_id ||
                getStepSelfId(freshCustomStep) ||
                getCustomInvoiceIdFromStepper(sRes.data, freshCustomStep) ||
                freshCustomStep?.redirect_id ||
                (freshCustomStep as any)?.redirectId
              );
              if (
                freshCustomId &&
                !isPlaceholderCustomId(freshCustomId) &&
                (!candidateId || isPlaceholderCustomId(candidateId))
              ) {
                try {
                  const freshRes = await getCustomInvoiceAction(freshCustomId, lang);
                  if (activeFetchSeqRef.current === currentSeq && freshRes?.success && freshRes.data) {
                    attemptedCustomInvoiceFetchRef.current = freshCustomId;
                    applyFreshCustomInvoice(freshRes.data);
                  }
                } catch (freshErr) {
                  console.warn('[DocumentDraftWorkspace] Error fetching fresh custom invoice from stepper:', freshErr);
                }
              }
            }
          })
          .catch(() => {});

        if (candidateId && !isPlaceholderCustomId(candidateId)) {
          try {
            attemptedCustomInvoiceFetchRef.current = candidateId;
            const res = await getCustomInvoiceAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq && res?.success && res.data) {
              didPrimaryFetchSucceed = applyFreshCustomInvoice(res.data);
            }
          } catch (err) {
            console.warn('[DocumentDraftWorkspace] Error fetching latest custom invoice:', err);
          } finally {
            if (!didPrimaryFetchSucceed) {
              await stepperPromise;
            }
            if (activeFetchSeqRef.current === currentSeq) {
              setIsLoadingCustomInvoice(false);
            }
          }
        } else {
          await stepperPromise;
          if (activeFetchSeqRef.current === currentSeq) {
            setIsLoadingCustomInvoice(false);
            setCustomInvoiceVersion((v) => v + 1);
          }
        }
        return;
      }

      // COMMERCIAL INVOICE (Step 7)
      if (isTargetCommercialInvoice) {
        setIsLoadingCommercialInvoice(true);

        const isPlaceholderCommercialId = (val?: string | null) =>
          !val ||
          (/^\d+$/.test(val) && Number(val) <= 20) ||
          /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|invoice|step-\d+)$/i.test(val);

        const candidateId = sanitizeDocId(
          (!isPlaceholderCommercialId(stepSelfId) ? stepSelfId : '') ||
          targetStep?.commercial_invoice_id ||
          (targetStep as any)?.commercialInvoiceId ||
          extractStepRedirectId(targetStep) ||
          getCommercialInvoiceIdFromStepper(steps, targetStep) ||
          canonicalCommercialInvoiceId ||
          extractLinkedCommercialInvoiceId(commercialInvoiceData) ||
          extractLinkedCommercialInvoiceId(customInvoiceData) ||
          extractLinkedCommercialInvoiceId(billOfLadingData) ||
          extractLinkedCommercialInvoiceId(shipmentInstructionData) ||
          extractLinkedCommercialInvoiceId(proformaData) ||
          extractLinkedCommercialInvoiceId(contractData)
        );

        const applyFreshCommercialInvoice = (rawData: any): boolean => {
          if (!rawData || typeof rawData !== 'object') return false;
          const extracted = extractCommercialInvoiceData(rawData) || {
            ...rawData,
            _is_commercial_invoice_loaded: true,
          };
          if (extracted) {
            setCommercialInvoiceData(extracted);
            setCommercialInvoiceVersion((v) => v + 1);
            return true;
          }
          return false;
        };

        let didPrimaryFetchSucceed = false;

        const stepperPromise = getStepperListAction({
          action: workflowAnchorType,
          step: String(workflowAnchorId),
          lang,
        })
          .then(async (sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps((prevSteps) => mergeStepperWithHidden(sRes.data, prevSteps));
              const freshCommercialStep = getCommercialInvoiceStep(sRes.data);
              const freshCommercialId = sanitizeDocId(
                getStepSelfId(freshCommercialStep) ||
                getCommercialInvoiceIdFromStepper(sRes.data, freshCommercialStep) ||
                freshCommercialStep?.commercial_invoice_id ||
                (freshCommercialStep as any)?.commercialInvoiceId ||
                freshCommercialStep?.redirect_id ||
                (freshCommercialStep as any)?.redirectId
              );
              if (
                freshCommercialId &&
                !isPlaceholderCommercialId(freshCommercialId) &&
                (!candidateId || isPlaceholderCommercialId(candidateId))
              ) {
                try {
                  const freshRes = await getCommercialInvoiceAction(freshCommercialId, lang);
                  if (activeFetchSeqRef.current === currentSeq && freshRes?.success && freshRes.data) {
                    attemptedCommercialInvoiceFetchRef.current = freshCommercialId;
                    applyFreshCommercialInvoice(freshRes.data);
                  }
                } catch (freshErr) {
                  console.warn('[DocumentDraftWorkspace] Error fetching fresh commercial invoice from stepper:', freshErr);
                }
              }
            }
          })
          .catch(() => {});

        if (candidateId && !isPlaceholderCommercialId(candidateId)) {
          try {
            attemptedCommercialInvoiceFetchRef.current = candidateId;
            const res = await getCommercialInvoiceAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq && res?.success && res.data) {
              didPrimaryFetchSucceed = applyFreshCommercialInvoice(res.data);
            }
          } catch (err) {
            console.warn('[DocumentDraftWorkspace] Error fetching latest commercial invoice:', err);
          } finally {
            if (!didPrimaryFetchSucceed) {
              await stepperPromise;
            }
            if (activeFetchSeqRef.current === currentSeq) {
              setIsLoadingCommercialInvoice(false);
            }
          }
        } else {
          await stepperPromise;
          if (activeFetchSeqRef.current === currentSeq) {
            setIsLoadingCommercialInvoice(false);
            setCommercialInvoiceVersion((v) => v + 1);
          }
        }
        return;
      }

      // PACKING LIST (Step 8)
      if (isTargetPackingList) {
        setIsLoadingPackingList(true);

        const isPlaceholderPackingId = (val?: string | null) =>
          !val ||
          (/^\d+$/.test(val) && Number(val) <= 20) ||
          /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|invoice|step-\d+)$/i.test(val);

        const candidateId = sanitizeDocId(
          (!isPlaceholderPackingId(stepSelfId) ? stepSelfId : '') ||
          targetStep?.packing_list_id ||
          (targetStep as any)?.packingListId ||
          extractStepRedirectId(targetStep) ||
          getPackingListIdFromStepper(steps, targetStep) ||
          canonicalPackingListId ||
          extractLinkedPackingListId(packingListData) ||
          extractLinkedPackingListId(commercialInvoiceData) ||
          extractLinkedPackingListId(customInvoiceData) ||
          extractLinkedPackingListId(billOfLadingData) ||
          extractLinkedPackingListId(shipmentInstructionData) ||
          extractLinkedPackingListId(proformaData) ||
          extractLinkedPackingListId(contractData)
        );

        const applyFreshPackingList = (rawData: any): boolean => {
          if (!rawData || typeof rawData !== 'object') return false;
          const extracted = extractPackingListData(rawData) || {
            ...rawData,
            _is_packing_list_loaded: true,
          };
          if (extracted) {
            setPackingListData(extracted);
            setPackingListVersion((v) => v + 1);
            return true;
          }
          return false;
        };

        let didPrimaryFetchSucceed = false;

        const stepperPromise = getStepperListAction({
          action: workflowAnchorType,
          step: String(workflowAnchorId),
          lang,
        })
          .then(async (sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps((prevSteps) => mergeStepperWithHidden(sRes.data, prevSteps));
              const freshPackingStep = getPackingListStep(sRes.data);
              const freshPackingId = sanitizeDocId(
                getStepSelfId(freshPackingStep) ||
                getPackingListIdFromStepper(sRes.data, freshPackingStep) ||
                freshPackingStep?.packing_list_id ||
                (freshPackingStep as any)?.packingListId ||
                freshPackingStep?.redirect_id ||
                (freshPackingStep as any)?.redirectId
              );
              if (
                freshPackingId &&
                !isPlaceholderPackingId(freshPackingId) &&
                (!candidateId || isPlaceholderPackingId(candidateId))
              ) {
                try {
                  const freshRes = await getPackingListAction(freshPackingId, lang);
                  if (activeFetchSeqRef.current === currentSeq && freshRes?.success && freshRes.data) {
                    attemptedPackingListFetchRef.current = freshPackingId;
                    applyFreshPackingList(freshRes.data);
                  }
                } catch (freshErr) {
                  console.warn('[DocumentDraftWorkspace] Error fetching fresh packing list from stepper:', freshErr);
                }
              }
            }
          })
          .catch(() => {});

        if (candidateId && !isPlaceholderPackingId(candidateId)) {
          try {
            attemptedPackingListFetchRef.current = candidateId;
            const res = await getPackingListAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq && res?.success && res.data) {
              didPrimaryFetchSucceed = applyFreshPackingList(res.data);
            }
          } catch (err) {
            console.warn('[DocumentDraftWorkspace] Error fetching latest packing list:', err);
          } finally {
            if (!didPrimaryFetchSucceed) {
              await stepperPromise;
            }
            if (activeFetchSeqRef.current === currentSeq) {
              setIsLoadingPackingList(false);
            }
          }
        } else {
          await stepperPromise;
          if (activeFetchSeqRef.current === currentSeq) {
            setIsLoadingPackingList(false);
            setPackingListVersion((v) => v + 1);
          }
        }
        return;
      }

      if (isTargetPhytoCertificate) {
        setIsLoadingPhytoCertificate(true);

        const isPlaceholderPhytoId = (val?: string | null) =>
          !val ||
          (/^\d+$/.test(val) && Number(val) <= 20) ||
          /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|phyto|phyto-certificate|invoice|step-\d+)$/i.test(val);

        const candidateId = sanitizeDocId(
          (!isPlaceholderPhytoId(stepSelfId) ? stepSelfId : '') ||
          targetStep?.phyto_certificate_id ||
          (targetStep as any)?.phytoCertificateId ||
          extractStepRedirectId(targetStep) ||
          getPhytoCertificateIdFromStepper(steps, targetStep) ||
          canonicalPhytoCertificateId ||
          extractLinkedPhytoCertificateId(phytoCertificateData) ||
          extractLinkedPhytoCertificateId(packingListData) ||
          extractLinkedPhytoCertificateId(commercialInvoiceData) ||
          extractLinkedPhytoCertificateId(customInvoiceData) ||
          extractLinkedPhytoCertificateId(billOfLadingData) ||
          extractLinkedPhytoCertificateId(shipmentInstructionData) ||
          extractLinkedPhytoCertificateId(proformaData) ||
          extractLinkedPhytoCertificateId(contractData)
        );

        const applyFreshPhytoCertificate = (rawData: any): boolean => {
          if (!rawData || typeof rawData !== 'object') return false;
          const extracted = extractPhytoCertificateData(rawData) || {
            ...rawData,
            _is_phyto_certificate_loaded: true,
          };
          if (extracted) {
            setPhytoCertificateData(extracted);
            setPhytoCertificateVersion((v) => v + 1);
            return true;
          }
          return false;
        };

        let didPrimaryFetchSucceed = false;

        const stepperPromise = getStepperListAction({
          action: workflowAnchorType,
          step: String(workflowAnchorId),
          lang,
        })
          .then(async (sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps((prevSteps) => mergeStepperWithHidden(sRes.data, prevSteps));
              const freshPhytoStep = getPhytoCertificateStep(sRes.data);
              const freshPhytoId = sanitizeDocId(
                getStepSelfId(freshPhytoStep) ||
                getPhytoCertificateIdFromStepper(sRes.data, freshPhytoStep) ||
                freshPhytoStep?.phyto_certificate_id ||
                (freshPhytoStep as any)?.phytoCertificateId ||
                freshPhytoStep?.redirect_id ||
                (freshPhytoStep as any)?.redirectId
              );
              if (
                freshPhytoId &&
                !isPlaceholderPhytoId(freshPhytoId) &&
                (!candidateId || isPlaceholderPhytoId(candidateId))
              ) {
                try {
                  const freshRes = await getPhytoCertificateAction(freshPhytoId, lang);
                  if (activeFetchSeqRef.current === currentSeq && freshRes?.success && freshRes.data) {
                    attemptedPhytoCertificateFetchRef.current = freshPhytoId;
                    applyFreshPhytoCertificate(freshRes.data);
                  }
                } catch (freshErr) {
                  console.warn('[DocumentDraftWorkspace] Error fetching fresh phyto certificate from stepper:', freshErr);
                }
              }
            }
          })
          .catch(() => {});

        if (candidateId && !isPlaceholderPhytoId(candidateId)) {
          try {
            attemptedPhytoCertificateFetchRef.current = candidateId;
            const res = await getPhytoCertificateAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq && res?.success && res.data) {
              didPrimaryFetchSucceed = applyFreshPhytoCertificate(res.data);
            }
          } catch (err) {
            console.warn('[DocumentDraftWorkspace] Error fetching latest phyto certificate:', err);
          } finally {
            if (!didPrimaryFetchSucceed) {
              await stepperPromise;
            }
            if (activeFetchSeqRef.current === currentSeq) {
              setIsLoadingPhytoCertificate(false);
            }
          }
        } else {
          await stepperPromise;
          if (activeFetchSeqRef.current === currentSeq) {
            setIsLoadingPhytoCertificate(false);
            setPhytoCertificateVersion((v) => v + 1);
          }
        }
        return;
      }
    },
    [
      steps,
      confirmationData,
      contractData,
      proformaData,
      shipmentInstructionData,
      billOfLadingData,
      customInvoiceData,
      commercialInvoiceData,
      packingListData,
      phytoCertificateData,
      canonicalContractId,
      canonicalProformaId,
      canonicalShipmentInstructionId,
      canonicalBillOfLadingId,
      canonicalCustomInvoiceId,
      canonicalCommercialInvoiceId,
      canonicalPackingListId,
      canonicalPhytoCertificateId,
      effectiveConfirmationId,
      rootWorkflowId,
      workflowAnchorId,
      workflowAnchorType,
      pinnedWorkflowContractNumber,
      initialId,
      draftId,
      lang,
    ]
  );

  // Handle step selection with URL shallow synchronization for proper linking
  // Deep link navigation: update URL query parameters without full page reload.
  // Stepper root ID remains constant; step slug indicates current view.
  const handleSelectStep = useCallback(
    (step: StepperDocumentItem, index?: number) => {
      let resolvedIndex = typeof index === 'number' ? index : -1;
      if (resolvedIndex < 0) {
        const visibleList = steps.filter(isVisibleWorkflowStep);
        resolvedIndex = visibleList.findIndex((s) => isSameWorkflowStep(s, step));
        if (resolvedIndex < 0) resolvedIndex = 0;
      }

      // Guard: If already on this exact step, avoid duplicate execution & visual flash
      if (
        selectedStep &&
        isSameWorkflowStep(selectedStep, step) &&
        resolvedIndex === selectedStepIndex
      ) {
        return;
      }

      setSelectedStepIndex(resolvedIndex);
      setSelectedStep(step);
      setIsMobileStepperOpen(false);

      // Reset attempted fetch refs so future or re-clicked fetches are never blocked
      attemptedContractFetchRef.current = null;
      attemptedProformaFetchRef.current = null;
      attemptedShipmentFetchRef.current = null;
      attemptedBillOfLadingFetchRef.current = null;
      attemptedCustomInvoiceFetchRef.current = null;
      attemptedCommercialInvoiceFetchRef.current = null;
      attemptedPackingListFetchRef.current = null;
      attemptedPhytoCertificateFetchRef.current = null;

      const isSelectingConfirmation = isConfirmationStep(step);
      const isSelectingContract = !isSelectingConfirmation && isContractStep(step);
      const isSelectingProforma = !isSelectingConfirmation && !isSelectingContract && isProformaStep(step);
      const isSelectingShipment = !isSelectingConfirmation && !isSelectingContract && !isSelectingProforma && isShipmentInstructionStep(step);
      const isSelectingBillOfLading = !isSelectingConfirmation && !isSelectingContract && !isSelectingProforma && !isSelectingShipment && isBillOfLadingStep(step);
      const isSelectingCustomInvoice = !isSelectingConfirmation && !isSelectingContract && !isSelectingProforma && !isSelectingShipment && !isSelectingBillOfLading && isCustomInvoiceStep(step);
      const isSelectingCommercialInvoice = !isSelectingConfirmation && !isSelectingContract && !isSelectingProforma && !isSelectingShipment && !isSelectingBillOfLading && !isSelectingCustomInvoice && isCommercialInvoiceStep(step);
      const isSelectingPackingList = !isSelectingConfirmation && !isSelectingContract && !isSelectingProforma && !isSelectingShipment && !isSelectingBillOfLading && !isSelectingCustomInvoice && !isSelectingCommercialInvoice && isPackingListStep(step);
      const isSelectingPhytoCertificate = !isSelectingConfirmation && !isSelectingContract && !isSelectingProforma && !isSelectingShipment && !isSelectingBillOfLading && !isSelectingCustomInvoice && !isSelectingCommercialInvoice && !isSelectingPackingList && isPhytoCertificateStep(step);

      if (isSelectingConfirmation) {
        setConfirmationVersion((v) => v + 1);
      } else if (isSelectingContract) {
        setContractVersion((v) => v + 1);
      } else if (isSelectingProforma) {
        setProformaVersion((v) => v + 1);
      } else if (isSelectingShipment) {
        setShipmentVersion((v) => v + 1);
      } else if (isSelectingBillOfLading) {
        setBillOfLadingVersion((v) => v + 1);
      } else if (isSelectingCustomInvoice) {
        setCustomInvoiceVersion((v) => v + 1);
      } else if (isSelectingCommercialInvoice) {
        setCommercialInvoiceVersion((v) => v + 1);
      } else if (isSelectingPackingList) {
        setPackingListVersion((v) => v + 1);
      } else if (isSelectingPhytoCertificate) {
        setPhytoCertificateVersion((v) => v + 1);
      }

      const stepSelfId = getStepSelfId(step);

      if (isSelectingConfirmation && !isCompleteConfirmationData(confirmationData) && !isCompleteConfirmationData(initialData) && (stepSelfId || getConfirmationIdFromStepper(steps, step) || effectiveConfirmationId)) {
        setIsLoadingConfirmation(true);
      }
      if (isSelectingContract && !isCompleteContractData(contractData) && !isCompleteContractData(initialContractData) && (stepSelfId || getContractIdFromStepper(steps, step) || canonicalContractId)) {
        setIsLoadingContract(true);
      }
      if (isSelectingProforma && !isCompleteProformaData(proformaData) && !isCompleteProformaData(initialProformaData) && (stepSelfId || getProformaIdFromStepper(steps, step) || canonicalProformaId)) {
        setIsLoadingProforma(true);
      }
      if (isSelectingShipment && !isCompleteShipmentInstructionData(shipmentInstructionData) && !isCompleteShipmentInstructionData(initialShipmentInstructionData) && (stepSelfId || getShipmentInstructionIdFromStepper(steps, step) || canonicalShipmentInstructionId)) {
        setIsLoadingShipmentInstruction(true);
      }
      if (isSelectingBillOfLading && !isCompleteBillOfLadingData(billOfLadingData) && !isCompleteBillOfLadingData(initialBillOfLadingData) && (stepSelfId || getBillOfLadingIdFromStepper(steps, step) || canonicalBillOfLadingId)) {
        setIsLoadingBillOfLading(true);
      }
      if (isSelectingCustomInvoice && !isCompleteCustomInvoiceData(customInvoiceData) && !isCompleteCustomInvoiceData(initialCustomInvoiceData) && (stepSelfId || getCustomInvoiceIdFromStepper(steps, step) || canonicalCustomInvoiceId)) {
        setIsLoadingCustomInvoice(true);
      }
      if (isSelectingCommercialInvoice && !isCompleteCommercialInvoiceData(commercialInvoiceData) && !isCompleteCommercialInvoiceData(initialCommercialInvoiceData) && (stepSelfId || getCommercialInvoiceIdFromStepper(steps, step) || canonicalCommercialInvoiceId)) {
        setIsLoadingCommercialInvoice(true);
      }
      if (isSelectingPackingList && !isCompletePackingListData(packingListData) && !isCompletePackingListData(initialPackingListData) && (stepSelfId || getPackingListIdFromStepper(steps, step) || canonicalPackingListId)) {
        setIsLoadingPackingList(true);
      }
      if (isSelectingPhytoCertificate && !isCompletePhytoCertificateData(phytoCertificateData) && !isCompletePhytoCertificateData(initialPhytoCertificateData) && (stepSelfId || getPhytoCertificateIdFromStepper(steps, step) || canonicalPhytoCertificateId)) {
        setIsLoadingPhytoCertificate(true);
      }

      const slug = getStepSlug(step, resolvedIndex);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        // "har bar usme jo form hai us form pe vo nahi karna hai hume kya bolte hai id change nahi karni hai stepper me just vo har form move karne par refresh karavani hai properly"
        // "and contract ke step me move hone par stepper me id change nahi karvani hai vaha sirf refresh hi karvana hai to solve proper ho jayega"
        const targetStepDocId = workflowAnchorId || initialId || draftId;
        if (targetStepDocId && targetStepDocId !== 'new-confirmation') {
          url.searchParams.set('id', targetStepDocId);
        }
        url.searchParams.set('step', slug);
        window.history.replaceState(null, '', url.toString());
      }

      // Concurrently refresh the stepper list so step statuses are updated without changing stepper ID
      const targetStepperId = workflowAnchorId || initialId;
      if (targetStepperId && targetStepperId !== 'new-confirmation') {
        getStepperListAction({
          action: workflowAnchorType,
          step: String(targetStepperId),
          lang,
        })
          .then((sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps((prevSteps) => mergeStepperWithHidden(sRes.data, prevSteps));
            }
          })
          .catch(() => {});
      }

      // Seamlessly reset scroll position to top of document on step transition
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        const draftCard = document.getElementById('draft-form-card');
        if (draftCard) draftCard.scrollTop = 0;
        const scrollContainers = document.querySelectorAll('.custom-scrollbar, .overflow-y-auto, main');
        scrollContainers.forEach((el) => {
          if (el instanceof HTMLElement) el.scrollTop = 0;
        });
      }

      const currentSeq = ++activeFetchSeqRef.current;
      fetchLatestStepData(step, resolvedIndex, currentSeq);
    },
    [
      steps,
      confirmationData,
      initialData,
      effectiveConfirmationId,
      contractData,
      initialContractData,
      canonicalContractId,
      proformaData,
      initialProformaData,
      canonicalProformaId,
      shipmentInstructionData,
      initialShipmentInstructionData,
      canonicalShipmentInstructionId,
      billOfLadingData,
      initialBillOfLadingData,
      canonicalBillOfLadingId,
      customInvoiceData,
      initialCustomInvoiceData,
      canonicalCustomInvoiceId,
      commercialInvoiceData,
      initialCommercialInvoiceData,
      canonicalCommercialInvoiceId,
      rootWorkflowId,
      workflowAnchorId,
      workflowAnchorType,
      initialId,
      fetchLatestStepData,
    ]
  );

  const handleUpdateSteps = useCallback(
    (newSteps: StepperDocumentItem[]) => {
      if (!newSteps || newSteps.length === 0) return;
      setSteps((prevSteps) => {
        const merged = mergeStepperWithHidden(newSteps, prevSteps);
        const visibleSteps = merged.filter(isVisibleWorkflowStep);
        if (visibleSteps.length === 0) return merged;

        if (!selectedStep) {
          handleSelectStep(visibleSteps[0], 0);
          return merged;
        }

        const matchIdx = visibleSteps.findIndex((s) => isSameWorkflowStep(s, selectedStep));

        if (matchIdx >= 0) {
          setSelectedStepIndex(matchIdx);
          setSelectedStep(visibleSteps[matchIdx]);
        } else {
          // Currently open document was removed/hidden from workflow!
          // Gracefully switch to nearest valid visible step (or first step):
          const fallbackStep = visibleSteps[0];
          handleSelectStep(fallbackStep, 0);
        }
        return merged;
      });
    },
    [selectedStep, handleSelectStep]
  );

  const pageTitle = isContract || (!selectedStep && (initialStepParam === 'contract' || initialStepParam === '2'))
    ? dict?.smart_docs?.draft_contract_title || dict?.smart_docs?.draft_contract || 'Draft Contract'
    : isProforma || (!selectedStep && (initialStepParam === 'proforma' || initialStepParam === '3'))
    ? dict?.smart_docs?.draft_proforma_title || 'Draft Proforma Invoice'
    : isShipmentInstruction ||
      (!selectedStep &&
        (initialStepParam === 'shipment' ||
          initialStepParam === 'shipment_instruction' ||
          initialStepParam === 'shipment-instruction' ||
          initialStepParam === 'instruction' ||
          initialStepParam === 'document' ||
          initialStepParam === '4'))
    ? dict?.smart_docs?.draft_shipment_instruction_title || 'Draft Shipment Instruction'
    : isBillOfLading ||
      (!selectedStep &&
        (initialStepParam === 'bill-of-lading' ||
          initialStepParam === 'bill_of_lading' ||
          initialStepParam === 'lading' ||
          initialStepParam === 'bl' ||
          initialStepParam === '5'))
    ? dict?.smart_docs?.draft_bill_of_lading_title || 'Draft Bill of Lading'
    : isCustomInvoice ||
      (!selectedStep &&
        (initialStepParam === 'custom-invoice' ||
          initialStepParam === 'custom_invoice' ||
          initialStepParam === 'custom' ||
          initialStepParam === 'invoice' ||
          initialStepParam === '6'))
    ? dict?.smart_docs?.draft_custom_invoice_title || 'Draft Custom Invoice'
    : isCommercialInvoice ||
      (!selectedStep &&
        (initialStepParam === 'commercial-invoice' ||
          initialStepParam === 'commercial_invoice' ||
          initialStepParam === 'commercial' ||
          initialStepParam === '7'))
    ? dict?.smart_docs?.draft_commercial_invoice_title || 'Draft Commercial Invoice'
    : isPackingList ||
      (!selectedStep &&
        (initialStepParam === 'packing-list' ||
          initialStepParam === 'packing_list' ||
          initialStepParam === 'packing' ||
          initialStepParam === '8'))
    ? dict?.smart_docs?.draft_packing_list_title || 'Draft Packing List'
    : isPhytoCertificate ||
      (!selectedStep &&
        (initialStepParam === 'phyto-certificate' ||
          initialStepParam === 'phyto_certificate' ||
          initialStepParam === 'phyto' ||
          initialStepParam === 'phytosanitary' ||
          initialStepParam === '9'))
    ? dict?.smart_docs?.draft_phyto_certificate_title || 'Draft Phyto Certificate'
    : isConfirmation || !selectedStep
    ? dict?.smart_docs?.draft_confirmation_title ||
      dict?.smart_docs?.draft_title ||
      dict?.smart_docs?.add_new_confirmation ||
      dict?.smart_docs?.add_confirmation ||
      'Draft Confirmation'
    : (() => {
        const rawName = safeString(
          selectedStep?.document_name ||
          selectedStep?.name ||
          selectedStep?.title ||
          selectedStep?.doc_name ||
          selectedStep?.step_name ||
          ''
        ).trim();
        if (!rawName) {
          return dict?.smart_docs?.draft_confirmation_title || dict?.smart_docs?.draft_title || 'Draft Confirmation';
        }
        if (/^draft\b/i.test(rawName)) {
          return rawName;
        }
        return `Draft ${rawName}`;
      })();

  // Prevent browser from restoring scroll position to bottom of form on normal refresh
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, []);

  // Synchronize document.title dynamically when switching steps
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${pageTitle} | Smart Docs | AgriGuru Online`;
    }
  }, [pageTitle]);

  useEffect(() => {
    if (initialContractData) {
      setContractData((prev: any) => {
        if (!prev || (prev.id && initialContractData.id && String(prev.id) !== String(initialContractData.id))) {
          return initialContractData;
        }
        return { ...initialContractData, ...prev };
      });
    }
  }, [initialContractData]);

  useEffect(() => {
    if (initialData) {
      setConfirmationData((prev: any) => {
        if (!prev || (prev.id && initialData.id && String(prev.id) !== String(initialData.id))) {
          return initialData;
        }
        return { ...initialData, ...prev };
      });
    }
  }, [initialData]);

  useEffect(() => {
    if (initialProformaData) {
      setProformaData((prev: any) => {
        if (!prev || (prev.id && initialProformaData.id && String(prev.id) !== String(initialProformaData.id))) {
          return initialProformaData;
        }
        return { ...initialProformaData, ...prev };
      });
    }
  }, [initialProformaData]);

  useEffect(() => {
    if (initialShipmentInstructionData) {
      setShipmentInstructionData((prev: any) => {
        if (!prev || (prev.id && initialShipmentInstructionData.id && String(prev.id) !== String(initialShipmentInstructionData.id))) {
          return initialShipmentInstructionData;
        }
        return { ...initialShipmentInstructionData, ...prev };
      });
    }
  }, [initialShipmentInstructionData]);

  useEffect(() => {
    if (initialBillOfLadingData) {
      setBillOfLadingData((prev: any) => {
        if (!prev || (prev.id && initialBillOfLadingData.id && String(prev.id) !== String(initialBillOfLadingData.id))) {
          return initialBillOfLadingData;
        }
        return { ...initialBillOfLadingData, ...prev };
      });
    }
  }, [initialBillOfLadingData]);

  useEffect(() => {
    if (initialCustomInvoiceData) {
      setCustomInvoiceData((prev: any) => {
        if (!prev || (prev.id && initialCustomInvoiceData.id && String(prev.id) !== String(initialCustomInvoiceData.id))) {
          return initialCustomInvoiceData;
        }
        const merged: Record<string, any> = { ...initialCustomInvoiceData };
        for (const [k, v] of Object.entries(prev)) {
          if (v !== undefined && v !== null && v !== '') {
            merged[k] = v;
          }
        }
        return merged;
      });
      setCustomInvoiceVersion((v) => v + 1);
    }
  }, [initialCustomInvoiceData]);

  useEffect(() => {
    if (initialCommercialInvoiceData) {
      setCommercialInvoiceData((prev: any) => {
        if (!prev || (prev.id && initialCommercialInvoiceData.id && String(prev.id) !== String(initialCommercialInvoiceData.id))) {
          return initialCommercialInvoiceData;
        }
        return { ...initialCommercialInvoiceData, ...prev };
      });
      setCommercialInvoiceVersion((v) => v + 1);
    }
  }, [initialCommercialInvoiceData]);

  useEffect(() => {
    if (initialPackingListData) {
      setPackingListData((prev: any) => {
        if (!prev || (prev.id && initialPackingListData.id && String(prev.id) !== String(initialPackingListData.id))) {
          return initialPackingListData;
        }
        return { ...initialPackingListData, ...prev };
      });
      setPackingListVersion((v) => v + 1);
    }
  }, [initialPackingListData]);

  // On initial mount / refresh, if the currently selected step does NOT have its data loaded, fetch it immediately!
  const hasInitialFetchedStepRef = useRef<boolean>(false);
  useEffect(() => {
    if (hasInitialFetchedStepRef.current) return;

    const isTargetConfirmation = isConfirmationStep(selectedStep);
    const isTargetContract = !isTargetConfirmation && isContractStep(selectedStep);
    const isTargetProforma = !isTargetConfirmation && !isTargetContract && isProformaStep(selectedStep);
    const isTargetShipment = !isTargetConfirmation && !isTargetContract && !isTargetProforma && isShipmentInstructionStep(selectedStep);
    const isTargetBillOfLading = !isTargetConfirmation && !isTargetContract && !isTargetProforma && !isTargetShipment && isBillOfLadingStep(selectedStep);
    const isTargetCustomInvoice = !isTargetConfirmation && !isTargetContract && !isTargetProforma && !isTargetShipment && !isTargetBillOfLading && isCustomInvoiceStep(selectedStep);
    const isTargetCommercialInvoice = !isTargetConfirmation && !isTargetContract && !isTargetProforma && !isTargetShipment && !isTargetBillOfLading && !isTargetCustomInvoice && isCommercialInvoiceStep(selectedStep);
    const isTargetPackingList = !isTargetConfirmation && !isTargetContract && !isTargetProforma && !isTargetShipment && !isTargetBillOfLading && !isTargetCustomInvoice && !isTargetCommercialInvoice && isPackingListStep(selectedStep);
    const isTargetPhytoCertificate = !isTargetConfirmation && !isTargetContract && !isTargetProforma && !isTargetShipment && !isTargetBillOfLading && !isTargetCustomInvoice && !isTargetCommercialInvoice && !isTargetPackingList && isPhytoCertificateStep(selectedStep);

    let needsFetch = false;
    if (isTargetContract && !isCompleteContractData(contractData) && !isCompleteContractData(initialContractData)) needsFetch = true;
    if (isTargetProforma && !isCompleteProformaData(proformaData) && !isCompleteProformaData(initialProformaData)) needsFetch = true;
    if (isTargetShipment && !isCompleteShipmentInstructionData(shipmentInstructionData) && !isCompleteShipmentInstructionData(initialShipmentInstructionData)) needsFetch = true;
    if (isTargetBillOfLading && !isCompleteBillOfLadingData(billOfLadingData) && !isCompleteBillOfLadingData(initialBillOfLadingData)) needsFetch = true;
    if (isTargetCustomInvoice && !isCompleteCustomInvoiceData(customInvoiceData) && !isCompleteCustomInvoiceData(initialCustomInvoiceData)) needsFetch = true;
    if (isTargetCommercialInvoice && !isCompleteCommercialInvoiceData(commercialInvoiceData) && !isCompleteCommercialInvoiceData(initialCommercialInvoiceData)) needsFetch = true;
    if (isTargetPackingList && !isCompletePackingListData(packingListData) && !isCompletePackingListData(initialPackingListData)) needsFetch = true;
    if (isTargetPhytoCertificate && !isCompletePhytoCertificateData(phytoCertificateData) && !isCompletePhytoCertificateData(initialPhytoCertificateData)) needsFetch = true;

    if (needsFetch) {
      hasInitialFetchedStepRef.current = true;
      const currentSeq = ++activeFetchSeqRef.current;
      fetchLatestStepData(selectedStep, selectedStepIndex, currentSeq);
    }
  }, [
    selectedStep,
    selectedStepIndex,
    fetchLatestStepData,
    contractData,
    initialContractData,
    proformaData,
    initialProformaData,
    shipmentInstructionData,
    initialShipmentInstructionData,
    billOfLadingData,
    initialBillOfLadingData,
    customInvoiceData,
    initialCustomInvoiceData,
    commercialInvoiceData,
    initialCommercialInvoiceData,
    packingListData,
    initialPackingListData,
    phytoCertificateData,
    initialPhytoCertificateData,
  ]);

  // Fetch confirmation data dynamically if confirmation step is active and data not yet loaded
  useEffect(() => {
    if (!isConfirmation || isCompleteConfirmationData(confirmationData) || isCompleteConfirmationData(initialData)) return;
    const cleanConfId = sanitizeDocId(
      effectiveConfirmationId ||
      getConfirmationIdFromStepper(steps) ||
      getStepSelfId(steps[0]) ||
      steps[0]?.redirect_id
    );
    if (cleanConfId && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(cleanConfId)) {
      setIsLoadingConfirmation(true);
      getConfirmationAction(cleanConfId, lang)
        .then((res) => {
          if (res?.success && res.data) {
            setConfirmationData(extractConfirmationData(res.data) || res.data);
            setConfirmationVersion((v) => v + 1);
          }
        })
        .catch((err) => {
          console.error('[DocumentDraftWorkspace] Error fetching confirmation dynamically:', err);
        })
        .finally(() => {
          setIsLoadingConfirmation(false);
        });
    } else {
      setIsLoadingConfirmation(false);
    }
  }, [isConfirmation, confirmationData, initialData, effectiveConfirmationId, steps, lang]);

  // Fetch contract data dynamically if not yet loaded
  useEffect(() => {
    if (isCompleteContractData(contractData) || isCompleteContractData(initialContractData)) {
      return;
    }

    const effectiveContractId = sanitizeDocId(
      canonicalContractId ||
      contractIdFromStepper ||
      getStepSelfId(steps[1]) ||
      steps[1]?.redirect_id
    );

    if (
      effectiveContractId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(effectiveContractId) &&
      attemptedContractFetchRef.current !== effectiveContractId
    ) {
      attemptedContractFetchRef.current = effectiveContractId;
      setIsLoadingContract(true);
      getContractAction(effectiveContractId, lang)
        .then((res) => {
          if (res?.success && res.data) {
            const extracted = extractContractData(res.data) || res.data;
            if (extracted) {
              const hasSplits = Boolean(
                (extracted.splits && Array.isArray(extracted.splits) && extracted.splits.length > 0) ||
                extracted.has_splits ||
                extracted.is_split ||
                extracted.is_partial ||
                extracted.partial_shipment_allowed
              );
              const baseContNum = cleanBaseContractNumber(
                extracted.contract_number || extracted.contractNumber || extracted.contract_no,
                hasSplits
              );
              if (baseContNum) {
                extracted.contract_number = baseContNum;
                extracted.contractNumber = baseContNum;
                extracted.contract_no = baseContNum;
                if (extracted.contract && typeof extracted.contract === 'object') {
                  extracted.contract.contract_number = baseContNum;
                  extracted.contract.contractNumber = baseContNum;
                  extracted.contract.contract_no = baseContNum;
                }
              }
              setContractData(extracted);
              setContractVersion((v) => v + 1);
            }
          }
        })
        .catch((err) => {
          console.error('[DocumentDraftWorkspace] Error fetching contract dynamically:', err);
        })
        .finally(() => {
          setIsLoadingContract(false);
        });
    } else if (!effectiveContractId) {
      setIsLoadingContract(false);
    }
  }, [canonicalContractId, contractIdFromStepper, steps, contractData, initialContractData, pinnedWorkflowContractNumber, lang]);

  // Fetch proforma data dynamically if a REAL proforma ID exists and not yet loaded
  useEffect(() => {
    if (isCompleteProformaData(proformaData) || isCompleteProformaData(initialProformaData)) {
      return;
    }

    const effectiveProformaId = canonicalProformaId;

    // Only fetch if there is a distinct, genuine proforma ID and we haven't already attempted it
    if (effectiveProformaId && attemptedProformaFetchRef.current !== effectiveProformaId) {
      attemptedProformaFetchRef.current = effectiveProformaId;
      setIsLoadingProforma(true);
      getProformaAction(effectiveProformaId, lang)
        .then((res) => {
          if (res?.success && res.data) {
            const extracted = extractProformaData(res.data) || res.data;
            if (extracted) {
              if (pinnedWorkflowContractNumber && isPartialContractNumber(pinnedWorkflowContractNumber)) {
                extracted.contract_number = pinnedWorkflowContractNumber;
                extracted.contractNumber = pinnedWorkflowContractNumber;
                extracted.contract_no = pinnedWorkflowContractNumber;
                if (extracted.contract && typeof extracted.contract === 'object') {
                  extracted.contract.contract_number = pinnedWorkflowContractNumber;
                  extracted.contract.contractNumber = pinnedWorkflowContractNumber;
                  extracted.contract.contract_no = pinnedWorkflowContractNumber;
                }
              }
              setProformaData(extracted);
              setProformaVersion((v) => v + 1);
            }
          }
        })
        .catch((err) => {
          console.warn('[DocumentDraftWorkspace] Error fetching proforma dynamically:', err);
        })
        .finally(() => {
          setIsLoadingProforma(false);
        });
    } else if (!effectiveProformaId) {
      setIsLoadingProforma(false);
    }
  }, [canonicalProformaId, proformaData, initialProformaData, pinnedWorkflowContractNumber, lang]);

  // Fetch shipment instruction data dynamically if a REAL shipment instruction ID exists and not yet loaded
  useEffect(() => {
    if (isCompleteShipmentInstructionData(shipmentInstructionData) || isCompleteShipmentInstructionData(initialShipmentInstructionData)) {
      return;
    }

    const effectiveId = canonicalShipmentInstructionId;
    if (!effectiveId) {
      setIsLoadingShipmentInstruction(false);
      return;
    }

    if (attemptedShipmentFetchRef.current !== effectiveId) {
      attemptedShipmentFetchRef.current = effectiveId;
      setIsLoadingShipmentInstruction(true);
      getShipmentInstructionAction(effectiveId, lang)
        .then((res) => {
          if (res?.success && res.data) {
            const extracted = extractShipmentInstructionData(res.data) || res.data;
            if (extracted) {
              setShipmentInstructionData(extracted);
              setShipmentVersion((v) => v + 1);
            }
          }
        })
        .catch((err) => {
          console.warn('[DocumentDraftWorkspace] Error fetching shipment instruction dynamically:', err);
        })
        .finally(() => {
          setIsLoadingShipmentInstruction(false);
        });
    }
  }, [canonicalShipmentInstructionId, shipmentInstructionData, initialShipmentInstructionData, lang]);

  // Fetch fresh bill of lading data whenever Bill of Lading step becomes active
  useEffect(() => {
    if (!isBillOfLading) {
      attemptedBillOfLadingFetchRef.current = null;
      isInitialBillOfLadingSsrFreshRef.current = false;
      return;
    }

    const ladingStep = getBillOfLadingStep(steps, selectedStep);
    const effectiveId = sanitizeDocId(
      canonicalBillOfLadingId ||
      ladingStep?.bill_of_lading_id ||
      (ladingStep as any)?.billOfLadingId ||
      ladingStep?.lading_id ||
      getStepSelfId(ladingStep) ||
      getBillOfLadingIdFromStepper(steps, selectedStep) ||
      extractStepRedirectId(ladingStep) ||
      extractLinkedBillOfLadingId(billOfLadingData) ||
      extractLinkedBillOfLadingId(shipmentInstructionData) ||
      extractLinkedBillOfLadingId(proformaData) ||
      extractLinkedBillOfLadingId(contractData)
    );

    if (
      !effectiveId ||
      (/^\d+$/.test(effectiveId) && Number(effectiveId) <= 20) ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|invoice|step-\d+)$/i.test(effectiveId)
    ) {
      setIsLoadingBillOfLading(false);
      return;
    }

    // On direct SSR hard-refresh to Bill of Lading step, SSR data is already fresh for this exact ID
    if (isInitialBillOfLadingSsrFreshRef.current) {
      isInitialBillOfLadingSsrFreshRef.current = false;
      attemptedBillOfLadingFetchRef.current = effectiveId;
      return;
    }

    if (attemptedBillOfLadingFetchRef.current !== effectiveId) {
      attemptedBillOfLadingFetchRef.current = effectiveId;
      let cancelled = false;
      setIsLoadingBillOfLading(true);
      getBillOfLadingAction(effectiveId, lang)
        .then((res) => {
          if (cancelled) return;
          if (res?.success && res.data && typeof res.data === 'object') {
            const extracted =
              extractBillOfLadingData(res.data) ||
              { ...res.data, _is_lading_loaded: true };
            if (extracted) {
              setBillOfLadingData({ ...extracted, _is_lading_loaded: true });
              setBillOfLadingVersion((v) => v + 1);
            }
          }
        })
        .catch((err) => {
          console.warn('[DocumentDraftWorkspace] Error fetching bill of lading dynamically:', err);
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingBillOfLading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }
  }, [
    isBillOfLading,
    canonicalBillOfLadingId,
    steps,
    selectedStep,
    shipmentInstructionData,
    proformaData,
    contractData,
    lang,
  ]);

  // Fetch fresh custom invoice data whenever Custom Invoice step becomes active
  useEffect(() => {
    if (!isCustomInvoice) {
      attemptedCustomInvoiceFetchRef.current = null;
      isInitialCustomInvoiceSsrFreshRef.current = false;
      return;
    }

    const customStep = getCustomInvoiceStep(steps, selectedStep);
    const effectiveId = sanitizeDocId(
      canonicalCustomInvoiceId ||
      customStep?.custom_invoice_id ||
      (customStep as any)?.customInvoiceId ||
      customStep?.invoice_id ||
      getStepSelfId(customStep) ||
      getCustomInvoiceIdFromStepper(steps, selectedStep) ||
      extractStepRedirectId(customStep) ||
      extractLinkedCustomInvoiceId(customInvoiceData) ||
      extractLinkedCustomInvoiceId(billOfLadingData) ||
      extractLinkedCustomInvoiceId(shipmentInstructionData) ||
      extractLinkedCustomInvoiceId(proformaData) ||
      extractLinkedCustomInvoiceId(contractData)
    );

    if (
      !effectiveId ||
      (/^\d+$/.test(effectiveId) && Number(effectiveId) <= 20) ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|invoice|step-\d+)$/i.test(effectiveId)
    ) {
      setIsLoadingCustomInvoice(false);
      return;
    }

    // On direct SSR hard-refresh to Custom Invoice step, SSR data is already fresh for this exact ID
    if (isInitialCustomInvoiceSsrFreshRef.current) {
      isInitialCustomInvoiceSsrFreshRef.current = false;
      attemptedCustomInvoiceFetchRef.current = effectiveId;
      return;
    }

    if (attemptedCustomInvoiceFetchRef.current !== effectiveId) {
      attemptedCustomInvoiceFetchRef.current = effectiveId;
      let cancelled = false;
      setIsLoadingCustomInvoice(true);
      getCustomInvoiceAction(effectiveId, lang)
        .then((res) => {
          if (cancelled) return;
          if (res?.success && res.data && typeof res.data === 'object') {
            const extracted =
              extractCustomInvoiceData(res.data) ||
              { ...res.data, _is_custom_invoice_loaded: true };
            if (extracted) {
              setCustomInvoiceData(extracted);
              setCustomInvoiceVersion((v) => v + 1);
            }
          }
        })
        .catch((err) => {
          console.warn('[DocumentDraftWorkspace] Error fetching custom invoice dynamically:', err);
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingCustomInvoice(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }
  }, [
    isCustomInvoice,
    canonicalCustomInvoiceId,
    steps,
    selectedStep,
    billOfLadingData,
    shipmentInstructionData,
    proformaData,
    contractData,
    lang,
  ]);

  // Fetch fresh commercial invoice data whenever Commercial Invoice step becomes active
  useEffect(() => {
    if (!isCommercialInvoice) {
      attemptedCommercialInvoiceFetchRef.current = null;
      isInitialCommercialInvoiceSsrFreshRef.current = false;
      return;
    }

    const commercialStep = getCommercialInvoiceStep(steps, selectedStep);
    const effectiveId = sanitizeDocId(
      canonicalCommercialInvoiceId ||
      commercialStep?.commercial_invoice_id ||
      (commercialStep as any)?.commercialInvoiceId ||
      getStepSelfId(commercialStep) ||
      getCommercialInvoiceIdFromStepper(steps, selectedStep) ||
      extractStepRedirectId(commercialStep) ||
      extractLinkedCommercialInvoiceId(commercialInvoiceData) ||
      extractLinkedCommercialInvoiceId(customInvoiceData) ||
      extractLinkedCommercialInvoiceId(billOfLadingData) ||
      extractLinkedCommercialInvoiceId(shipmentInstructionData) ||
      extractLinkedCommercialInvoiceId(proformaData) ||
      extractLinkedCommercialInvoiceId(contractData)
    );

    if (
      !effectiveId ||
      (/^\d+$/.test(effectiveId) && Number(effectiveId) <= 20) ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|invoice|step-\d+)$/i.test(effectiveId)
    ) {
      setIsLoadingCommercialInvoice(false);
      return;
    }

    if (isInitialCommercialInvoiceSsrFreshRef.current) {
      isInitialCommercialInvoiceSsrFreshRef.current = false;
      attemptedCommercialInvoiceFetchRef.current = effectiveId;
      return;
    }

    if (attemptedCommercialInvoiceFetchRef.current !== effectiveId) {
      attemptedCommercialInvoiceFetchRef.current = effectiveId;
      let cancelled = false;
      setIsLoadingCommercialInvoice(true);
      getCommercialInvoiceAction(effectiveId, lang)
        .then((res) => {
          if (cancelled) return;
          if (res?.success && res.data && typeof res.data === 'object') {
            const extracted =
              extractCommercialInvoiceData(res.data) ||
              { ...res.data, _is_commercial_invoice_loaded: true };
            if (extracted) {
              setCommercialInvoiceData(extracted);
              setCommercialInvoiceVersion((v) => v + 1);
            }
          }
        })
        .catch((err) => {
          console.warn('[DocumentDraftWorkspace] Error fetching commercial invoice dynamically:', err);
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingCommercialInvoice(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }
  }, [
    isCommercialInvoice,
    canonicalCommercialInvoiceId,
    steps,
    selectedStep,
    customInvoiceData,
    billOfLadingData,
    shipmentInstructionData,
    proformaData,
    contractData,
    lang,
  ]);

  // Fetch fresh packing list data whenever Packing List step becomes active
  useEffect(() => {
    if (!isPackingList) {
      attemptedPackingListFetchRef.current = null;
      isInitialPackingListSsrFreshRef.current = false;
      return;
    }

    const packingStep = getPackingListStep(steps, selectedStep);
    const effectiveId = sanitizeDocId(
      canonicalPackingListId ||
      packingStep?.packing_list_id ||
      (packingStep as any)?.packingListId ||
      getStepSelfId(packingStep) ||
      getPackingListIdFromStepper(steps, selectedStep) ||
      extractStepRedirectId(packingStep) ||
      extractLinkedPackingListId(packingListData) ||
      extractLinkedPackingListId(commercialInvoiceData) ||
      extractLinkedPackingListId(customInvoiceData) ||
      extractLinkedPackingListId(billOfLadingData) ||
      extractLinkedPackingListId(shipmentInstructionData) ||
      extractLinkedPackingListId(proformaData) ||
      extractLinkedPackingListId(contractData)
    );

    if (
      !effectiveId ||
      (/^\d+$/.test(effectiveId) && Number(effectiveId) <= 20) ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|invoice|step-\d+)$/i.test(effectiveId)
    ) {
      setIsLoadingPackingList(false);
      return;
    }

    if (isInitialPackingListSsrFreshRef.current) {
      isInitialPackingListSsrFreshRef.current = false;
      attemptedPackingListFetchRef.current = effectiveId;
      return;
    }

    if (attemptedPackingListFetchRef.current !== effectiveId) {
      attemptedPackingListFetchRef.current = effectiveId;
      let cancelled = false;
      setIsLoadingPackingList(true);
      getPackingListAction(effectiveId, lang)
        .then((res) => {
          if (cancelled) return;
          if (res?.success && res.data && typeof res.data === 'object') {
            const extracted =
              extractPackingListData(res.data) ||
              { ...res.data, _is_packing_list_loaded: true };
            if (extracted) {
              setPackingListData(extracted);
              setPackingListVersion((v) => v + 1);
            }
          }
        })
        .catch((err) => {
          console.warn('[DocumentDraftWorkspace] Error fetching packing list dynamically:', err);
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingPackingList(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }
  }, [
    isPackingList,
    canonicalPackingListId,
    steps,
    selectedStep,
    commercialInvoiceData,
    customInvoiceData,
    billOfLadingData,
    shipmentInstructionData,
    proformaData,
    contractData,
    lang,
  ]);

  // Fetch fresh phyto certificate data whenever Phyto Certificate step becomes active
  useEffect(() => {
    if (!isPhytoCertificate) {
      attemptedPhytoCertificateFetchRef.current = null;
      isInitialPhytoCertificateSsrFreshRef.current = false;
      return;
    }

    const phytoStep = getPhytoCertificateStep(steps, selectedStep);
    const effectiveId = sanitizeDocId(
      canonicalPhytoCertificateId ||
      phytoStep?.phyto_certificate_id ||
      (phytoStep as any)?.phytoCertificateId ||
      getStepSelfId(phytoStep) ||
      getPhytoCertificateIdFromStepper(steps, selectedStep) ||
      extractStepRedirectId(phytoStep) ||
      extractLinkedPhytoCertificateId(phytoCertificateData) ||
      extractLinkedPhytoCertificateId(packingListData) ||
      extractLinkedPhytoCertificateId(commercialInvoiceData) ||
      extractLinkedPhytoCertificateId(customInvoiceData) ||
      extractLinkedPhytoCertificateId(billOfLadingData) ||
      extractLinkedPhytoCertificateId(shipmentInstructionData) ||
      extractLinkedPhytoCertificateId(proformaData) ||
      extractLinkedPhytoCertificateId(contractData)
    );

    if (
      !effectiveId ||
      (/^\d+$/.test(effectiveId) && Number(effectiveId) <= 20) ||
      /^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|lading|bill-of-lading|bl|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|phyto|phyto-certificate|invoice|step-\d+)$/i.test(effectiveId)
    ) {
      setIsLoadingPhytoCertificate(false);
      return;
    }

    if (isInitialPhytoCertificateSsrFreshRef.current) {
      isInitialPhytoCertificateSsrFreshRef.current = false;
      attemptedPhytoCertificateFetchRef.current = effectiveId;
      return;
    }

    if (attemptedPhytoCertificateFetchRef.current !== effectiveId) {
      attemptedPhytoCertificateFetchRef.current = effectiveId;
      let cancelled = false;
      setIsLoadingPhytoCertificate(true);
      getPhytoCertificateAction(effectiveId, lang)
        .then((res) => {
          if (cancelled) return;
          if (res?.success && res.data && typeof res.data === 'object') {
            const extracted =
              extractPhytoCertificateData(res.data) ||
              { ...res.data, _is_phyto_certificate_loaded: true };
            if (extracted) {
              setPhytoCertificateData(extracted);
              setPhytoCertificateVersion((v) => v + 1);
            }
          }
        })
        .catch((err) => {
          console.warn('[DocumentDraftWorkspace] Error fetching phyto certificate dynamically:', err);
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingPhytoCertificate(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }
  }, [
    isPhytoCertificate,
    canonicalPhytoCertificateId,
    steps,
    selectedStep,
    packingListData,
    commercialInvoiceData,
    customInvoiceData,
    billOfLadingData,
    shipmentInstructionData,
    proformaData,
    contractData,
    lang,
  ]);

  const activeDocName = safeString(
    selectedStep?.document_name ||
    selectedStep?.name ||
    selectedStep?.title ||
    selectedStep?.doc_name ||
    (isContract
      ? dict?.smart_docs?.contract_form?.sales_contract_title || 'Sales Contract'
      : isProforma
      ? 'Proforma Invoice'
      : isShipmentInstruction
      ? 'Shipment Instruction'
      : isBillOfLading
      ? 'Bill of Lading'
      : isCustomInvoice
      ? 'Custom Invoice'
      : isCommercialInvoice
      ? 'Commercial Invoice'
      : isPackingList
      ? 'Packing List'
      : isPhytoCertificate
      ? 'Phyto Certificate'
      : dict?.smart_docs?.draft_title || 'Trade Confirmation')
  );

  // Safe context inheritance for Shipment Instruction:
  // Inherits only trade reference attributes (parties, product, contract references)
  // NEVER copies document IDs, statuses, or step-specific fields (consignee, notify parties, marks, freight)
  // so an unsaved or fresh SI form is NEVER pre-filled with stale or corrupted data.
  const mergedShipmentInstructionData = useMemo(() => {
    // If a saved shipment instruction already exists, use it directly
    if (shipmentInstructionData || initialShipmentInstructionData) {
      return shipmentInstructionData || initialShipmentInstructionData;
    }

    const tradeSource =
      proformaData ||
      initialProformaData ||
      contractData ||
      initialContractData ||
      confirmationData ||
      initialData;
    if (!tradeSource || typeof tradeSource !== 'object') return null;

    return {
      seller_name: tradeSource.seller_name || tradeSource.seller?.name || tradeSource.seller_company_name,
      seller_details: tradeSource.seller_details || tradeSource.seller_instruction || tradeSource.seller?.address,
      shipper_name: tradeSource.seller_name || tradeSource.seller?.name || tradeSource.seller_company_name,
      shipper_details: tradeSource.seller_details || tradeSource.seller_instruction,
      buyer_instruction_id:
        buyerInstructionIdForShipment ||
        tradeSource.buyer_instruction_id ||
        tradeSource.buyerInstructionId ||
        tradeSource.buyer?.buyer_instruction_id ||
        tradeSource.buyer_id ||
        tradeSource.buyerId,
      buyer_name: tradeSource.buyer_name || tradeSource.buyer?.name || tradeSource.buyer_company_name,
      buyer_details: tradeSource.buyer_details || tradeSource.buyer_instruction,
      product_name: tradeSource.product_name || tradeSource.commodity || tradeSource.product?.name,
      product_id: tradeSource.product_id || tradeSource.product?.id,
      packing_type_title:
        tradeSource.packing_type_title ||
        tradeSource.packing_type?.title ||
        tradeSource.packing_type?.name,
      packing_description:
        tradeSource.packing_type_title ||
        tradeSource.packing_description ||
        tradeSource.packing_type ||
        tradeSource.packing,
      net_weight: tradeSource.net_weight ?? null,
      place_of_delivery: tradeSource.place_of_delivery,
      fcl_type: tradeSource.fcl_type || tradeSource.ship_by,
      fcl_quantity: tradeSource.fcl_quantity ?? tradeSource.fcl_qty,
      fcl_capacity: tradeSource.fcl_capacity,
      mt_quantity: tradeSource.mt_quantity || tradeSource.quantity_mt || tradeSource.quantity,
      rate_price: tradeSource.rate_price ?? tradeSource.price ?? tradeSource.rate,
      currency: tradeSource.currency || tradeSource.currency_code,
      currency_symbol: tradeSource.currency_symbol || tradeSource.currency?.symbol,
      port_of_loading: tradeSource.port_of_loading || tradeSource.loading_port,
      loading_port_name: tradeSource.loading_port_name,
      port_of_discharge: tradeSource.port_of_discharge || tradeSource.destination_port,
      destination_port_name: tradeSource.destination_port_name,
      shipping_term: tradeSource.shipping_term || tradeSource.incoterm || tradeSource.delivery_terms,
      contract_id: canonicalContractId || tradeSource.contract_id || (tradeSource.contract_number ? tradeSource.id : undefined),
      contract_number: tradeSource.contract_number || tradeSource.contract_no,
      confirmation_id: effectiveConfirmationId || tradeSource.confirmation_id,
    };
  }, [
    initialData,
    confirmationData,
    initialContractData,
    contractData,
    initialProformaData,
    proformaData,
    initialShipmentInstructionData,
    shipmentInstructionData,
    buyerInstructionIdForShipment,
    canonicalContractId,
    effectiveConfirmationId,
  ]);

  // Comprehensive data merge for Custom Invoice so trade context is inherited
  const mergedCustomInvoiceData = useMemo(() => {
    const sources = [
      initialData,
      confirmationData,
      initialContractData,
      contractData,
      initialProformaData,
      proformaData,
      initialShipmentInstructionData,
      shipmentInstructionData,
      initialBillOfLadingData,
      billOfLadingData,
      initialCustomInvoiceData,
      customInvoiceData,
    ];
    const merged: Record<string, any> = {};
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const [key, val] of Object.entries(src)) {
        if (val === undefined || val === null || val === '') continue;
        if (
          src !== customInvoiceData &&
          src !== initialCustomInvoiceData &&
          (key === 'id' || key === '_id' || key === 'status' || key === 'document_status' || key === 'title' || key === 'pdf_title' || key === 'document_title')
        ) {
          continue;
        }
        if (
          (key === 'loading_port' || key === 'destination_port') &&
          typeof merged[key] === 'object' &&
          merged[key] !== null &&
          merged[key].country &&
          (typeof val !== 'object' || val === null || !(val as any).country)
        ) {
          continue;
        }
        merged[key] = val;
      }
    }
    return merged;
  }, [
    initialData,
    confirmationData,
    initialContractData,
    contractData,
    initialProformaData,
    proformaData,
    initialShipmentInstructionData,
    shipmentInstructionData,
    initialBillOfLadingData,
    billOfLadingData,
    initialCustomInvoiceData,
    customInvoiceData,
  ]);

  // Comprehensive data merge for Commercial Invoice so trade, consignee, and notify party context is inherited
  const mergedCommercialInvoiceData = useMemo(() => {
    const sources = [
      initialData,
      confirmationData,
      initialContractData,
      contractData,
      initialProformaData,
      proformaData,
      initialShipmentInstructionData,
      shipmentInstructionData,
      initialBillOfLadingData,
      billOfLadingData,
      initialCustomInvoiceData,
      customInvoiceData,
      initialCommercialInvoiceData,
      commercialInvoiceData,
    ];
    const merged: Record<string, any> = {};
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const [key, val] of Object.entries(src)) {
        if (val === undefined || val === null || val === '') continue;
        if (
          src !== commercialInvoiceData &&
          src !== initialCommercialInvoiceData &&
          (key === 'id' ||
            key === '_id' ||
            key === 'status' ||
            key === 'document_status' ||
            key === 'title' ||
            key === 'pdf_title' ||
            key === 'document_title' ||
            key === 'invoice_number' ||
            key === 'invoice_no' ||
            key === 'invoice_date')
        ) {
          continue;
        }
        if (
          (key === 'loading_port' || key === 'destination_port') &&
          typeof merged[key] === 'object' &&
          merged[key] !== null &&
          merged[key].country &&
          (typeof val !== 'object' || val === null || !(val as any).country)
        ) {
          continue;
        }
        merged[key] = val;
      }
    }
    return merged;
  }, [
    initialData,
    confirmationData,
    initialContractData,
    contractData,
    initialProformaData,
    proformaData,
    initialShipmentInstructionData,
    shipmentInstructionData,
    initialBillOfLadingData,
    billOfLadingData,
    initialCustomInvoiceData,
    customInvoiceData,
    initialCommercialInvoiceData,
    commercialInvoiceData,
  ]);

  // Comprehensive data merge for Packing List so trade, consignee, containers, and notify party context is inherited.
  // CRITICAL: Commercial invoice data is NEVER merged into packing list! Packing list data must strictly come from packing list API.
  const mergedPackingListData = useMemo(() => {
    const sources = [
      initialData,
      confirmationData,
      initialContractData,
      contractData,
      initialProformaData,
      proformaData,
      initialShipmentInstructionData,
      shipmentInstructionData,
      initialBillOfLadingData,
      billOfLadingData,
      initialCustomInvoiceData,
      customInvoiceData,
      initialPackingListData,
      packingListData,
    ];
    const merged: Record<string, any> = {};
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const [key, val] of Object.entries(src)) {
        if (val === undefined || val === null || val === '') continue;
        // Never allow commercial invoice properties into packing list
        if (key.includes('commercial')) continue;
        if (
          src !== packingListData &&
          src !== initialPackingListData &&
          (key === 'id' ||
            key === '_id' ||
            key === 'status' ||
            key === 'document_status' ||
            key === 'title' ||
            key === 'pdf_title' ||
            key === 'document_title' ||
            key === 'packing_list_number' ||
            key === 'packing_list_no' ||
            key === 'packing_list_date' ||
            key === 'invoice_number' ||
            key === 'invoice_no' ||
            key === 'invoice_date')
        ) {
          continue;
        }
        if (
          (key === 'loading_port' || key === 'destination_port') &&
          typeof merged[key] === 'object' &&
          merged[key] !== null &&
          merged[key].country &&
          (typeof val !== 'object' || val === null || !(val as any).country)
        ) {
          continue;
        }
        merged[key] = val;
      }
    }
    // Clean any accidental commercial invoice fields
    delete merged.commercial_invoice;
    delete merged.commercialInvoice;
    delete merged.commercial_invoice_id;
    delete merged.commercial_invoice_number;
    delete merged.commercial_invoice_date;
    delete merged.commercial_invoice_no;

    return merged;
  }, [
    initialData,
    confirmationData,
    initialContractData,
    contractData,
    initialProformaData,
    proformaData,
    initialShipmentInstructionData,
    shipmentInstructionData,
    initialBillOfLadingData,
    billOfLadingData,
    initialCustomInvoiceData,
    customInvoiceData,
    initialPackingListData,
    packingListData,
  ]);

  // Comprehensive data merge for Phyto Certificate so trade, parties, and container context is inherited if creating new.
  // CRITICAL: When real phyto data is loaded from API (_is_phyto_certificate_loaded: true), it takes absolute precedence!
  const mergedPhytoCertificateData = useMemo(() => {
    if (phytoCertificateData && phytoCertificateData._is_phyto_certificate_loaded) {
      return phytoCertificateData;
    }
    const sources = [
      initialData,
      confirmationData,
      initialContractData,
      contractData,
      initialProformaData,
      proformaData,
      initialShipmentInstructionData,
      shipmentInstructionData,
      initialBillOfLadingData,
      billOfLadingData,
      initialCustomInvoiceData,
      customInvoiceData,
      initialCommercialInvoiceData,
      commercialInvoiceData,
      initialPackingListData,
      packingListData,
      initialPhytoCertificateData,
      phytoCertificateData,
    ];
    const merged: Record<string, any> = {};
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const [key, val] of Object.entries(src)) {
        if (val === undefined || val === null || val === '') continue;
        if (
          src !== phytoCertificateData &&
          src !== initialPhytoCertificateData &&
          (key === 'id' ||
            key === '_id' ||
            key === 'status' ||
            key === 'document_status' ||
            key === 'title' ||
            key === 'pdf_title' ||
            key === 'document_title' ||
            key === 'phyto_certificate_number' ||
            key === 'phyto_certificate_no' ||
            key === 'phyto_number' ||
            key === 'phyto_certificate_date' ||
            key === 'phyto_date')
        ) {
          continue;
        }
        if (
          (key === 'loading_port' || key === 'destination_port') &&
          typeof merged[key] === 'object' &&
          merged[key] !== null &&
          merged[key].country &&
          (typeof val !== 'object' || val === null || !(val as any).country)
        ) {
          continue;
        }
        merged[key] = val;
      }
    }
    return merged;
  }, [
    initialData,
    confirmationData,
    initialContractData,
    contractData,
    initialProformaData,
    proformaData,
    initialShipmentInstructionData,
    shipmentInstructionData,
    initialBillOfLadingData,
    billOfLadingData,
    initialCustomInvoiceData,
    customInvoiceData,
    initialCommercialInvoiceData,
    commercialInvoiceData,
    initialPackingListData,
    packingListData,
    initialPhytoCertificateData,
    phytoCertificateData,
  ]);

  // Active Contract Number strictly resolved from the currently open form's API response:
  // "and SI se Stepper ke uper jo Contract number dikh raha hai vo jo bhi form open hai uski api resposen me se dikhana hai so make sure proper perfect karo isko bhi"
  // "Sab me contract_number aayega shipment instructions and uske bad ke sabhi forms me same vo hi dikhana hai... abhi aa raha hai vo main contract id hai proper karo isko jo bhi jis step me hai vaha se aaye uska dikhao properly achhe se"
  const activeStepContractNumber = useMemo(() => {
    // Helper to find a partial contract number (having split suffix /A, /B, etc.) from known partial documents
    const findPartialFromSiblings = (): string | null => {
      if (pinnedWorkflowContractNumber && isPartialContractNumber(pinnedWorkflowContractNumber)) {
        return pinnedWorkflowContractNumber;
      }
      const candidates = [
        extractDocContractNumber(phytoCertificateData),
        extractDocContractNumber(initialPhytoCertificateData),
        extractDocContractNumber(packingListData),
        extractDocContractNumber(initialPackingListData),
        extractDocContractNumber(commercialInvoiceData),
        extractDocContractNumber(initialCommercialInvoiceData),
        extractDocContractNumber(customInvoiceData),
        extractDocContractNumber(initialCustomInvoiceData),
        extractDocContractNumber(billOfLadingData),
        extractDocContractNumber(initialBillOfLadingData),
        extractDocContractNumber(shipmentInstructionData),
        extractDocContractNumber(initialShipmentInstructionData),
        extractDocContractNumber(proformaData),
        extractDocContractNumber(initialProformaData),
        extractDocContractNumber(contractData),
        extractDocContractNumber(initialContractData),
      ];
      // 1. First look for candidate with explicit partial split suffix (/A, /B)
      for (const cand of candidates) {
        if (cand && isPartialContractNumber(cand)) {
          return cand;
        }
      }
      if (
        pinnedWorkflowContractNumber &&
        !isPureDbId(pinnedWorkflowContractNumber) &&
        !isLikelyInvoiceNumber(pinnedWorkflowContractNumber)
      ) {
        return pinnedWorkflowContractNumber;
      }
      // 2. Otherwise return first non-null candidate from real document data
      for (const cand of candidates) {
        if (cand && !isPureDbId(cand) && !isLikelyInvoiceNumber(cand)) return cand;
      }
      return null;
    };

    const activePartial = findPartialFromSiblings();

    const getValidDocContract = (data: any, initialData?: any): string | null => {
      const fromActive =
        extractContractFromSiResponse(data) ||
        extractContractFromSiResponse(initialData) ||
        extractDocContractNumber(data) ||
        extractDocContractNumber(initialData);
      if (fromActive && !isPureDbId(fromActive) && !isLikelyInvoiceNumber(fromActive)) {
        if (isPartialContractNumber(fromActive)) return fromActive;
        if (pinnedWorkflowContractNumber && isPartialContractNumber(pinnedWorkflowContractNumber)) {
          return pinnedWorkflowContractNumber;
        }
        return fromActive;
      }
      if (
        pinnedWorkflowContractNumber &&
        !isPureDbId(pinnedWorkflowContractNumber) &&
        !isLikelyInvoiceNumber(pinnedWorkflowContractNumber)
      ) {
        return pinnedWorkflowContractNumber;
      }
      if (activePartial) return activePartial;
      return null;
    };

    if (isShipmentInstruction) {
      // 1. Check SI response contract_number or contract_id: "also SI ka form open hua to uske resposnse me contract_id mile vo dikhani hai"
      const fromSi = extractContractFromSiResponse(shipmentInstructionData) || extractContractFromSiResponse(initialShipmentInstructionData);
      if (fromSi) return fromSi;

      return getValidDocContract(shipmentInstructionData, initialShipmentInstructionData);
    }

    if (isBillOfLading) {
      const direct = getValidDocContract(billOfLadingData, initialBillOfLadingData);
      if (direct) return direct;
      const fromSi = extractContractFromSiResponse(shipmentInstructionData) || extractContractFromSiResponse(initialShipmentInstructionData);
      if (fromSi) return fromSi;
    }

    if (isCustomInvoice) {
      const direct = getValidDocContract(customInvoiceData, initialCustomInvoiceData);
      if (direct) return direct;
      const fromSi = extractContractFromSiResponse(shipmentInstructionData) || extractContractFromSiResponse(initialShipmentInstructionData);
      if (fromSi) return fromSi;
    }

    if (isCommercialInvoice) {
      const direct = getValidDocContract(commercialInvoiceData, initialCommercialInvoiceData);
      if (direct) return direct;
      const fromSi = extractContractFromSiResponse(shipmentInstructionData) || extractContractFromSiResponse(initialShipmentInstructionData);
      if (fromSi) return fromSi;
    }

    if (isPackingList) {
      const direct = getValidDocContract(packingListData, initialPackingListData);
      if (direct) return direct;
      const fromSi = extractContractFromSiResponse(shipmentInstructionData) || extractContractFromSiResponse(initialShipmentInstructionData);
      if (fromSi) return fromSi;
    }

    if (isPhytoCertificate) {
      const direct = getValidDocContract(phytoCertificateData, initialPhytoCertificateData);
      if (direct) return direct;
      const fromSi = extractContractFromSiResponse(shipmentInstructionData) || extractContractFromSiResponse(initialShipmentInstructionData);
      if (fromSi) return fromSi;
    }

    if (isContract) {
      const direct = extractDocContractNumber(contractData) || extractDocContractNumber(initialContractData);
      if (direct && !isPureDbId(direct) && !isLikelyInvoiceNumber(direct)) {
        return cleanBaseContractNumber(direct, true);
      }
      if (
        pinnedWorkflowContractNumber &&
        !isPureDbId(pinnedWorkflowContractNumber) &&
        !isLikelyInvoiceNumber(pinnedWorkflowContractNumber)
      ) {
        return cleanBaseContractNumber(pinnedWorkflowContractNumber, true);
      }
      if (activePartial) return cleanBaseContractNumber(activePartial, true);
      if (
        resolvedContractNumber &&
        !isPureDbId(resolvedContractNumber) &&
        !isLikelyInvoiceNumber(resolvedContractNumber)
      ) {
        return cleanBaseContractNumber(resolvedContractNumber, true);
      }
      return null;
    }

    if (isProforma) {
      // Similarly for Proforma, maintain the active partial contract number (B)
      if (pinnedWorkflowContractNumber && isPartialContractNumber(pinnedWorkflowContractNumber)) {
        return pinnedWorkflowContractNumber;
      }
      if (activePartial && isPartialContractNumber(activePartial)) {
        return activePartial;
      }
      const direct = extractDocContractNumber(proformaData) || extractDocContractNumber(initialProformaData);
      if (direct && !isPureDbId(direct) && !isLikelyInvoiceNumber(direct)) {
        return direct;
      }
      if (
        pinnedWorkflowContractNumber &&
        !isPureDbId(pinnedWorkflowContractNumber) &&
        !isLikelyInvoiceNumber(pinnedWorkflowContractNumber)
      ) {
        return pinnedWorkflowContractNumber;
      }
      if (activePartial) return activePartial;
      if (
        resolvedContractNumber &&
        !isPureDbId(resolvedContractNumber) &&
        !isLikelyInvoiceNumber(resolvedContractNumber)
      ) {
        return resolvedContractNumber;
      }
      return null;
    }

    if (
      pinnedWorkflowContractNumber &&
      !isPureDbId(pinnedWorkflowContractNumber) &&
      !isLikelyInvoiceNumber(pinnedWorkflowContractNumber)
    ) {
      return pinnedWorkflowContractNumber;
    }
    if (activePartial) return activePartial;
    if (
      resolvedContractNumber &&
      !isPureDbId(resolvedContractNumber) &&
      !isLikelyInvoiceNumber(resolvedContractNumber)
    ) {
      return resolvedContractNumber;
    }
    return null;
  }, [
    isShipmentInstruction,
    isBillOfLading,
    isCustomInvoice,
    isCommercialInvoice,
    isPackingList,
    isPhytoCertificate,
    isContract,
    isProforma,
    pinnedWorkflowContractNumber,
    shipmentInstructionData,
    initialShipmentInstructionData,
    billOfLadingData,
    initialBillOfLadingData,
    customInvoiceData,
    initialCustomInvoiceData,
    commercialInvoiceData,
    initialCommercialInvoiceData,
    packingListData,
    initialPackingListData,
    phytoCertificateData,
    initialPhytoCertificateData,
    contractData,
    initialContractData,
    proformaData,
    initialProformaData,
    resolvedContractNumber,
  ]);

  // Number displayed on top of the Stepper card (both desktop and mobile):
  // User instruction: From Contract/SI onwards, show the Contract number from the currently open form's API response!
  // Never show invoice number!
  const stepperHeaderDocNumber = isConfirmation
    ? (resolvedConfirmationNumber || activeStepContractNumber)
    : activeStepContractNumber;

  const mobileActiveDocNumber = isConfirmation
    ? resolvedConfirmationNumber
    : activeStepContractNumber;

  const mobileActiveDocLabel = isConfirmation
    ? (dict?.smart_docs?.confirmation_form?.confirmation_number || 'Confirmation No.')
    : (dict?.smart_docs?.contract_form?.contract_number || 'Contract No.');

  // Effective initial data for Contract form:
  // Must always maintain the clean base contract number (e.g. CON/ABC/0001)
  // and NEVER overwrite it with partial split suffixes (/A, /B) from other workflow documents!
  const effectiveContractInitialData = useMemo(() => {
    const base = contractData || initialContractData || confirmationData || initialData || null;
    if (!base) return null;

    const rawContNum =
      base.contract_number ||
      base.contractNumber ||
      base.contract_no ||
      base.contract?.contract_number ||
      base.contract?.contractNumber ||
      base.contract?.contract_no ||
      (pinnedWorkflowContractNumber && !isPureDbId(pinnedWorkflowContractNumber) && !isLikelyInvoiceNumber(pinnedWorkflowContractNumber) ? pinnedWorkflowContractNumber : null) ||
      activeStepContractNumber;

    const hasSplits = Boolean(
      (base.splits && Array.isArray(base.splits) && base.splits.length > 0) ||
      base.has_splits ||
      base.is_split ||
      base.is_partial ||
      base.partial_shipment_allowed
    );

    const cleanContNum = cleanBaseContractNumber(rawContNum, hasSplits || isPartialContractNumber(rawContNum));

    if (cleanContNum) {
      const updatedContractObj =
        base.contract && typeof base.contract === 'object'
          ? {
              ...base.contract,
              contract_number: cleanContNum,
              contractNumber: cleanContNum,
              contract_no: cleanContNum,
            }
          : undefined;

      return {
        ...base,
        contract_number: cleanContNum,
        contractNumber: cleanContNum,
        contract_no: cleanContNum,
        ...(updatedContractObj ? { contract: updatedContractObj } : {}),
      };
    }
    return base;
  }, [
    contractData,
    initialContractData,
    confirmationData,
    initialData,
    pinnedWorkflowContractNumber,
    activeStepContractNumber,
  ]);

  const effectiveProformaInitialData = useMemo(() => {
    const base =
      proformaData ||
      initialProformaData ||
      contractData ||
      initialContractData ||
      confirmationData ||
      initialData ||
      null;
    if (!base) return null;
    const activeDocContNum =
      (pinnedWorkflowContractNumber && !isPureDbId(pinnedWorkflowContractNumber) && !isLikelyInvoiceNumber(pinnedWorkflowContractNumber) ? pinnedWorkflowContractNumber : null) ||
      extractDocContractNumber(shipmentInstructionData) ||
      extractDocContractNumber(initialShipmentInstructionData) ||
      activeStepContractNumber;
    if (activeDocContNum && !isPureDbId(activeDocContNum) && !isLikelyInvoiceNumber(activeDocContNum)) {
      const updatedContractObj =
        base.contract && typeof base.contract === 'object'
          ? {
              ...base.contract,
              contract_number: activeDocContNum,
              contractNumber: activeDocContNum,
              contract_no: activeDocContNum,
            }
          : undefined;

      return {
        ...base,
        contract_number: activeDocContNum,
        contractNumber: activeDocContNum,
        contract_no: activeDocContNum,
        ...(updatedContractObj ? { contract: updatedContractObj } : {}),
      };
    }
    return base;
  }, [
    proformaData,
    initialProformaData,
    contractData,
    initialContractData,
    confirmationData,
    initialData,
    shipmentInstructionData,
    initialShipmentInstructionData,
    pinnedWorkflowContractNumber,
    activeStepContractNumber,
  ]);

  return (
    <div className="flex-1 min-h-fit lg:min-h-0 flex flex-col lg:overflow-hidden">
      {/* Permanent, Always-Visible Modern Custom Scrollbars */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          -webkit-appearance: none !important;
          display: block !important;
          width: 8px !important;
          height: 8px !important;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          display: block !important;
          background-color: #f1f5f9 !important;
          border-radius: 9999px !important;
          border: none !important;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          display: block !important;
          background-color: #94a3b8 !important;
          border-radius: 9999px !important;
          border: 2px solid #f1f5f9 !important;
          background-clip: padding-box !important;
          min-height: 44px !important;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #64748b !important;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-track {
          background-color: #1e293b !important;
          border-radius: 9999px !important;
          border: none !important;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #64748b !important;
          border-radius: 9999px !important;
          border: 2px solid #1e293b !important;
          background-clip: padding-box !important;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8 !important;
        }
      `}</style>

      {/* Header Bar with Dynamic Step Title */}
      <div className="shrink-0">
        <PageHeader
          title={pageTitle}
          backText={dict?.common?.back || 'Back'}
          backHref={`/${lang}/smart-docs`}
          size="sm"
          className="!top-0"
        />
      </div>

      <div className="w-full flex-1 min-h-fit lg:min-h-0 lg:h-full flex flex-col lg:flex-row items-stretch justify-start gap-2.5 sm:gap-3 lg:gap-3.5 pb-1 sm:pb-1.5 lg:pb-0">
      {/* 
        Mobile Stepper Banner (< lg only):
        Compact, non-intrusive step tracker with expandable drawer
      */}
      <div className="lg:hidden shrink-0 bg-card border border-border rounded-xl p-2.5 sm:p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6.5 h-6.5 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
              {selectedStepIndex + 1}
            </span>
            <div className="flex flex-col min-w-0">
              {mobileActiveDocNumber && (
                <div className="flex items-center gap-1 min-w-0 text-[10px] text-foreground font-bold tracking-tight">
                  <span className="text-muted-foreground font-semibold text-[9px] uppercase">
                    {safeString(mobileActiveDocLabel)}:
                  </span>
                  <span className="truncate font-mono">{safeString(mobileActiveDocNumber)}</span>
                </div>
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {dict?.smart_docs?.document_status || 'Document Step'}
                {steps.length > 0 ? ` (${selectedStepIndex + 1}/${steps.length})` : ''}
              </span>
              <span className="text-xs font-bold text-foreground truncate">
                {safeString(activeDocName)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileStepperOpen(!isMobileStepperOpen)}
            className="text-xs font-semibold px-2.5 py-1 rounded-md border border-border bg-muted/40 hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <span>{isMobileStepperOpen ? (dict?.common?.hide || 'Hide Steps') : (dict?.common?.view || 'View Steps')}</span>
            <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${isMobileStepperOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Collapsible Mobile Stepper List */}
        {isMobileStepperOpen && (
          <div className="mt-2.5 pt-2 border-t border-border animate-in fade-in duration-200 max-h-[60vh] sm:max-h-[440px] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar">
            <DocumentStatusStepper
              isMobile
              stepperType={workflowAnchorType}
              stepperId={workflowAnchorId}
              stepId={workflowAnchorId}
              confirmationId={effectiveConfirmationId}
              initialSteps={steps}
              currentStepIndex={selectedStepIndex}
              selectedStep={selectedStep}
              onSelectStep={handleSelectStep}
              onUpdateSteps={handleUpdateSteps}
              lang={lang}
              dict={dict}
              confirmationNumber={resolvedConfirmationNumber}
              contractNumber={activeStepContractNumber}
              activeDocNumber={stepperHeaderDocNumber}
              isContractStep={isContract}
            />
          </div>
        )}
      </div>

      {/* 
        Left Side: A4-like Form Card
        - On desktop: fills left column with locked internal scrolling
        - On mobile: visible at full width, scrolling naturally with sticky bottom bar
        - Both Confirmation and Contract forms stay mounted in DOM to guarantee
          that filled confirmation data is NEVER lost when switching between steps!
      */}
      <div 
        id="draft-form-card"
        className="w-full flex-1 min-w-0 min-h-fit lg:min-h-0 lg:h-full bg-card border border-border rounded-xl shadow-xs overflow-visible lg:overflow-hidden flex flex-col relative z-10"
      >
        {/* Confirmation Document Form: Visible when Confirmation Step is active */}
        <div className={`w-full h-full ${isConfirmation ? 'flex flex-col' : 'hidden'}`}>
          <ConfirmationDocumentForm
            key={`confirmation-${effectiveConfirmationId || confirmationData?.id || 'default'}`}
            dataVersion={confirmationVersion}
            initialData={
              confirmationData || initialData
            }
            steps={steps}
            selectedStep={selectedStep}
            lang={lang}
            dict={dict}
            sellers={initialSellers}
            buyers={initialBuyers}
            products={initialProducts}
            paymentTerms={initialPaymentTerms}
            currencies={initialCurrencies}
            shippingTerms={shippingTerms}
            onUpdateSteps={handleUpdateSteps}
            onSaveSuccess={(savedId, savedData) => {
              if (savedId) {
                setDraftId(savedId);
                const confNum =
                  savedData?.confirmation_number ||
                  savedData?.confirmationNumber ||
                  savedData?.confirmation?.confirmation_number;
                setConfirmationData((prev: any) => ({
                  ...(prev || {}),
                  ...(savedData || {}),
                  ...(confNum ? { confirmation_number: confNum } : {}),
                  id: savedId,
                  _id: savedId,
                }));
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  const cleanSavedId = sanitizeDocId(savedId);
                  const targetWorkflowId = cleanSavedId || effectiveConfirmationId || rootWorkflowId;
                  if (targetWorkflowId && !isInvalidPlaceholder(targetWorkflowId)) {
                    url.searchParams.set('id', targetWorkflowId);
                  }
                  if (!url.searchParams.get('step')) {
                    url.searchParams.set('step', 'confirmation');
                  }
                  window.history.replaceState(null, '', url.toString());
                }
              }
            }}
            onSaveDraft={async (formData) => {
              const res = await saveConfirmationDraftAction(formData, lang);
              if (res?.success) {
                const confNum =
                  res.data?.confirmation_number ||
                  res.data?.confirmationNumber ||
                  res.data?.confirmation?.confirmation_number ||
                  (res as any)?.confirmation_number ||
                  formData?.confirmation_number;
                const cleanSavedId =
                  res.id ||
                  res.data?.id ||
                  res.data?._id ||
                  res.data?.confirmation_id ||
                  formData?.id ||
                  formData?._id;
                setConfirmationData((prev: any) => ({
                  ...(prev || {}),
                  ...(formData || {}),
                  ...(res.data || {}),
                  ...(confNum ? { confirmation_number: confNum } : {}),
                  ...(cleanSavedId ? { id: cleanSavedId, _id: cleanSavedId } : {}),
                }));
              }
              return res;
            }}
            onSelectStep={handleSelectStep}
            onSubmitContract={async (formData, passedNextStep) => {
              const res = await submitConfirmationAction(formData, lang);
              if (res?.success) {
                const confId =
                  res.confirmation_id ||
                  res.data?.confirmation_id ||
                  (res.id && res.id !== res.data?.contract_id ? res.id : null) ||
                  formData?.id ||
                  draftId;
                const nextDoc = (res as any)?.next_doc || res?.data?.next_doc || res?.data?.data?.next_doc;
                const generatedContractId =
                  res.contract_id ||
                  res.data?.contract_id ||
                  (nextDoc?.id ? String(nextDoc.id) : null) ||
                  null;

                if (confId && !isInvalidPlaceholder(String(confId))) {
                  setDraftId(String(confId));
                }
                const confNum =
                  res.data?.confirmation_number ||
                  res.data?.confirmationNumber ||
                  res.data?.confirmation?.confirmation_number ||
                  formData?.confirmation_number;

                setConfirmationData((prev: any) => ({
                  ...(prev || {}),
                  ...(formData || {}),
                  ...(res.data || {}),
                  ...(confNum ? { confirmation_number: confNum } : {}),
                  status: 'COMPLETED',
                  id: confId || prev?.id,
                  _id: confId || prev?._id,
                  confirmation_id: confId || prev?.confirmation_id,
                }));

                // Immediately update steps optimistically so confirmation is marked completed
                // and contract redirect_id is set if generatedContractId exists
                let updatedSteps = steps.map((s) => {
                  if (isConfirmationStep(s)) {
                    return {
                      ...s,
                      status: 'COMPLETED',
                      completed: true,
                      redirect_id: confId || s.redirect_id,
                      redirectId: confId || s.redirectId,
                    };
                  }
                  if (isContractStep(s) && generatedContractId) {
                    return {
                      ...s,
                      redirect_id: generatedContractId,
                      redirectId: generatedContractId,
                    };
                  }
                  return s;
                });
                setSteps(updatedSteps);

                if (generatedContractId) {
                  setContractData((prev: any) => ({
                    ...(prev || {}),
                    id: generatedContractId,
                    contract_id: generatedContractId,
                  }));
                }

                // Update stepper to reflect completion and switch to next step
                try {
                  const stepperParam = confId || workflowAnchorId || draftId;
                  const stepperRes = await getStepperListAction({
                    action: 'confirmation',
                    step: String(stepperParam),
                    lang,
                  });
                  if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                    updatedSteps = mergeStepperWithHidden(stepperRes.data, updatedSteps);
                    setSteps(updatedSteps);
                  }
                } catch (stepErr) {
                  console.error('[DocumentDraftWorkspace] Stepper refresh error:', stepErr);
                }

                // ALWAYS navigate to the contract step (next step)
                const visibleList = updatedSteps.filter(isVisibleWorkflowStep);
                let nextStepToSelect: StepperDocumentItem | null = null;
                let targetIdx = -1;
                if (passedNextStep) {
                  targetIdx = visibleList.findIndex((s) => isSameWorkflowStep(s, passedNextStep));
                  if (targetIdx >= 0) nextStepToSelect = visibleList[targetIdx];
                }
                if (!nextStepToSelect || targetIdx === -1) {
                  const confIndex = visibleList.findIndex((s) => isConfirmationStep(s));
                  if (confIndex >= 0 && confIndex + 1 < visibleList.length) {
                    targetIdx = confIndex + 1;
                    nextStepToSelect = visibleList[targetIdx];
                  } else {
                    const contractIdx = visibleList.findIndex((s) => isContractStep(s));
                    if (contractIdx >= 0) {
                      targetIdx = contractIdx;
                      nextStepToSelect = visibleList[contractIdx];
                    }
                  }
                }
                if (nextStepToSelect && targetIdx >= 0) {
                  handleSelectStep(nextStepToSelect, targetIdx);
                }
              }
              return res;
            }}
          />
        </div>

        {/* Contract Document Form: Visible when Contract Step is active */}
        <div className={`w-full h-full ${isContract ? 'flex flex-col' : 'hidden'}`}>
          <ContractDocumentForm
            key={`contract-${canonicalContractId || contractData?.id || 'default'}`}
            dataVersion={contractVersion}
            initialData={effectiveContractInitialData}
            contractId={contractIdFromStepper || canonicalContractId}
            steps={steps}
            selectedStep={selectedStep}
            onUpdateSteps={handleUpdateSteps}
            onSelectStep={handleSelectStep}
            lang={lang}
            dict={dict}
            sellers={initialSellers}
            buyers={initialBuyers}
            products={initialProducts}
            paymentTerms={initialPaymentTerms}
            currencies={initialCurrencies}
            shippingTerms={shippingTerms}
            documentsList={initialDocumentList}
            onSaveSuccess={(savedId: string, savedData?: any) => {
              if (savedId) {
                if (!effectiveConfirmationId) {
                  setDraftId(savedId);
                }
                const rawSavedContNum =
                  savedData?.contract_number ||
                  savedData?.contractNumber ||
                  savedData?.contract_no ||
                  savedData?.contract?.contract_number ||
                  savedData?.contract?.contractNumber;
                const hasSplits = Boolean(
                  (savedData?.splits && Array.isArray(savedData.splits) && savedData.splits.length > 0) ||
                  savedData?.has_splits ||
                  savedData?.is_split ||
                  savedData?.is_partial ||
                  savedData?.partial_shipment_allowed
                );
                const contNum = cleanBaseContractNumber(rawSavedContNum, hasSplits || isPartialContractNumber(rawSavedContNum)) || rawSavedContNum;
                setContractData((prev: any) => ({
                  ...(prev || {}),
                  ...(savedData || {}),
                  ...(contNum ? { contract_number: contNum } : {}),
                  id: savedId,
                  contract_id: savedId,
                }));
                // Update stepper item for contract so checkmark and redirect_id reflect the saved contract
                setSteps((prevSteps) =>
                  prevSteps.map((s) =>
                    isContractStep(s)
                      ? { ...s, redirect_id: savedId, redirectId: savedId, status: s.status || 'draft' }
                      : s
                  )
                );
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  const cleanSavedId = sanitizeDocId(savedId);
                  const targetWorkflowId = isDocumentWorkflow
                    ? (workflowAnchorId || initialId || rootWorkflowId || canonicalContractId || cleanSavedId)
                    : (rootWorkflowId || effectiveConfirmationId || canonicalContractId || cleanSavedId);
                  if (targetWorkflowId && !isInvalidPlaceholder(targetWorkflowId)) {
                    url.searchParams.set('id', targetWorkflowId);
                  }
                  if (url.searchParams.get('step') !== 'proforma') {
                    url.searchParams.set('step', 'contract');
                  }
                  window.history.replaceState(null, '', url.toString());
                }
              }
            }}
              onSaveDraft={async (formData) => {
                const activeDocId =
                  canonicalContractId ||
                  contractIdFromStepper ||
                  sanitizeDocId(contractData?.contract_id || contractData?.id || initialContractData?.contract_id || initialContractData?.id) ||
                  getStepSelfId(steps[1]) ||
                  steps[1]?.redirect_id ||
                  effectiveConfirmationId ||
                  rootWorkflowId ||
                  draftId;

                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|step-\d+)$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                if (validEffectiveId && typeof formData?.set === 'function') {
                  formData.set('id', validEffectiveId);
                  formData.set('contract_id', validEffectiveId);
                }

                const confId = sanitizeDocId(
                  effectiveConfirmationId ||
                  initialData?.confirmation_id ||
                  initialData?.confirmationId
                );
                if (confId && typeof formData?.set === 'function' && !formData.get('confirmation_id')) {
                  formData.set('confirmation_id', confId);
                }

                const res = await saveContractDraftAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.contract_id || (res as any)?.contract_id;
                  if (newId && !effectiveConfirmationId) {
                    setDraftId(String(newId));
                  }

                  if (res.data) {
                    const extracted = extractContractData(res.data) || res.data;
                    const rawContNum =
                      extracted?.contract_number ||
                      extracted?.contractNumber ||
                      extracted?.contract_no ||
                      res.data?.contract_number ||
                      res.data?.contractNumber ||
                      (typeof formData?.get === 'function' ? formData.get('contract_number') : null);
                    const hasSplits = Boolean(
                      (extracted?.splits && Array.isArray(extracted.splits) && extracted.splits.length > 0) ||
                      extracted?.has_splits ||
                      extracted?.is_split ||
                      extracted?.is_partial ||
                      extracted?.partial_shipment_allowed
                    );
                    const contNum = cleanBaseContractNumber(rawContNum, hasSplits || isPartialContractNumber(rawContNum)) || rawContNum;
                    setContractData((prev: any) => {
                      const updated = { ...(prev || {}) };
                      if (extracted && typeof extracted === 'object') {
                        for (const [k, v] of Object.entries(extracted)) {
                          if (v !== undefined) {
                            updated[k] = v;
                          }
                        }
                      }
                      if (contNum) {
                        updated.contract_number = contNum;
                      }
                      const submittedDocs =
                        typeof (formData as any)?.getAll === 'function'
                          ? (formData as any).getAll('documents_required[]')
                          : null;
                      if (submittedDocs && submittedDocs.length > 0) {
                        updated.documents_required = submittedDocs;
                        updated.documents = submittedDocs;
                        updated.required_documents = submittedDocs;
                      }
                      const isFormData = typeof formData?.get === 'function';
                      const getVal = (key: string) => isFormData ? formData.get(key) : (formData as any)?.[key];
                      if (isFormData && (formData.get('remove_seller_signature') === 'true' || formData.get('seller_signature') === '')) {
                        updated.seller_signature = null;
                        updated.seller_signature_url = null;
                        updated.exporter_signature = null;
                        updated.exporter_signature_url = null;
                      }
                      if (isFormData && (formData.get('remove_buyer_signature') === 'true' || formData.get('buyer_signature') === '')) {
                        updated.buyer_signature = null;
                        updated.buyer_signature_url = null;
                        updated.importer_signature = null;
                        updated.importer_signature_url = null;
                      }
                      const brokerAllowedVal = String(getVal('sales_broker_allowed') ?? getVal('is_broker') ?? '');
                      if (
                        brokerAllowedVal === 'false' ||
                        getVal('remove_broker_signature') === 'true' ||
                        getVal('remove_sales_broker_signature') === 'true' ||
                        getVal('broker_signature') === ''
                      ) {
                        updated.broker_signature = null;
                        updated.broker_signature_url = null;
                        updated.sales_broker_signature = null;
                        updated.sales_broker_signature_url = null;
                      }
                      if (brokerAllowedVal === 'false') {
                        updated.is_broker = false;
                        updated.sales_broker_allowed = false;
                        updated.broker_commission_type = null;
                        updated.sales_broker_type = null;
                        updated.broker_commission = null;
                        updated.sales_broker_commission = null;
                        updated.broker_commission_amt = null;
                        updated.broker_commission_amount = null;
                        updated.sales_broker_amount = null;
                        updated.broker_name = null;
                        updated.sales_broker_name = null;
                      }
                      const advanceVal = String(getVal('any_advance') ?? getVal('has_advance') ?? '');
                      if (advanceVal === 'false') {
                        updated.any_advance = false;
                        updated.has_advance = false;
                        updated.advance = false;
                        updated.advance_payment_type = null;
                        updated.advance_type = null;
                        updated.advance_payment_amt = null;
                        updated.advance_amount = null;
                        updated.advance_payment = null;
                        updated.advance_payment_pct = null;
                        updated.advance_percentage = null;
                        updated.advance_pct = null;
                      }
                      return updated;
                    });
                  }

                  // Concurrently refresh stepper list from backend so all steps stay fresh
                  try {
                    const stepperParam = workflowAnchorId;
                    const stepperRes = await getStepperListAction({
                      action: workflowAnchorType,
                      step: String(stepperParam),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0 && isRealStepperList(stepperRes.data)) {
                      setSteps((prevSteps) => mergeStepperWithHidden(stepperRes.data, prevSteps));
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Stepper refresh error:', stepErr);
                  }
                }
                return res;
              }}
              onSubmitContract={async (formData, passedId, passedNextStep) => {
                const activeDocId =
                  passedId ||
                  canonicalContractId ||
                  contractIdFromStepper ||
                  sanitizeDocId(contractData?.contract_id || contractData?.id || initialContractData?.contract_id || initialContractData?.id) ||
                  getStepSelfId(steps[1]) ||
                  steps[1]?.redirect_id ||
                  effectiveConfirmationId ||
                  rootWorkflowId ||
                  draftId;

                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|step-\d+)$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                if (validEffectiveId && typeof formData?.set === 'function') {
                  formData.set('id', validEffectiveId);
                  formData.set('contract_id', validEffectiveId);
                }

                const confId = sanitizeDocId(
                  effectiveConfirmationId ||
                  initialData?.confirmation_id ||
                  initialData?.confirmationId
                );
                if (confId && typeof formData?.set === 'function' && !formData.get('confirmation_id')) {
                  formData.set('confirmation_id', confId);
                }

                const res = await submitContractAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  setContractVersion((v) => v + 1);
                  const newId = res.id || res.data?.id || res.data?.contract_id || (res as any)?.contract_id;
                  if (newId && !effectiveConfirmationId) {
                    setDraftId(String(newId));
                  }
                  if (res.data) {
                    const extracted = extractContractData(res.data) || res.data;
                    const rawContNum =
                      extracted?.contract_number ||
                      extracted?.contractNumber ||
                      extracted?.contract_no ||
                      res.data?.contract_number ||
                      res.data?.contractNumber ||
                      (typeof formData?.get === 'function' ? formData.get('contract_number') : null);
                    const hasSplits = Boolean(
                      (extracted?.splits && Array.isArray(extracted.splits) && extracted.splits.length > 0) ||
                      extracted?.has_splits ||
                      extracted?.is_split ||
                      extracted?.is_partial ||
                      extracted?.partial_shipment_allowed
                    );
                    const contNum = cleanBaseContractNumber(rawContNum, hasSplits || isPartialContractNumber(rawContNum)) || rawContNum;
                    setContractData((prev: any) => {
                      const updated = { ...(prev || {}) };
                      if (extracted && typeof extracted === 'object') {
                        for (const [k, v] of Object.entries(extracted)) {
                          if (v !== undefined) {
                            updated[k] = v;
                          }
                        }
                      }
                      if (contNum) {
                        updated.contract_number = contNum;
                      }
                      const submittedDocs =
                        typeof (formData as any)?.getAll === 'function'
                          ? (formData as any).getAll('documents_required[]')
                          : null;
                      if (submittedDocs && submittedDocs.length > 0) {
                        updated.documents_required = submittedDocs;
                        updated.documents = submittedDocs;
                        updated.required_documents = submittedDocs;
                      }
                      const isFormData = typeof formData?.get === 'function';
                      const getVal = (key: string) => isFormData ? formData.get(key) : (formData as any)?.[key];
                      if (isFormData && (formData.get('remove_seller_signature') === 'true' || formData.get('seller_signature') === '')) {
                        updated.seller_signature = null;
                        updated.seller_signature_url = null;
                        updated.exporter_signature = null;
                        updated.exporter_signature_url = null;
                      }
                      if (isFormData && (formData.get('remove_buyer_signature') === 'true' || formData.get('buyer_signature') === '')) {
                        updated.buyer_signature = null;
                        updated.buyer_signature_url = null;
                        updated.importer_signature = null;
                        updated.importer_signature_url = null;
                      }
                      const brokerAllowedVal = String(getVal('sales_broker_allowed') ?? getVal('is_broker') ?? '');
                      if (
                        brokerAllowedVal === 'false' ||
                        getVal('remove_broker_signature') === 'true' ||
                        getVal('remove_sales_broker_signature') === 'true' ||
                        getVal('broker_signature') === ''
                      ) {
                        updated.broker_signature = null;
                        updated.broker_signature_url = null;
                        updated.sales_broker_signature = null;
                        updated.sales_broker_signature_url = null;
                      }
                      if (brokerAllowedVal === 'false') {
                        updated.is_broker = false;
                        updated.sales_broker_allowed = false;
                        updated.broker_commission_type = null;
                        updated.sales_broker_type = null;
                        updated.broker_commission = null;
                        updated.sales_broker_commission = null;
                        updated.broker_commission_amt = null;
                        updated.broker_commission_amount = null;
                        updated.sales_broker_amount = null;
                        updated.broker_name = null;
                        updated.sales_broker_name = null;
                      }
                      const advanceVal = String(getVal('any_advance') ?? getVal('has_advance') ?? '');
                      if (advanceVal === 'false') {
                        updated.any_advance = false;
                        updated.has_advance = false;
                        updated.advance = false;
                        updated.advance_payment_type = null;
                        updated.advance_type = null;
                        updated.advance_payment_amt = null;
                        updated.advance_amount = null;
                        updated.advance_payment = null;
                        updated.advance_payment_pct = null;
                        updated.advance_percentage = null;
                        updated.advance_pct = null;
                      }
                      return updated;
                    });
                  }
                  const nextDoc = (res as any)?.next_doc || res?.data?.next_doc || res?.data?.data?.next_doc;
                  const nextDocId = nextDoc?.id ? String(nextDoc.id) : '';
                  if (nextDocId) {
                    setProformaData((prev: any) => ({
                      ...(prev || {}),
                      id: nextDocId,
                      proforma_id: nextDocId,
                    }));
                  }

                  // Update stepper to reflect completion and switch to next step
                  let targetList = steps;
                  try {
                    const stepperParam = workflowAnchorId;
                    const stepperRes = await getStepperListAction({
                      action: workflowAnchorType,
                      step: String(stepperParam),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                      targetList = mergeStepperWithHidden(stepperRes.data, steps);
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit contract stepper error:', stepErr);
                  }

                  if (nextDocId) {
                    targetList = targetList.map((s) =>
                      isProformaStep(s)
                        ? { ...s, redirect_id: nextDocId, redirectId: nextDocId }
                        : s
                    );
                  }
                  setSteps(targetList);

                  const visibleList = targetList.filter(isVisibleWorkflowStep);
                  let nextStepToSelect: StepperDocumentItem | null = null;
                  let targetIdx = -1;
                  if (passedNextStep) {
                    targetIdx = visibleList.findIndex((s) => isSameWorkflowStep(s, passedNextStep));
                    if (targetIdx >= 0) nextStepToSelect = visibleList[targetIdx];
                  }
                  if (!nextStepToSelect || targetIdx === -1) {
                    const contIndex = visibleList.findIndex((s) => isContractStep(s));
                    if (contIndex >= 0 && contIndex + 1 < visibleList.length) {
                      targetIdx = contIndex + 1;
                      nextStepToSelect = visibleList[targetIdx];
                    }
                  }
                  if (nextStepToSelect && targetIdx >= 0) {
                    handleSelectStep(nextStepToSelect, targetIdx);
                  }
                }
                return res;
              }}
            />
        </div>

        {/* Proforma Invoice Document Form: Visible when Proforma Step is active */}
        <div className={`w-full h-full ${isProforma ? 'flex flex-col' : 'hidden'}`}>
          <ProformaDocumentForm
            key={`proforma-${canonicalProformaId || (proformaData?.id ? String(proformaData.id) : 'default')}-${activeStepContractNumber || ''}`}
            dataVersion={proformaVersion}
            initialData={effectiveProformaInitialData}
            proformaId={canonicalProformaId}
            contractId={canonicalContractId}
            confirmationId={effectiveConfirmationId}
            steps={steps}
            selectedStep={selectedStep}
            onUpdateSteps={handleUpdateSteps}
            onSelectStep={handleSelectStep}
            lang={lang}
            dict={dict}
            sellers={initialSellers}
            buyers={initialBuyers}
            products={initialProducts}
            paymentTerms={initialPaymentTerms}
            currencies={initialCurrencies}
            shippingTerms={shippingTerms}
            onSaveSuccess={(savedId: string, savedData?: any) => {
              if (savedId) {
                setProformaData((prev: any) => ({
                  ...(prev || {}),
                  ...(savedData || {}),
                  id: savedId,
                  proforma_id: savedId,
                }));
                // Update stepper item for proforma so checkmark and redirect_id reflect the saved proforma
                setSteps((prevSteps) =>
                  prevSteps.map((s) =>
                    isProformaStep(s)
                      ? { ...s, redirect_id: savedId, redirectId: savedId, status: s.status || 'draft' }
                      : s
                  )
                );
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  const cleanSavedId = sanitizeDocId(savedId);
                  const targetWorkflowId = isDocumentWorkflow
                    ? (workflowAnchorId || initialId || rootWorkflowId || canonicalContractId || cleanSavedId)
                    : (rootWorkflowId || effectiveConfirmationId || canonicalContractId || cleanSavedId);
                  if (targetWorkflowId && !isInvalidPlaceholder(targetWorkflowId)) {
                    url.searchParams.set('id', targetWorkflowId);
                  }
                  url.searchParams.set('step', 'proforma');
                  window.history.replaceState(null, '', url.toString());
                }
              }
            }}
              onSaveDraft={async (formData) => {
                const activeDocId =
                  canonicalProformaId ||
                  sanitizeDocId(
                    (proformaData?.invoice_number ? proformaData?.proforma_id || proformaData?.proforma_invoice_id || proformaData?.id : '') ||
                    getStepSelfId(getProformaStep(steps, selectedStep)) ||
                    extractStepRedirectId(getProformaStep(steps, selectedStep)) ||
                    extractStepId(getProformaStep(steps, selectedStep)) ||
                    canonicalContractId ||
                    effectiveConfirmationId ||
                    rootWorkflowId ||
                    draftId
                  );
                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+)$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                if (typeof formData?.set === 'function') {
                  if (validEffectiveId) {
                    formData.set('id', validEffectiveId);
                    formData.set('proforma_id', validEffectiveId);
                  }
                  if (!formData.get('contract_id') && canonicalContractId) formData.set('contract_id', canonicalContractId);
                  if (!formData.get('confirmation_id') && (effectiveConfirmationId || rootWorkflowId)) {
                    formData.set('confirmation_id', effectiveConfirmationId || rootWorkflowId);
                  }
                }

                const res = await saveProformaDraftAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  setProformaVersion((v) => v + 1);
                  const newId = res.id || res.data?.id || res.data?.proforma_id || res.data?.proforma_invoice_id;
                  if (newId) {
                    setSteps((prevSteps) =>
                      prevSteps.map((s) =>
                        isProformaStep(s)
                          ? { ...s, redirect_id: String(newId), redirectId: String(newId), status: s.status || 'draft' }
                          : s
                      )
                    );
                  }
                  const extracted = extractProformaData(res.data) || (typeof res.data === 'object' && res.data !== null ? res.data : {});
                  const isFormDataObj = typeof (formData as any)?.get === 'function';
                  const formValues = isFormDataObj ? {} : (typeof formData === 'object' ? formData : {});
                  setProformaData((prev: any) => {
                    const updated: any = {
                      ...(prev || {}),
                      ...formValues,
                      ...(extracted && typeof extracted === 'object'
                        ? Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== undefined && v !== null))
                        : {}),
                      ...(newId ? { id: String(newId), proforma_id: String(newId) } : {}),
                    };
                    if (isFormDataObj) {
                      const syncTextFields: Array<[string, string[]]> = [
                        ['invoice_number', ['invoice_number', 'invoice_no']],
                        ['invoice_date', ['invoice_date']],
                        ['gst_number', ['gst_number', 'registration_number']],
                        ['buyer_order_no_date', ['buyer_order_no_date', 'buyer_order_no']],
                        ['bank_charges_note', ['bank_charges_note']],
                        ['comment_label', ['comment_label', 'comment_title']],
                        ['comment_value', ['comment_value', 'comment_text']],
                        ['pdf_title', ['pdf_title', 'document_title', 'title']],
                      ];
                      for (const [formKey, targetKeys] of syncTextFields) {
                        const val = formData.get(formKey);
                        if (typeof val === 'string') {
                          for (const tk of targetKeys) {
                            updated[tk] = val;
                          }
                        }
                      }
                      const letterheadVal = formData.get('letterhead_space');
                      if (letterheadVal === 'true' || letterheadVal === 'false') {
                        const boolVal = letterheadVal === 'true';
                        updated.letterhead_space = boolVal;
                        updated.header_enabled = boolVal;
                        updated.letterhead = boolVal;
                      }
                      const watermarkVal = formData.get('is_watermark_enabled');
                      if (watermarkVal === 'true' || watermarkVal === 'false') {
                        const boolVal = watermarkVal === 'true';
                        updated.is_watermark_enabled = boolVal;
                        updated.watermark = boolVal;
                      }
                      const bankIdFromForm = formData.get('bank_details_id') || formData.get('bank_account_id');
                      if (bankIdFromForm !== null && bankIdFromForm !== undefined && String(bankIdFromForm).trim() !== '') {
                        updated.bank_details_id = String(bankIdFromForm).trim();
                        updated.bank_account_id = String(bankIdFromForm).trim();
                      }
                      const bankDetailsFromForm = formData.get('bank_details');
                      if (bankDetailsFromForm !== null && bankDetailsFromForm !== undefined && String(bankDetailsFromForm).trim() !== '') {
                        updated.bank_details = String(bankDetailsFromForm).trim();
                      }
                      const otherRef = formData.get('other_reference') || formData.get('other_references');
                      if (otherRef !== null && otherRef !== undefined) {
                        updated.other_reference = String(otherRef);
                        updated.other_references = String(otherRef);
                      }
                      const sigLabel = formData.get('seller_signature_label') || formData.get('authority_signature_title');
                      if (sigLabel !== null && sigLabel !== undefined) {
                        updated.seller_signature_label = String(sigLabel);
                        updated.authority_signature_title = String(sigLabel);
                      }
                      if (formData.get('remove_seller_signature') === 'true' || formData.get('seller_signature') === '') {
                        updated.seller_signature = null;
                        updated.seller_signature_url = null;
                        updated.signature = null;
                        updated.authorised_signature = null;
                        updated.stamp_image_url = null;
                      }
                    }
                    return updated;
                  });
                  try {
                    const stepperParam = workflowAnchorId;
                    const stepperRes = await getStepperListAction({
                      action: workflowAnchorType,
                      step: String(stepperParam),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0 && isRealStepperList(stepperRes.data)) {
                      setSteps((prevSteps) => mergeStepperWithHidden(stepperRes.data, prevSteps));
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-save proforma stepper error:', stepErr);
                  }
                }
                return res;
              }}
              onSubmitProforma={async (formData, passedId, passedNextStep) => {
                const cleanPassed = sanitizeDocId(passedId);
                const activeDocId =
                  cleanPassed ||
                  canonicalProformaId ||
                  sanitizeDocId(
                    (proformaData?.invoice_number ? proformaData?.proforma_id || proformaData?.proforma_invoice_id || proformaData?.id : '') ||
                    getStepSelfId(getProformaStep(steps, selectedStep)) ||
                    extractStepRedirectId(getProformaStep(steps, selectedStep)) ||
                    extractStepId(getProformaStep(steps, selectedStep)) ||
                    canonicalContractId ||
                    effectiveConfirmationId ||
                    rootWorkflowId ||
                    draftId
                  );
                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+)$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                if (typeof formData?.set === 'function') {
                  if (validEffectiveId) {
                    formData.set('id', validEffectiveId);
                    formData.set('proforma_id', validEffectiveId);
                  }
                  if (!formData.get('contract_id') && canonicalContractId) formData.set('contract_id', canonicalContractId);
                  if (!formData.get('confirmation_id') && (effectiveConfirmationId || rootWorkflowId)) {
                    formData.set('confirmation_id', effectiveConfirmationId || rootWorkflowId);
                  }
                }

                const res = await submitProformaAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  setProformaVersion((v) => v + 1);
                  const newId = res.id || res.data?.id || res.data?.proforma_id || res.data?.proforma_invoice_id;
                  if (newId) {
                    setSteps((prevSteps) =>
                      prevSteps.map((s) =>
                        isProformaStep(s)
                          ? { ...s, redirect_id: String(newId), redirectId: String(newId), status: 'completed' }
                          : s
                      )
                    );
                  }
                  const extracted = extractProformaData(res.data) || (typeof res.data === 'object' && res.data !== null ? res.data : {});
                  const isFormDataObj = typeof (formData as any)?.get === 'function';
                  const formValues = isFormDataObj ? {} : (typeof formData === 'object' ? formData : {});
                  setProformaData((prev: any) => {
                    const updated: any = {
                      ...(prev || {}),
                      ...formValues,
                      ...(extracted && typeof extracted === 'object'
                        ? Object.fromEntries(Object.entries(extracted).filter(([, v]) => v !== undefined && v !== null))
                        : {}),
                      status: extracted?.status || 'COMPLETED',
                      proforma_status: extracted?.proforma_status || 'COMPLETED',
                      ...(newId ? { id: String(newId), proforma_id: String(newId) } : {}),
                    };
                    if (isFormDataObj) {
                      const syncTextFields: Array<[string, string[]]> = [
                        ['invoice_number', ['invoice_number', 'invoice_no']],
                        ['invoice_date', ['invoice_date']],
                        ['gst_number', ['gst_number', 'registration_number']],
                        ['buyer_order_no_date', ['buyer_order_no_date', 'buyer_order_no']],
                        ['bank_charges_note', ['bank_charges_note']],
                        ['comment_label', ['comment_label', 'comment_title']],
                        ['comment_value', ['comment_value', 'comment_text']],
                        ['pdf_title', ['pdf_title', 'document_title', 'title']],
                      ];
                      for (const [formKey, targetKeys] of syncTextFields) {
                        const val = formData.get(formKey);
                        if (typeof val === 'string') {
                          for (const tk of targetKeys) {
                            updated[tk] = val;
                          }
                        }
                      }
                      const letterheadVal = formData.get('letterhead_space');
                      if (letterheadVal === 'true' || letterheadVal === 'false') {
                        const boolVal = letterheadVal === 'true';
                        updated.letterhead_space = boolVal;
                        updated.header_enabled = boolVal;
                        updated.letterhead = boolVal;
                      }
                      const watermarkVal = formData.get('is_watermark_enabled');
                      if (watermarkVal === 'true' || watermarkVal === 'false') {
                        const boolVal = watermarkVal === 'true';
                        updated.is_watermark_enabled = boolVal;
                        updated.watermark = boolVal;
                      }
                      const bankIdFromForm = formData.get('bank_details_id') || formData.get('bank_account_id');
                      if (bankIdFromForm !== null && bankIdFromForm !== undefined && String(bankIdFromForm).trim() !== '') {
                        updated.bank_details_id = String(bankIdFromForm).trim();
                        updated.bank_account_id = String(bankIdFromForm).trim();
                      }
                      const bankDetailsFromForm = formData.get('bank_details');
                      if (bankDetailsFromForm !== null && bankDetailsFromForm !== undefined && String(bankDetailsFromForm).trim() !== '') {
                        updated.bank_details = String(bankDetailsFromForm).trim();
                      }
                      const otherRef = formData.get('other_reference') || formData.get('other_references');
                      if (otherRef !== null && otherRef !== undefined) {
                        updated.other_reference = String(otherRef);
                        updated.other_references = String(otherRef);
                      }
                      const sigLabel = formData.get('seller_signature_label') || formData.get('authority_signature_title');
                      if (sigLabel !== null && sigLabel !== undefined) {
                        updated.seller_signature_label = String(sigLabel);
                        updated.authority_signature_title = String(sigLabel);
                      }
                      if (formData.get('remove_seller_signature') === 'true' || formData.get('seller_signature') === '') {
                        updated.seller_signature = null;
                        updated.seller_signature_url = null;
                        updated.signature = null;
                        updated.authorised_signature = null;
                        updated.stamp_image_url = null;
                      }
                    }
                    return updated;
                  });
                  const nextDoc = (res as any)?.next_doc || res?.data?.next_doc || res?.data?.data?.next_doc;
                  const nextDocId = nextDoc?.id ? String(nextDoc.id) : '';
                  if (nextDocId) {
                    setShipmentInstructionData((prev: any) => ({
                      ...(prev || {}),
                      id: nextDocId,
                      shipment_instruction_id: nextDocId,
                    }));
                  }

                  let targetList = steps;
                  try {
                    const stepperParam = workflowAnchorId;
                    const stepperRes = await getStepperListAction({
                      action: workflowAnchorType,
                      step: String(stepperParam),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                      targetList = mergeStepperWithHidden(stepperRes.data, steps);
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit proforma stepper error:', stepErr);
                  }

                  if (nextDocId) {
                    targetList = targetList.map((s) =>
                      isShipmentInstructionStep(s)
                        ? { ...s, redirect_id: nextDocId, redirectId: nextDocId }
                        : s
                    );
                  }
                  setSteps(targetList);

                  const visibleList = targetList.filter(isVisibleWorkflowStep);
                  let nextStepToSelect: StepperDocumentItem | null = null;
                  let targetIdx = -1;
                  if (passedNextStep) {
                    targetIdx = visibleList.findIndex((s) => isSameWorkflowStep(s, passedNextStep));
                    if (targetIdx >= 0) nextStepToSelect = visibleList[targetIdx];
                  }
                  if (!nextStepToSelect || targetIdx === -1) {
                    const profIndex = visibleList.findIndex((s) => isProformaStep(s));
                    if (profIndex >= 0 && profIndex + 1 < visibleList.length) {
                      targetIdx = profIndex + 1;
                      nextStepToSelect = visibleList[targetIdx];
                    }
                  }
                  if (nextStepToSelect && targetIdx >= 0) {
                    handleSelectStep(nextStepToSelect, targetIdx);
                  }
                }
                return res;
              }}
            />
        </div>

        {/* Shipment Instruction Document Form: Visible when Shipment Instruction Step is active */}
        <div className={`w-full h-full ${isShipmentInstruction ? 'flex flex-col' : 'hidden'}`}>
          <ShipmentInstructionDocumentForm
            key={`shipment-${canonicalShipmentInstructionId || (shipmentInstructionData?.id ? String(shipmentInstructionData.id) : 'default')}`}
            dataVersion={shipmentVersion}
            initialData={shipmentInstructionData || initialShipmentInstructionData || mergedShipmentInstructionData || null}
              buyerInstructionId={buyerInstructionIdForShipment}
              instructionId={canonicalShipmentInstructionId}
              shipmentInstructionId={canonicalShipmentInstructionId}
              initialConsignees={
                initialConsigneesBuyerId &&
                buyerInstructionIdForShipment &&
                sanitizeDocId(initialConsigneesBuyerId) === buyerInstructionIdForShipment
                  ? initialConsignees
                  : []
              }
              initialNotifyParties={
                initialConsigneesBuyerId &&
                buyerInstructionIdForShipment &&
                sanitizeDocId(initialConsigneesBuyerId) === buyerInstructionIdForShipment
                  ? initialNotifyParties
                  : []
              }
              initialConsigneesBuyerId={initialConsigneesBuyerId}
              proformaId={canonicalProformaId}
              contractId={canonicalContractId}
              confirmationId={effectiveConfirmationId}
              steps={steps}
              selectedStep={selectedStep}
              onUpdateSteps={handleUpdateSteps}
              onSelectStep={handleSelectStep}
              lang={lang}
              dict={dict}
              sellers={initialSellers}
              buyers={initialBuyers}
              products={initialProducts}
              currencies={initialCurrencies}
              shippingTerms={shippingTerms}
              onSaveSuccess={(savedId: string, savedData?: any) => {
                if (savedId) {
                  setShipmentInstructionData((prev: any) => ({
                    ...(prev || {}),
                    ...(savedData || {}),
                    id: savedId,
                    shipment_instruction_id: savedId,
                  }));
                  // Update stepper item for shipment instruction so checkmark and redirect_id reflect the saved document
                  setSteps((prevSteps) =>
                    prevSteps.map((s) =>
                      isShipmentInstructionStep(s)
                        ? { ...s, redirect_id: savedId, redirectId: savedId, status: s.status || 'draft' }
                        : s
                    )
                  );
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    const cleanSavedId = sanitizeDocId(savedId);
                    const targetWorkflowId = rootWorkflowId || effectiveConfirmationId || canonicalContractId || cleanSavedId;
                    if (targetWorkflowId && !isInvalidPlaceholder(targetWorkflowId)) {
                      url.searchParams.set('id', targetWorkflowId);
                    }
                    url.searchParams.set('step', 'shipment');
                    window.history.replaceState(null, '', url.toString());
                  }
                }
              }}
              onSaveDraft={async (formData) => {
                const activeDocId =
                  canonicalShipmentInstructionId ||
                  sanitizeDocId(
                    shipmentInstructionData?.shipment_instruction_id ||
                    shipmentInstructionData?.id ||
                    getStepSelfId(getShipmentInstructionStep(steps, selectedStep)) ||
                    extractStepRedirectId(getShipmentInstructionStep(steps, selectedStep)) ||
                    canonicalProformaId ||
                    canonicalContractId ||
                    effectiveConfirmationId ||
                    rootWorkflowId ||
                    draftId
                  );
                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                if (typeof formData?.set === 'function') {
                  if (validEffectiveId) {
                    formData.set('id', validEffectiveId);
                    formData.set('shipment_instruction_id', validEffectiveId);
                  }
                  if (!formData.get('proforma_id') && canonicalProformaId) formData.set('proforma_id', canonicalProformaId);
                  if (!formData.get('contract_id') && canonicalContractId) formData.set('contract_id', canonicalContractId);
                  if (!formData.get('confirmation_id') && (effectiveConfirmationId || rootWorkflowId)) {
                    formData.set('confirmation_id', effectiveConfirmationId || rootWorkflowId);
                  }

                  const marksVal =
                    formData.get('marking_brand') ||
                    formData.get('marks_and_numbers') ||
                    formData.get('container_marks') ||
                    formData.get('markingBrand');
                  if (marksVal) {
                    const strMarks = String(marksVal).trim();
                    if (strMarks && strMarks !== '[object Object]' && strMarks !== 'undefined' && strMarks !== 'null') {
                      if (!formData.get('marking_brand')) formData.set('marking_brand', strMarks);
                      if (!formData.get('marks_and_numbers')) formData.set('marks_and_numbers', strMarks);
                      if (!formData.get('container_marks')) formData.set('container_marks', strMarks);
                    }
                  }

                  const discVal =
                    formData.get('disclaimer') ||
                    formData.get('special_instruction') ||
                    formData.get('specialInstruction') ||
                    formData.get('special_note');
                  if (discVal) {
                    const strDisc = String(discVal).trim();
                    if (strDisc && strDisc !== '[object Object]' && strDisc !== 'undefined' && strDisc !== 'null') {
                      if (!formData.get('disclaimer')) formData.set('disclaimer', strDisc);
                      if (!formData.get('special_instruction')) formData.set('special_instruction', strDisc);
                    }
                  }
                }

                const res = await saveShipmentInstructionDraftAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.shipment_instruction_id;
                  if (newId) {
                    setSteps((prevSteps) =>
                      prevSteps.map((s) =>
                        isShipmentInstructionStep(s)
                          ? { ...s, redirect_id: String(newId), redirectId: String(newId), status: s.status || 'draft' }
                          : s
                      )
                    );
                    let freshData = res.data;
                    try {
                      const freshRes = await getShipmentInstructionAction(String(newId), lang);
                      if (freshRes?.success && freshRes.data) {
                        freshData = freshRes.data;
                      }
                    } catch (e) {
                      console.warn('[DocumentDraftWorkspace] Re-fetch shipment instruction after save warning:', e);
                    }
                    setShipmentInstructionData((prev: any) => ({
                      ...(prev || {}),
                      ...(freshData || {}),
                      id: String(newId),
                      shipment_instruction_id: String(newId),
                    }));
                    setPinnedWorkflowAnchorId(String(newId));
                    setPinnedWorkflowAnchorType('document');
                  }
                }
                return res;
              }}
              onSubmitInstruction={async (formData, passedId, passedNextStep) => {
                const activeDocId =
                  canonicalShipmentInstructionId ||
                  sanitizeDocId(
                    shipmentInstructionData?.shipment_instruction_id ||
                    shipmentInstructionData?.id ||
                    getStepSelfId(getShipmentInstructionStep(steps, selectedStep)) ||
                    extractStepRedirectId(getShipmentInstructionStep(steps, selectedStep)) ||
                    canonicalProformaId ||
                    canonicalContractId ||
                    effectiveConfirmationId ||
                    rootWorkflowId ||
                    draftId
                  );
                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                if (typeof formData?.set === 'function') {
                  if (validEffectiveId) {
                    formData.set('id', validEffectiveId);
                    formData.set('shipment_instruction_id', validEffectiveId);
                  }
                  if (!formData.get('proforma_id') && canonicalProformaId) formData.set('proforma_id', canonicalProformaId);
                  if (!formData.get('contract_id') && canonicalContractId) formData.set('contract_id', canonicalContractId);
                  if (!formData.get('confirmation_id') && (effectiveConfirmationId || rootWorkflowId)) {
                    formData.set('confirmation_id', effectiveConfirmationId || rootWorkflowId);
                  }

                  const marksVal =
                    formData.get('marking_brand') ||
                    formData.get('marks_and_numbers') ||
                    formData.get('container_marks') ||
                    formData.get('markingBrand');
                  if (marksVal) {
                    const strMarks = String(marksVal).trim();
                    if (strMarks && strMarks !== '[object Object]' && strMarks !== 'undefined' && strMarks !== 'null') {
                      if (!formData.get('marking_brand')) formData.set('marking_brand', strMarks);
                      if (!formData.get('marks_and_numbers')) formData.set('marks_and_numbers', strMarks);
                      if (!formData.get('container_marks')) formData.set('container_marks', strMarks);
                    }
                  }

                  const discVal =
                    formData.get('disclaimer') ||
                    formData.get('special_instruction') ||
                    formData.get('specialInstruction') ||
                    formData.get('special_note');
                  if (discVal) {
                    const strDisc = String(discVal).trim();
                    if (strDisc && strDisc !== '[object Object]' && strDisc !== 'undefined' && strDisc !== 'null') {
                      if (!formData.get('disclaimer')) formData.set('disclaimer', strDisc);
                      if (!formData.get('special_instruction')) formData.set('special_instruction', strDisc);
                    }
                  }
                }

                const res = await submitShipmentInstructionAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.shipment_instruction_id;
                  if (newId) {
                    setSteps((prevSteps) =>
                      prevSteps.map((s) =>
                        isShipmentInstructionStep(s)
                          ? { ...s, redirect_id: String(newId), redirectId: String(newId), status: 'completed' }
                          : s
                      )
                    );
                  }
                  let freshData = res.data;
                  try {
                    if (newId) {
                      const freshRes = await getShipmentInstructionAction(String(newId), lang);
                      if (freshRes?.success && freshRes.data) {
                        freshData = freshRes.data;
                      }
                    }
                  } catch (e) {
                    console.warn('[DocumentDraftWorkspace] Re-fetch shipment instruction after submit warning:', e);
                  }
                  setShipmentInstructionData((prev: any) => ({
                    ...(prev || {}),
                    ...(freshData || {}),
                    status: 'COMPLETED',
                    shipment_status: 'COMPLETED',
                    ...(newId ? { id: String(newId), shipment_instruction_id: String(newId) } : {}),
                  }));

                  const nextDoc = (res as any)?.next_doc || res?.data?.next_doc || res?.data?.data?.next_doc;
                  const nextDocId = nextDoc?.id ? String(nextDoc.id) : '';
                  if (nextDocId) {
                    setBillOfLadingData((prev: any) => ({
                      ...(prev || {}),
                      id: nextDocId,
                      bill_of_lading_id: nextDocId,
                    }));
                  }

                  let targetList = steps;
                  try {
                    const siCompletedId = String(newId || effectiveShipmentInstructionId || workflowAnchorId);
                    setPinnedWorkflowAnchorId(siCompletedId);
                    setPinnedWorkflowAnchorType('document');
                    const stepperRes = await getStepperListAction({
                      action: 'document',
                      step: siCompletedId,
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                      targetList = mergeStepperWithHidden(stepperRes.data, steps);
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit shipment stepper error:', stepErr);
                  }

                  if (nextDocId) {
                    targetList = targetList.map((s) =>
                      isBillOfLadingStep(s)
                        ? { ...s, redirect_id: nextDocId, redirectId: nextDocId }
                        : s
                    );
                  }
                  setSteps(targetList);

                  const visibleList = targetList.filter(isVisibleWorkflowStep);
                  let nextStepToSelect: StepperDocumentItem | null = null;
                  let targetIdx = -1;
                  if (passedNextStep) {
                    targetIdx = visibleList.findIndex((s) => isSameWorkflowStep(s, passedNextStep));
                    if (targetIdx >= 0) nextStepToSelect = visibleList[targetIdx];
                  }
                  if (!nextStepToSelect || targetIdx === -1) {
                    const shipIndex = visibleList.findIndex((s) => isShipmentInstructionStep(s));
                    if (shipIndex >= 0 && shipIndex + 1 < visibleList.length) {
                      targetIdx = shipIndex + 1;
                      nextStepToSelect = visibleList[targetIdx];
                    }
                  }
                  if (nextStepToSelect && targetIdx >= 0) {
                    handleSelectStep(nextStepToSelect, targetIdx);
                  }
                }
                return res;
              }}
            />
        </div>

        {/* Bill of Lading Document Form: Visible when Bill of Lading Step is active */}
        <div className={`w-full h-full ${isBillOfLading ? 'flex flex-col' : 'hidden'}`}>
          {isBillOfLading && isLoadingBillOfLading && !billOfLadingData && !initialBillOfLadingData ? (
            <DocumentDraftSkeleton mode="contract" isFormCardOnly={true} />
          ) : (
          <BillOfLadingDocumentForm
            key={`bill-of-lading-${canonicalBillOfLadingId || (billOfLadingData?.id ? String(billOfLadingData.id) : 'default')}`}
            dataVersion={billOfLadingVersion}
            initialData={billOfLadingData || initialBillOfLadingData || null}
            billOfLadingId={canonicalBillOfLadingId || ''}
            shipmentInstructionId={canonicalShipmentInstructionId}
            customInvoiceId={canonicalCustomInvoiceId}
            proformaId={canonicalProformaId}
            contractId={canonicalContractId}
            confirmationId={effectiveConfirmationId}
            steps={steps}
            selectedStep={selectedStep}
            onUpdateSteps={handleUpdateSteps}
            onSelectStep={handleSelectStep}
            sellers={initialSellers}
            buyers={initialBuyers}
            products={initialProducts}
            currencies={initialCurrencies}
            shippingTerms={shippingTerms}
            lang={lang}
            dict={dict}
            readOnly={false}
            onSaveSuccess={(savedId, savedData) => {
              if (savedId) {
                setBillOfLadingData((prev: any) => ({
                  ...(prev || {}),
                  ...(savedData || {}),
                  id: savedId,
                  bill_of_lading_id: savedId,
                }));
                setSteps((prevSteps) =>
                  prevSteps.map((s) =>
                    isBillOfLadingStep(s)
                      ? { ...s, redirect_id: savedId, redirectId: savedId, status: s.status || 'draft' }
                      : s
                  )
                );
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  const cleanSavedId = sanitizeDocId(savedId);
                  const targetWorkflowId = rootWorkflowId || effectiveConfirmationId || canonicalContractId || cleanSavedId;
                  if (targetWorkflowId && !isInvalidPlaceholder(targetWorkflowId)) {
                    url.searchParams.set('id', targetWorkflowId);
                  }
                  url.searchParams.set('step', 'bill-of-lading');
                  window.history.replaceState(null, '', url.toString());
                }
              }
            }}
            onSaveDraft={async (formData) => {
              const ladingStep = getBillOfLadingStep(steps, selectedStep);
              const activeDocId =
                canonicalBillOfLadingId ||
                sanitizeDocId(
                  billOfLadingData?.bill_of_lading_id ||
                  ((billOfLadingData?.bl_number || billOfLadingData?.bl_no) ? billOfLadingData?.id : '')
                ) ||
                getStepSelfId(ladingStep) ||
                extractStepRedirectId(ladingStep) ||
                (ladingStep?.redirect_id) ||
                (ladingStep as any)?.redirectId ||
                extractLinkedBillOfLadingId(billOfLadingData) ||
                extractLinkedBillOfLadingId(shipmentInstructionData) ||
                canonicalShipmentInstructionId ||
                canonicalProformaId ||
                canonicalContractId ||
                effectiveConfirmationId ||
                rootWorkflowId ||
                draftId;

              const validEffectiveId =
                activeDocId &&
                !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|lading|bill-of-lading|bl|step-\d+|null|undefined|nan|\[object object\])$/i.test(activeDocId)
                  ? activeDocId
                  : undefined;

              if (typeof formData?.set === 'function') {
                if (validEffectiveId) {
                  formData.set('id', validEffectiveId);
                  formData.set('bill_of_lading_id', validEffectiveId);
                } else {
                  formData.delete('id');
                  formData.delete('bill_of_lading_id');
                  formData.delete('lading_id');
                }
                if (!formData.get('shipment_instruction_id') && canonicalShipmentInstructionId) {
                  formData.set('shipment_instruction_id', canonicalShipmentInstructionId);
                }
                if (!formData.get('proforma_id') && canonicalProformaId) formData.set('proforma_id', canonicalProformaId);
                if (!formData.get('contract_id') && canonicalContractId) formData.set('contract_id', canonicalContractId);
                if (!formData.get('confirmation_id') && (effectiveConfirmationId || rootWorkflowId)) {
                  formData.set('confirmation_id', effectiveConfirmationId || rootWorkflowId);
                }
              } else if (formData && typeof formData === 'object') {
                if (validEffectiveId) {
                  formData.id = validEffectiveId;
                  formData.bill_of_lading_id = validEffectiveId;
                } else {
                  delete formData.id;
                  delete formData.bill_of_lading_id;
                  delete formData.lading_id;
                }
                if (!formData.shipment_instruction_id && canonicalShipmentInstructionId) {
                  formData.shipment_instruction_id = canonicalShipmentInstructionId;
                }
                if (!formData.proforma_id && canonicalProformaId) formData.proforma_id = canonicalProformaId;
                if (!formData.contract_id && canonicalContractId) formData.contract_id = canonicalContractId;
                if (!formData.confirmation_id && (effectiveConfirmationId || rootWorkflowId)) {
                  formData.confirmation_id = effectiveConfirmationId || rootWorkflowId;
                }
              }

              const res = await saveBillOfLadingDraftAction(formData, lang, validEffectiveId);
              if (res?.success) {
                const newId = res.id || res.data?.id || res.data?.bill_of_lading_id || res.data?.lading_id;
                if (newId) {
                  const cleanNewId = String(newId);
                  setSteps((prevSteps) =>
                    prevSteps.map((s) =>
                      isBillOfLadingStep(s)
                        ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: s.status || 'draft' }
                        : s
                    )
                  );
                  let freshData = res.data;
                  try {
                    const freshRes = await getBillOfLadingAction(cleanNewId, lang);
                    if (freshRes?.success && freshRes.data) {
                      freshData = freshRes.data;
                    }
                  } catch (e) {
                    console.warn('[DocumentDraftWorkspace] Re-fetch bill of lading after save warning:', e);
                  }
                  setBillOfLadingData((prev: any) => ({
                    ...(prev || {}),
                    ...(freshData || {}),
                    id: cleanNewId,
                    bill_of_lading_id: cleanNewId,
                  }));
                }
              }
              return res;
            }}
            onSubmitLading={async (formData, id, passedNextStep) => {
              const cleanPassed = sanitizeDocId(id);
              const ladingStep = getBillOfLadingStep(steps, selectedStep);
              const activeDocId =
                cleanPassed ||
                canonicalBillOfLadingId ||
                sanitizeDocId(
                  billOfLadingData?.bill_of_lading_id ||
                  ((billOfLadingData?.bl_number || billOfLadingData?.bl_no) ? billOfLadingData?.id : '')
                ) ||
                getStepSelfId(ladingStep) ||
                extractStepRedirectId(ladingStep) ||
                (ladingStep?.redirect_id) ||
                (ladingStep as any)?.redirectId ||
                extractLinkedBillOfLadingId(billOfLadingData) ||
                extractLinkedBillOfLadingId(shipmentInstructionData) ||
                canonicalShipmentInstructionId ||
                canonicalProformaId ||
                canonicalContractId ||
                effectiveConfirmationId ||
                rootWorkflowId ||
                draftId;

              const validEffectiveId =
                activeDocId &&
                !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|lading|bill-of-lading|bl|step-\d+|null|undefined|nan|\[object object\])$/i.test(activeDocId)
                  ? activeDocId
                  : undefined;

              if (typeof formData?.set === 'function') {
                if (validEffectiveId) {
                  formData.set('id', validEffectiveId);
                  formData.set('bill_of_lading_id', validEffectiveId);
                } else {
                  formData.delete('id');
                  formData.delete('bill_of_lading_id');
                  formData.delete('lading_id');
                }
                if (!formData.get('shipment_instruction_id') && canonicalShipmentInstructionId) {
                  formData.set('shipment_instruction_id', canonicalShipmentInstructionId);
                }
                if (!formData.get('proforma_id') && canonicalProformaId) formData.set('proforma_id', canonicalProformaId);
                if (!formData.get('contract_id') && canonicalContractId) formData.set('contract_id', canonicalContractId);
                if (!formData.get('confirmation_id') && (effectiveConfirmationId || rootWorkflowId)) {
                  formData.set('confirmation_id', effectiveConfirmationId || rootWorkflowId);
                }
              } else if (formData && typeof formData === 'object') {
                if (validEffectiveId) {
                  formData.id = validEffectiveId;
                  formData.bill_of_lading_id = validEffectiveId;
                } else {
                  delete formData.id;
                  delete formData.bill_of_lading_id;
                  delete formData.lading_id;
                }
                if (!formData.shipment_instruction_id && canonicalShipmentInstructionId) {
                  formData.shipment_instruction_id = canonicalShipmentInstructionId;
                }
                if (!formData.proforma_id && canonicalProformaId) formData.proforma_id = canonicalProformaId;
                if (!formData.contract_id && canonicalContractId) formData.contract_id = canonicalContractId;
                if (!formData.confirmation_id && (effectiveConfirmationId || rootWorkflowId)) {
                  formData.confirmation_id = effectiveConfirmationId || rootWorkflowId;
                }
              }

              const res = await submitBillOfLadingAction(formData, lang, validEffectiveId);
              if (res?.success) {
                const newId = res.id || res.data?.id || res.data?.bill_of_lading_id || res.data?.lading_id;
                const cleanNewId = newId ? String(newId) : validEffectiveId || '';
                if (cleanNewId) {
                  setSteps((prevSteps) =>
                    prevSteps.map((s) =>
                      isBillOfLadingStep(s)
                        ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: 'completed' }
                        : s
                    )
                  );
                }
                let freshData = res.data;
                try {
                  if (cleanNewId) {
                    const freshRes = await getBillOfLadingAction(cleanNewId, lang);
                    if (freshRes?.success && freshRes.data) {
                      freshData = freshRes.data;
                    }
                  }
                } catch (e) {
                  console.warn('[DocumentDraftWorkspace] Re-fetch bill of lading after submit warning:', e);
                }
                setBillOfLadingData((prev: any) => ({
                  ...(prev || {}),
                  ...(freshData || {}),
                  status: 'COMPLETED',
                  bill_of_lading_status: 'COMPLETED',
                  ...(cleanNewId ? { id: cleanNewId, bill_of_lading_id: cleanNewId } : {}),
                }));

                const nextDoc = (res as any)?.next_doc || res?.data?.next_doc || res?.data?.data?.next_doc;
                const nextDocId = nextDoc?.id ? String(nextDoc.id) : '';
                if (nextDocId) {
                  setCustomInvoiceData((prev: any) => ({
                    ...(prev || {}),
                    id: nextDocId,
                    custom_invoice_id: nextDocId,
                  }));
                }

                let targetList = steps;
                try {
                  const stepperParam = workflowAnchorId;
                  const stepperRes = await getStepperListAction({
                    action: workflowAnchorType,
                    step: String(stepperParam),
                    lang,
                  });
                  if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                    targetList = mergeStepperWithHidden(stepperRes.data, steps);
                  }
                } catch (stepErr) {
                  console.error('[DocumentDraftWorkspace] Post-submit bill of lading stepper error:', stepErr);
                }

                if (nextDocId) {
                  targetList = targetList.map((s) =>
                    isCustomInvoiceStep(s)
                      ? { ...s, redirect_id: nextDocId, redirectId: nextDocId }
                      : s
                  );
                }
                setSteps(targetList);

                const visibleList = targetList.filter(isVisibleWorkflowStep);
                let nextStepToSelect: StepperDocumentItem | null = null;
                let targetIdx = -1;
                if (passedNextStep) {
                  targetIdx = visibleList.findIndex((s) => isSameWorkflowStep(s, passedNextStep));
                  if (targetIdx >= 0) nextStepToSelect = visibleList[targetIdx];
                }
                if (!nextStepToSelect || targetIdx === -1) {
                  const ladingIndex = visibleList.findIndex((s) => isBillOfLadingStep(s));
                  if (ladingIndex >= 0 && ladingIndex + 1 < visibleList.length) {
                    targetIdx = ladingIndex + 1;
                    nextStepToSelect = visibleList[targetIdx];
                  }
                }
                if (nextStepToSelect && targetIdx >= 0) {
                  handleSelectStep(nextStepToSelect, targetIdx);
                }
              }
              return res;
            }}
          />
          )}
        </div>

        {/* Custom Invoice Document Form: Visible when Custom Invoice Step is active */}
        <div className={`w-full h-full ${isCustomInvoice ? 'flex flex-col' : 'hidden'}`}>
          <CustomInvoiceDocumentForm
            key={`custom-invoice-${canonicalCustomInvoiceId || (customInvoiceData?.id ? String(customInvoiceData.id) : 'default')}`}
            dataVersion={customInvoiceVersion}
            initialData={customInvoiceData || initialCustomInvoiceData || mergedCustomInvoiceData || null}
            customInvoiceId={canonicalCustomInvoiceId || ''}
              shipmentInstructionId={canonicalShipmentInstructionId}
              proformaId={canonicalProformaId}
              contractId={canonicalContractId}
              confirmationId={effectiveConfirmationId}
              steps={steps}
              selectedStep={selectedStep}
              onUpdateSteps={handleUpdateSteps}
              onSelectStep={handleSelectStep}
              sellers={initialSellers}
              buyers={initialBuyers}
              products={initialProducts}
              currencies={initialCurrencies}
              shippingTerms={shippingTerms}
              lang={lang}
              dict={dict}
              readOnly={false}
              onSaveSuccess={(savedId, savedData) => {
                if (savedId) {
                  setCustomInvoiceData((prev: any) => ({
                    ...(prev || {}),
                    ...(savedData || {}),
                    id: savedId,
                    custom_invoice_id: savedId,
                  }));
                  setSteps((prevSteps) =>
                    prevSteps.map((s) =>
                      isCustomInvoiceStep(s)
                        ? { ...s, redirect_id: savedId, redirectId: savedId, status: s.status || 'draft' }
                        : s
                    )
                  );
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    const cleanSavedId = sanitizeDocId(savedId);
                    const targetWorkflowId = rootWorkflowId || effectiveConfirmationId || canonicalContractId || cleanSavedId;
                    if (targetWorkflowId && !isInvalidPlaceholder(targetWorkflowId)) {
                      url.searchParams.set('id', targetWorkflowId);
                    }
                    url.searchParams.set('step', 'custom-invoice');
                    window.history.replaceState(null, '', url.toString());
                  }
                }
              }}
              onSaveDraft={async (formData) => {
                const customStep = getCustomInvoiceStep(steps, selectedStep);
                const activeDocId =
                  canonicalCustomInvoiceId ||
                  sanitizeDocId(
                    customInvoiceData?.custom_invoice_id ||
                    (customInvoiceData?.custom_invoice_number ? customInvoiceData?.id : '')
                  ) ||
                  getStepSelfId(customStep) ||
                  extractStepRedirectId(customStep) ||
                  (customStep?.redirect_id) ||
                  (customStep as any)?.redirectId ||
                  extractLinkedCustomInvoiceId(customInvoiceData) ||
                  extractLinkedCustomInvoiceId(shipmentInstructionData) ||
                  canonicalShipmentInstructionId ||
                  canonicalProformaId ||
                  canonicalContractId ||
                  effectiveConfirmationId ||
                  rootWorkflowId ||
                  draftId;

                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                const watermarkVal = typeof formData?.get === 'function'
                  ? (formData.get('is_watermark_enabled') ?? formData.get('watermark_enabled') ?? formData.get('watermark') ?? 'true')
                  : (formData?.is_watermark_enabled ?? formData?.watermark_enabled ?? formData?.watermark ?? true);
                const isWatermarkBool = typeof watermarkVal === 'string' ? watermarkVal !== 'false' && watermarkVal !== '0' : Boolean(watermarkVal);

                const titleCandidate = typeof formData?.get === 'function'
                  ? (formData.get('pdf_title') ?? formData.get('document_title') ?? formData.get('custom_doc_title') ?? formData.get('title') ?? 'CUSTOM INVOICE')
                  : (formData?.pdf_title ?? formData?.document_title ?? formData?.custom_doc_title ?? formData?.title ?? 'CUSTOM INVOICE');
                const safeTitle = String(titleCandidate || '').trim() || 'CUSTOM INVOICE';

                const cLabelCandidate = typeof formData?.get === 'function'
                  ? (formData.get('comment_label') ?? formData.get('comment_title') ?? formData.get('notes_title') ?? formData.get('title') ?? '')
                  : (formData?.comment_label ?? formData?.comment_title ?? formData?.notes_title ?? formData?.title ?? '');
                const cValueCandidate = typeof formData?.get === 'function'
                  ? (formData.get('comment_value') ?? formData.get('comment_text') ?? formData.get('notes_comment') ?? formData.get('comment') ?? '')
                  : (formData?.comment_value ?? formData?.comment_text ?? formData?.notes_comment ?? formData?.comment ?? '');
                const effectiveCLabel = String(cLabelCandidate || (cValueCandidate ? 'Comments' : '')).trim();
                const effectiveCValue = String(cValueCandidate || '').trim();

                if (typeof formData?.set === 'function') {
                  if (validEffectiveId) {
                    formData.set('id', validEffectiveId);
                    formData.set('custom_invoice_id', validEffectiveId);
                  } else {
                    formData.delete('id');
                    formData.delete('custom_invoice_id');
                    formData.delete('invoice_id');
                  }
                  if (!formData.get('shipment_instruction_id') && canonicalShipmentInstructionId) {
                    formData.set('shipment_instruction_id', canonicalShipmentInstructionId);
                  }
                  if (!formData.get('proforma_id') && canonicalProformaId) formData.set('proforma_id', canonicalProformaId);
                  if (!formData.get('contract_id') && canonicalContractId) formData.set('contract_id', canonicalContractId);
                  if (!formData.get('confirmation_id') && (effectiveConfirmationId || rootWorkflowId)) {
                    formData.set('confirmation_id', effectiveConfirmationId || rootWorkflowId);
                  }
                  formData.set('is_watermark_enabled', String(isWatermarkBool));
                  formData.set('watermark_enabled', String(isWatermarkBool));
                  formData.set('watermark', String(isWatermarkBool));
                  formData.set('pdf_title', safeTitle);
                  formData.set('document_title', safeTitle);
                  formData.set('custom_doc_title', safeTitle);
                  formData.set('comment_label', effectiveCLabel);
                  formData.set('comment_title', effectiveCLabel);
                  formData.set('notes_title', effectiveCLabel);
                  formData.set('comment_value', effectiveCValue);
                  formData.set('comment_text', effectiveCValue);
                  formData.set('notes_comment', effectiveCValue);
                  formData.set('comment', effectiveCValue);
                  const rawPricePerBag = formData.get('price_per_bag') ?? formData.get('rate_per_bag') ?? formData.get('rate_bag');
                  if (rawPricePerBag !== undefined && rawPricePerBag !== null && String(rawPricePerBag).trim() !== '') {
                    formData.set('price_per_bag', String(rawPricePerBag).trim());
                    formData.set('rate_per_bag', String(rawPricePerBag).trim());
                  }
                } else if (formData && typeof formData === 'object') {
                  if (validEffectiveId) {
                    formData.id = validEffectiveId;
                    formData.custom_invoice_id = validEffectiveId;
                  } else {
                    delete formData.id;
                    delete formData.custom_invoice_id;
                    delete formData.invoice_id;
                  }
                  if (!formData.shipment_instruction_id && canonicalShipmentInstructionId) {
                    formData.shipment_instruction_id = canonicalShipmentInstructionId;
                  }
                  if (!formData.proforma_id && canonicalProformaId) formData.proforma_id = canonicalProformaId;
                  if (!formData.contract_id && canonicalContractId) formData.contract_id = canonicalContractId;
                  if (!formData.confirmation_id && (effectiveConfirmationId || rootWorkflowId)) {
                    formData.confirmation_id = effectiveConfirmationId || rootWorkflowId;
                  }
                  formData.is_watermark_enabled = isWatermarkBool;
                  formData.watermark_enabled = isWatermarkBool;
                  formData.watermark = isWatermarkBool;
                  formData.pdf_title = safeTitle;
                  formData.document_title = safeTitle;
                  formData.custom_doc_title = safeTitle;
                  formData.comment_label = effectiveCLabel;
                  formData.comment_title = effectiveCLabel;
                  formData.notes_title = effectiveCLabel;
                  formData.comment_value = effectiveCValue;
                  formData.comment_text = effectiveCValue;
                  formData.notes_comment = effectiveCValue;
                  formData.comment = effectiveCValue;
                  const rawPricePerBag = formData.price_per_bag ?? formData.rate_per_bag ?? formData.rate_bag;
                  if (rawPricePerBag !== undefined && rawPricePerBag !== null && String(rawPricePerBag).trim() !== '') {
                    const numP = Number(rawPricePerBag);
                    formData.price_per_bag = !isNaN(numP) ? numP : rawPricePerBag;
                    formData.rate_per_bag = !isNaN(numP) ? numP : rawPricePerBag;
                  }
                }

                const res = await saveCustomInvoiceDraftAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.custom_invoice_id || res.data?.invoice_id;
                  if (newId) {
                    const cleanNewId = String(newId);
                    setSteps((prevSteps) =>
                      prevSteps.map((s) =>
                        isCustomInvoiceStep(s)
                          ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: s.status || 'draft' }
                          : s
                      )
                    );
                    let freshData = res.data;
                    try {
                      const freshRes = await getCustomInvoiceAction(cleanNewId, lang);
                      if (freshRes?.success && freshRes.data) {
                        freshData = freshRes.data;
                      }
                    } catch (e) {
                      console.warn('[DocumentDraftWorkspace] Re-fetch custom invoice after save warning:', e);
                    }
                    setCustomInvoiceData((prev: any) => ({
                      ...(prev || {}),
                      ...(freshData || {}),
                      id: cleanNewId,
                      custom_invoice_id: cleanNewId,
                    }));
                    setCustomInvoiceVersion((v) => v + 1);
                  }
                }
                return res;
              }}
              onSubmitInvoice={async (formData, id, passedNextStep) => {
                const cleanPassed = sanitizeDocId(id);
                const customStep = getCustomInvoiceStep(steps, selectedStep);
                const activeDocId =
                  cleanPassed ||
                  canonicalCustomInvoiceId ||
                  sanitizeDocId(
                    customInvoiceData?.custom_invoice_id ||
                    (customInvoiceData?.custom_invoice_number ? customInvoiceData?.id : '')
                  ) ||
                  getStepSelfId(customStep) ||
                  extractStepRedirectId(customStep) ||
                  (customStep?.redirect_id) ||
                  (customStep as any)?.redirectId ||
                  extractLinkedCustomInvoiceId(customInvoiceData) ||
                  extractLinkedCustomInvoiceId(shipmentInstructionData) ||
                  canonicalShipmentInstructionId ||
                  canonicalProformaId ||
                  canonicalContractId ||
                  effectiveConfirmationId ||
                  rootWorkflowId ||
                  draftId;

                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                const watermarkVal = typeof formData?.get === 'function'
                  ? (formData.get('is_watermark_enabled') ?? formData.get('watermark_enabled') ?? formData.get('watermark') ?? 'true')
                  : (formData?.is_watermark_enabled ?? formData?.watermark_enabled ?? formData?.watermark ?? true);
                const isWatermarkBool = typeof watermarkVal === 'string' ? watermarkVal !== 'false' && watermarkVal !== '0' : Boolean(watermarkVal);

                const titleCandidate = typeof formData?.get === 'function'
                  ? (formData.get('pdf_title') ?? formData.get('document_title') ?? formData.get('custom_doc_title') ?? formData.get('title') ?? 'CUSTOM INVOICE')
                  : (formData?.pdf_title ?? formData?.document_title ?? formData?.custom_doc_title ?? formData?.title ?? 'CUSTOM INVOICE');
                const safeTitle = String(titleCandidate || '').trim() || 'CUSTOM INVOICE';

                const cLabelCandidate = typeof formData?.get === 'function'
                  ? (formData.get('comment_label') ?? formData.get('comment_title') ?? formData.get('notes_title') ?? formData.get('title') ?? '')
                  : (formData?.comment_label ?? formData?.comment_title ?? formData?.notes_title ?? formData?.title ?? '');
                const cValueCandidate = typeof formData?.get === 'function'
                  ? (formData.get('comment_value') ?? formData.get('comment_text') ?? formData.get('notes_comment') ?? formData.get('comment') ?? '')
                  : (formData?.comment_value ?? formData?.comment_text ?? formData?.notes_comment ?? formData?.comment ?? '');
                const effectiveCLabel = String(cLabelCandidate || (cValueCandidate ? 'Comments' : '')).trim();
                const effectiveCValue = String(cValueCandidate || '').trim();

                if (typeof formData?.set === 'function') {
                  if (validEffectiveId) {
                    formData.set('id', validEffectiveId);
                    formData.set('custom_invoice_id', validEffectiveId);
                  } else {
                    formData.delete('id');
                    formData.delete('custom_invoice_id');
                    formData.delete('invoice_id');
                  }
                  if (!formData.get('shipment_instruction_id') && canonicalShipmentInstructionId) {
                    formData.set('shipment_instruction_id', canonicalShipmentInstructionId);
                  }
                  if (!formData.get('proforma_id') && canonicalProformaId) formData.set('proforma_id', canonicalProformaId);
                  if (!formData.get('contract_id') && canonicalContractId) formData.set('contract_id', canonicalContractId);
                  if (!formData.get('confirmation_id') && (effectiveConfirmationId || rootWorkflowId)) {
                    formData.set('confirmation_id', effectiveConfirmationId || rootWorkflowId);
                  }
                  formData.set('is_watermark_enabled', String(isWatermarkBool));
                  formData.set('watermark_enabled', String(isWatermarkBool));
                  formData.set('watermark', String(isWatermarkBool));
                  formData.set('pdf_title', safeTitle);
                  formData.set('document_title', safeTitle);
                  formData.set('custom_doc_title', safeTitle);
                  formData.set('comment_label', effectiveCLabel);
                  formData.set('comment_title', effectiveCLabel);
                  formData.set('notes_title', effectiveCLabel);
                  formData.set('comment_value', effectiveCValue);
                  formData.set('comment_text', effectiveCValue);
                  formData.set('notes_comment', effectiveCValue);
                  formData.set('comment', effectiveCValue);
                  const rawPricePerBag = formData.get('price_per_bag') ?? formData.get('rate_per_bag') ?? formData.get('rate_bag');
                  if (rawPricePerBag !== undefined && rawPricePerBag !== null && String(rawPricePerBag).trim() !== '') {
                    formData.set('price_per_bag', String(rawPricePerBag).trim());
                    formData.set('rate_per_bag', String(rawPricePerBag).trim());
                  }
                } else if (formData && typeof formData === 'object') {
                  if (validEffectiveId) {
                    formData.id = validEffectiveId;
                    formData.custom_invoice_id = validEffectiveId;
                  } else {
                    delete formData.id;
                    delete formData.custom_invoice_id;
                    delete formData.invoice_id;
                  }
                  if (!formData.shipment_instruction_id && canonicalShipmentInstructionId) {
                    formData.shipment_instruction_id = canonicalShipmentInstructionId;
                  }
                  if (!formData.proforma_id && canonicalProformaId) formData.proforma_id = canonicalProformaId;
                  if (!formData.contract_id && canonicalContractId) formData.contract_id = canonicalContractId;
                  if (!formData.confirmation_id && (effectiveConfirmationId || rootWorkflowId)) {
                    formData.confirmation_id = effectiveConfirmationId || rootWorkflowId;
                  }
                  formData.is_watermark_enabled = isWatermarkBool;
                  formData.watermark_enabled = isWatermarkBool;
                  formData.watermark = isWatermarkBool;
                  formData.pdf_title = safeTitle;
                  formData.document_title = safeTitle;
                  formData.custom_doc_title = safeTitle;
                  formData.comment_label = effectiveCLabel;
                  formData.comment_title = effectiveCLabel;
                  formData.notes_title = effectiveCLabel;
                  formData.comment_value = effectiveCValue;
                  formData.comment_text = effectiveCValue;
                  formData.notes_comment = effectiveCValue;
                  formData.comment = effectiveCValue;
                  const rawPricePerBag = formData.price_per_bag ?? formData.rate_per_bag ?? formData.rate_bag;
                  if (rawPricePerBag !== undefined && rawPricePerBag !== null && String(rawPricePerBag).trim() !== '') {
                    const numP = Number(rawPricePerBag);
                    formData.price_per_bag = !isNaN(numP) ? numP : rawPricePerBag;
                    formData.rate_per_bag = !isNaN(numP) ? numP : rawPricePerBag;
                  }
                }

                const res = await submitCustomInvoiceAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.custom_invoice_id || res.data?.invoice_id || validEffectiveId;
                  if (newId) {
                    const cleanNewId = String(newId);
                    setSteps((prevSteps) =>
                      prevSteps.map((s) =>
                        isCustomInvoiceStep(s)
                          ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: 'completed' }
                          : s
                      )
                    );
                  }
                  let freshData = res.data;
                  try {
                    if (newId) {
                      const freshRes = await getCustomInvoiceAction(String(newId), lang);
                      if (freshRes?.success && freshRes.data) {
                        freshData = freshRes.data;
                      }
                    }
                  } catch (e) {
                    console.warn('[DocumentDraftWorkspace] Re-fetch custom invoice after submit warning:', e);
                  }
                  setCustomInvoiceData((prev: any) => ({
                    ...(prev || {}),
                    ...(freshData || {}),
                    status: 'COMPLETED',
                    document_status: 'COMPLETED',
                    ...(newId ? { id: String(newId), custom_invoice_id: String(newId) } : {}),
                  }));
                  setCustomInvoiceVersion((v) => v + 1);

                  const nextDoc = (res as any)?.next_doc || res?.data?.next_doc || res?.data?.data?.next_doc;
                  const nextDocId = nextDoc?.id ? String(nextDoc.id) : '';
                  if (nextDocId) {
                    setCommercialInvoiceData((prev: any) => ({
                      ...(prev || {}),
                      id: nextDocId,
                      commercial_invoice_id: nextDocId,
                    }));
                  }

                  let targetList = steps;
                  try {
                    const stepperParam = workflowAnchorId;
                    const stepperRes = await getStepperListAction({
                      action: workflowAnchorType,
                      step: String(stepperParam),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                      targetList = mergeStepperWithHidden(stepperRes.data, steps);
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit custom invoice stepper error:', stepErr);
                  }

                  if (nextDocId) {
                    targetList = targetList.map((s) =>
                      isCommercialInvoiceStep(s)
                        ? { ...s, redirect_id: nextDocId, redirectId: nextDocId }
                        : s
                    );
                  }
                  setSteps(targetList);

                  const visibleList = targetList.filter(isVisibleWorkflowStep);
                  let nextStepToSelect: StepperDocumentItem | null = null;
                  let targetIdx = -1;
                  if (passedNextStep) {
                    targetIdx = visibleList.findIndex((s) => isSameWorkflowStep(s, passedNextStep));
                    if (targetIdx >= 0) nextStepToSelect = visibleList[targetIdx];
                  }
                  if (!nextStepToSelect || targetIdx === -1) {
                    const customIndex = visibleList.findIndex((s) => isCustomInvoiceStep(s));
                    if (customIndex >= 0 && customIndex + 1 < visibleList.length) {
                      targetIdx = customIndex + 1;
                      nextStepToSelect = visibleList[targetIdx];
                    }
                  }
                  if (nextStepToSelect && targetIdx >= 0) {
                    handleSelectStep(nextStepToSelect, targetIdx);
                  }
                }
                return res;
              }}
            />
        </div>

        {/* Commercial Invoice Document Form: Visible when Commercial Invoice Step is active */}
        <div className={`w-full h-full ${isCommercialInvoice ? 'flex flex-col' : 'hidden'}`}>
          {isLoadingCommercialInvoice && !commercialInvoiceData && !initialCommercialInvoiceData ? (
            <DocumentDraftSkeleton mode="contract" />
          ) : (
            <CommercialInvoiceDocumentForm
              key={`commercial-invoice-${canonicalCommercialInvoiceId || (commercialInvoiceData?.id ? String(commercialInvoiceData.id) : 'default')}`}
              dataVersion={commercialInvoiceVersion}
              initialData={commercialInvoiceData || initialCommercialInvoiceData || mergedCommercialInvoiceData || null}
              commercialInvoiceId={canonicalCommercialInvoiceId || ''}
              customInvoiceId={canonicalCustomInvoiceId}
              shipmentInstructionId={canonicalShipmentInstructionId}
              proformaId={canonicalProformaId}
              contractId={canonicalContractId}
              confirmationId={effectiveConfirmationId}
              steps={steps}
              selectedStep={selectedStep}
              onUpdateSteps={handleUpdateSteps}
              onSelectStep={handleSelectStep}
              sellers={initialSellers}
              buyers={initialBuyers}
              products={initialProducts}
              paymentTerms={initialPaymentTerms}
              currencies={initialCurrencies}
              shippingTerms={shippingTerms}
              lang={lang}
              dict={dict}
              readOnly={false}
              onSaveSuccess={(savedId, savedData) => {
                if (savedId) {
                  setCommercialInvoiceData((prev: any) => ({
                    ...(prev || {}),
                    ...(savedData || {}),
                    id: savedId,
                    commercial_invoice_id: savedId,
                  }));
                  setSteps((prevSteps) =>
                    prevSteps.map((s) =>
                      isCommercialInvoiceStep(s)
                        ? { ...s, redirect_id: savedId, redirectId: savedId, status: s.status || 'draft' }
                        : s
                    )
                  );
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    const cleanSavedId = sanitizeDocId(savedId);
                    const targetWorkflowId = rootWorkflowId || effectiveConfirmationId || canonicalContractId || cleanSavedId;
                    if (targetWorkflowId && !isInvalidPlaceholder(targetWorkflowId)) {
                      url.searchParams.set('id', targetWorkflowId);
                    }
                    url.searchParams.set('step', 'commercial-invoice');
                    window.history.replaceState(null, '', url.toString());
                  }
                }
              }}
              onSaveDraft={async (formData) => {
                const commercialStep = getCommercialInvoiceStep(steps, selectedStep);
                const activeDocId =
                  canonicalCommercialInvoiceId ||
                  sanitizeDocId(
                    commercialInvoiceData?.commercial_invoice_id ||
                    (commercialInvoiceData?.commercial_invoice_number ? commercialInvoiceData?.id : '')
                  ) ||
                  getStepSelfId(commercialStep) ||
                  extractStepRedirectId(commercialStep) ||
                  commercialStep?.redirect_id ||
                  (commercialStep as any)?.redirectId ||
                  extractLinkedCommercialInvoiceId(commercialInvoiceData) ||
                  extractLinkedCommercialInvoiceId(customInvoiceData) ||
                  canonicalCustomInvoiceId ||
                  canonicalShipmentInstructionId ||
                  canonicalProformaId ||
                  canonicalContractId ||
                  effectiveConfirmationId ||
                  rootWorkflowId ||
                  draftId;

                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|commercial|commercial-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                const res = await saveCommercialInvoiceDraftAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.commercial_invoice_id;
                  if (newId) {
                    const cleanNewId = String(newId);
                    setSteps((prevSteps) =>
                      prevSteps.map((s) =>
                        isCommercialInvoiceStep(s)
                          ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: s.status || 'draft' }
                          : s
                      )
                    );
                    let freshData = res.data;
                    try {
                      const freshRes = await getCommercialInvoiceAction(cleanNewId, lang);
                      if (freshRes?.success && freshRes.data) {
                        freshData = freshRes.data;
                      }
                    } catch (e) {
                      console.warn('[DocumentDraftWorkspace] Re-fetch commercial invoice after save warning:', e);
                    }
                    setCommercialInvoiceData((prev: any) => ({
                      ...(prev || {}),
                      ...(freshData || {}),
                      id: cleanNewId,
                      commercial_invoice_id: cleanNewId,
                    }));
                    setCommercialInvoiceVersion((v) => v + 1);
                  }
                }
                return res;
              }}
              onSubmitCommercialInvoice={async (formData, id, passedNextStep) => {
                const cleanPassed = sanitizeDocId(id);
                const commercialStep = getCommercialInvoiceStep(steps, selectedStep);
                const activeDocId =
                  cleanPassed ||
                  canonicalCommercialInvoiceId ||
                  sanitizeDocId(
                    commercialInvoiceData?.commercial_invoice_id ||
                    (commercialInvoiceData?.commercial_invoice_number ? commercialInvoiceData?.id : '')
                  ) ||
                  getStepSelfId(commercialStep) ||
                  extractStepRedirectId(commercialStep) ||
                  commercialStep?.redirect_id ||
                  (commercialStep as any)?.redirectId ||
                  extractLinkedCommercialInvoiceId(commercialInvoiceData) ||
                  extractLinkedCommercialInvoiceId(customInvoiceData) ||
                  canonicalCustomInvoiceId ||
                  canonicalShipmentInstructionId ||
                  canonicalProformaId ||
                  canonicalContractId ||
                  effectiveConfirmationId ||
                  rootWorkflowId ||
                  draftId;

                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|commercial|commercial-invoice|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                const res = await submitCommercialInvoiceAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.commercial_invoice_id || validEffectiveId;
                  if (newId) {
                    const cleanNewId = String(newId);
                    setSteps((prevSteps) =>
                      prevSteps.map((s) =>
                        isCommercialInvoiceStep(s)
                          ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: 'completed' }
                          : s
                      )
                    );
                  }
                  let freshData = res.data;
                  try {
                    if (newId) {
                      const freshRes = await getCommercialInvoiceAction(String(newId), lang);
                      if (freshRes?.success && freshRes.data) {
                        freshData = freshRes.data;
                      }
                    }
                  } catch (e) {
                    console.warn('[DocumentDraftWorkspace] Re-fetch commercial invoice after submit warning:', e);
                  }
                  setCommercialInvoiceData((prev: any) => ({
                    ...(prev || {}),
                    ...(freshData || {}),
                    status: 'COMPLETED',
                    document_status: 'COMPLETED',
                    ...(newId ? { id: String(newId), commercial_invoice_id: String(newId) } : {}),
                  }));
                  setCommercialInvoiceVersion((v) => v + 1);

                  const nextDoc = (res as any)?.next_doc || res?.data?.next_doc || res?.data?.data?.next_doc;
                  const nextDocId = nextDoc?.id ? String(nextDoc.id) : '';
                  if (nextDocId) {
                    setPackingListData((prev: any) => ({
                      ...(prev || {}),
                      id: nextDocId,
                      packing_list_id: nextDocId,
                    }));
                  }

                  let targetList = steps;
                  try {
                    const stepperRes = await getStepperListAction({
                      action: workflowAnchorType,
                      step: String(workflowAnchorId),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                      targetList = mergeStepperWithHidden(stepperRes.data, steps);
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit commercial invoice stepper error:', stepErr);
                  }

                  if (nextDocId) {
                    targetList = targetList.map((s) =>
                      isPackingListStep(s)
                        ? { ...s, redirect_id: nextDocId, redirectId: nextDocId }
                        : s
                    );
                  }
                  setSteps(targetList);

                  const visibleList = targetList.filter(isVisibleWorkflowStep);
                  let nextStepToSelect: StepperDocumentItem | null = null;
                  let targetIdx = -1;
                  if (passedNextStep) {
                    targetIdx = visibleList.findIndex((s) => isSameWorkflowStep(s, passedNextStep));
                    if (targetIdx >= 0) nextStepToSelect = visibleList[targetIdx];
                  }
                  if (!nextStepToSelect || targetIdx === -1) {
                    const commIndex = visibleList.findIndex((s) => isCommercialInvoiceStep(s));
                    if (commIndex >= 0 && commIndex + 1 < visibleList.length) {
                      targetIdx = commIndex + 1;
                      nextStepToSelect = visibleList[targetIdx];
                    }
                  }
                  if (nextStepToSelect && targetIdx >= 0) {
                    handleSelectStep(nextStepToSelect, targetIdx);
                  }
                }
                return res;
              }}
            />
          )}
        </div>

        {/* Packing List Document Form: Visible when Packing List Step is active */}
        <div className={`w-full h-full ${isPackingList ? 'flex flex-col' : 'hidden'}`}>
          {isLoadingPackingList && !packingListData && !initialPackingListData ? (
            <DocumentDraftSkeleton mode="contract" />
          ) : (
            <PackingListDocumentForm
              key={`packing-list-${canonicalPackingListId || (packingListData?.id ? String(packingListData.id) : 'default')}`}
              dataVersion={packingListVersion}
              initialData={
                packingListData && Object.keys(packingListData).length > 2
                  ? { ...mergedPackingListData, ...packingListData }
                  : initialPackingListData && Object.keys(initialPackingListData).length > 2
                  ? { ...mergedPackingListData, ...initialPackingListData }
                  : mergedPackingListData || packingListData || initialPackingListData || null
              }
              packingListId={canonicalPackingListId || ''}
              commercialInvoiceId={canonicalCommercialInvoiceId}
              customInvoiceId={canonicalCustomInvoiceId}
              shipmentInstructionId={canonicalShipmentInstructionId}
              proformaId={canonicalProformaId}
              contractId={canonicalContractId}
              confirmationId={effectiveConfirmationId}
              steps={steps}
              selectedStep={selectedStep}
              onUpdateSteps={handleUpdateSteps}
              onSelectStep={handleSelectStep}
              sellers={initialSellers}
              buyers={initialBuyers}
              products={initialProducts}
              paymentTerms={initialPaymentTerms}
              currencies={initialCurrencies}
              shippingTerms={shippingTerms}
              lang={lang}
              dict={dict}
              readOnly={false}
              onSaveSuccess={(savedId, savedData) => {
                if (savedId) {
                  setPackingListData((prev: any) => ({
                    ...(prev || {}),
                    ...(savedData || {}),
                    id: savedId,
                    packing_list_id: savedId,
                  }));
                  setSteps((prevSteps) =>
                    prevSteps.map((s) =>
                      isPackingListStep(s)
                        ? { ...s, redirect_id: savedId, redirectId: savedId, status: s.status || 'draft' }
                        : s
                    )
                  );
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    const cleanSavedId = sanitizeDocId(savedId);
                    const targetWorkflowId = rootWorkflowId || effectiveConfirmationId || canonicalContractId || cleanSavedId;
                    if (targetWorkflowId && !isInvalidPlaceholder(targetWorkflowId)) {
                      url.searchParams.set('id', targetWorkflowId);
                    }
                    url.searchParams.set('step', 'packing-list');
                    window.history.replaceState(null, '', url.toString());
                  }
                }
              }}
              onSaveDraft={async (formData) => {
                const packingStep = getPackingListStep(steps, selectedStep);
                const activeDocId =
                  canonicalPackingListId ||
                  sanitizeDocId(
                    packingListData?.packing_list_id ||
                    (packingListData?.packing_list_number ? packingListData?.id : '')
                  ) ||
                  getStepSelfId(packingStep) ||
                  extractStepRedirectId(packingStep) ||
                  packingStep?.redirect_id ||
                  (packingStep as any)?.redirectId ||
                  extractLinkedPackingListId(packingListData) ||
                  extractLinkedPackingListId(commercialInvoiceData) ||
                  canonicalCommercialInvoiceId ||
                  canonicalCustomInvoiceId ||
                  canonicalShipmentInstructionId ||
                  canonicalProformaId ||
                  canonicalContractId ||
                  effectiveConfirmationId ||
                  rootWorkflowId ||
                  draftId;

                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                const res = await savePackingListDraftAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.packing_list_id;
                  if (newId) {
                    const cleanNewId = String(newId);
                    setSteps((prevSteps) =>
                      prevSteps.map((s) =>
                        isPackingListStep(s)
                          ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: s.status || 'draft' }
                          : s
                      )
                    );
                    let freshData = res.data;
                    try {
                      const freshRes = await getPackingListAction(cleanNewId, lang);
                      if (freshRes?.success && freshRes.data) {
                        freshData = freshRes.data;
                      }
                    } catch (e) {
                      console.warn('[DocumentDraftWorkspace] Re-fetch packing list after save warning:', e);
                    }
                    setPackingListData((prev: any) => ({
                      ...(prev || {}),
                      ...(freshData || {}),
                      id: cleanNewId,
                      packing_list_id: cleanNewId,
                    }));
                    setPackingListVersion((v) => v + 1);
                  }
                }
                return res;
              }}
              onSubmitPackingList={async (formData, id, passedNextStep) => {
                const cleanPassed = sanitizeDocId(id);
                const packingStep = getPackingListStep(steps, selectedStep);
                const activeDocId =
                  cleanPassed ||
                  canonicalPackingListId ||
                  sanitizeDocId(
                    packingListData?.packing_list_id ||
                    (packingListData?.packing_list_number ? packingListData?.id : '')
                  ) ||
                  getStepSelfId(packingStep) ||
                  extractStepRedirectId(packingStep) ||
                  packingStep?.redirect_id ||
                  (packingStep as any)?.redirectId ||
                  extractLinkedPackingListId(packingListData) ||
                  extractLinkedPackingListId(commercialInvoiceData) ||
                  canonicalCommercialInvoiceId ||
                  canonicalCustomInvoiceId ||
                  canonicalShipmentInstructionId ||
                  canonicalProformaId ||
                  canonicalContractId ||
                  effectiveConfirmationId ||
                  rootWorkflowId ||
                  draftId;

                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                const res = await submitPackingListAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.packing_list_id || validEffectiveId;
                  if (newId) {
                    const cleanNewId = String(newId);
                    setSteps((prevSteps) =>
                      prevSteps.map((s) =>
                        isPackingListStep(s)
                          ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: 'completed' }
                          : s
                      )
                    );
                  }
                  let freshData = res.data;
                  try {
                    if (newId) {
                      const freshRes = await getPackingListAction(String(newId), lang);
                      if (freshRes?.success && freshRes.data) {
                        freshData = freshRes.data;
                      }
                    }
                  } catch (e) {
                    console.warn('[DocumentDraftWorkspace] Re-fetch packing list after submit warning:', e);
                  }
                  setPackingListData((prev: any) => ({
                    ...(prev || {}),
                    ...(freshData || {}),
                    status: 'COMPLETED',
                    document_status: 'COMPLETED',
                    ...(newId ? { id: String(newId), packing_list_id: String(newId) } : {}),
                  }));
                  setPackingListVersion((v) => v + 1);

                  const nextDoc = (res as any)?.next_doc || res?.data?.next_doc || res?.data?.data?.next_doc;
                  const nextDocId = nextDoc?.id ? String(nextDoc.id) : '';
                  if (nextDocId) {
                    setPhytoCertificateData((prev: any) => ({
                      ...(prev || {}),
                      id: nextDocId,
                      phyto_certificate_id: nextDocId,
                    }));
                  }

                  let targetList = steps;
                  try {
                    const stepperRes = await getStepperListAction({
                      action: workflowAnchorType,
                      step: String(workflowAnchorId),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0 && isRealStepperList(stepperRes.data)) {
                      targetList = mergeStepperWithHidden(stepperRes.data, steps);
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit packing list stepper error:', stepErr);
                  }

                  if (nextDocId) {
                    targetList = targetList.map((s) =>
                      isPhytoCertificateStep(s)
                        ? { ...s, redirect_id: nextDocId, redirectId: nextDocId }
                        : s
                    );
                  }
                  setSteps(targetList);

                  const visibleList = targetList.filter(isVisibleWorkflowStep);
                  let nextStepToSelect: StepperDocumentItem | null = null;
                  let targetIdx = -1;
                  if (passedNextStep) {
                    targetIdx = visibleList.findIndex((s) => isSameWorkflowStep(s, passedNextStep));
                    if (targetIdx >= 0) nextStepToSelect = visibleList[targetIdx];
                  }
                  if (!nextStepToSelect || targetIdx === -1) {
                    const packingIndex = visibleList.findIndex((s) => isPackingListStep(s));
                    if (packingIndex >= 0 && packingIndex + 1 < visibleList.length) {
                      targetIdx = packingIndex + 1;
                      nextStepToSelect = visibleList[targetIdx];
                    }
                  }
                  if (nextStepToSelect && targetIdx >= 0) {
                    handleSelectStep(nextStepToSelect, targetIdx);
                  }
                }
                return res;
              }}
            />
          )}
        </div>

        {/* Phyto Certificate Document Form: Visible when Phyto Certificate Step is active */}
        <div className={`w-full h-full ${isPhytoCertificate ? 'flex flex-col' : 'hidden'}`}>
          {isLoadingPhytoCertificate && !phytoCertificateData && !initialPhytoCertificateData ? (
            <DocumentDraftSkeleton mode="contract" />
          ) : (
            <PhytoCertificateDocumentForm
              key={`phyto-certificate-${canonicalPhytoCertificateId || (phytoCertificateData?.id ? String(phytoCertificateData.id) : 'default')}`}
              dataVersion={phytoCertificateVersion}
              initialData={
                phytoCertificateData && Object.keys(phytoCertificateData).length > 2
                  ? { ...mergedPhytoCertificateData, ...phytoCertificateData }
                  : initialPhytoCertificateData && Object.keys(initialPhytoCertificateData).length > 2
                  ? { ...mergedPhytoCertificateData, ...initialPhytoCertificateData }
                  : mergedPhytoCertificateData || phytoCertificateData || initialPhytoCertificateData || null
              }
              phytoCertificateId={canonicalPhytoCertificateId || ''}
              packingListId={canonicalPackingListId}
              commercialInvoiceId={canonicalCommercialInvoiceId}
              customInvoiceId={canonicalCustomInvoiceId}
              shipmentInstructionId={canonicalShipmentInstructionId}
              proformaId={canonicalProformaId}
              contractId={canonicalContractId}
              confirmationId={effectiveConfirmationId}
              steps={steps}
              selectedStep={selectedStep}
              onUpdateSteps={handleUpdateSteps}
              onSelectStep={handleSelectStep}
              sellers={initialSellers}
              buyers={initialBuyers}
              products={initialProducts}
              paymentTerms={initialPaymentTerms}
              currencies={initialCurrencies}
              shippingTerms={shippingTerms}
              lang={lang}
              dict={dict}
              readOnly={false}
              onSaveSuccess={(savedId, savedData) => {
                if (savedId) {
                  setPhytoCertificateData((prev: any) => ({
                    ...(prev || {}),
                    ...(savedData || {}),
                    id: savedId,
                    phyto_certificate_id: savedId,
                  }));
                  setSteps((prevSteps) =>
                    prevSteps.map((s) =>
                      isPhytoCertificateStep(s)
                        ? { ...s, redirect_id: savedId, redirectId: savedId, status: s.status || 'draft' }
                        : s
                    )
                  );
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    const cleanSavedId = sanitizeDocId(savedId);
                    const targetWorkflowId = rootWorkflowId || effectiveConfirmationId || canonicalContractId || cleanSavedId;
                    if (targetWorkflowId && !isInvalidPlaceholder(targetWorkflowId)) {
                      url.searchParams.set('id', targetWorkflowId);
                    }
                    url.searchParams.set('step', 'phyto-certificate');
                    window.history.replaceState(null, '', url.toString());
                  }
                }
              }}
              onSaveDraft={async (formData) => {
                const phytoStep = getPhytoCertificateStep(steps, selectedStep);
                const activeDocId =
                  canonicalPhytoCertificateId ||
                  sanitizeDocId(
                    phytoCertificateData?.phyto_certificate_id ||
                    (phytoCertificateData?.phyto_certificate_number ? phytoCertificateData?.id : '')
                  ) ||
                  getStepSelfId(phytoStep) ||
                  extractStepRedirectId(phytoStep) ||
                  phytoStep?.redirect_id ||
                  (phytoStep as any)?.redirectId ||
                  extractLinkedPhytoCertificateId(phytoCertificateData) ||
                  canonicalPackingListId ||
                  canonicalCommercialInvoiceId ||
                  canonicalCustomInvoiceId ||
                  canonicalShipmentInstructionId ||
                  canonicalProformaId ||
                  canonicalContractId ||
                  effectiveConfirmationId ||
                  rootWorkflowId ||
                  draftId;

                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|phyto|phyto-certificate|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                const res = await savePhytoCertificateDraftAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.phyto_certificate_id;
                  if (newId) {
                    const cleanNewId = String(newId);
                    setSteps((prevSteps) =>
                      prevSteps.map((s) =>
                        isPhytoCertificateStep(s)
                          ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: s.status || 'draft' }
                          : s
                      )
                    );
                    let freshData = res.data;
                    try {
                      const freshRes = await getPhytoCertificateAction(cleanNewId, lang);
                      if (freshRes?.success && freshRes.data) {
                        freshData = freshRes.data;
                      }
                    } catch (e) {
                      console.warn('[DocumentDraftWorkspace] Re-fetch phyto certificate after save warning:', e);
                    }
                    setPhytoCertificateData((prev: any) => ({
                      ...(prev || {}),
                      ...(freshData || {}),
                      id: cleanNewId,
                      phyto_certificate_id: cleanNewId,
                    }));
                    setPhytoCertificateVersion((v) => v + 1);
                  }
                }
                return res;
              }}
              onSubmitPhytoCertificate={async (formData, id, passedNextStep) => {
                const cleanPassed = sanitizeDocId(id);
                const phytoStep = getPhytoCertificateStep(steps, selectedStep);
                const activeDocId =
                  cleanPassed ||
                  canonicalPhytoCertificateId ||
                  sanitizeDocId(
                    phytoCertificateData?.phyto_certificate_id ||
                    (phytoCertificateData?.phyto_certificate_number ? phytoCertificateData?.id : '')
                  ) ||
                  getStepSelfId(phytoStep) ||
                  extractStepRedirectId(phytoStep) ||
                  phytoStep?.redirect_id ||
                  (phytoStep as any)?.redirectId ||
                  extractLinkedPhytoCertificateId(phytoCertificateData) ||
                  canonicalPackingListId ||
                  canonicalCommercialInvoiceId ||
                  canonicalCustomInvoiceId ||
                  canonicalShipmentInstructionId ||
                  canonicalProformaId ||
                  canonicalContractId ||
                  effectiveConfirmationId ||
                  rootWorkflowId ||
                  draftId;

                const validEffectiveId =
                  activeDocId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|shipment-instruction|custom|custom-invoice|commercial|commercial-invoice|packing|packing-list|phyto|phyto-certificate|invoice|step-\d+|null|undefined|nan|\[object object\])$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                const res = await submitPhytoCertificateAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.phyto_certificate_id || validEffectiveId;
                  if (newId) {
                    const cleanNewId = String(newId);
                    setSteps((prevSteps) =>
                      prevSteps.map((s) =>
                        isPhytoCertificateStep(s)
                          ? { ...s, redirect_id: cleanNewId, redirectId: cleanNewId, status: 'completed' }
                          : s
                      )
                    );
                  }
                  let freshData = res.data;
                  try {
                    if (newId) {
                      const freshRes = await getPhytoCertificateAction(String(newId), lang);
                      if (freshRes?.success && freshRes.data) {
                        freshData = freshRes.data;
                      }
                    }
                  } catch (e) {
                    console.warn('[DocumentDraftWorkspace] Re-fetch phyto certificate after submit warning:', e);
                  }
                  setPhytoCertificateData((prev: any) => ({
                    ...(prev || {}),
                    ...(freshData || {}),
                    status: 'COMPLETED',
                    document_status: 'COMPLETED',
                    ...(newId ? { id: String(newId), phyto_certificate_id: String(newId) } : {}),
                  }));
                  setPhytoCertificateVersion((v) => v + 1);

                  let targetList = steps;
                  try {
                    const stepperRes = await getStepperListAction({
                      action: workflowAnchorType,
                      step: String(workflowAnchorId),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0 && isRealStepperList(stepperRes.data)) {
                      targetList = mergeStepperWithHidden(stepperRes.data, steps);
                      setSteps(targetList);
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit phyto certificate stepper error:', stepErr);
                  }

                  const visibleList = targetList.filter(isVisibleWorkflowStep);
                  let nextStepToSelect: StepperDocumentItem | null = null;
                  let targetIdx = -1;
                  if (passedNextStep) {
                    targetIdx = visibleList.findIndex((s) => isSameWorkflowStep(s, passedNextStep));
                    if (targetIdx >= 0) nextStepToSelect = visibleList[targetIdx];
                  }
                  if (!nextStepToSelect || targetIdx === -1) {
                    const phytoIndex = visibleList.findIndex((s) => isPhytoCertificateStep(s));
                    if (phytoIndex >= 0 && phytoIndex + 1 < visibleList.length) {
                      targetIdx = phytoIndex + 1;
                      nextStepToSelect = visibleList[targetIdx];
                    }
                  }
                  if (nextStepToSelect && targetIdx >= 0) {
                    handleSelectStep(nextStepToSelect, targetIdx);
                  }
                }
                return res;
              }}
            />
          )}
        </div>

        {/* Subsequent Workflow Steps View (Post-Phyto Certificate): Clean placeholder */}
        <div className={`w-full h-full flex-col ${!isConfirmation && !isContract && !isProforma && !isShipmentInstruction && !isBillOfLading && !isCustomInvoice && !isCommercialInvoice && !isPackingList && !isPhytoCertificate ? 'flex' : 'hidden'}`} />
      </div>

      {/* 
        Right Side: Desktop Stepper Card
        - Rendered only on desktop (lg and up) to avoid taking 100% height and squashing form on mobile
      */}
      <aside 
        id="draft-stepper-card"
        className="hidden lg:flex w-[260px] xl:w-[280px] 2xl:w-[300px] shrink-0 h-full min-h-0 bg-card border border-border rounded-xl shadow-xs flex-col relative z-20"
      >
        {/* Stepper Viewport (pinned header with internal scrollable list) */}
        <div className="w-full h-full flex flex-col p-2.5 sm:p-3 min-h-0">
          <DocumentStatusStepper
            stepperType={workflowAnchorType}
            stepperId={workflowAnchorId}
            stepId={workflowAnchorId}
            confirmationId={effectiveConfirmationId}
            initialSteps={steps}
            currentStepIndex={selectedStepIndex}
            selectedStep={selectedStep}
            activeDocNumber={stepperHeaderDocNumber}
            onSelectStep={handleSelectStep}
            onUpdateSteps={handleUpdateSteps}
            lang={lang}
            dict={dict}
            confirmationNumber={resolvedConfirmationNumber}
            contractNumber={activeStepContractNumber}
            isContractStep={isContract}
          />
        </div>
      </aside>
    </div>
    </div>
  );
}

export default DocumentDraftWorkspace;

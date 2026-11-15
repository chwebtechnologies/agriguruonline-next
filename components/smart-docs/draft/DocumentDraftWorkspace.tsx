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
  isCustomInvoiceStep,
  getContractStep,
  getProformaStep,
  getShipmentInstructionStep,
  getCustomInvoiceStep,
  getContractIdFromStepper,
  getProformaIdFromStepper,
  getConfirmationIdFromStepper,
  getShipmentInstructionIdFromStepper,
  getCustomInvoiceIdFromStepper,
  extractShipmentInstructionData,
  extractCustomInvoiceData,
  isCompleteCustomInvoiceData,
  extractLinkedCustomInvoiceId,
  sanitizeDocId,
  isRealStepperList,
  isStatusCompleted,
  DEFAULT_WORKFLOW_STEPPER_ITEMS,
  isVisibleWorkflowStep,
  isSameWorkflowStep,
  mergeStepperWithHidden,
  getWorkflowSubmitButtonInfo,
} from '@/lib/api/smart-docs.service';
import DocumentStatusStepper, { cleanDocNumber } from './DocumentStatusStepper';
import ConfirmationDocumentForm, { FormOptionItem } from './form/ConfirmationDocumentForm';
import ContractDocumentForm from './form/ContractDocumentForm';
import ProformaDocumentForm from './form/ProformaDocumentForm';
import ShipmentInstructionDocumentForm from './form/ShipmentInstructionDocumentForm';
import CustomInvoiceDocumentForm from './form/CustomInvoiceDocumentForm';
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
  getCustomInvoiceAction,
  saveCustomInvoiceDraftAction,
  submitCustomInvoiceAction,
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
    return fallback;
  }
  return String(val) || fallback;
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

export function isCompleteProformaData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const substantiveKeys = Object.keys(data).filter(
    (k) => !['id', '_id', 'proforma_id', 'proformaId', 'status', 'success', 'message', 'statusCode', 'redirect_id', 'redirectId'].includes(k)
  );
  if (substantiveKeys.length === 0) return false;
  return Boolean(
    data.invoice_number ||
    data.invoice_no ||
    data.goods_description ||
    data.seller_details ||
    data.buyer_details ||
    data.seller_id ||
    data.buyer_id ||
    data.seller ||
    data.buyer ||
    data.company_name ||
    data.seller_name ||
    data.quantity_mt ||
    data.rate_price ||
    data.contract_number ||
    data.proforma ||
    substantiveKeys.length >= 3
  );
}

export function isCompleteContractData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const substantiveKeys = Object.keys(data).filter(
    (k) => !['id', '_id', 'contract_id', 'contractId', 'status', 'success', 'message', 'statusCode', 'redirect_id', 'redirectId'].includes(k)
  );
  if (substantiveKeys.length === 0) return false;
  return Boolean(
    data.contract_number ||
    data.contract_no ||
    data.seller_details ||
    data.buyer_details ||
    data.seller_id ||
    data.buyer_id ||
    data.goods_description ||
    data.quantity_mt ||
    data.rate_price ||
    data.contract ||
    substantiveKeys.length >= 3
  );
}

export function isCompleteConfirmationData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const substantiveKeys = Object.keys(data).filter(
    (k) => !['id', '_id', 'confirmation_id', 'confirmationId', 'status', 'success', 'message', 'statusCode', 'redirect_id', 'redirectId'].includes(k)
  );
  if (substantiveKeys.length === 0) return false;
  return Boolean(
    data.confirmation_number ||
    data.contract_number ||
    data.seller_details ||
    data.buyer_details ||
    data.seller_id ||
    data.buyer_id ||
    data.goods_description ||
    data.quantity_mt ||
    data.rate_price ||
    substantiveKeys.length >= 3
  );
}

export function isCompleteShipmentInstructionData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const substantiveKeys = Object.keys(data).filter(
    (k) => !['id', '_id', 'shipment_id', 'shipmentId', 'shipment_instruction_id', 'status', 'success', 'message', 'statusCode', 'redirect_id', 'redirectId'].includes(k)
  );
  if (substantiveKeys.length === 0) return false;
  return Boolean(
    data.booking_no ||
    data.bl_number ||
    data.shipper_details ||
    data.consignee_details ||
    data.vessel_name ||
    data.port_of_loading ||
    substantiveKeys.length >= 3
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
  initialCustomInvoiceData?: any;
  initialConsignees?: any[];
  initialNotifyParties?: any[];
  initialId?: string;
  initialStepParam?: string;
}

export function getStepSlug(step?: StepperDocumentItem | null, index?: number): string {
  if (isConfirmationStep(step)) return 'confirmation';
  if (isContractStep(step)) return 'contract';
  if (isProformaStep(step)) return 'proforma';
  if (isShipmentInstructionStep(step)) return 'shipment';
  if (isCustomInvoiceStep(step)) return 'custom-invoice';

  if (step) {
    const name = String(step.document_name || step.name || step.title || '').trim().toLowerCase();
    if (name.includes('lading')) return 'bill-of-lading';
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
    if (clean === 'custom-invoice' || clean === 'custom_invoice' || clean === 'custom' || clean === 'invoice' || clean === '6') {
      if (!stepList || stepList.length === 0) return 0;
      const customIdx = stepList.findIndex((s) => isCustomInvoiceStep(s));
      return customIdx >= 0 ? customIdx : (stepList.length > 5 ? 5 : 0);
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
  initialCustomInvoiceData,
  initialConsignees = [],
  initialNotifyParties = [],
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
  const [confirmationData, setConfirmationData] = useState<any>(initialData || null);
  const [isLoadingConfirmation, setIsLoadingConfirmation] = useState<boolean>(false);
  const [contractData, setContractData] = useState<any>(initialContractData || null);
  const [isLoadingContract, setIsLoadingContract] = useState<boolean>(false);
  const [proformaData, setProformaData] = useState<any>(initialProformaData || null);
  const [isLoadingProforma, setIsLoadingProforma] = useState<boolean>(false);
  const [shipmentInstructionData, setShipmentInstructionData] = useState<any>(initialShipmentInstructionData || null);
  const [isLoadingShipmentInstruction, setIsLoadingShipmentInstruction] = useState<boolean>(false);
  const [customInvoiceData, setCustomInvoiceData] = useState<any>(initialCustomInvoiceData || null);
  const [isLoadingCustomInvoice, setIsLoadingCustomInvoice] = useState<boolean>(false);

  // Step data version counters to signal forms on stepper navigation and fresh API fetch
  const [confirmationVersion, setConfirmationVersion] = useState<number>(0);
  const [contractVersion, setContractVersion] = useState<number>(0);
  const [proformaVersion, setProformaVersion] = useState<number>(0);
  const [shipmentVersion, setShipmentVersion] = useState<number>(0);
  const [customInvoiceVersion, setCustomInvoiceVersion] = useState<number>(0);

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

  const isConfirmation = isConfirmationStep(selectedStep);
  const isContract = !isConfirmation && isContractStep(selectedStep);
  const isProforma = !isConfirmation && !isContract && isProformaStep(selectedStep);
  const isShipmentInstruction = !isConfirmation && !isContract && !isProforma && isShipmentInstructionStep(selectedStep);
  const isCustomInvoice = !isConfirmation && !isContract && !isProforma && !isShipmentInstruction && isCustomInvoiceStep(selectedStep);

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
      directContractId !== effectiveConfirmationId &&
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
      stepperContractId !== effectiveConfirmationId &&
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
      linked !== effectiveConfirmationId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(linked)
    ) {
      return linked;
    }

    // 4. Fallback to draftId ONLY if isContract is true and draftId is not confirmation ID
    const cleanDraft = sanitizeDocId(draftId);
    if (
      isContract &&
      cleanDraft &&
      cleanDraft !== effectiveConfirmationId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(cleanDraft)
    ) {
      return cleanDraft;
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

  // Canonical Proforma Document ID (strictly proforma, NEVER contract or confirmation ID)
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
      directProformaId !== effectiveConfirmationId &&
      directProformaId !== canonicalContractId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(directProformaId)
    ) {
      return directProformaId;
    }

    // 2. From Stepper step (current selection or proforma step) - strictly explicit proforma keys or redirect_id
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
      fromStepper !== effectiveConfirmationId &&
      fromStepper !== canonicalContractId &&
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
      linkedCandidate !== effectiveConfirmationId &&
      linkedCandidate !== canonicalContractId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(linkedCandidate)
    ) {
      return linkedCandidate;
    }

    // 4. Fallback to cleanDraftId ONLY if draftId is genuine proforma ID
    const cleanDraftId = sanitizeDocId(draftId);
    if (
      isProforma &&
      cleanDraftId &&
      cleanDraftId !== effectiveConfirmationId &&
      cleanDraftId !== canonicalContractId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(cleanDraftId)
    ) {
      return cleanDraftId;
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
        (data.shipment_instruction_number || data.instruction_number || data.booking_number || data.booking_no || data.bl_number || data._is_shipment_loaded)
      );

    // 1. Direct shipment instruction data
    const directShipmentId = sanitizeDocId(
      (hasShipmentMarkers(shipmentInstructionData) ? shipmentInstructionData?.id || shipmentInstructionData?._id : '') ||
      shipmentInstructionData?.shipment_instruction_id ||
      shipmentInstructionData?.instruction_id ||
      (hasShipmentMarkers(initialShipmentInstructionData) ? initialShipmentInstructionData?.id || initialShipmentInstructionData?._id : '') ||
      initialShipmentInstructionData?.shipment_instruction_id ||
      initialShipmentInstructionData?.instruction_id
    );
    if (
      directShipmentId &&
      directShipmentId !== effectiveConfirmationId &&
      directShipmentId !== canonicalContractId &&
      directShipmentId !== canonicalProformaId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(directShipmentId)
    ) {
      return directShipmentId;
    }

    // 2. From Stepper step (current selection or shipment step)
    const shipmentStep = getShipmentInstructionStep(steps, selectedStep);
    const fromStepper = sanitizeDocId(
      getStepSelfId(shipmentStep) ||
      getShipmentInstructionIdFromStepper(steps, selectedStep) ||
      shipmentStep?.shipment_instruction_id ||
      (shipmentStep as any)?.shipmentInstructionId ||
      shipmentStep?.instruction_id ||
      (shipmentStep as any)?.instructionId ||
      shipmentStep?.redirect_id ||
      (shipmentStep as any)?.redirectId
    );
    if (
      fromStepper &&
      fromStepper !== effectiveConfirmationId &&
      fromStepper !== canonicalContractId &&
      fromStepper !== canonicalProformaId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(fromStepper)
    ) {
      return fromStepper;
    }

    // 3. Linked shipment IDs from other documents
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
      linkedCandidate !== effectiveConfirmationId &&
      linkedCandidate !== canonicalContractId &&
      linkedCandidate !== canonicalProformaId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(linkedCandidate)
    ) {
      return linkedCandidate;
    }

    // 4. Fallback to cleanDraftId ONLY if draftId is genuine shipment instruction ID
    const cleanDraftId = sanitizeDocId(draftId);
    if (
      isShipmentInstruction &&
      cleanDraftId &&
      cleanDraftId !== effectiveConfirmationId &&
      cleanDraftId !== canonicalContractId &&
      cleanDraftId !== canonicalProformaId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(cleanDraftId)
    ) {
      return cleanDraftId;
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
    draftId,
    initialId,
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
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|custom|custom-invoice|invoice|step-\d+)$/i.test(directCustomId)
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
      fromStepper !== effectiveConfirmationId &&
      fromStepper !== canonicalContractId &&
      fromStepper !== canonicalProformaId &&
      fromStepper !== canonicalShipmentInstructionId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|custom|custom-invoice|invoice|step-\d+)$/i.test(fromStepper)
    ) {
      return fromStepper;
    }

    // 3. Linked custom invoice IDs from other documents
    const linkedCandidate = sanitizeDocId(
      extractLinkedCustomInvoiceId(customInvoiceData) ||
      extractLinkedCustomInvoiceId(initialCustomInvoiceData) ||
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
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|custom|custom-invoice|invoice|step-\d+)$/i.test(linkedCandidate)
    ) {
      return linkedCandidate;
    }

    const cleanDraftId = sanitizeDocId(draftId);
    if (
      isCustomInvoice &&
      cleanDraftId &&
      cleanDraftId !== effectiveConfirmationId &&
      cleanDraftId !== canonicalContractId &&
      cleanDraftId !== canonicalProformaId &&
      cleanDraftId !== canonicalShipmentInstructionId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|custom|custom-invoice|invoice|step-\d+)$/i.test(cleanDraftId)
    ) {
      return cleanDraftId;
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
    shipmentInstructionData,
    initialShipmentInstructionData,
    proformaData,
    contractData,
    confirmationData,
    isCustomInvoice,
    draftId,
    initialId,
  ]);

  // Buyer Instruction ID for Shipment Instruction (passed to consignee and notify party APIs)
  const buyerInstructionIdForShipment = useMemo(() => {
    const cand = [
      shipmentInstructionData?.buyer_instruction_id,
      shipmentInstructionData?.buyer_id,
      shipmentInstructionData?.buyerId,
      proformaData?.buyer_instruction_id,
      proformaData?.buyer_id,
      proformaData?.buyerId,
      contractData?.buyer_instruction_id,
      contractData?.buyer_id,
      contractData?.buyerId,
      confirmationData?.buyer_instruction_id,
      confirmationData?.buyer_id,
      confirmationData?.buyerId,
      initialContractData?.buyer_instruction_id,
      initialContractData?.buyer_id,
      initialData?.buyer_instruction_id,
      initialData?.buyer_id,
    ];
    for (const c of cand) {
      const clean = sanitizeDocId(c);
      if (clean) return clean;
    }
    return '';
  }, [shipmentInstructionData, proformaData, contractData, confirmationData, initialContractData, initialData]);

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
    return cleanDocNumber(
      contractData?.contract_number ||
      contractData?.contractNumber ||
      contractData?.contract_no ||
      contractData?.contract?.contract_number ||
      contractData?.contract?.contract_no ||
      initialContractData?.contract_number ||
      initialContractData?.contractNumber ||
      initialContractData?.contract_no ||
      initialContractData?.contract?.contract_number ||
      initialContractData?.contract?.contract_no ||
      steps.find((s) => isContractStep(s))?.contract_number
    );
  }, [contractData, initialContractData, steps]);

  // Active document ID and type for stepper:
  // "document id hi stepper me pass karo jis step se aaye hai form me button se si ki id contract ki id ya confirmation ki id vo hi stepper ki api me same pass karni hai"
  // The true workflow root action and ID anchoring this entire document workflow.
  // Confirmation ID is the primary root of the entire trade deal workflow.
  // If the deal was started directly as a contract without confirmation, contract ID is the root.
  const workflowAnchorType = useMemo(() => {
    if (effectiveConfirmationId) return 'confirmation';
    if (canonicalContractId) return 'contract';
    return 'confirmation';
  }, [effectiveConfirmationId, canonicalContractId]);

  const workflowAnchorId = useMemo(() => {
    return (
      effectiveConfirmationId ||
      canonicalContractId ||
      initialId ||
      draftId ||
      'new-confirmation'
    );
  }, [effectiveConfirmationId, canonicalContractId, initialId, draftId]);

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
            initialData?._id
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
            initialData?.confirmation_status
          );
          if (isDone && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          } else if (!isDone && normalizeStepStatus(step.status) === 'completed') {
            newStep.status = confirmationData?.status || initialData?.status || 'draft';
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
            initialContractData?._id
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
            initialContractData?.contract_status
          );
          if (isDone && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          } else if (!isDone && normalizeStepStatus(step.status) === 'completed') {
            newStep.status = contractData?.status || initialContractData?.status || 'pending';
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
            initialProformaData?._id
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
            initialProformaData?.proforma_status
          );
          if (isDone && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          } else if (!isDone && normalizeStepStatus(step.status) === 'completed') {
            newStep.status = proformaData?.status || initialProformaData?.status || 'pending';
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
          } else if (!isDone && normalizeStepStatus(step.status) === 'completed') {
            newStep.status = shipmentInstructionData?.status || initialShipmentInstructionData?.status || 'pending';
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
          } else if (!isDone && normalizeStepStatus(step.status) === 'completed') {
            newStep.status = customInvoiceData?.status || initialCustomInvoiceData?.status || 'pending';
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
    customInvoiceData,
    initialCustomInvoiceData,
    effectiveConfirmationId,
    canonicalContractId,
    canonicalProformaId,
    canonicalShipmentInstructionId,
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
    if (isCustomInvoice) {
      return (
        canonicalCustomInvoiceId ||
        customInvoiceData?.custom_invoice_id ||
        customInvoiceData?.id ||
        customInvoiceData?._id ||
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
    isCustomInvoice,
    effectiveConfirmationId,
    confirmationData,
    canonicalContractId,
    contractData,
    canonicalProformaId,
    proformaData,
    canonicalShipmentInstructionId,
    shipmentInstructionData,
    canonicalCustomInvoiceId,
    customInvoiceData,
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
    selectedStep,
    selectedStepIndex,
  ]);

  const attemptedContractFetchRef = useRef<string | null>(null);
  const attemptedProformaFetchRef = useRef<string | null>(null);
  const attemptedShipmentFetchRef = useRef<string | null>(null);
  const activeFetchSeqRef = useRef<number>(0);

  // Centralized step data fetcher: fetches the latest document data and refreshes stepper metadata
  const fetchLatestStepData = useCallback(
    async (targetStep: StepperDocumentItem | null | undefined, targetIndex: number, currentSeq: number) => {
      const isTargetConfirmation = isConfirmationStep(targetStep);
      const isTargetContract = !isTargetConfirmation && isContractStep(targetStep);
      const isTargetProforma = !isTargetConfirmation && !isTargetContract && isProformaStep(targetStep);
      const isTargetShipment = !isTargetConfirmation && !isTargetContract && !isTargetProforma && isShipmentInstructionStep(targetStep);
      const isTargetCustomInvoice = !isTargetConfirmation && !isTargetContract && !isTargetProforma && !isTargetShipment && isCustomInvoiceStep(targetStep);

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
                freshProformaId !== candidateId
              ) {
                getProformaAction(freshProformaId, lang)
                  .then((freshRes) => {
                    if (activeFetchSeqRef.current === currentSeq && freshRes?.success && freshRes.data) {
                      const extracted = extractProformaData(freshRes.data) || freshRes.data;
                      if (extracted) {
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
          targetStep?.instruction_id ||
          extractStepRedirectId(targetStep) ||
          extractStepId(targetStep) ||
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
                const extracted = extractShipmentInstructionData(res.data);
                if (extracted && isCompleteShipmentInstructionData(extracted)) {
                  setShipmentInstructionData(extracted);
                  setShipmentVersion((v) => v + 1);
                } else if (res.data && typeof res.data === 'object') {
                  setShipmentInstructionData(res.data);
                  setShipmentVersion((v) => v + 1);
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

      if (isTargetCustomInvoice) {
        setIsLoadingCustomInvoice(true);

        const candidateId = sanitizeDocId(
          (stepSelfId && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|custom|custom-invoice|invoice|step-\d+)$/i.test(stepSelfId) ? stepSelfId : '') ||
          targetStep?.custom_invoice_id ||
          (targetStep as any)?.customInvoiceId ||
          targetStep?.invoice_id ||
          extractStepRedirectId(targetStep) ||
          extractStepId(targetStep) ||
          getCustomInvoiceIdFromStepper(steps, targetStep) ||
          canonicalCustomInvoiceId ||
          extractLinkedCustomInvoiceId(customInvoiceData) ||
          extractLinkedCustomInvoiceId(shipmentInstructionData) ||
          extractLinkedCustomInvoiceId(proformaData) ||
          extractLinkedCustomInvoiceId(contractData) ||
          (customInvoiceData?.custom_invoice_number ? customInvoiceData?.id || customInvoiceData?.custom_invoice_id : '')
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

        if (candidateId && !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|custom|custom-invoice|invoice|step-\d+)$/i.test(candidateId)) {
          try {
            const res = await getCustomInvoiceAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq) {
              if (res?.success && res.data) {
                const extracted = extractCustomInvoiceData(res.data);
                if (extracted && isCompleteCustomInvoiceData(extracted)) {
                  setCustomInvoiceData(extracted);
                  setCustomInvoiceVersion((v) => v + 1);
                } else if (res.data && typeof res.data === 'object') {
                  setCustomInvoiceData(res.data);
                  setCustomInvoiceVersion((v) => v + 1);
                }
              }
            }
          } catch (err) {
            console.warn('[DocumentDraftWorkspace] Error fetching latest custom invoice:', err);
          } finally {
            if (activeFetchSeqRef.current === currentSeq) {
              setIsLoadingCustomInvoice(false);
            }
          }
        } else {
          if (activeFetchSeqRef.current === currentSeq) {
            setIsLoadingCustomInvoice(false);
            setCustomInvoiceVersion((v) => v + 1);
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
      customInvoiceData,
      canonicalContractId,
      canonicalProformaId,
      canonicalShipmentInstructionId,
      canonicalCustomInvoiceId,
      effectiveConfirmationId,
      rootWorkflowId,
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
      attemptedCustomInvoiceFetchRef.current = null;

      const isSelectingConfirmation = isConfirmationStep(step);
      const isSelectingContract = !isSelectingConfirmation && isContractStep(step);
      const isSelectingProforma = !isSelectingConfirmation && !isSelectingContract && isProformaStep(step);
      const isSelectingShipment = !isSelectingConfirmation && !isSelectingContract && !isSelectingProforma && isShipmentInstructionStep(step);
      const isSelectingCustomInvoice = !isSelectingConfirmation && !isSelectingContract && !isSelectingProforma && !isSelectingShipment && isCustomInvoiceStep(step);

      if (isSelectingConfirmation) {
        setConfirmationVersion((v) => v + 1);
      } else if (isSelectingContract) {
        setContractVersion((v) => v + 1);
      } else if (isSelectingProforma) {
        setProformaVersion((v) => v + 1);
      } else if (isSelectingShipment) {
        setShipmentVersion((v) => v + 1);
      } else if (isSelectingCustomInvoice) {
        setCustomInvoiceVersion((v) => v + 1);
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
      if (isSelectingCustomInvoice && !isCompleteCustomInvoiceData(customInvoiceData) && !isCompleteCustomInvoiceData(initialCustomInvoiceData) && (stepSelfId || getCustomInvoiceIdFromStepper(steps, step) || canonicalCustomInvoiceId)) {
        setIsLoadingCustomInvoice(true);
      }

      const slug = getStepSlug(step, resolvedIndex);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const specificDocId = isSelectingCustomInvoice
          ? canonicalCustomInvoiceId
          : isSelectingShipment
          ? canonicalShipmentInstructionId
          : isSelectingContract
          ? canonicalContractId
          : isSelectingProforma
          ? canonicalProformaId
          : effectiveConfirmationId;

        const targetStepDocId = specificDocId || effectiveConfirmationId || rootWorkflowId || initialId;

        if (targetStepDocId) {
          url.searchParams.set('id', targetStepDocId);
        }
        url.searchParams.set('step', slug);
        window.history.replaceState(null, '', url.toString());
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
      customInvoiceData,
      initialCustomInvoiceData,
      canonicalCustomInvoiceId,
      rootWorkflowId,
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

  const pageTitle = isContract
    ? dict?.smart_docs?.draft_contract_title || dict?.smart_docs?.draft_contract || 'Draft Contract'
    : isProforma
    ? dict?.smart_docs?.draft_proforma_title || 'Proforma Invoice'
    : isShipmentInstruction
    ? 'Shipment Instruction'
    : dict?.smart_docs?.draft_title ||
      dict?.smart_docs?.add_new_confirmation ||
      dict?.smart_docs?.add_confirmation ||
      'Draft Confirmation';

  // Synchronize document.title dynamically when switching steps
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `${pageTitle} | Smart Docs | AgriGuru Online`;
    }
  }, [pageTitle]);

  useEffect(() => {
    if (initialContractData) {
      setContractData((prev: any) => {
        if (!prev) return initialContractData;
        return { ...initialContractData, ...prev };
      });
    }
  }, [initialContractData]);

  useEffect(() => {
    if (initialData) {
      setConfirmationData((prev: any) => {
        if (!prev) return initialData;
        return { ...initialData, ...prev };
      });
    }
  }, [initialData]);

  useEffect(() => {
    if (initialProformaData) {
      setProformaData((prev: any) => {
        if (!prev) return initialProformaData;
        return { ...initialProformaData, ...prev };
      });
    }
  }, [initialProformaData]);

  useEffect(() => {
    if (initialShipmentInstructionData) {
      setShipmentInstructionData((prev: any) => {
        if (!prev) return initialShipmentInstructionData;
        return { ...initialShipmentInstructionData, ...prev };
      });
    }
  }, [initialShipmentInstructionData]);

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
            setConfirmationData(extractConfirmationData(res.data));
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
            setContractData(extractContractData(res.data));
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
  }, [canonicalContractId, contractIdFromStepper, steps, contractData, initialContractData, lang]);

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
            const extracted = extractProformaData(res.data);
            if (extracted) {
              setProformaData(extracted);
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
  }, [canonicalProformaId, proformaData, initialProformaData, lang]);

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
            const extracted = extractShipmentInstructionData(res.data);
            if (extracted) {
              setShipmentInstructionData(extracted);
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

  const attemptedCustomInvoiceFetchRef = useRef<string | null>(null);

  // Fetch custom invoice data dynamically only if custom invoice step is active and not loaded
  useEffect(() => {
    if (!isCustomInvoice || isCompleteCustomInvoiceData(customInvoiceData) || isCompleteCustomInvoiceData(initialCustomInvoiceData)) {
      return;
    }

    const effectiveId = canonicalCustomInvoiceId;
    if (!effectiveId) {
      setIsLoadingCustomInvoice(false);
      return;
    }

    if (attemptedCustomInvoiceFetchRef.current !== effectiveId) {
      attemptedCustomInvoiceFetchRef.current = effectiveId;
      setIsLoadingCustomInvoice(true);
      getCustomInvoiceAction(effectiveId, lang)
        .then((res) => {
          if (res?.success && res.data) {
            const extracted = extractCustomInvoiceData(res.data);
            if (extracted) {
              setCustomInvoiceData(extracted);
            }
          }
        })
        .catch((err) => {
          console.warn('[DocumentDraftWorkspace] Error fetching custom invoice dynamically:', err);
        })
        .finally(() => {
          setIsLoadingCustomInvoice(false);
        });
    }
  }, [isCustomInvoice, canonicalCustomInvoiceId, customInvoiceData, initialCustomInvoiceData, lang]);

  const activeDocName =
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
      : isCustomInvoice
      ? 'Custom Invoice'
      : dict?.smart_docs?.draft_title || 'Trade Confirmation');

  // Once contract number is generated, it ALWAYS takes priority everywhere (even on confirmation step!)
  const mobileActiveDocNumber = resolvedContractNumber || resolvedConfirmationNumber;

  const mobileActiveDocLabel = resolvedContractNumber
    ? (dict?.smart_docs?.contract_form?.contract_number || 'Contract No.')
    : (dict?.smart_docs?.confirmation_form?.confirmation_number || 'Confirmation No.');

  // Comprehensive data merge for Custom Invoice so trade context (goods, quantities, rates, buyer/seller, notify parties) is never lost
  const mergedCustomInvoiceData = useMemo(() => {
    const sources = [
      initialData,
      confirmationData,
      contractData,
      initialContractData,
      proformaData,
      initialProformaData,
      shipmentInstructionData,
      initialShipmentInstructionData,
      initialCustomInvoiceData,
      customInvoiceData,
    ];
    const merged: Record<string, any> = {};
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const [key, val] of Object.entries(src)) {
        if (val === undefined || val === null || val === '') continue;
        if (
          (src !== customInvoiceData && src !== initialCustomInvoiceData) &&
          (
            key === 'bank_details_id' ||
            key === 'bank_account_id' ||
            key === 'bank_details' ||
            key === 'bank_account_details' ||
            key === 'special_instruction' ||
            key === 'special_note' ||
            key === 'remarks_title' ||
            key === 'remarks_comment' ||
            key === 'comment' ||
            key === 'comment_title' ||
            key === 'comment_label' ||
            key === 'comment_value' ||
            key === 'comment_text' ||
            key === 'extra_title' ||
            key === 'extra_comment' ||
            key === 'notes_title' ||
            key === 'notes_comment' ||
            key === 'title' ||
            key === 'pdf_title' ||
            key === 'document_title'
          )
        ) {
          continue;
        }
        if (typeof val === 'string' && /PLEASE DO NOT MENTION INVOICE NUMBER/i.test(val)) {
          continue;
        }
        if (
          (src === proformaData || src === initialProformaData) &&
          (key === 'disclaimer' || key === 'bank_charges_note')
        ) {
          continue;
        }
        if (
          (key === 'total_value' ||
            key === 'total_amount' ||
            key === 'price' ||
            key === 'rate' ||
            key === 'rate_price' ||
            key === 'quantity_mt' ||
            key === 'mt_quantity') &&
          val === 0 &&
          merged[key] &&
          merged[key] > 0
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
    contractData,
    initialContractData,
    proformaData,
    initialProformaData,
    shipmentInstructionData,
    initialShipmentInstructionData,
    initialCustomInvoiceData,
    customInvoiceData,
  ]);

  // Comprehensive data merge for Shipment Instruction so trade context (goods, quantities, vessel, ports, buyer/seller, notify parties) is never lost
  const mergedShipmentInstructionData = useMemo(() => {
    const sources = [
      initialData,
      confirmationData,
      contractData,
      initialContractData,
      proformaData,
      initialProformaData,
      initialShipmentInstructionData,
      shipmentInstructionData,
    ];
    const merged: Record<string, any> = {};
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const [key, val] of Object.entries(src)) {
        if (val === undefined || val === null || val === '') continue;
        if (
          (src !== shipmentInstructionData && src !== initialShipmentInstructionData) &&
          (
            key === 'id' ||
            key === '_id' ||
            key === 'title' ||
            key === 'pdf_title' ||
            key === 'document_title' ||
            key === 'special_instruction' ||
            key === 'special_note' ||
            key === 'remarks_title' ||
            key === 'remarks_comment' ||
            key === 'comment' ||
            key === 'comment_title' ||
            key === 'comment_label' ||
            key === 'comment_value' ||
            key === 'comment_text'
          )
        ) {
          continue;
        }
        if (
          (key === 'total_value' ||
            key === 'total_amount' ||
            key === 'quantity_mt' ||
            key === 'mt_quantity') &&
          val === 0 &&
          merged[key] &&
          merged[key] > 0
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
    contractData,
    initialContractData,
    proformaData,
    initialProformaData,
    initialShipmentInstructionData,
    shipmentInstructionData,
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
                    {mobileActiveDocLabel}:
                  </span>
                  <span className="truncate font-mono">{mobileActiveDocNumber}</span>
                </div>
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {dict?.smart_docs?.document_status || 'Document Step'}
                {steps.length > 0 ? ` (${selectedStepIndex + 1}/${steps.length})` : ''}
              </span>
              <span className="text-xs font-bold text-foreground truncate">
                {activeDocName}
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
              onSelectStep={handleSelectStep}
              onUpdateSteps={handleUpdateSteps}
              lang={lang}
              dict={dict}
              confirmationNumber={resolvedConfirmationNumber}
              contractNumber={resolvedContractNumber}
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
        <div className={`w-full h-full flex flex-col ${isConfirmation ? 'flex' : 'hidden'}`}>
          <ConfirmationDocumentForm
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
                  url.searchParams.set('id', savedId);
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
                setConfirmationData((prev: any) => ({
                  ...(prev || {}),
                  ...(res.data || {}),
                  ...(confNum ? { confirmation_number: confNum } : {}),
                  id: res.id || prev?.id,
                  _id: res.id || prev?._id,
                }));
              }
              return res;
            }}
            onSelectStep={handleSelectStep}
            onSubmitContract={async (formData, passedNextStep) => {
              const res = await submitConfirmationAction(formData, lang);
              if (res?.success) {
                const newId =
                  res.id ||
                  res.data?.id ||
                  res.data?.contract_id ||
                  res.data?.confirmation_id ||
                  formData?.id ||
                  draftId;
                if (newId) {
                  setDraftId(String(newId));
                }
                const confNum =
                  res.data?.confirmation_number ||
                  res.data?.confirmationNumber ||
                  res.data?.confirmation?.confirmation_number ||
                  formData?.confirmation_number;
                if (confNum) {
                  setConfirmationData((prev: any) => ({
                    ...(prev || {}),
                    confirmation_number: confNum,
                  }));
                }
                if (res.data) {
                  const extracted = extractContractData(res.data) || res.data;
                  setContractData(extracted);
                }

                // Update stepper to reflect completion and switch to next step
                try {
                  const stepperParam = workflowAnchorId;
                  const stepperRes = await getStepperListAction({
                    action: workflowAnchorType,
                    step: String(stepperParam),
                    lang,
                  });
                  let targetList = steps;
                  if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                    targetList = mergeStepperWithHidden(stepperRes.data, steps);
                    setSteps(targetList);
                  }
                  const visibleList = targetList.filter(isVisibleWorkflowStep);
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
                    }
                  }
                  if (nextStepToSelect && targetIdx >= 0) {
                    handleSelectStep(nextStepToSelect, targetIdx);
                  }
                } catch (stepErr) {
                  console.error('[DocumentDraftWorkspace] Stepper refresh error:', stepErr);
                }
              }
              return res;
            }}
          />
        </div>

        {/* Contract Document Form: Visible when Contract Step is active */}
        <div className={`w-full h-full flex flex-col ${isContract ? 'flex' : 'hidden'}`}>
          <ContractDocumentForm
            dataVersion={contractVersion}
              initialData={
                contractData || initialContractData || (isCompleteConfirmationData(confirmationData) ? confirmationData : initialData)
              }
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
                  const contNum =
                    savedData?.contract_number ||
                    savedData?.contractNumber ||
                    savedData?.contract_no ||
                    savedData?.contract?.contract_number;
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
                    const targetWorkflowId = rootWorkflowId || effectiveConfirmationId || canonicalContractId || savedId;
                    if (targetWorkflowId) {
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
                    const contNum =
                      extracted?.contract_number ||
                      extracted?.contractNumber ||
                      extracted?.contract_no ||
                      res.data?.contract_number ||
                      res.data?.contractNumber ||
                      (typeof formData?.get === 'function' ? formData.get('contract_number') : null);
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
                      if (isFormData && (formData.get('remove_broker_signature') === 'true' || formData.get('broker_signature') === '')) {
                        updated.broker_signature = null;
                        updated.broker_signature_url = null;
                        updated.sales_broker_signature = null;
                        updated.sales_broker_signature_url = null;
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
                  const newId = res.id || res.data?.id || res.data?.contract_id || (res as any)?.contract_id;
                  if (newId && !effectiveConfirmationId) {
                    setDraftId(String(newId));
                  }
                  if (res.data) {
                    const extracted = extractContractData(res.data) || res.data;
                    const contNum =
                      extracted?.contract_number ||
                      extracted?.contractNumber ||
                      extracted?.contract_no ||
                      res.data?.contract_number ||
                      res.data?.contractNumber ||
                      (typeof formData?.get === 'function' ? formData.get('contract_number') : null);
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
                      if (isFormData && (formData.get('remove_broker_signature') === 'true' || formData.get('broker_signature') === '')) {
                        updated.broker_signature = null;
                        updated.broker_signature_url = null;
                        updated.sales_broker_signature = null;
                        updated.sales_broker_signature_url = null;
                      }
                      return updated;
                    });
                  }
                  // Update stepper to reflect completion and switch to next step
                  try {
                    const stepperParam = workflowAnchorId;
                    const stepperRes = await getStepperListAction({
                      action: workflowAnchorType,
                      step: String(stepperParam),
                      lang,
                    });
                    let targetList = steps;
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                      targetList = mergeStepperWithHidden(stepperRes.data, steps);
                      setSteps(targetList);
                    }
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
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit contract stepper error:', stepErr);
                  }
                }
                return res;
              }}
            />
        </div>

        {/* Proforma Invoice Document Form: Visible when Proforma Step is active */}
        <div className={`w-full h-full flex flex-col ${isProforma ? 'flex' : 'hidden'}`}>
          <ProformaDocumentForm
            key={`proforma-${canonicalProformaId || (proformaData?.id ? String(proformaData.id) : 'default')}`}
            dataVersion={proformaVersion}
              initialData={
                proformaData || initialProformaData || contractData || initialContractData || confirmationData || initialData
              }
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
                    const targetWorkflowId = rootWorkflowId || effectiveConfirmationId || canonicalContractId;
                    if (targetWorkflowId) {
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
                  try {
                    const stepperParam = workflowAnchorId;
                    const stepperRes = await getStepperListAction({
                      action: workflowAnchorType,
                      step: String(stepperParam),
                      lang,
                    });
                    let targetList = steps;
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                      targetList = mergeStepperWithHidden(stepperRes.data, steps);
                      setSteps(targetList);
                    }
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
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit proforma stepper error:', stepErr);
                  }
                }
                return res;
              }}
            />
        </div>

        {/* Shipment Instruction Document Form: Visible when Shipment Instruction Step is active */}
        <div className={`w-full h-full flex flex-col ${isShipmentInstruction ? 'flex' : 'hidden'}`}>
          <ShipmentInstructionDocumentForm
            key={`shipment-${canonicalShipmentInstructionId || (shipmentInstructionData?.id ? String(shipmentInstructionData.id) : 'default')}`}
            dataVersion={shipmentVersion}
            initialData={mergedShipmentInstructionData}
              buyerInstructionId={buyerInstructionIdForShipment}
              instructionId={canonicalShipmentInstructionId}
              shipmentInstructionId={canonicalShipmentInstructionId}
              initialConsignees={initialConsignees}
              initialNotifyParties={initialNotifyParties}
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
                    const targetWorkflowId = rootWorkflowId || effectiveConfirmationId || canonicalContractId;
                    if (targetWorkflowId) {
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

                  try {
                    const stepperParam = workflowAnchorId;
                    const stepperRes = await getStepperListAction({
                      action: workflowAnchorType,
                      step: String(stepperParam),
                      lang,
                    });
                    let targetList = steps;
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                      targetList = mergeStepperWithHidden(stepperRes.data, steps);
                      setSteps(targetList);
                    }
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
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit shipment stepper error:', stepErr);
                  }
                }
                return res;
              }}
            />
        </div>

        {/* Custom Invoice Document Form: Visible when Custom Invoice Step is active */}
        <div className={`w-full h-full flex flex-col ${isCustomInvoice ? 'flex' : 'hidden'}`}>
          <CustomInvoiceDocumentForm
            key={`custom-invoice-${canonicalCustomInvoiceId || (customInvoiceData?.id ? String(customInvoiceData.id) : 'default')}`}
            dataVersion={customInvoiceVersion}
            initialData={mergedCustomInvoiceData}
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
                    const targetWorkflowId = rootWorkflowId || effectiveConfirmationId || canonicalContractId;
                    if (targetWorkflowId) {
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

                  try {
                    const stepperParam = workflowAnchorId;
                    const stepperRes = await getStepperListAction({
                      action: workflowAnchorType,
                      step: String(stepperParam),
                      lang,
                    });
                    let targetList = steps;
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                      targetList = mergeStepperWithHidden(stepperRes.data, steps);
                      setSteps(targetList);
                    }
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
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit custom invoice stepper error:', stepErr);
                  }
                }
                return res;
              }}
            />
        </div>

        {/* Subsequent Workflow Steps View (Post-Custom Invoice): Clean placeholder */}
        <div className={`w-full h-full flex-col ${!isConfirmation && !isContract && !isProforma && !isShipmentInstruction && !isCustomInvoice ? 'flex' : 'hidden'}`} />
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
            onSelectStep={handleSelectStep}
            onUpdateSteps={handleUpdateSteps}
            lang={lang}
            dict={dict}
            confirmationNumber={resolvedConfirmationNumber}
            contractNumber={resolvedContractNumber}
            isContractStep={isContract}
          />
        </div>
      </aside>
    </div>
    </div>
  );
}

export default DocumentDraftWorkspace;

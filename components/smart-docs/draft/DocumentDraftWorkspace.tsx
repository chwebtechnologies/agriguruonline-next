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
  getContractStep,
  getProformaStep,
  getShipmentInstructionStep,
  getContractIdFromStepper,
  getProformaIdFromStepper,
  getConfirmationIdFromStepper,
  getShipmentInstructionIdFromStepper,
  extractShipmentInstructionData,
  sanitizeDocId,
  isRealStepperList,
  DEFAULT_WORKFLOW_STEPPER_ITEMS,
} from '@/lib/api/smart-docs.service';
import DocumentStatusStepper, { cleanDocNumber } from './DocumentStatusStepper';
import ConfirmationDocumentForm, { FormOptionItem } from './form/ConfirmationDocumentForm';
import ContractDocumentForm from './form/ContractDocumentForm';
import ProformaDocumentForm from './form/ProformaDocumentForm';
import ShipmentInstructionDocumentForm from './form/ShipmentInstructionDocumentForm';
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
  initialId?: string;
  initialStepParam?: string;
}

export function getStepSlug(step?: StepperDocumentItem | null, index?: number): string {
  if (index === 0 || isConfirmationStep(step, index)) return 'confirmation';
  if (index === 1 || isContractStep(step, index)) return 'contract';
  if (index === 2 || isProformaStep(step, index)) return 'proforma';
  if (index === 3 || isShipmentInstructionStep(step, index)) return 'shipment';
  if (step?.id) return String(step.id);
  return `step-${(index ?? 0) + 1}`;
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
      if (!stepList || stepList.length === 0) return 1;
      const contractIdx = stepList.findIndex((s, idx) => isContractStep(s, idx));
      return contractIdx >= 0 ? contractIdx : (stepList.length > 1 ? 1 : 1);
    }
    if (clean === 'proforma' || clean === '3') {
      if (!stepList || stepList.length === 0) return 2;
      const proformaIdx = stepList.findIndex((s, idx) => isProformaStep(s, idx));
      return proformaIdx >= 0 ? proformaIdx : (stepList.length > 2 ? 2 : 2);
    }
    if (clean === 'shipment' || clean === 'shipment_instruction' || clean === 'shipment-instruction' || clean === 'instruction' || clean === 'document' || clean === '4') {
      if (!stepList || stepList.length === 0) return 3;
      const shipmentIdx = stepList.findIndex((s, idx) => isShipmentInstructionStep(s, idx));
      return shipmentIdx >= 0 ? shipmentIdx : (stepList.length > 3 ? 3 : 3);
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

  const isConfirmation = selectedStepIndex === 0 || isConfirmationStep(selectedStep, selectedStepIndex);
  const isContract = !isConfirmation && (selectedStepIndex === 1 || isContractStep(selectedStep, selectedStepIndex));
  const isProforma = !isConfirmation && !isContract && (selectedStepIndex === 2 || isProformaStep(selectedStep, selectedStepIndex));
  const isShipmentInstruction = !isConfirmation && !isContract && !isProforma && (selectedStepIndex === 3 || isShipmentInstructionStep(selectedStep, selectedStepIndex));

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
    const stepperConfStep = steps.find((s, idx) => isConfirmationStep(s, idx)) || steps[0];
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
    // 1. Direct contract data
    const directContractId = sanitizeDocId(
      contractData?.id ||
      contractData?._id ||
      contractData?.contract_id ||
      contractData?.contractId ||
      initialContractData?.id ||
      initialContractData?._id ||
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

    // 2. Stepper list Step 1 (Sales Contract) redirect_id
    const stepperContractStep = steps.find((s, idx) => isContractStep(s, idx)) || steps[1];
    const stepperContractId = sanitizeDocId(
      contractIdFromStepper ||
      getStepSelfId(stepperContractStep) ||
      stepperContractStep?.redirect_id ||
      stepperContractStep?.redirectId
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

    // 4. Fallback to draftId ONLY if isContract is true
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
  ]);

  // Canonical Proforma Document ID (strictly proforma, NEVER contract or confirmation ID)
  const canonicalProformaId = useMemo(() => {
    // 1. Direct proforma data
    const directProformaId = sanitizeDocId(
      proformaData?.id ||
      proformaData?._id ||
      proformaData?.proforma_id ||
      proformaData?.proformaId ||
      initialProformaData?.id ||
      initialProformaData?._id ||
      initialProformaData?.proforma_id ||
      initialProformaData?.proformaId
    );
    if (
      directProformaId &&
      directProformaId !== effectiveConfirmationId &&
      directProformaId !== canonicalContractId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(directProformaId)
    ) {
      return directProformaId;
    }

    // 2. From Stepper step (current selection or proforma step)
    const proformaStep = getProformaStep(steps, selectedStep);
    const fromStepper = sanitizeDocId(
      getStepSelfId(proformaStep) ||
      getProformaIdFromStepper(steps, selectedStep) ||
      proformaStep?.redirect_id ||
      proformaStep?.redirectId
    );
    if (
      fromStepper &&
      fromStepper !== effectiveConfirmationId &&
      fromStepper !== canonicalContractId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(fromStepper)
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
      !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(linkedCandidate)
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
      !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(cleanDraftId)
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
  ]);

  // Canonical Shipment Instruction Document ID
  const canonicalShipmentInstructionId = useMemo(() => {
    // 1. Direct shipment instruction data
    const directShipmentId = sanitizeDocId(
      shipmentInstructionData?.id ||
      shipmentInstructionData?._id ||
      shipmentInstructionData?.shipment_instruction_id ||
      shipmentInstructionData?.instruction_id ||
      initialShipmentInstructionData?.id ||
      initialShipmentInstructionData?._id ||
      initialShipmentInstructionData?.shipment_instruction_id ||
      initialShipmentInstructionData?.instruction_id
    );
    if (
      directShipmentId &&
      directShipmentId !== effectiveConfirmationId &&
      directShipmentId !== canonicalContractId &&
      directShipmentId !== canonicalProformaId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|proforma|shipment|step-\d+)$/i.test(directShipmentId)
    ) {
      return directShipmentId;
    }

    // 2. From Stepper step (current selection or shipment step)
    const shipmentStep = getShipmentInstructionStep(steps, selectedStep);
    const fromStepper = sanitizeDocId(
      getStepSelfId(shipmentStep) ||
      getShipmentInstructionIdFromStepper(steps, selectedStep) ||
      shipmentStep?.redirect_id ||
      shipmentStep?.redirectId
    );
    if (
      fromStepper &&
      fromStepper !== effectiveConfirmationId &&
      fromStepper !== canonicalContractId &&
      fromStepper !== canonicalProformaId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|proforma|shipment|step-\d+)$/i.test(fromStepper)
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
      !/^(contract|confirmation|new-confirmation|sales-contract|proforma|shipment|step-\d+)$/i.test(linkedCandidate)
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
      !/^(contract|confirmation|new-confirmation|sales-contract|proforma|shipment|step-\d+)$/i.test(cleanDraftId)
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
      steps[0]?.confirmation_number ||
      steps.find((s, idx) => isConfirmationStep(s, idx))?.confirmation_number
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
      steps[1]?.contract_number ||
      steps.find((s, idx) => isContractStep(s, idx))?.contract_number
    );
  }, [contractData, initialContractData, steps]);

  // Active document ID and type for stepper:
  // "document id hi stepper me pass karo jis step se aaye hai form me button se si ki id contract ki id ya confirmation ki id vo hi stepper ki api me same pass karni hai"
  const activeStepperId = useMemo(() => {
    if (isShipmentInstruction) {
      return canonicalShipmentInstructionId || initialId || draftId || '';
    }
    if (isContract) {
      return canonicalContractId || initialId || draftId || '';
    }
    if (isProforma) {
      return canonicalProformaId || initialId || draftId || '';
    }
    return effectiveConfirmationId || initialId || draftId || '';
  }, [
    isShipmentInstruction,
    isContract,
    isProforma,
    canonicalShipmentInstructionId,
    canonicalContractId,
    canonicalProformaId,
    effectiveConfirmationId,
    initialId,
    draftId,
  ]);

  const activeStepperType = useMemo(() => {
    if (isShipmentInstruction) return 'document';
    if (isContract) return 'contract';
    if (isProforma) return 'document';
    return 'confirmation';
  }, [isShipmentInstruction, isContract, isProforma]);

  const rootWorkflowId = useMemo(() => {
    return activeStepperId || effectiveConfirmationId || canonicalContractId || initialId || '';
  }, [activeStepperId, effectiveConfirmationId, canonicalContractId, initialId]);

  const workflowAnchorType = activeStepperType;
  const workflowAnchorId = activeStepperId || rootWorkflowId || initialId || '';

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
      const active = steps[selectedStepIndex] || steps[0];
      setSelectedStep(active);
    }
  }, [steps, selectedStepIndex]);

  // Synchronize step status and redirect IDs in stepper based on loaded/completed document data
  useEffect(() => {
    setSteps((prevSteps) => {
      let changed = false;
      const updated = prevSteps.map((step, idx) => {
        let newStep = { ...step };

        // Step 0: Confirmation
        if (isConfirmationStep(step, idx)) {
          const confId = sanitizeDocId(
            confirmationData?.id ||
            confirmationData?._id ||
            confirmationData?.confirmation_id ||
            initialData?.id ||
            initialData?._id
          );
          const isComplete = isCompleteConfirmationData(confirmationData) || isCompleteConfirmationData(initialData);
          if (confId && (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))) {
            newStep.redirect_id = confId;
            newStep.redirectId = confId;
            changed = true;
          }
          if (isComplete && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          }
        }

        // Step 1: Contract
        if (isContractStep(step, idx)) {
          const contractId = sanitizeDocId(
            contractData?.id ||
            contractData?._id ||
            contractData?.contract_id ||
            initialContractData?.id ||
            initialContractData?._id
          );
          const isComplete = isCompleteContractData(contractData) || isCompleteContractData(initialContractData);
          if (contractId && (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))) {
            newStep.redirect_id = contractId;
            newStep.redirectId = contractId;
            changed = true;
          }
          if (isComplete && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          }
        }

        // Step 2: Proforma
        if (isProformaStep(step, idx)) {
          const proformaId = sanitizeDocId(
            proformaData?.id ||
            proformaData?._id ||
            proformaData?.proforma_id ||
            initialProformaData?.id ||
            initialProformaData?._id
          );
          const isComplete = isCompleteProformaData(proformaData) || isCompleteProformaData(initialProformaData);
          if (proformaId && (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))) {
            newStep.redirect_id = proformaId;
            newStep.redirectId = proformaId;
            changed = true;
          }
          if (isComplete && normalizeStepStatus(step.status) !== 'completed') {
            newStep.status = 'completed';
            changed = true;
          }
        }

        // Step 3: Shipment Instruction
        if (isShipmentInstructionStep(step, idx)) {
          const shipmentId = sanitizeDocId(
            shipmentInstructionData?.id ||
            shipmentInstructionData?._id ||
            shipmentInstructionData?.shipment_instruction_id ||
            shipmentInstructionData?.shipment_id ||
            initialShipmentInstructionData?.id ||
            initialShipmentInstructionData?._id ||
            initialShipmentInstructionData?.shipment_instruction_id
          );
          const isComplete = isCompleteShipmentInstructionData(shipmentInstructionData) || isCompleteShipmentInstructionData(initialShipmentInstructionData);
          if (shipmentId && (!step.redirect_id || step.redirect_id === 'new-confirmation' || step.redirect_id.startsWith('step-'))) {
            newStep.redirect_id = shipmentId;
            newStep.redirectId = shipmentId;
            changed = true;
          }
          if (isComplete && normalizeStepStatus(step.status) !== 'completed') {
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
    return '';
  }, [
    selectedStep,
    isConfirmation,
    isContract,
    isProforma,
    isShipmentInstruction,
    effectiveConfirmationId,
    confirmationData,
    canonicalContractId,
    contractData,
    canonicalProformaId,
    proformaData,
    canonicalShipmentInstructionId,
    shipmentInstructionData,
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
      const isTargetConfirmation = targetIndex === 0 || isConfirmationStep(targetStep, targetIndex);
      const isTargetContract = !isTargetConfirmation && (targetIndex === 1 || isContractStep(targetStep, targetIndex));
      const isTargetProforma = !isTargetConfirmation && !isTargetContract && (targetIndex === 2 || isProformaStep(targetStep, targetIndex));
      const isTargetShipment = !isTargetConfirmation && !isTargetContract && !isTargetProforma && (targetIndex === 3 || isShipmentInstructionStep(targetStep, targetIndex));

      const stepSelfId = getStepSelfId(targetStep);

      // PROFORMA INVOICE (Index 2)
      if (isTargetProforma) {
        let candidateId = sanitizeDocId(
          stepSelfId ||
          targetStep?.redirect_id ||
          (targetStep as any)?.redirectId ||
          getProformaIdFromStepper(steps, targetStep) ||
          canonicalProformaId ||
          extractLinkedProformaId(shipmentInstructionData) ||
          extractLinkedProformaId(contractData) ||
          extractLinkedProformaId(confirmationData) ||
          (proformaData?.id || proformaData?.proforma_id)
        );

        if (/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(candidateId)) {
          candidateId = '';
        }

        if (!isCompleteProformaData(proformaData)) {
          setIsLoadingProforma(true);
        }

        // Concurrently refresh stepper list from backend so we have the absolute latest redirect_id & status
        const stepperParam = effectiveConfirmationId || canonicalContractId || initialId || 'new-confirmation';
        getStepperListAction({
          action: 'confirmation',
          step: String(stepperParam),
          lang,
        })
          .then((sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps(sRes.data);
              const freshProformaStep = getProformaStep(sRes.data);
              const freshProformaId = sanitizeDocId(getStepSelfId(freshProformaStep) || freshProformaStep?.redirect_id);
              if (
                freshProformaId &&
                !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(freshProformaId) &&
                freshProformaId !== candidateId
              ) {
                getProformaAction(freshProformaId, lang)
                  .then((freshRes) => {
                    if (activeFetchSeqRef.current === currentSeq && freshRes?.success && freshRes.data) {
                      const extracted = extractProformaData(freshRes.data);
                      if (extracted && isCompleteProformaData(extracted)) {
                        setProformaData(extracted);
                      } else if (freshRes.data) {
                        setProformaData(freshRes.data);
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

        if (candidateId) {
          try {
            const res = await getProformaAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq) {
              if (res?.success && res.data) {
                const extracted = extractProformaData(res.data);
                if (extracted && isCompleteProformaData(extracted)) {
                  setProformaData(extracted);
                } else if (res.data && typeof res.data === 'object') {
                  setProformaData(res.data);
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
          }
        }
        return;
      }

      // SALES CONTRACT (Index 1)
      if (isTargetContract) {
        let candidateId = sanitizeDocId(
          stepSelfId ||
          targetStep?.redirect_id ||
          (targetStep as any)?.redirectId ||
          getContractIdFromStepper(steps, targetStep) ||
          canonicalContractId ||
          draftId ||
          extractLinkedContractId(confirmationData) ||
          (contractData?.id || contractData?.contract_id)
        );

        if (/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(candidateId)) {
          candidateId = '';
        }

        if (!isCompleteContractData(contractData)) {
          setIsLoadingContract(true);
        }

        const stepperParam = candidateId || effectiveConfirmationId || 'new-contract';
        getStepperListAction({
          action: 'contract',
          step: String(stepperParam),
          lang,
        })
          .then((sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps(sRes.data);
            }
          })
          .catch(() => {});

        if (candidateId) {
          try {
            const res = await getContractAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq) {
              if (res?.success && res.data) {
                const extracted = extractContractData(res.data);
                if (extracted && isCompleteContractData(extracted)) {
                  setContractData(extracted);
                } else if (res.data && typeof res.data === 'object') {
                  setContractData(res.data);
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

        const stepperParam = candidateId || 'new-confirmation';
        getStepperListAction({
          action: 'confirmation',
          step: String(stepperParam),
          lang,
        })
          .then((sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps(sRes.data);
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
                } else if (res.data && typeof res.data === 'object') {
                  setConfirmationData(res.data);
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
          }
        }
        return;
      }

      // SHIPMENT INSTRUCTION (Index 3)
      if (isTargetShipment) {
        let candidateId = sanitizeDocId(
          stepSelfId ||
          targetStep?.redirect_id ||
          (targetStep as any)?.redirectId ||
          getShipmentInstructionIdFromStepper(steps, targetStep) ||
          canonicalShipmentInstructionId ||
          (isShipmentInstruction ? draftId || initialId : '') ||
          extractLinkedShipmentInstructionId(proformaData) ||
          extractLinkedShipmentInstructionId(contractData) ||
          (shipmentInstructionData?.id || shipmentInstructionData?.shipment_id || shipmentInstructionData?.shipment_instruction_id)
        );

        if (/^(contract|confirmation|new-confirmation|sales-contract|proforma|shipment|step-\d+)$/i.test(candidateId)) {
          candidateId = '';
        }

        if (!isCompleteShipmentInstructionData(shipmentInstructionData)) {
          setIsLoadingShipmentInstruction(true);
        }

        const stepperParam = workflowAnchorId || 'new-confirmation';
        getStepperListAction({
          action: workflowAnchorType,
          step: String(stepperParam),
          lang,
        })
          .then((sRes) => {
            if (sRes?.success && sRes.data && sRes.data.length > 0 && isRealStepperList(sRes.data)) {
              setSteps(sRes.data);
            }
          })
          .catch(() => {});

        if (candidateId) {
          try {
            const res = await getShipmentInstructionAction(candidateId, lang);
            if (activeFetchSeqRef.current === currentSeq) {
              if (res?.success && res.data) {
                const extracted = extractShipmentInstructionData(res.data);
                if (extracted && isCompleteShipmentInstructionData(extracted)) {
                  setShipmentInstructionData(extracted);
                } else if (res.data && typeof res.data === 'object') {
                  setShipmentInstructionData(res.data);
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
      canonicalContractId,
      canonicalProformaId,
      canonicalShipmentInstructionId,
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
    (step: StepperDocumentItem, index: number) => {
      setSelectedStepIndex(index);
      setSelectedStep(step);
      setIsMobileStepperOpen(false);

      // Reset attempted fetch refs so future or re-clicked fetches are never blocked
      attemptedContractFetchRef.current = null;
      attemptedProformaFetchRef.current = null;
      attemptedShipmentFetchRef.current = null;

      const isSelectingConfirmation = index === 0 || isConfirmationStep(step, index);
      const isSelectingContract = !isSelectingConfirmation && (index === 1 || isContractStep(step, index));
      const isSelectingProforma = !isSelectingConfirmation && !isSelectingContract && (index === 2 || isProformaStep(step, index));
      const isSelectingShipment = !isSelectingConfirmation && !isSelectingContract && !isSelectingProforma && (index === 3 || isShipmentInstructionStep(step, index));

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

      const slug = getStepSlug(step, index);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const targetStepDocId =
          stepSelfId ||
          (isSelectingShipment ? canonicalShipmentInstructionId : isSelectingContract ? canonicalContractId : isSelectingProforma ? canonicalProformaId : effectiveConfirmationId) ||
          draftId;

        if (targetStepDocId) {
          url.searchParams.set('id', targetStepDocId);
        }
        url.searchParams.set('step', slug);
        window.history.replaceState(null, '', url.toString());
      }

      const currentSeq = ++activeFetchSeqRef.current;
      fetchLatestStepData(step, index, currentSeq);
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
      rootWorkflowId,
      initialId,
      fetchLatestStepData,
    ]
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
      setContractData((prev: any) => prev || initialContractData);
    }
  }, [initialContractData]);

  useEffect(() => {
    if (initialData) {
      setConfirmationData((prev: any) => prev || initialData);
    }
  }, [initialData]);

  useEffect(() => {
    if (initialProformaData) {
      setProformaData((prev: any) => prev || initialProformaData);
    }
  }, [initialProformaData]);

  useEffect(() => {
    if (initialShipmentInstructionData) {
      setShipmentInstructionData((prev: any) => prev || initialShipmentInstructionData);
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

  // Fetch contract data dynamically if contract step is active and contract data not yet loaded
  useEffect(() => {
    if (!isContract || isCompleteContractData(contractData) || isCompleteContractData(initialContractData)) {
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
  }, [isContract, canonicalContractId, contractIdFromStepper, steps, contractData, initialContractData, lang]);

  // Fetch proforma data dynamically only if proforma step is active, proforma data not loaded, and a REAL proforma ID exists
  useEffect(() => {
    if (!isProforma || isCompleteProformaData(proformaData) || isCompleteProformaData(initialProformaData)) {
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
  }, [isProforma, canonicalProformaId, proformaData, initialProformaData, lang]);

  // Fetch shipment instruction data dynamically only if shipment instruction step is active and not loaded
  useEffect(() => {
    if (!isShipmentInstruction || isCompleteShipmentInstructionData(shipmentInstructionData) || isCompleteShipmentInstructionData(initialShipmentInstructionData)) {
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
  }, [isShipmentInstruction, canonicalShipmentInstructionId, shipmentInstructionData, initialShipmentInstructionData, lang]);

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
      : dict?.smart_docs?.draft_title || 'Trade Confirmation');

  // Once contract number is generated, it ALWAYS takes priority everywhere (even on confirmation step!)
  const mobileActiveDocNumber = resolvedContractNumber || resolvedConfirmationNumber;

  const mobileActiveDocLabel = resolvedContractNumber
    ? (dict?.smart_docs?.contract_form?.contract_number || 'Contract No.')
    : (dict?.smart_docs?.confirmation_form?.confirmation_number || 'Confirmation No.');

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
              stepperType={activeStepperType}
              stepperId={activeStepperId || initialId || draftId || 'new-confirmation'}
              stepId={activeStepperId || initialId || draftId || 'new-confirmation'}
              confirmationId={effectiveConfirmationId || activeStepperId || draftId}
              initialSteps={steps}
              currentStepIndex={selectedStepIndex}
              onSelectStep={handleSelectStep}
              onUpdateSteps={setSteps}
              lang={lang}
              dict={dict}
              confirmationNumber={resolvedConfirmationNumber}
              contractNumber={resolvedContractNumber}
              isContractStep={activeStepperType === 'contract'}
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
          {isConfirmation && isLoadingConfirmation && !isCompleteConfirmationData(confirmationData) ? (
            <DocumentDraftSkeleton mode="confirmation" isFormCardOnly />
          ) : (
            <ConfirmationDocumentForm
              initialData={
                isCompleteConfirmationData(confirmationData)
                  ? confirmationData
                  : isCompleteConfirmationData(initialData)
                  ? initialData
                  : confirmationData || initialData
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
            onUpdateSteps={(newSteps) => {
              if (newSteps && newSteps.length > 0) {
                setSteps(newSteps);
              }
            }}
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
            onSubmitContract={async (formData) => {
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

                // Update stepper to reflect completion and switch to contract step
                try {
                  const stepperRes = await getStepperListAction({
                    action: 'confirmation',
                    step: String(newId || 'new-confirmation'),
                    lang,
                  });
                  if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                    setSteps(stepperRes.data);
                    const contractIndex = stepperRes.data.findIndex((s, idx) => isContractStep(s, idx));
                    const targetIdx =
                      contractIndex >= 0 ? contractIndex : (stepperRes.data.length > 1 ? 1 : 0);
                    setSelectedStepIndex(targetIdx);
                    const newContractStep = stepperRes.data[targetIdx] || null;
                    setSelectedStep(newContractStep);

                    // Extract the contract ID from the stepper contract step!
                    const newContractId = extractStepId(newContractStep);
                    if (newContractId) {
                      setDraftId(newContractId);
                      setIsLoadingContract(true);
                      getContractAction(newContractId, lang).then((cRes) => {
                        if (cRes?.success && cRes.data) {
                          const extracted = extractContractData(cRes.data);
                          if (extracted) {
                            setContractData(extracted);
                          }
                        }
                      }).finally(() => {
                        setIsLoadingContract(false);
                      });
                    } else if (newId) {
                      setDraftId(String(newId));
                      fetchLatestStepData(newContractStep, targetIdx, ++activeFetchSeqRef.current);
                    } else {
                      fetchLatestStepData(newContractStep, targetIdx, ++activeFetchSeqRef.current);
                    }

                    // Update URL to contract step (preserving rootWorkflowId in ?id=)
                    if (typeof window !== 'undefined') {
                      const url = new URL(window.location.href);
                      const targetId = rootWorkflowId || effectiveConfirmationId || String(newId);
                      if (targetId) {
                        url.searchParams.set('id', targetId);
                      }
                      url.searchParams.set('step', 'contract');
                      window.history.replaceState(null, '', url.toString());
                    }
                  } else if (steps.length > 1) {
                    setSelectedStepIndex(1);
                    setSelectedStep(steps[1]);
                    fetchLatestStepData(steps[1], 1, ++activeFetchSeqRef.current);
                    if (typeof window !== 'undefined') {
                      const url = new URL(window.location.href);
                      url.searchParams.set('step', 'contract');
                      window.history.replaceState(null, '', url.toString());
                    }
                  }
                } catch (stepErr) {
                  console.error('[DocumentDraftWorkspace] Stepper refresh error:', stepErr);
                  if (steps.length > 1) {
                    setSelectedStepIndex(1);
                    setSelectedStep(steps[1]);
                  }
                }
              }
              return res;
            }}
          />
          )}
        </div>

        {/* Contract Document Form: Visible when Contract Step is active */}
        <div className={`w-full h-full flex flex-col ${isContract ? 'flex' : 'hidden'}`}>
          {isContract && isLoadingContract && !isCompleteContractData(contractData) ? (
            <DocumentDraftSkeleton mode="contract" isFormCardOnly />
          ) : (
            <ContractDocumentForm
              initialData={
                isCompleteContractData(contractData)
                  ? contractData
                  : isCompleteContractData(initialContractData)
                  ? initialContractData
                  : (isCompleteConfirmationData(confirmationData) ? confirmationData : initialData)
              }
              contractId={contractIdFromStepper || canonicalContractId}
              steps={steps}
              selectedStep={selectedStep}
              onUpdateSteps={(newSteps) => {
                if (newSteps && newSteps.length > 0) {
                  setSteps(newSteps);
                }
              }}
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
                    prevSteps.map((s, idx) =>
                      isContractStep(s, idx)
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
                  sanitizeDocId(contractData?.contract_id || contractData?.id || initialContractData?.contract_id || initialContractData?.id);

                const validEffectiveId =
                  activeDocId &&
                  activeDocId !== effectiveConfirmationId &&
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
                    const stepperParam = validEffectiveId || newId || 'new-confirmation';
                    const stepperRes = await getStepperListAction({
                      action: 'confirmation',
                      step: String(stepperParam),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0 && isRealStepperList(stepperRes.data)) {
                      setSteps(stepperRes.data);
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Stepper refresh error:', stepErr);
                  }
                }
                return res;
              }}
              onSubmitContract={async (formData, passedId) => {
                const activeDocId =
                  passedId ||
                  canonicalContractId ||
                  contractIdFromStepper ||
                  sanitizeDocId(contractData?.contract_id || contractData?.id || initialContractData?.contract_id || initialContractData?.id);

                const validEffectiveId =
                  activeDocId &&
                  activeDocId !== effectiveConfirmationId &&
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
                  // Update stepper to reflect completion and switch to proforma step (just like confirmation switches to contract!)
                  try {
                    const stepperParam = effectiveConfirmationId || confId || 'new-confirmation';
                    const stepperRes = await getStepperListAction({
                      action: 'confirmation',
                      step: String(stepperParam),
                      lang,
                    });

                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                      setSteps(stepperRes.data);
                      const proformaIndex = stepperRes.data.findIndex((s, idx) => isProformaStep(s, idx));
                      const targetIdx =
                        proformaIndex >= 0 ? proformaIndex : (stepperRes.data.length > 2 ? 2 : 2);
                      setSelectedStepIndex(targetIdx);
                      const newProformaStep = stepperRes.data[targetIdx] || null;
                      setSelectedStep(newProformaStep);

                      const newProformaId = extractStepId(newProformaStep) || res.data?.proforma_id;
                      if (newProformaId) {
                        setIsLoadingProforma(true);
                        getProformaAction(String(newProformaId), lang)
                          .then((pRes) => {
                            if (pRes?.success && pRes.data) {
                              const extracted = extractProformaData(pRes.data);
                              if (extracted && isCompleteProformaData(extracted)) {
                                setProformaData(extracted);
                              } else if (pRes.data) {
                                setProformaData(pRes.data);
                              }
                            }
                          })
                          .catch((pErr) => {
                            console.warn('[DocumentDraftWorkspace] Post-submit contract proforma fetch error:', pErr);
                          })
                          .finally(() => {
                            setIsLoadingProforma(false);
                          });
                      } else {
                        fetchLatestStepData(newProformaStep, targetIdx, ++activeFetchSeqRef.current);
                      }

                      // Update URL to proforma step (preserving rootWorkflowId in ?id=)
                      if (typeof window !== 'undefined') {
                        const url = new URL(window.location.href);
                        const targetId = rootWorkflowId || effectiveConfirmationId;
                        if (targetId) {
                          url.searchParams.set('id', targetId);
                        }
                        url.searchParams.set('step', 'proforma');
                        window.history.replaceState(null, '', url.toString());
                      }
                    } else if (steps.length > 2) {
                      const proformaIndex = steps.findIndex((s, idx) => isProformaStep(s, idx));
                      const targetIdx = proformaIndex >= 0 ? proformaIndex : 2;
                      setSelectedStepIndex(targetIdx);
                      setSelectedStep(steps[targetIdx]);
                      fetchLatestStepData(steps[targetIdx], targetIdx, ++activeFetchSeqRef.current);
                      if (typeof window !== 'undefined') {
                        const url = new URL(window.location.href);
                        const targetId = rootWorkflowId || effectiveConfirmationId;
                        if (targetId) {
                          url.searchParams.set('id', targetId);
                        }
                        url.searchParams.set('step', 'proforma');
                        window.history.replaceState(null, '', url.toString());
                      }
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit contract stepper error:', stepErr);
                  }
                }
                return res;
              }}
            />
          )}
        </div>

        {/* Proforma Invoice Document Form: Visible when Proforma Step is active */}
        <div className={`w-full h-full flex flex-col ${isProforma ? 'flex' : 'hidden'}`}>
          {isProforma && isLoadingProforma && !isCompleteProformaData(proformaData) ? (
            <DocumentDraftSkeleton mode="contract" isFormCardOnly />
          ) : (
            <ProformaDocumentForm
              initialData={
                isCompleteProformaData(proformaData)
                  ? proformaData
                  : isCompleteProformaData(initialProformaData)
                  ? initialProformaData
                  : (isProforma ? (contractData || initialContractData || confirmationData || initialData) : undefined)
              }
              proformaId={canonicalProformaId}
              contractId={canonicalContractId}
              confirmationId={effectiveConfirmationId}
              steps={steps}
              selectedStep={selectedStep}
              onUpdateSteps={(newSteps) => {
                if (newSteps && newSteps.length > 0) {
                  setSteps(newSteps);
                }
              }}
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
                    prevSteps.map((s, idx) =>
                      isProformaStep(s, idx)
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
                  sanitizeDocId(proformaData?.proforma_id || proformaData?.proforma_invoice_id || (proformaData?.invoice_number ? proformaData?.id : ''));
                const validEffectiveId =
                  activeDocId &&
                  activeDocId !== canonicalContractId &&
                  activeDocId !== effectiveConfirmationId &&
                  activeDocId !== canonicalShipmentInstructionId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+)$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                if (typeof formData?.set === 'function') {
                  if (canonicalProformaId) {
                    formData.set('id', canonicalProformaId);
                    formData.set('proforma_id', canonicalProformaId);
                  } else {
                    formData.delete('id');
                    formData.delete('proforma_id');
                    formData.delete('proforma_invoice_id');
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
                      prevSteps.map((s, idx) =>
                        isProformaStep(s, idx)
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
                    const stepperParam = effectiveConfirmationId || 'new-confirmation';
                    const stepperRes = await getStepperListAction({
                      action: 'confirmation',
                      step: String(stepperParam),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0 && isRealStepperList(stepperRes.data)) {
                      setSteps(stepperRes.data);
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-save proforma stepper error:', stepErr);
                  }
                }
                return res;
              }}
              onSubmitProforma={async (formData, passedId) => {
                const activeDocId =
                  canonicalProformaId ||
                  sanitizeDocId(
                    proformaData?.proforma_id ||
                    proformaData?.proforma_invoice_id ||
                    passedId ||
                    (proformaData?.invoice_number ? proformaData?.id : '')
                  );
                const validEffectiveId =
                  activeDocId &&
                  activeDocId !== canonicalContractId &&
                  activeDocId !== effectiveConfirmationId &&
                  activeDocId !== canonicalShipmentInstructionId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|step-\d+)$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                if (typeof formData?.set === 'function') {
                  if (canonicalProformaId) {
                    formData.set('id', canonicalProformaId);
                    formData.set('proforma_id', canonicalProformaId);
                  } else {
                    formData.delete('id');
                    formData.delete('proforma_id');
                    formData.delete('proforma_invoice_id');
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
                      prevSteps.map((s, idx) =>
                        isProformaStep(s, idx)
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
                    const stepperParam = effectiveConfirmationId || 'new-confirmation';
                    const stepperRes = await getStepperListAction({
                      action: 'confirmation',
                      step: String(stepperParam),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0 && isRealStepperList(stepperRes.data)) {
                      setSteps(stepperRes.data);
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit proforma stepper error:', stepErr);
                  }
                }
                return res;
              }}
            />
          )}
        </div>

        {/* Shipment Instruction Document Form: Visible when Shipment Instruction Step is active */}
        <div className={`w-full h-full flex flex-col ${isShipmentInstruction ? 'flex' : 'hidden'}`}>
          {isShipmentInstruction && isLoadingShipmentInstruction && !isCompleteShipmentInstructionData(shipmentInstructionData) ? (
            <DocumentDraftSkeleton mode="contract" isFormCardOnly />
          ) : (
            <ShipmentInstructionDocumentForm
              initialData={
                isCompleteShipmentInstructionData(shipmentInstructionData)
                  ? shipmentInstructionData
                  : isCompleteShipmentInstructionData(initialShipmentInstructionData)
                  ? initialShipmentInstructionData
                  : (isShipmentInstruction
                    ? (isCompleteProformaData(proformaData) ? proformaData : isCompleteContractData(contractData) ? contractData : confirmationData || initialData)
                    : undefined)
              }
              buyerInstructionId={buyerInstructionIdForShipment}
              instructionId={canonicalShipmentInstructionId}
              shipmentInstructionId={canonicalShipmentInstructionId}
              proformaId={canonicalProformaId}
              contractId={canonicalContractId}
              confirmationId={effectiveConfirmationId}
              steps={steps}
              selectedStep={selectedStep}
              onUpdateSteps={(newSteps) => {
                if (newSteps && newSteps.length > 0) {
                  setSteps(newSteps);
                }
              }}
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
                    prevSteps.map((s, idx) =>
                      isShipmentInstructionStep(s, idx)
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
                  sanitizeDocId(shipmentInstructionData?.shipment_instruction_id || shipmentInstructionData?.id);
                const validEffectiveId =
                  activeDocId &&
                  activeDocId !== canonicalContractId &&
                  activeDocId !== effectiveConfirmationId &&
                  activeDocId !== canonicalProformaId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                if (typeof formData?.set === 'function') {
                  if (canonicalShipmentInstructionId) {
                    formData.set('id', canonicalShipmentInstructionId);
                    formData.set('shipment_instruction_id', canonicalShipmentInstructionId);
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
                      prevSteps.map((s, idx) =>
                        isShipmentInstructionStep(s, idx)
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
              onSubmitInstruction={async (formData) => {
                const activeDocId =
                  canonicalShipmentInstructionId ||
                  sanitizeDocId(shipmentInstructionData?.shipment_instruction_id || shipmentInstructionData?.id);
                const validEffectiveId =
                  activeDocId &&
                  activeDocId !== canonicalContractId &&
                  activeDocId !== effectiveConfirmationId &&
                  activeDocId !== canonicalProformaId &&
                  !/^(contract|confirmation|new-confirmation|sales-contract|trade-confirmation|proforma|shipment|step-\d+)$/i.test(activeDocId)
                    ? activeDocId
                    : undefined;

                if (typeof formData?.set === 'function') {
                  if (canonicalShipmentInstructionId) {
                    formData.set('id', canonicalShipmentInstructionId);
                    formData.set('shipment_instruction_id', canonicalShipmentInstructionId);
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
                      prevSteps.map((s, idx) =>
                        isShipmentInstructionStep(s, idx)
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
                    const stepperParam = effectiveConfirmationId || 'new-confirmation';
                    const stepperRes = await getStepperListAction({
                      action: 'confirmation',
                      step: String(stepperParam),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0 && isRealStepperList(stepperRes.data)) {
                      setSteps(stepperRes.data);
                    }
                  } catch (stepErr) {
                    console.error('[DocumentDraftWorkspace] Post-submit shipment stepper error:', stepErr);
                  }
                }
                return res;
              }}
            />
          )}
        </div>

        {/* Subsequent Workflow Steps View (Post-Shipment Instruction): Clean placeholder */}
        <div className={`w-full h-full flex-col ${!isConfirmation && !isContract && !isProforma && !isShipmentInstruction ? 'flex' : 'hidden'}`} />
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
            stepperType={activeStepperType}
            stepperId={activeStepperId || initialId || draftId || 'new-confirmation'}
            stepId={activeStepperId || initialId || draftId || 'new-confirmation'}
            confirmationId={effectiveConfirmationId || activeStepperId || draftId}
            initialSteps={steps}
            currentStepIndex={selectedStepIndex}
            onSelectStep={handleSelectStep}
            onUpdateSteps={setSteps}
            lang={lang}
            dict={dict}
            confirmationNumber={resolvedConfirmationNumber}
            contractNumber={resolvedContractNumber}
            isContractStep={activeStepperType === 'contract'}
          />
        </div>
      </aside>
    </div>
    </div>
  );
}

export default DocumentDraftWorkspace;

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  isConfirmationStep,
  isContractStep,
  isProformaStep,
  getContractStep,
  getProformaStep,
  getContractIdFromStepper,
  getProformaIdFromStepper,
  sanitizeDocId,
  DEFAULT_WORKFLOW_STEPPER_ITEMS,
} from '@/lib/api/smart-docs.service';
import DocumentStatusStepper, { cleanDocNumber } from './DocumentStatusStepper';
import ConfirmationDocumentForm, { FormOptionItem } from './form/ConfirmationDocumentForm';
import ContractDocumentForm from './form/ContractDocumentForm';
import ProformaDocumentForm from './form/ProformaDocumentForm';
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
  initialId?: string;
  initialStepParam?: string;
}

export function getStepSlug(step?: StepperDocumentItem | null, index?: number): string {
  if (index === 0 || isConfirmationStep(step, index)) return 'confirmation';
  if (index === 1 || isContractStep(step, index)) return 'contract';
  if (index === 2 || isProformaStep(step, index)) return 'proforma';
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

  // Contract ID extracted strictly from Stepper list / selectedStep (user: "id tumhe stepper se milegi")
  const contractIdFromStepper = useMemo(() => {
    return getContractIdFromStepper(steps, selectedStep);
  }, [steps, selectedStep]);

  // Confirmation ID for Stepper workflow operations (strictly confirmation, NEVER contract ID)
  const effectiveConfirmationId = useMemo(() => {
    const raw =
      initialData?.id ||
      initialData?._id ||
      initialData?.confirmation_id ||
      initialData?.confirmationId ||
      confirmationData?.id ||
      confirmationData?._id ||
      confirmationData?.confirmation_id ||
      confirmationData?.confirmationId ||
      contractData?.confirmation_id ||
      contractData?.confirmationId ||
      contractData?.confirmation?.id ||
      contractData?.confirmation?._id ||
      initialContractData?.confirmation_id ||
      initialContractData?.confirmationId ||
      initialContractData?.confirmation?.id ||
      initialContractData?.confirmation?._id ||
      proformaData?.confirmation_id ||
      proformaData?.confirmationId ||
      initialProformaData?.confirmation_id ||
      initialProformaData?.confirmationId ||
      (typeof contractData?.confirmation === 'string' ? contractData.confirmation : '') ||
      (typeof initialContractData?.confirmation === 'string' ? initialContractData.confirmation : '') ||
      (isConfirmation ? draftId : '') ||
      '';
    const clean = sanitizeDocId(raw);
    return clean && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(clean) ? clean : '';
  }, [initialData, confirmationData, contractData, initialContractData, proformaData, initialProformaData, isConfirmation, draftId]);

  // Canonical Contract Document ID (strictly contract)
  const canonicalContractId = useMemo(() => {
    const raw =
      contractIdFromStepper ||
      contractData?.id ||
      contractData?._id ||
      contractData?.contract_id ||
      contractData?.contractId ||
      initialContractData?.id ||
      initialContractData?._id ||
      initialContractData?.contract_id ||
      initialContractData?.contractId ||
      proformaData?.contract_id ||
      proformaData?.contractId ||
      initialProformaData?.contract_id ||
      initialProformaData?.contractId ||
      initialData?.contract_id ||
      initialData?.contractId ||
      (isContract ? draftId : '') ||
      '';
    const clean = sanitizeDocId(raw);
    return clean && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(clean) ? clean : '';
  }, [contractIdFromStepper, contractData, initialContractData, proformaData, initialProformaData, initialData, isContract, draftId]);

  // Canonical Proforma Document ID (strictly proforma, NEVER contract or confirmation ID)
  const canonicalProformaId = useMemo(() => {
    const fromStepper = getProformaIdFromStepper(steps, selectedStep);
    if (
      fromStepper &&
      fromStepper !== effectiveConfirmationId &&
      fromStepper !== canonicalContractId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(fromStepper)
    ) {
      return sanitizeDocId(fromStepper);
    }
    const candidateDataId = sanitizeDocId(
      proformaData?.id ||
      proformaData?._id ||
      proformaData?.proforma_id ||
      proformaData?.proformaId ||
      initialProformaData?.id ||
      initialProformaData?._id ||
      initialProformaData?.proforma_id ||
      initialProformaData?.proformaId ||
      contractData?.proforma_id ||
      contractData?.proformaId ||
      contractData?.proforma?.id ||
      initialContractData?.proforma_id ||
      initialContractData?.proformaId ||
      initialContractData?.proforma?.id ||
      initialData?.proforma_id ||
      initialData?.proformaId
    );
    if (
      candidateDataId &&
      candidateDataId !== effectiveConfirmationId &&
      candidateDataId !== canonicalContractId &&
      !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(candidateDataId)
    ) {
      return candidateDataId;
    }
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
  }, [steps, selectedStep, effectiveConfirmationId, canonicalContractId, proformaData, initialProformaData, contractData, initialContractData, initialData, isProforma, draftId]);

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

  // The root workflow / confirmation ID. This ID anchors the entire 3-step process.
  // The URL parameter ?id= MUST ALWAYS be this ID and must NEVER change to a contract or proforma ID.
  const rootWorkflowId = useMemo(() => {
    const raw =
      effectiveConfirmationId ||
      initialData?.id ||
      initialData?._id ||
      initialData?.confirmation_id ||
      initialData?.confirmationId ||
      confirmationData?.id ||
      confirmationData?._id ||
      confirmationData?.confirmation_id ||
      confirmationData?.confirmationId ||
      contractData?.confirmation_id ||
      contractData?.confirmationId ||
      initialContractData?.confirmation_id ||
      initialContractData?.confirmationId ||
      proformaData?.confirmation_id ||
      proformaData?.confirmationId ||
      initialProformaData?.confirmation_id ||
      initialProformaData?.confirmationId ||
      initialId ||
      draftId ||
      '';
    const clean = sanitizeDocId(raw);
    return clean && !/^(contract|confirmation|new-confirmation|sales-contract|proforma|step-\d+)$/i.test(clean) ? clean : '';
  }, [
    effectiveConfirmationId,
    initialData,
    confirmationData,
    contractData,
    initialContractData,
    proformaData,
    initialProformaData,
    initialId,
    draftId,
  ]);

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

  // Ensure the browser URL query parameter 'id' is ALWAYS the rootWorkflowId (confirmation ID)
  // and 'step' parameter strictly mirrors the active step ('confirmation', 'contract', 'proforma')
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    let shouldUpdate = false;

    const currentUrlId = url.searchParams.get('id');
    const targetId = rootWorkflowId || effectiveConfirmationId;
    if (targetId && currentUrlId !== targetId) {
      url.searchParams.set('id', targetId);
      shouldUpdate = true;
    }

    const currentUrlStep = url.searchParams.get('step');
    const targetStep = isConfirmation
      ? 'confirmation'
      : isContract
      ? 'contract'
      : isProforma
      ? 'proforma'
      : getStepSlug(selectedStep, selectedStepIndex);

    if (targetStep && currentUrlStep !== targetStep) {
      url.searchParams.set('step', targetStep);
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      window.history.replaceState(null, '', url.toString());
    }
  }, [rootWorkflowId, effectiveConfirmationId, isConfirmation, isContract, isProforma, selectedStep, selectedStepIndex]);

  // Handle step selection with URL shallow synchronization for proper linking
  // Deep link navigation: update URL query parameters without full page reload
  // CRITICAL: URL 'id' must ALWAYS remain the root workflow confirmation ID! Only 'step' changes.
  const handleSelectStep = useCallback(
    (step: StepperDocumentItem, index: number) => {
      setSelectedStepIndex(index);
      setSelectedStep(step);
      setIsMobileStepperOpen(false);

      const isSelectingContract = index === 1 || isContractStep(step, index);
      const isSelectingProforma = index === 2 || isProformaStep(step, index);

      if (isSelectingContract && !contractData && !initialContractData) {
        setIsLoadingContract(true);
      }
      if (isSelectingProforma && !proformaData && !initialProformaData) {
        setIsLoadingProforma(true);
      }

      const slug = getStepSlug(step, index);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const targetId = rootWorkflowId || effectiveConfirmationId;
        if (targetId) {
          url.searchParams.set('id', targetId);
        }
        url.searchParams.set('step', slug);
        window.history.replaceState(null, '', url.toString());
      }
    },
    [rootWorkflowId, effectiveConfirmationId, contractData, initialContractData, proformaData, initialProformaData]
  );

  const pageTitle = isContract
    ? dict?.smart_docs?.draft_contract_title || dict?.smart_docs?.draft_contract || 'Draft Contract'
    : isProforma
    ? dict?.smart_docs?.draft_proforma_title || 'Proforma Invoice'
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
    if (initialContractData && !contractData) {
      setContractData(initialContractData);
    }
  }, [initialContractData, contractData]);

  useEffect(() => {
    if (initialData && !confirmationData) {
      setConfirmationData(initialData);
    }
  }, [initialData, confirmationData]);

  useEffect(() => {
    if (initialProformaData && !proformaData) {
      setProformaData(initialProformaData);
    }
  }, [initialProformaData, proformaData]);

  // Fetch confirmation data dynamically if confirmation step is active and data not yet loaded
  useEffect(() => {
    if (!isConfirmation || confirmationData || initialData) return;
    const cleanConfId = sanitizeDocId(effectiveConfirmationId);
    if (cleanConfId) {
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
    }
  }, [isConfirmation, confirmationData, initialData, effectiveConfirmationId, lang]);

  // Fetch contract data dynamically if contract step is active and contract data not yet loaded
  useEffect(() => {
    if (!isContract || contractData || initialContractData) {
      return;
    }

    const confId =
      initialData?.id ||
      initialData?._id ||
      initialData?.confirmation_id ||
      initialData?.confirmationId;

    const candidateContractId =
      contractIdFromStepper ||
      (draftId && draftId !== confId ? draftId : '') ||
      initialData?.contract_id ||
      initialData?.contractId;

    const effectiveContractId =
      candidateContractId && !/^(contract|confirmation|new-confirmation|sales-contract|step-\d+)$/i.test(candidateContractId)
        ? candidateContractId
        : '';

    if (effectiveContractId) {
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
    } else {
      setIsLoadingContract(false);
    }
  }, [isContract, contractIdFromStepper, draftId, initialData, contractData, initialContractData, lang]);

  // Fetch proforma data dynamically only if proforma step is active, proforma data not loaded, and a REAL proforma ID exists
  useEffect(() => {
    if (!isProforma || proformaData || initialProformaData) {
      return;
    }

    const hasInitialFallback = Boolean(contractData || initialContractData || initialData);
    const effectiveProformaId = canonicalProformaId;

    // Only fetch if there is a distinct, genuine proforma ID
    if (effectiveProformaId) {
      // Only show full skeleton if there is NO fallback data at all to display
      if (!hasInitialFallback) {
        setIsLoadingProforma(true);
      }
      getProformaAction(effectiveProformaId, lang)
        .then((res) => {
          if (res?.success && res.data) {
            setProformaData(extractProformaData(res.data));
          }
        })
        .catch((err) => {
          console.warn('[DocumentDraftWorkspace] Error fetching proforma dynamically:', err);
        })
        .finally(() => {
          setIsLoadingProforma(false);
        });
    } else {
      setIsLoadingProforma(false);
    }
  }, [isProforma, canonicalProformaId, proformaData, initialProformaData, contractData, initialContractData, initialData, lang]);

  const activeDocName =
    selectedStep?.document_name ||
    selectedStep?.name ||
    selectedStep?.title ||
    selectedStep?.doc_name ||
    (isContract
      ? dict?.smart_docs?.contract_form?.sales_contract_title || 'Sales Contract'
      : isProforma
      ? 'Proforma Invoice'
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
              stepperType={isContract ? 'contract' : 'confirmation'}
              stepperId={isContract ? (canonicalContractId || rootWorkflowId || effectiveConfirmationId) : (rootWorkflowId || effectiveConfirmationId)}
              stepId={rootWorkflowId || effectiveConfirmationId || 'new-confirmation'}
              confirmationId={rootWorkflowId || effectiveConfirmationId}
              initialSteps={steps}
              currentStepIndex={selectedStepIndex}
              onSelectStep={handleSelectStep}
              onUpdateSteps={setSteps}
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
          {isConfirmation && isLoadingConfirmation ? (
            <DocumentDraftSkeleton mode="confirmation" isFormCardOnly />
          ) : (
            <ConfirmationDocumentForm
              initialData={confirmationData || initialData}
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
                      getContractAction(newContractId, lang).then((cRes) => {
                        if (cRes?.success && cRes.data) {
                          setContractData(cRes.data);
                        }
                      });
                    } else if (newId) {
                      setDraftId(String(newId));
                    }

                    // Update URL to contract step (preserving rootWorkflowId in ?id=)
                    if (typeof window !== 'undefined') {
                      const url = new URL(window.location.href);
                      const targetId = String(newId) || rootWorkflowId || effectiveConfirmationId;
                      if (targetId) {
                        url.searchParams.set('id', targetId);
                      }
                      url.searchParams.set('step', 'contract');
                      window.history.replaceState(null, '', url.toString());
                    }
                  } else if (steps.length > 1) {
                    setSelectedStepIndex(1);
                    setSelectedStep(steps[1]);
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
          {isContract && isLoadingContract ? (
            <DocumentDraftSkeleton mode="contract" isFormCardOnly />
          ) : (
            <ContractDocumentForm
              initialData={contractData || initialContractData || initialData}
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
                  setDraftId(savedId);
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
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    const targetId = rootWorkflowId || effectiveConfirmationId;
                    if (targetId) {
                      url.searchParams.set('id', targetId);
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
                  sanitizeDocId(
                    (contractData?.contract_id || contractData?.id) ||
                    (initialContractData?.contract_id || initialContractData?.id) ||
                    contractIdFromStepper ||
                    draftId ||
                    initialId ||
                    initialData?.id ||
                    initialData?._id ||
                    initialData?.confirmation_id ||
                    initialData?.confirmationId
                  );

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
                  initialData?.confirmation_id ||
                  initialData?.confirmationId ||
                  validEffectiveId
                );
                if (confId && typeof formData?.set === 'function' && !formData.get('confirmation_id')) {
                  formData.set('confirmation_id', confId);
                }

                const res = await saveContractDraftAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.contract_id || (res as any)?.contract_id;
                  if (newId) {
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
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
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
                  sanitizeDocId(
                    passedId ||
                    (contractData?.contract_id || contractData?.id) ||
                    (initialContractData?.contract_id || initialContractData?.id) ||
                    contractIdFromStepper ||
                    canonicalContractId ||
                    draftId ||
                    initialId ||
                    initialData?.contract_id ||
                    initialData?.contractId ||
                    initialData?.id ||
                    initialData?._id ||
                    initialData?.confirmation_id ||
                    initialData?.confirmationId
                  );

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
                  initialData?.confirmation_id ||
                  initialData?.confirmationId ||
                  validEffectiveId
                );
                if (confId && typeof formData?.set === 'function' && !formData.get('confirmation_id')) {
                  formData.set('confirmation_id', confId);
                }

                const res = await submitContractAction(formData, lang, validEffectiveId);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.proforma_id || res.data?.contract_id;
                  if (newId) {
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
                        setDraftId(String(newProformaId));
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
          {isProforma && isLoadingProforma && !proformaData && !contractData && !initialContractData && !initialData ? (
            <DocumentDraftSkeleton mode="contract" isFormCardOnly />
          ) : (
            <ProformaDocumentForm
              initialData={proformaData || contractData || initialContractData || initialData}
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
                  setDraftId(savedId);
                  setProformaData((prev: any) => ({
                    ...(prev || {}),
                    ...(savedData || {}),
                    id: savedId,
                    proforma_id: savedId,
                  }));
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
              }}
              onSaveDraft={async (formData) => {
                const activeDocId =
                  sanitizeDocId(
                    canonicalProformaId ||
                    (proformaData?.proforma_id || proformaData?.proforma_invoice_id || (proformaData?.invoice_number ? proformaData?.id : '')) ||
                    canonicalContractId ||
                    effectiveConfirmationId ||
                    rootWorkflowId ||
                    draftId ||
                    initialId
                  );
                const validEffectiveId =
                  activeDocId &&
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
                  if (newId) setDraftId(String(newId));
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
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
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
                  sanitizeDocId(
                    canonicalProformaId ||
                    (proformaData?.proforma_id || proformaData?.proforma_invoice_id) ||
                    passedId ||
                    proformaData?.id ||
                    canonicalContractId ||
                    effectiveConfirmationId ||
                    rootWorkflowId ||
                    draftId ||
                    initialId
                  );
                const validEffectiveId =
                  activeDocId &&
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
                  if (newId) setDraftId(String(newId));
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
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
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

        {/* Subsequent Workflow Steps View (Post-Proforma): Clean placeholder */}
        <div className={`w-full h-full flex-col ${!isConfirmation && !isContract && !isProforma ? 'flex' : 'hidden'}`} />
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
            stepperType={isContract ? 'contract' : 'confirmation'}
            stepperId={isContract ? (canonicalContractId || rootWorkflowId || effectiveConfirmationId) : (rootWorkflowId || effectiveConfirmationId)}
            stepId={rootWorkflowId || effectiveConfirmationId || 'new-confirmation'}
            confirmationId={rootWorkflowId || effectiveConfirmationId}
            initialSteps={steps}
            currentStepIndex={selectedStepIndex}
            onSelectStep={handleSelectStep}
            onUpdateSteps={setSteps}
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

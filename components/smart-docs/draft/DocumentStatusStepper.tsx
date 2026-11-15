'use client';

import React, { useState, useEffect, useTransition, useRef, useCallback, useMemo } from 'react';
import type { StepperDocumentItem } from '@/lib/api/smart-docs.service';
import {
  DEFAULT_WORKFLOW_STEPPER_ITEMS,
  isRealStepperList,
  downloadPdfFromActionResponse,
  isConfirmationStep,
  isContractStep,
  isProformaStep,
  isShipmentInstructionStep,
  isCustomInvoiceStep,
  extractStepRedirectId,
  extractStepId,
  getStepSelfId,
} from '@/lib/api/smart-docs.service';
import {
  getStepperListAction,
  downloadDocPdfAction,
  getStepperDocsListAction,
  saveStepperDocsListAction,
  type StepperDocConfigItem,
} from '@/app/actions/smart-docs';

export function cleanDocNumber(val: any): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (
    !str ||
    str.toLowerCase() === 'null' ||
    str.toLowerCase() === 'undefined' ||
    str === '-' ||
    str.toLowerCase() === 'n/a' ||
    str.toLowerCase() === '[object object]'
  ) {
    return null;
  }
  return str;
}

export type NormalizedStatus = 'completed' | 'in_progress' | 'pending' | 'locked';

export function normalizeStepStatus(rawStatus?: string): NormalizedStatus {
  if (!rawStatus) return 'pending';
  const s = String(rawStatus).toLowerCase().trim();
  if (['completed', 'complete', 'done', 'approved', 'success', 'finished'].includes(s)) {
    return 'completed';
  }
  if (['locked', 'lock', 'blocked'].includes(s)) {
    return 'locked';
  }
  return 'pending';
}

export function isStepPdfEnabled(step: StepperDocumentItem): boolean {
  if (step.pdf_enabled === false || step.is_pdf_available === false) {
    return false;
  }
  if (Boolean(step.pdf_url || step.pdf || step.download_url || step.file_url)) {
    return true;
  }
  if (step.pdf_enabled === true || step.is_pdf_available === true) {
    return true;
  }
  const norm = normalizeStepStatus(step.status || step.document_status || step.step_status);
  return norm === 'completed';
}

export interface DocumentStatusStepperProps {
  initialSteps?: StepperDocumentItem[];
  currentStepIndex?: number;
  onSelectStep?: (step: StepperDocumentItem, index: number) => void;
  onUpdateSteps?: (steps: StepperDocumentItem[]) => void;
  lang?: string;
  dict?: any;
  isMobile?: boolean;
  stepId?: string;
  stepperId?: string;
  stepperType?: string;
  confirmationId?: string;
  confirmationNumber?: string | null;
  contractNumber?: string | null;
  isContractStep?: boolean;
}

export function DocumentStatusStepper({
  initialSteps,
  currentStepIndex = 0,
  onSelectStep,
  onUpdateSteps,
  lang = 'en',
  dict,
  isMobile = false,
  stepId,
  stepperId: propStepperId,
  stepperType: propStepperType,
  confirmationId: propConfirmationId,
  confirmationNumber,
  contractNumber,
  isContractStep: propIsContractStep,
}: DocumentStatusStepperProps) {
  const propStepId = stepId;
  const [steps, setSteps] = useState<StepperDocumentItem[]>(initialSteps || []);
  const [selectedIndex, setSelectedIndex] = useState<number>(currentStepIndex);
  const [isLoading, setIsLoading] = useState<boolean>(!initialSteps || initialSteps.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Document List Dropdown (Panel inside stepper card) - Controlled Visibility State
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [visibilityDocuments, setVisibilityDocuments] = useState<StepperDocConfigItem[]>([]);
  const [hiddenDocuments, setHiddenDocuments] = useState<string[]>([]);
  const [initialHiddenDocuments, setInitialHiddenDocuments] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingVisibility, setIsLoadingVisibility] = useState<boolean>(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const [visibilitySuccess, setVisibilitySuccess] = useState<string | null>(null);

  // User-made change tracking for Document List:
  // Enabled only if user actually toggled any document visibility since loaded or saved
  const isDirty = useMemo(() => {
    if (initialHiddenDocuments === null) return false;
    if (initialHiddenDocuments.length !== hiddenDocuments.length) return true;
    const initialSet = new Set(initialHiddenDocuments);
    return hiddenDocuments.some((id) => !initialSet.has(id));
  }, [hiddenDocuments, initialHiddenDocuments]);

  const lastFetchedIdRef = useRef<string>('');

  // Load steps from API if initialSteps is empty or when target workflow ID changes
  useEffect(() => {
    // If initialSteps already provided by parent, use them and NEVER trigger redundant re-fetch or skeleton
    if (initialSteps && initialSteps.length > 0) {
      setSteps(initialSteps);
      setIsLoading(false);
      return;
    }

    const { stepperId, stepperType } = getStepperContext();
    const targetStep = propConfirmationId || stepperId || stepId || '';

    if (!targetStep || targetStep === 'new-confirmation') {
      setSteps(DEFAULT_WORKFLOW_STEPPER_ITEMS);
      setIsLoading(false);
      return;
    }

    // Avoid refetching identical targetStep
    if (targetStep && targetStep === lastFetchedIdRef.current) {
      return;
    }

    lastFetchedIdRef.current = targetStep;
    let isMounted = true;

    const fetchSteps = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const actionToUse = propConfirmationId ? 'confirmation' : ((stepperType as any) || 'confirmation');
        const res = await getStepperListAction({
          action: actionToUse,
          step: targetStep || 'new-confirmation',
          lang,
        });

        if (!isMounted) return;

        let stepsData = res?.success && res?.data && res.data.length > 0 ? res.data : [];

        // If specific step ID returned empty, try fallback to new-confirmation template only if initialSteps is empty
        if (stepsData.length === 0 && (!initialSteps || initialSteps.length === 0) && targetStep && targetStep !== 'new-confirmation') {
          try {
            const fallbackRes = await getStepperListAction({
              action: 'confirmation',
              step: 'new-confirmation',
              lang,
            });
            if (fallbackRes?.success && fallbackRes?.data && fallbackRes.data.length > 0) {
              stepsData = fallbackRes.data;
            }
          } catch {
            // ignore
          }
        }

        if (stepsData.length > 0) {
          setSteps(stepsData);
          onUpdateSteps?.(stepsData);
        } else if (initialSteps && initialSteps.length > 0) {
          setSteps(initialSteps);
        } else {
          setSteps(DEFAULT_WORKFLOW_STEPPER_ITEMS);
        }
      } catch (err: any) {
        if (!isMounted) return;
        if (initialSteps && initialSteps.length > 0) {
          setSteps(initialSteps);
        } else {
          setSteps(DEFAULT_WORKFLOW_STEPPER_ITEMS);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSteps();

    return () => {
      isMounted = false;
    };
  }, [stepId, propConfirmationId, propStepperId, propStepperType, lang]);

  // Keep internal steps synced if parent provides fresh steps
  useEffect(() => {
    if (initialSteps && initialSteps.length > 0) {
      setSteps(initialSteps);
      setIsLoading(false);
    }
  }, [initialSteps]);

  // Keep internal selection synced if parent passes new currentStepIndex
  useEffect(() => {
    if (typeof currentStepIndex === 'number' && currentStepIndex >= 0) {
      setSelectedIndex(currentStepIndex);
    }
  }, [currentStepIndex]);

  // Resolves the dynamic redirect id from the current active step in stepper
  const getActiveStepRedirectId = useCallback((): string => {
    const safeSteps = Array.isArray(steps) ? steps : [];
    // 1. Current step from selection
    const activeStep = safeSteps[selectedIndex] || safeSteps[0];
    const activeId = extractStepRedirectId(activeStep);
    if (activeId) return activeId;

    // 2. Direct inspect active step keys
    if (activeStep) {
      const candidates = [
        activeStep.redirect_id,
        activeStep.redirectId,
        activeStep.redirect_document_id,
        activeStep.redirectDocumentId,
        activeStep.document_id,
        activeStep.confirmation_id,
        activeStep.contract_id,
        activeStep.proforma_id,
        activeStep.id,
        activeStep._id,
      ];
      for (const c of candidates) {
        if (c && typeof c === 'string') {
          const clean = c.trim();
          if (clean.length > 6 && !clean.includes('/') && !clean.includes('step-') && clean !== 'new-confirmation') {
            return clean;
          }
        }
      }
    }

    // 3. Check all steps in the stepper for any available redirect_id
    for (const step of safeSteps) {
      const candidateId = extractStepRedirectId(step);
      if (candidateId) return candidateId;
    }

    // 4. Fallback to stepId prop if it's a valid ID (not 'new-confirmation')
    if (stepId && stepId !== 'new-confirmation' && !stepId.startsWith('step-')) {
      const clean = String(stepId).trim();
      if (clean && clean.length > 5 && !clean.includes('/')) return clean;
    }

    // 5. Browser URL check directly (?id=...)
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id');
        if (urlId && urlId !== 'new-confirmation' && urlId.length > 5) {
          return urlId.trim();
        }
      } catch {
        // ignore
      }
    }

    return '';
  }, [steps, selectedIndex, stepId]);

  const safeSteps = Array.isArray(steps) ? steps : [];
  const visibleSteps = useMemo(() => {
    return safeSteps.filter((s) => !s.is_hidden && String(s.is_hidden) !== 'true');
  }, [safeSteps]);
  const completedCount = visibleSteps.filter(
    (s) => normalizeStepStatus(s?.status || s?.document_status || s?.step_status) === 'completed'
  ).length;

  const isContractView =
    Boolean(propIsContractStep) ||
    selectedIndex === 1 ||
    (safeSteps.length > selectedIndex && isContractStep(safeSteps[selectedIndex], selectedIndex));

  const getStepperContext = useCallback(() => {
    // 1. Resolve stepper action/type
    let sType = propConfirmationId ? 'confirmation' : propStepperType;
    if (!sType) {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const stepParam = urlParams.get('step')?.toLowerCase();
        if (stepParam === 'shipment' || stepParam === 'document' || stepParam === 'instruction' || stepParam === 'shipment_instruction') {
          sType = 'document';
        } else if (stepParam === 'contract') {
          sType = 'contract';
        } else {
          sType = propIsContractStep ? 'contract' : 'confirmation';
        }
      } else {
        sType = propIsContractStep ? 'contract' : 'confirmation';
      }
    }

    // 2. The document ID passed from the button / URL is the primary document ID:
    let sId = propConfirmationId || propStepId || propStepperId;

    if (typeof window !== 'undefined' && (!sId || sId === 'new-confirmation')) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id');
        if (urlId && urlId !== 'new-confirmation') {
          sId = urlId.trim();
        }
      } catch {
        // ignore
      }
    }

    if (!sId || sId === 'new-confirmation') {
      sId = propConfirmationId;
    }

    // 3. Fallback to active step redirect_id if still not resolved
    if (!sId || sId === 'new-confirmation') {
      const activeStep = safeSteps[selectedIndex] || safeSteps[0];
      const activeRedirect = getStepSelfId(activeStep);
      if (activeRedirect && String(activeRedirect) !== 'new-confirmation') {
        sId = String(activeRedirect);
      }
    }

    const finalType = String(sType || 'confirmation').trim().toLowerCase();
    const cleanId = String(sId || '').trim();
    const finalId =
      cleanId &&
      cleanId !== 'new-confirmation' &&
      cleanId !== 'undefined' &&
      cleanId !== 'null'
        ? cleanId
        : '';

    return { stepperType: finalType, stepperId: finalId };
  }, [
    propConfirmationId,
    propStepperType,
    propStepperId,
    propStepId,
    propIsContractStep,
    safeSteps,
    selectedIndex,
  ]);

  const { stepperType: resolvedStepperType, stepperId: resolvedStepperId } = getStepperContext();

  const isDocListDisabled = !resolvedStepperId;

  // On Open (handleOpen):
  // Toggle isOpen = !isOpen.
  // If opening, call the GET API.
  // On success, populate:
  // visibilityDocuments = response.data
  // hiddenDocuments = response.data.filter(d => d.is_hidden).map(d => d.id)
  const handleOpen = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      const { stepperType, stepperId } = getStepperContext();
      if (!stepperId) {
        // If !stepperId or if button is disabled, do not trigger fetch
        return;
      }

      setIsLoadingVisibility(true);
      setVisibilityError(null);
      setVisibilitySuccess(null);

      try {
        const res = await getStepperDocsListAction({
          stepperType,
          stepperId,
          confirmationId: propConfirmationId,
          contractId: isContractView && propConfirmationId !== stepperId ? stepperId : undefined,
          lang,
        });

        if (res?.success && Array.isArray(res?.data)) {
          setVisibilityDocuments(res.data);
          const hidden = res.data.filter((d) => d.is_hidden).map((d) => String(d.id));
          setHiddenDocuments(hidden);
          setInitialHiddenDocuments(hidden);
          setVisibilityError(null);
        } else {
          setVisibilityDocuments([]);
          setHiddenDocuments([]);
          setInitialHiddenDocuments([]);
          setVisibilityError(res?.error || 'Failed to load documents list');
        }
      } catch (err: any) {
        setVisibilityDocuments([]);
        setHiddenDocuments([]);
        setInitialHiddenDocuments([]);
        setVisibilityError(err?.message || 'Failed to load documents list');
      } finally {
        setIsLoadingVisibility(false);
      }
    } else {
      // Revert unsaved toggle state if closed without saving
      if (initialHiddenDocuments !== null) {
        setHiddenDocuments(initialHiddenDocuments);
      }
    }
  };

  // Toggle Switch Handler (handleToggle(documentId)):
  // If hiddenDocuments includes documentId, remove it (unhide).
  // If not present, add it (hide).
  const handleToggle = (documentId: string) => {
    setHiddenDocuments((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleStepClick = (step: StepperDocumentItem, index: number) => {
    setSelectedIndex(index);
    if (onSelectStep) {
      onSelectStep(step, index);
    }
  };

  const handlePdfClick = async (e: React.MouseEvent, step: StepperDocumentItem) => {
    e.stopPropagation();
    const directUrl = step.pdf_url || step.pdf || step.download_url || step.file_url;
    if (directUrl && typeof directUrl === 'string') {
      window.open(directUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const cleanId = String(getStepSelfId(step) || step.id || step._id || stepId || '').trim();
    if (!cleanId) return;

    try {
      const stepName = String(
        step.document_name || step.name || step.title || step.id || ''
      ).toLowerCase();
      const isCustomInvoice = isCustomInvoiceStep(step) || stepName.includes('custom') || (stepName.includes('invoice') && !stepName.includes('proforma')) || step.step === 5 || step.step === 6;
      const isShipment = !isCustomInvoice && (stepName.includes('shipment') || stepName.includes('instruction') || step.step === 4);
      const isContract = !isCustomInvoice && !isShipment && (stepName.includes('contract') || step.step === 2);
      const isProforma = !isCustomInvoice && !isShipment && !isContract && (stepName.includes('proforma') || step.step === 3);
      const prefix = isCustomInvoice ? 'custom_invoice' : isShipment ? 'shipment_instruction' : isContract ? 'contract' : isProforma ? 'proforma' : 'confirmation';

      const res = await downloadDocPdfAction({
        prefix,
        id: cleanId,
        customInvoiceId: isCustomInvoice ? cleanId : undefined,
        lang,
      });

      if (res.success) {
        const fallbackName = `${prefix.toUpperCase()}-${cleanId}.pdf`;
        downloadPdfFromActionResponse(res, fallbackName);
      }
    } catch (err) {
      console.error('[DocumentStatusStepper] handlePdfClick error:', err);
    }
  };

  const isStepMatchingDoc = useCallback((stepItem: StepperDocumentItem, docConfig: StepperDocConfigItem): boolean => {
    const stepId = String(stepItem.id || stepItem._id || stepItem.document_id || stepItem.doc_id || '').trim();
    const configId = String(docConfig.id || '').trim();
    if (stepId && configId && stepId === configId) return true;

    const sName = String(stepItem.document_name || stepItem.name || stepItem.title || '').trim().toLowerCase();
    const cName = String(docConfig.name || '').trim().toLowerCase();
    if (sName && cName && sName === cName) return true;

    if (isConfirmationStep(stepItem) && isConfirmationStep(docConfig as any)) return true;
    if (isContractStep(stepItem) && isContractStep(docConfig as any)) return true;
    if (isProformaStep(stepItem) && isProformaStep(docConfig as any)) return true;
    if (isShipmentInstructionStep(stepItem) && isShipmentInstructionStep(docConfig as any)) return true;
    if (isCustomInvoiceStep(stepItem) && isCustomInvoiceStep(docConfig as any)) return true;

    return false;
  }, []);

  const refreshSteps = () => {
    startTransition(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { stepperId, stepperType } = getStepperContext();
        const actionToUse = propConfirmationId ? 'confirmation' : ((stepperType as any) || 'confirmation');
        const targetStep = propConfirmationId || stepperId || stepId || 'new-confirmation';
        let res = await getStepperListAction({
          action: actionToUse,
          step: targetStep,
          lang,
        });
        let stepsData = res?.success && res?.data && res.data.length > 0 ? res.data : [];
        if (stepsData.length === 0 && targetStep !== 'new-confirmation') {
          const fallbackRes = await getStepperListAction({
            action: 'confirmation',
            step: 'new-confirmation',
            lang,
          });
          if (fallbackRes?.success && fallbackRes?.data && fallbackRes.data.length > 0) {
            stepsData = fallbackRes.data;
          }
        }
        if (stepsData.length > 0) {
          const finalSteps = stepsData.map((s) => {
            if (s.is_hidden !== undefined && s.is_hidden !== null) return s;
            const isDocHidden = visibilityDocuments.some(
              (doc) => hiddenDocuments.includes(String(doc.id)) && isStepMatchingDoc(s, doc)
            );
            return {
              ...s,
              is_hidden: isDocHidden,
            };
          });
          setSteps(finalSteps);
          onUpdateSteps?.(finalSteps);
        } else {
          setSteps(initialSteps && initialSteps.length > 0 ? initialSteps : DEFAULT_WORKFLOW_STEPPER_ITEMS);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to refresh steps');
      } finally {
        setIsLoading(false);
      }
    });
  };

  // On Save Click (handleSubmitVisibility):
  // Prepare payload mapping documents with current visibility:
  // const stepper_docs = visibilityDocuments.map((doc) => ({
  //   id: doc.id,
  //   is_hidden: hiddenDocuments.includes(doc.id),
  //   allow_hide: doc.allow_hide,
  // }));
  // Send PATCH/PUT request with { stepper_docs }.
  // On success:
  // Close dropdown (isOpen = false).
  // Re-trigger the main Stepper steps API so the vertical steps immediately reflect the updated visible documents.
  const handleSubmitVisibility = async () => {
    const { stepperType, stepperId } = getStepperContext();
    if (!stepperId) {
      setVisibilityError(
        dict?.smart_docs?.save_draft_first || 'Please save the draft first'
      );
      return;
    }

    const stepper_docs = visibilityDocuments.map((doc) => ({
      id: doc.id,
      is_hidden: hiddenDocuments.includes(doc.id),
      allow_hide: doc.allow_hide,
    }));

    setIsSaving(true);
    setVisibilityError(null);
    setVisibilitySuccess(null);

    try {
      const res = await saveStepperDocsListAction({
        stepperType,
        stepperId,
        confirmationId: propConfirmationId,
        contractId: isContractView && propConfirmationId !== stepperId ? stepperId : undefined,
        stepper_docs,
        lang,
      });

      if (res?.success) {
        setInitialHiddenDocuments(hiddenDocuments);
        setVisibilitySuccess(dict?.common?.saved_successfully || 'Saved successfully');
        setIsOpen(false);
        // Optimistically update visible steps locally so parent and stepper update instantly
        const updatedSteps = (steps || []).map((s) => {
          const isDocHidden = visibilityDocuments.some(
            (doc) => hiddenDocuments.includes(String(doc.id)) && isStepMatchingDoc(s, doc)
          );
          return {
            ...s,
            is_hidden: isDocHidden,
          };
        });
        setSteps(updatedSteps);
        onUpdateSteps?.(updatedSteps);
        // Re-trigger the main Stepper steps API so the vertical steps immediately reflect the updated visible documents
        refreshSteps();
      } else {
        setVisibilityError(res?.error || 'Failed to save visibility');
      }
    } catch (err: any) {
      setVisibilityError(err?.message || 'Failed to save visibility');
    } finally {
      setIsSaving(false);
    }
  };

  const cleanConf = cleanDocNumber(
    confirmationNumber ||
    safeSteps[0]?.confirmation_number ||
    safeSteps.find((s, i) => isConfirmationStep(s, i))?.confirmation_number
  );

  const cleanCont = cleanDocNumber(
    contractNumber ||
    safeSteps[1]?.contract_number ||
    safeSteps.find((s, i) => isContractStep(s, i))?.contract_number
  );

  let activeDocNumber: string | null = null;
  if (cleanCont) {
    activeDocNumber = cleanCont;
  } else if (cleanConf) {
    activeDocNumber = cleanConf;
  }

  const titleText = (dict?.smart_docs?.document_list || 'DOCUMENT LIST').toUpperCase();

  return (
    <div className={`w-full flex flex-col ${isMobile ? '' : 'h-full'} select-none relative overflow-hidden`}>
      {/* Stepper Card Header */}
      {!isMobile && (
        <div className="shrink-0 pb-2 mb-1 border-b border-border">
          {/* Active Document Number: Centered, 14px, no box/border */}
          {activeDocNumber && (
            <div className="mb-1.5 text-center">
              <span
                className="text-[14px] font-bold text-foreground font-mono select-all tracking-tight truncate block"
                title={activeDocNumber}
              >
                {activeDocNumber}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleOpen}
            disabled={isDocListDisabled}
            className="w-full group flex items-center justify-between gap-2 px-1 py-1 -mx-1 rounded-md hover:bg-muted/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer text-left focus:outline-hidden"
            title={
              isDocListDisabled
                ? 'Please save draft first to manage documents list'
                : 'Click to manage document list visibility'
            }
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-5 h-5 rounded bg-brand-blue/10 text-brand-blue dark:text-sky-400 flex items-center justify-center shrink-0 text-xs">
                <i className="fa-solid fa-list-check" />
              </span>
              <h2 className="text-xs sm:text-[13px] font-bold text-foreground tracking-wide uppercase truncate group-hover:text-brand-blue transition-colors">
                {titleText}
              </h2>
              {!isLoading && visibleSteps.length > 0 && (
                <span
                  className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue dark:text-sky-400 border border-brand-blue/20 dark:border-sky-500/30"
                  title={`${completedCount} of ${visibleSteps.length} documents completed`}
                >
                  {completedCount}/{visibleSteps.length}
                </span>
              )}
            </div>

            <i
              className={`fa-solid fa-chevron-down text-[10px] text-muted-foreground group-hover:text-foreground transition-transform duration-200 shrink-0 ${
                isOpen ? 'rotate-180 text-brand-blue' : ''
              }`}
            />
          </button>
        </div>
      )}

      {/* Mobile Drawer Header */}
      {isMobile && (
        <div className="shrink-0 pb-2 mb-2 border-b border-border">
          {/* Active Document Number: Centered, 14px, no box/border */}
          {activeDocNumber && (
            <div className="mb-1.5 text-center">
              <span
                className="text-[14px] font-bold text-foreground font-mono select-all tracking-tight truncate block"
                title={activeDocNumber}
              >
                {activeDocNumber}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleOpen}
            disabled={isDocListDisabled}
            className="w-full group flex items-center justify-between gap-2 px-1 py-1 -mx-1 rounded-md hover:bg-muted/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer text-left focus:outline-hidden"
            title={
              isDocListDisabled
                ? 'Please save draft first to manage documents list'
                : 'Click to manage document list visibility'
            }
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-5 h-5 rounded bg-brand-blue/10 text-brand-blue dark:text-sky-400 flex items-center justify-center shrink-0 text-xs">
                <i className="fa-solid fa-list-check" />
              </span>
              <h2 className="text-xs sm:text-[13px] font-bold text-foreground tracking-wide uppercase truncate group-hover:text-brand-blue transition-colors">
                {titleText}
              </h2>
              {!isLoading && visibleSteps.length > 0 && (
                <span
                  className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue dark:text-sky-400 border border-brand-blue/20 dark:border-sky-500/30"
                  title={`${completedCount} of ${visibleSteps.length} documents completed`}
                >
                  {completedCount}/{visibleSteps.length}
                </span>
              )}
            </div>

            <i
              className={`fa-solid fa-chevron-down text-[10px] text-muted-foreground group-hover:text-foreground transition-transform duration-200 shrink-0 ${
                isOpen ? 'rotate-180 text-brand-blue' : ''
              }`}
            />
          </button>
        </div>
      )}

      {/* 
        PATTA (Document List Visibility Panel):
        Directly beneath header HR without extra spacing, fills down inside stepper card
      */}
      {isOpen ? (
        <div className="flex-1 min-h-0 flex flex-col bg-card animate-in fade-in duration-150">
          {/* Scrollable list of toggle items inside the card patta */}
          <div className="flex-1 min-h-0 overflow-y-scroll overscroll-contain py-1 pr-1 custom-scrollbar space-y-0.5">
            {isLoadingVisibility ? (
              <div className="flex flex-col space-y-1 py-1" role="status" aria-label="Loading documents">
                {[
                  { w: 'w-36', locked: true },
                  { w: 'w-44', locked: false },
                  { w: 'w-32', locked: false },
                  { w: 'w-48', locked: false },
                  { w: 'w-28', locked: false },
                  { w: 'w-40', locked: false },
                  { w: 'w-36', locked: false },
                  { w: 'w-32', locked: false },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg animate-pulse"
                  >
                    <div className="min-w-0 flex-1 flex items-center">
                      <div className={`h-3.5 ${item.w} max-w-[70%] rounded-md bg-muted/80`} />
                    </div>
                    <div className="shrink-0 flex items-center justify-end">
                      {item.locked ? (
                        <div className="w-7 h-7 rounded-md bg-muted/70" />
                      ) : (
                        <div className="h-5 w-9 rounded-full bg-muted/70" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : visibilityDocuments.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 px-3 text-center">
                <i className="fa-solid fa-folder-open text-muted-foreground/60 text-lg" />
                <span className="text-xs text-muted-foreground font-medium">
                  {visibilityError || dict?.smart_docs?.no_documents || 'No documents in workflow'}
                </span>
              </div>
            ) : (
              visibilityDocuments.map((doc) => {
                const isLocked = !doc.allow_hide;
                const isHidden = hiddenDocuments.includes(doc.id);
                const isVisible = !isHidden;

                return (
                  <div
                    key={doc.id}
                    onClick={!isLocked ? () => handleToggle(doc.id) : undefined}
                    className={`group flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg transition-all ${
                      isLocked
                        ? 'opacity-85 cursor-not-allowed bg-transparent'
                        : 'cursor-pointer hover:bg-muted/50 active:scale-[0.99]'
                    }`}
                  >
                    {/* Document Name: UPPERCASE, clear proportional font, balanced layout */}
                    <div className="min-w-0 flex-1 flex items-center">
                      <span
                        className={`text-xs sm:text-[12.5px] uppercase tracking-wide block truncate select-none leading-snug transition-colors ${
                          isVisible
                            ? 'font-semibold text-foreground'
                            : 'font-normal text-muted-foreground/75'
                        }`}
                        title={doc.name}
                      >
                        {doc.name}
                      </span>
                    </div>

                    {/* Right Side: Red lock icon for locked items, clean toggle switch for toggleable items */}
                    <div className="shrink-0 flex items-center justify-end">
                      {isLocked ? (
                        <div
                          title="Mandatory step in workflow (Locked)"
                          className="w-7 h-7 rounded-md bg-red-500/10 text-red-500 dark:text-red-400 flex items-center justify-center border border-red-500/20 shadow-2xs"
                        >
                          <i className="fa-solid fa-lock text-xs" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isVisible}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(doc.id);
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-hidden cursor-pointer ${
                            isVisible
                              ? 'bg-brand-blue dark:bg-sky-500 shadow-2xs'
                              : 'bg-muted-foreground/25 hover:bg-muted-foreground/35'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
                              isVisible ? 'translate-x-[18px]' : 'translate-x-[2px]'
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Patta Bottom Footer: Cancel & Save Buttons */}
          <div className="shrink-0 pt-2 border-t border-border/80 flex flex-col gap-1.5">
            {visibilityError && (
              <span className="text-[11px] text-destructive font-medium truncate block text-center">
                {visibilityError}
              </span>
            )}
            {visibilitySuccess && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate block text-center">
                {visibilitySuccess}
              </span>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (initialHiddenDocuments !== null) {
                    setHiddenDocuments(initialHiddenDocuments);
                  }
                  setIsOpen(false);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                {dict?.common?.cancel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSubmitVisibility}
                disabled={isSaving || isLoadingVisibility || !isDirty}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-blue text-white hover:bg-brand-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-[0.98]"
                title={!isDirty ? 'No changes to save' : 'Save document list visibility'}
              >
                {isSaving && <i className="fa-solid fa-circle-notch fa-spin text-[10px]" />}
                <span>{dict?.common?.save || 'Save'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Standard Stepper Body - Compact High-Density list */
        <div
          className={
            isMobile
              ? 'w-full pr-1'
              : 'flex-1 min-h-0 overflow-y-scroll overscroll-contain pr-1 custom-scrollbar'
          }
        >
          {isLoading && (!visibleSteps || visibleSteps.length === 0) ? (
            <StepperSkeleton count={11} />
          ) : error && (!visibleSteps || visibleSteps.length === 0) ? (
            <div className="py-6 px-3 text-center flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
                <i className="fa-solid fa-triangle-exclamation text-xs" />
              </div>
              <p className="text-xs text-muted-foreground mb-2.5">{error}</p>
              <button
                type="button"
                onClick={refreshSteps}
                className="text-xs font-medium px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-rotate-right text-[10px]" />
                <span>{dict?.smart_docs?.retry || 'Retry'}</span>
              </button>
            </div>
          ) : visibleSteps.length === 0 ? (
            <div className="py-6 px-3 text-center text-muted-foreground text-xs">
              <i className="fa-regular fa-folder-open text-lg mb-1.5 text-muted-foreground/60 block" />
              {dict?.smart_docs?.no_documents_found || 'No documents in workflow'}
            </div>
          ) : (
            <div className="relative flex flex-col space-y-0.5">
              {visibleSteps.map((step, index) => {
                const docName =
                  step.document_name ||
                  step.name ||
                  step.title ||
                  step.doc_name ||
                  step.step_name ||
                  `${dict?.smart_docs?.step_prefix || 'Document'} ${index + 1}`;

                const rawStatus = step.status || step.document_status || step.step_status;
                const normalized = normalizeStepStatus(rawStatus);
                const isSelected = selectedIndex === index;
                const isLast = index === visibleSteps.length - 1;
                const isPdfEnabled = isStepPdfEnabled(step);
                const stepNumber = step.step ?? step.step_number ?? step.order ?? index + 1;
                const pdfUrl = step.pdf_url || step.pdf || step.download_url || step.file_url;

                const isStepLocked = (() => {
                  if (index === 0) return false;
                  if (index === selectedIndex) return false;
                  if (index < selectedIndex) return false;
                  if (normalized === 'completed') return false;

                  const selfId = getStepSelfId(step);
                  if (selfId) return false;

                  if (Boolean(step.is_locked || step.locked || normalized === 'locked')) {
                    return true;
                  }

                  const prevStep = visibleSteps[index - 1];
                  const prevStatus = normalizeStepStatus(prevStep?.status || prevStep?.document_status || prevStep?.step_status);
                  const prevHasId = Boolean(getStepSelfId(prevStep));
                  if (prevStatus !== 'completed' && !prevHasId) {
                    return true;
                  }
                  return false;
                })();

                return (
                  <div
                    key={step.id || step._id || index}
                    onClick={!isStepLocked ? () => handleStepClick(step, index) : undefined}
                    className={`relative group flex items-center gap-2 px-2 py-1 rounded-md border transition-all duration-150 ${
                      isStepLocked
                        ? 'cursor-not-allowed select-none opacity-60 border-transparent bg-transparent'
                        : isSelected
                        ? 'bg-primary/5 hover:bg-primary/10 border-primary/20 text-brand-blue dark:text-sky-400'
                        : 'cursor-pointer hover:bg-muted/40 border-transparent'
                    }`}
                  >
                    <div className="relative flex items-center justify-center shrink-0 w-5 h-5">
                      {index > 0 && (
                        <div
                          className={`absolute -top-2 left-1/2 -translate-x-1/2 w-0.5 h-2.5 transition-colors ${
                            normalizeStepStatus(visibleSteps[index - 1]?.status) === 'completed'
                              ? 'bg-emerald-500/70'
                              : 'bg-border'
                          }`}
                        />
                      )}

                      {!isLast && (
                        <div
                          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-0.5 h-2.5 transition-colors ${
                            normalized === 'completed'
                              ? 'bg-emerald-500/70'
                              : 'bg-border'
                          }`}
                        />
                      )}

                      <div
                        className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-150 ${
                          normalized === 'completed'
                            ? 'bg-emerald-500 !text-white shadow-2xs ring-1 ring-emerald-500/30'
                            : isSelected || normalized === 'in_progress'
                            ? 'bg-brand-blue dark:bg-sky-500 !text-white ring-2 ring-brand-blue/20 dark:ring-sky-500/25 shadow-2xs'
                            : isStepLocked
                            ? 'bg-muted text-muted-foreground/60 border border-border/80 font-medium'
                            : 'bg-muted/70 text-foreground/80 border border-border font-medium'
                        }`}
                      >
                        {normalized === 'completed' ? (
                          <i className="fa-solid fa-check !text-white text-[8px]" />
                        ) : (
                          <span className={normalized === 'in_progress' || isSelected ? '!text-white font-bold leading-none' : 'leading-none'}>
                            {stepNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <span
                        className={`text-[12px] sm:text-[12.5px] truncate transition-colors leading-tight ${
                          isStepLocked
                            ? 'text-muted-foreground font-medium select-none'
                            : isSelected
                            ? 'text-brand-blue dark:text-sky-400 font-bold'
                            : 'text-foreground font-medium group-hover:text-brand-blue dark:group-hover:text-sky-400'
                        }`}
                        title={docName}
                      >
                        {docName}
                      </span>
                      <div className="mt-0.5 flex items-center">
                        <StatusBadge
                          status={normalized}
                          rawStatus={rawStatus}
                          dict={dict}
                        />
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      {!isStepLocked && isPdfEnabled ? (
                        <button
                          type="button"
                          onClick={(e) => handlePdfClick(e, step)}
                          title={
                            pdfUrl
                              ? dict?.smart_docs?.view_pdf || 'View / Download PDF'
                              : dict?.smart_docs?.download_pdf || 'Download PDF'
                          }
                          className="w-7 h-7 rounded-md bg-brand-red/10 hover:bg-brand-red/20 text-brand-red border border-brand-red/20 hover:border-brand-red/40 flex items-center justify-center transition-all duration-150 transform hover:scale-105 active:scale-95 shadow-2xs cursor-pointer group/pdf"
                          aria-label={`PDF for ${docName}`}
                        >
                          <i className="fa-solid fa-file-pdf text-[13px]" />
                        </button>
                      ) : (
                        <div
                          title={dict?.smart_docs?.pdf_not_available || 'PDF not generated yet'}
                          className="w-7 h-7 rounded-md bg-muted/20 border border-border/30 text-muted-foreground/35 flex items-center justify-center cursor-not-allowed select-none"
                          aria-disabled="true"
                        >
                          <i className="fa-regular fa-file-pdf text-[13px]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  rawStatus,
  dict,
}: {
  status: NormalizedStatus;
  rawStatus?: string;
  dict?: any;
}) {
  const norm = normalizeStepStatus(rawStatus || status);
  if (norm === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 leading-none">
        <i className="fa-solid fa-check text-[7px]" />
        <span>{dict?.smart_docs?.status_completed || 'Completed'}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 leading-none">
      <i className="fa-regular fa-clock text-[7px]" />
      <span>{dict?.smart_docs?.status_pending || 'Pending'}</span>
    </span>
  );
}

function StepperSkeleton({ count = 5 }: { count?: number }) {
  const items = Array.from({ length: Math.min(count, 12) }, (_, i) => i + 1);
  return (
    <div className="space-y-0.5 animate-pulse">
      {items.map((i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-md border border-transparent">
          <div className="w-5 h-5 rounded-full bg-muted/60 shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="h-3 bg-muted/50 rounded w-3/4" />
            <div className="w-12 h-2.5 bg-muted/40 rounded" />
          </div>
          <div className="w-7 h-7 rounded-md bg-muted/30 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default DocumentStatusStepper;

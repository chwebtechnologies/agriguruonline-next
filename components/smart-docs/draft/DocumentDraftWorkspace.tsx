'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type {
  StepperDocumentItem,
  InstructionPartyOption,
  SmartDocsProductOption,
} from '@/lib/api/smart-docs.service';
import DocumentStatusStepper, { normalizeStepStatus } from './DocumentStatusStepper';
import ConfirmationDocumentForm, { FormOptionItem } from './form/ConfirmationDocumentForm';
import ContractDocumentForm from './form/ContractDocumentForm';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  saveConfirmationDraftAction,
  submitConfirmationAction,
  getStepperListAction,
} from '@/app/actions/smart-docs';

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
  initialData?: any;
  initialId?: string;
  initialStepParam?: string;
}

export function isConfirmationStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (index === 0) return true;
  if (!step) return false;
  const id = String(step.id || '').toLowerCase();
  const name = String(step.document_name || step.name || '').toLowerCase();
  return id.includes('confirmation') || name.includes('confirmation');
}

export function isContractStep(step?: StepperDocumentItem | null, index?: number): boolean {
  if (index === 1) return true;
  if (!step) return false;
  const id = String(step.id || '').toLowerCase();
  const name = String(step.document_name || step.name || '').toLowerCase();
  return id.includes('contract') || name.includes('contract');
}

export function getStepSlug(step?: StepperDocumentItem | null, index?: number): string {
  if (index === 0 || isConfirmationStep(step, index)) return 'confirmation';
  if (index === 1 || isContractStep(step, index)) return 'contract';
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
  if (!stepList || stepList.length === 0) return 0;

  // 1. If explicit step param in URL, match requested step
  if (stepParam && stepParam.trim()) {
    const clean = stepParam.trim().toLowerCase();
    if (clean === 'confirmation' || clean === '1') {
      return 0;
    }
    if (clean === 'contract' || clean === '2') {
      const contractIdx = stepList.findIndex((s) => isContractStep(s));
      return contractIdx >= 0 ? contractIdx : (stepList.length > 1 ? 1 : 0);
    }
    const matchedIdx = stepList.findIndex((s, i) => {
      const id = String(s.id || '').toLowerCase();
      const name = String(s.document_name || s.name || '').toLowerCase();
      return id === clean || name === clean || String(i + 1) === clean;
    });
    if (matchedIdx >= 0) return matchedIdx;
  }

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
  initialData,
  initialId,
  initialStepParam,
}: DocumentDraftWorkspaceProps) {
  const [steps, setSteps] = useState<StepperDocumentItem[]>(initialSteps);
  const [draftId, setDraftId] = useState<string>(
    initialId || initialData?.id || initialData?._id || initialData?.confirmation_id || ''
  );

  // Compute initial selected step (honoring explicit URL param or defaulting to latest open step)
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(() =>
    resolveInitialStepIndex(initialSteps, initialStepParam)
  );
  const [selectedStep, setSelectedStep] = useState<StepperDocumentItem | null>(() => {
    const idx = resolveInitialStepIndex(initialSteps, initialStepParam);
    return initialSteps && initialSteps.length > 0 ? initialSteps[idx] || initialSteps[0] : null;
  });

  const [isMobileStepperOpen, setIsMobileStepperOpen] = useState<boolean>(false);

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

  // Handle step selection with URL shallow synchronization for proper linking
  const handleSelectStep = useCallback(
    (step: StepperDocumentItem, index: number) => {
      setSelectedStepIndex(index);
      setSelectedStep(step);
      setIsMobileStepperOpen(false);

      // Deep link navigation: update URL query parameters without full page reload
      const slug = getStepSlug(step, index);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (draftId) {
          url.searchParams.set('id', draftId);
        }
        url.searchParams.set('step', slug);
        window.history.replaceState(null, '', url.toString());
      }
    },
    [draftId]
  );

  const isContract = selectedStepIndex === 1 || isContractStep(selectedStep, selectedStepIndex);

  const pageTitle = isContract
    ? dict?.smart_docs?.draft_contract_title || dict?.smart_docs?.draft_contract || 'Draft Contract'
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

  const activeDocName =
    selectedStep?.document_name ||
    selectedStep?.name ||
    selectedStep?.title ||
    selectedStep?.doc_name ||
    (isContract
      ? dict?.smart_docs?.contract_form?.sales_contract_title || 'Sales Contract'
      : dict?.smart_docs?.draft_title || 'Trade Confirmation');

  return (
    <div className="flex-1 min-h-fit lg:min-h-0 flex flex-col lg:overflow-hidden">
      {/* Header Bar with Dynamic Step Title */}
      <div className="shrink-0">
        <PageHeader
          title={pageTitle}
          backText={dict?.common?.back || 'Back'}
          backHref={`/${lang}/smart-docs`}
        />
      </div>

      <div className="w-full flex-1 min-h-fit lg:min-h-0 lg:h-full flex flex-col lg:flex-row items-stretch justify-start gap-3 sm:gap-4 lg:gap-5 pb-2 sm:pb-3 lg:pb-0">
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {dict?.smart_docs?.document_status || 'Document Step'} ({selectedStepIndex + 1}/{steps.length || 11})
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
          <div className="mt-2.5 pt-2 border-t border-border animate-in fade-in duration-200 max-h-[60vh] sm:max-h-[440px] overflow-y-auto overscroll-contain touch-pan-y">
            <DocumentStatusStepper
              isMobile
              stepId={draftId}
              initialSteps={steps}
              currentStepIndex={selectedStepIndex}
              onSelectStep={handleSelectStep}
              lang={lang}
              dict={dict}
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
        <div className={`w-full h-full flex flex-col ${isContract ? 'hidden' : 'flex'}`}>
          <ConfirmationDocumentForm
            initialData={initialData}
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
            onSaveSuccess={(savedId) => {
              if (savedId) {
                setDraftId(savedId);
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.set('id', savedId);
                  window.history.replaceState(null, '', url.toString());
                }
              }
            }}
            onSaveDraft={async (formData) => {
              const res = await saveConfirmationDraftAction(formData, lang);
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

                // Update stepper to reflect completion and switch to contract step
                try {
                  const stepperRes = await getStepperListAction({
                    action: 'confirmation',
                    step: String(newId || 'new-confirmation'),
                    lang,
                  });
                  if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                    setSteps(stepperRes.data);
                    const contractIndex = stepperRes.data.findIndex((s) => isContractStep(s));
                    const targetIdx =
                      contractIndex >= 0 ? contractIndex : (stepperRes.data.length > 1 ? 1 : 0);
                    setSelectedStepIndex(targetIdx);
                    setSelectedStep(stepperRes.data[targetIdx] || null);

                    // Update URL to contract step
                    if (typeof window !== 'undefined') {
                      const url = new URL(window.location.href);
                      if (newId) url.searchParams.set('id', String(newId));
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
        </div>

        {/* Contract Document Form: Visible when Contract Step is active */}
        <div className={`w-full h-full flex flex-col ${isContract ? 'flex' : 'hidden'}`}>
          <ContractDocumentForm
            initialData={undefined}
            lang={lang}
            dict={dict}
            sellers={initialSellers}
            buyers={initialBuyers}
            products={initialProducts}
            paymentTerms={initialPaymentTerms}
            currencies={initialCurrencies}
            shippingTerms={shippingTerms}
            onSaveDraft={async (formData) => {
              const res = await saveConfirmationDraftAction(formData, lang);
              return res;
            }}
            onSubmitContract={async (formData) => {
              const res = await submitConfirmationAction(formData, lang);
              return res;
            }}
          />
        </div>
      </div>

      {/* 
        Right Side: Desktop Stepper Card
        - Rendered only on desktop (lg and up) to avoid taking 100% height and squashing form on mobile
      */}
      <aside 
        id="draft-stepper-card"
        className="hidden lg:flex w-[260px] xl:w-[280px] 2xl:w-[300px] shrink-0 h-full min-h-0 bg-card border border-border rounded-xl shadow-xs overflow-hidden flex-col relative z-10"
      >
        {/* Stepper Viewport (pinned header with internal scrollable list) */}
        <div className="w-full h-full flex flex-col p-2.5 sm:p-3 min-h-0">
          <DocumentStatusStepper
            stepId={draftId}
            initialSteps={steps}
            currentStepIndex={selectedStepIndex}
            onSelectStep={handleSelectStep}
            lang={lang}
            dict={dict}
          />
        </div>
      </aside>
    </div>
    </div>
  );
}

export default DocumentDraftWorkspace;

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  type StepperDocumentItem,
  type InstructionPartyOption,
  type SmartDocsProductOption,
  type SmartDocsSelectionDocumentOption,
  extractContractData,
  normalizeStepStatus,
  extractStepId,
  isConfirmationStep,
  isContractStep,
  getContractStep,
  getContractIdFromStepper,
  sanitizeDocId,
} from '@/lib/api/smart-docs.service';
import DocumentStatusStepper from './DocumentStatusStepper';
import ConfirmationDocumentForm, { FormOptionItem } from './form/ConfirmationDocumentForm';
import ContractDocumentForm from './form/ContractDocumentForm';
import DocumentDraftSkeleton from './DocumentDraftSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  saveConfirmationDraftAction,
  submitConfirmationAction,
  saveContractDraftAction,
  submitContractAction,
  getContractAction,
  getStepperListAction,
} from '@/app/actions/smart-docs';

export {
  extractStepId,
  isConfirmationStep,
  isContractStep,
  getContractStep,
  getContractIdFromStepper,
  normalizeStepStatus,
};

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
  initialId?: string;
  initialStepParam?: string;
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
      const contractIdx = stepList.findIndex((s, idx) => isContractStep(s, idx));
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
  initialDocumentList = [],
  initialData,
  initialContractData,
  initialId,
  initialStepParam,
}: DocumentDraftWorkspaceProps) {
  const [steps, setSteps] = useState<StepperDocumentItem[]>(initialSteps);
  const [draftId, setDraftId] = useState<string>(
    initialId || initialContractData?.id || initialContractData?._id || initialData?.id || initialData?._id || initialData?.confirmation_id || ''
  );
  const [contractData, setContractData] = useState<any>(initialContractData || null);
  const [isLoadingContract, setIsLoadingContract] = useState<boolean>(() => {
    const isInitiallyContract = initialStepParam === 'contract' || initialStepParam === '2';
    return isInitiallyContract && !initialContractData;
  });

  // Compute initial selected step (honoring explicit URL param or defaulting to latest open step)
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(() =>
    resolveInitialStepIndex(initialSteps, initialStepParam)
  );
  const [selectedStep, setSelectedStep] = useState<StepperDocumentItem | null>(() => {
    const idx = resolveInitialStepIndex(initialSteps, initialStepParam);
    return initialSteps && initialSteps.length > 0 ? initialSteps[idx] || initialSteps[0] : null;
  });

  const [isMobileStepperOpen, setIsMobileStepperOpen] = useState<boolean>(false);

  // Contract ID extracted strictly from Stepper list / selectedStep (user: "id tumhe stepper se milegi")
  const contractIdFromStepper = useMemo(() => {
    return getContractIdFromStepper(steps, selectedStep);
  }, [steps, selectedStep]);

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

      const isSelectingContract = index === 1 || isContractStep(step, index);
      if (isSelectingContract && !contractData && !initialContractData) {
        setIsLoadingContract(true);
      }

      const stepDocId = extractStepId(step);
      if (stepDocId) {
        setDraftId(stepDocId);
      }

      // Deep link navigation: update URL query parameters without full page reload
      const slug = getStepSlug(step, index);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const urlId = stepDocId || draftId;
        if (urlId) {
          url.searchParams.set('id', urlId);
        }
        url.searchParams.set('step', slug);
        window.history.replaceState(null, '', url.toString());
      }
    },
    [draftId]
  );

  const isConfirmation = selectedStepIndex === 0 || isConfirmationStep(selectedStep, selectedStepIndex);
  const isContract = !isConfirmation && (selectedStepIndex === 1 || isContractStep(selectedStep, selectedStepIndex));

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

  useEffect(() => {
    if (initialContractData && !contractData) {
      setContractData(initialContractData);
    }
  }, [initialContractData, contractData]);

  // Fetch contract data dynamically if contract step is active and contract data not yet loaded
  useEffect(() => {
    const effectiveContractId =
      contractIdFromStepper ||
      initialContractData?.id ||
      initialContractData?._id ||
      contractData?.id ||
      contractData?._id ||
      initialData?.contract_id ||
      initialData?.contractId;

    if (isContract && effectiveContractId && !contractData && !isLoadingContract) {
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
    }
  }, [isContract, contractIdFromStepper, initialContractData, initialData, contractData, isLoadingContract, lang]);

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
        <div className={`w-full h-full flex flex-col ${isConfirmation ? 'flex' : 'hidden'}`}>
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

                    // Update URL to contract step
                    if (typeof window !== 'undefined') {
                      const url = new URL(window.location.href);
                      url.searchParams.set('id', newContractId || String(newId));
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
          {isContract && (isLoadingContract || (!contractData && !initialContractData)) ? (
            <DocumentDraftSkeleton mode="contract" isFormCardOnly />
          ) : (
            <ContractDocumentForm
              initialData={contractData || initialContractData || initialData}
              contractId={contractIdFromStepper}
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
              onSaveSuccess={(savedId) => {
                if (savedId) {
                  setDraftId(savedId);
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('id', savedId);
                    url.searchParams.set('step', 'contract');
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
              onSubmitContract={async (formData) => {
                const res = await submitContractAction(formData, lang);
                if (res?.success) {
                  const newId = res.id || res.data?.id || res.data?.proforma_id || res.data?.contract_id;
                  if (newId) {
                    setDraftId(String(newId));
                  }
                  if (res.data) {
                    const extracted = extractContractData(res.data) || res.data;
                    setContractData((prev: any) => {
                      const updated = { ...(prev || {}) };
                      if (extracted && typeof extracted === 'object') {
                        for (const [k, v] of Object.entries(extracted)) {
                          if (v !== undefined && v !== null && v !== '') {
                            updated[k] = v;
                          }
                        }
                      }
                      return updated;
                    });
                  }
                  // Refresh stepper
                  try {
                    const stepperRes = await getStepperListAction({
                      action: 'confirmation',
                      step: String(newId || draftId || 'new-confirmation'),
                      lang,
                    });
                    if (stepperRes?.success && stepperRes.data && stepperRes.data.length > 0) {
                      setSteps(stepperRes.data);
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

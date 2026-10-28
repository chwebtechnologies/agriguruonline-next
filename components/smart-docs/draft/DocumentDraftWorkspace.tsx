'use client';

import React, { useState } from 'react';
import type {
  StepperDocumentItem,
  InstructionPartyOption,
  SmartDocsProductOption,
} from '@/lib/api/smart-docs.service';
import DocumentStatusStepper from './DocumentStatusStepper';
import ConfirmationDocumentForm, { FormOptionItem } from './form/ConfirmationDocumentForm';
import { saveConfirmationDraftAction } from '@/app/actions/smart-docs';

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
}: DocumentDraftWorkspaceProps) {
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [selectedStep, setSelectedStep] = useState<StepperDocumentItem | null>(
    initialSteps.length > 0 ? initialSteps[0] : null
  );
  const [isMobileStepperOpen, setIsMobileStepperOpen] = useState<boolean>(false);

  const activeDocName =
    selectedStep?.document_name ||
    selectedStep?.name ||
    selectedStep?.title ||
    selectedStep?.doc_name ||
    (initialSteps.length > 0
      ? initialSteps[0]?.document_name || initialSteps[0]?.name
      : dict?.smart_docs?.draft_title || 'Trade Confirmation');

  return (
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
                {dict?.smart_docs?.document_status || 'Document Step'} ({selectedStepIndex + 1}/{initialSteps.length || 11})
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
              initialSteps={initialSteps}
              currentStepIndex={selectedStepIndex}
              onSelectStep={(step, index) => {
                setSelectedStepIndex(index);
                setSelectedStep(step);
                setIsMobileStepperOpen(false);
              }}
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
      */}
      <div 
        id="draft-form-card"
        className="w-full flex-1 min-w-0 min-h-fit lg:min-h-0 lg:h-full bg-card border border-border rounded-xl shadow-xs overflow-visible lg:overflow-hidden flex flex-col relative z-10"
      >
        <ConfirmationDocumentForm
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
            console.log('[DocumentDraftWorkspace] Submitted to contract:', formData);
            if (initialSteps.length > selectedStepIndex + 1) {
              const nextIdx = selectedStepIndex + 1;
              setSelectedStepIndex(nextIdx);
              setSelectedStep(initialSteps[nextIdx]);
            }
          }}
        />
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
            initialSteps={initialSteps}
            currentStepIndex={selectedStepIndex}
            onSelectStep={(step, index) => {
              setSelectedStepIndex(index);
              setSelectedStep(step);
            }}
            lang={lang}
            dict={dict}
          />
        </div>
      </aside>
    </div>
  );
}

export default DocumentDraftWorkspace;

'use client';

import React, { useState, useEffect, useTransition } from 'react';
import type { StepperDocumentItem } from '@/lib/api/smart-docs.service';
import { getStepperListAction } from '@/app/actions/smart-docs';

export type NormalizedStatus = 'completed' | 'in_progress' | 'pending' | 'locked';

export function normalizeStepStatus(rawStatus?: string): NormalizedStatus {
  if (!rawStatus) return 'pending';
  const s = String(rawStatus).toLowerCase().trim();
  if (['completed', 'complete', 'done', 'approved', 'success', 'finished'].includes(s)) {
    return 'completed';
  }
  if (['in_progress', 'inprogress', 'in-progress', 'active', 'current', 'processing', 'draft'].includes(s)) {
    return 'in_progress';
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
  lang?: string;
  dict?: any;
  isMobile?: boolean;
}

export function DocumentStatusStepper({
  initialSteps,
  currentStepIndex = 0,
  onSelectStep,
  lang = 'en',
  dict,
  isMobile = false,
}: DocumentStatusStepperProps) {
  const [steps, setSteps] = useState<StepperDocumentItem[]>(initialSteps || []);
  const [selectedIndex, setSelectedIndex] = useState<number>(currentStepIndex);
  const [isLoading, setIsLoading] = useState<boolean>(!initialSteps || initialSteps.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load steps if initialSteps wasn't provided or empty
  useEffect(() => {
    if (initialSteps && initialSteps.length > 0) {
      setSteps(initialSteps);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const fetchSteps = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getStepperListAction({
          action: 'confirmation',
          step: 'new-confirmation',
          lang,
        });

        if (!isMounted) return;

        if (res.success && res.data && res.data.length > 0) {
          setSteps(res.data);
        } else if (res.error) {
          setError(res.error);
        } else {
          // Fallback initial draft workflow steps
          setSteps(getDefaultSteps());
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || 'Failed to load steps');
        setSteps(getDefaultSteps());
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchSteps();

    return () => {
      isMounted = false;
    };
  }, [initialSteps, lang]);

  // Keep internal selection synced if parent passes new currentStepIndex
  useEffect(() => {
    if (typeof currentStepIndex === 'number' && currentStepIndex >= 0) {
      setSelectedIndex(currentStepIndex);
    }
  }, [currentStepIndex]);

  const handleStepClick = (step: StepperDocumentItem, index: number) => {
    setSelectedIndex(index);
    if (onSelectStep) {
      onSelectStep(step, index);
    }
  };

  const handlePdfClick = (e: React.MouseEvent, step: StepperDocumentItem) => {
    e.stopPropagation();
    const pdfUrl = step.pdf_url || step.pdf || step.download_url || step.file_url;
    if (pdfUrl && typeof pdfUrl === 'string') {
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const refreshSteps = () => {
    startTransition(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getStepperListAction({
          action: 'confirmation',
          step: 'new-confirmation',
          lang,
        });
        if (res.success && res.data && res.data.length > 0) {
          setSteps(res.data);
        } else {
          setError(res.error || 'Failed to refresh steps');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to refresh steps');
      } finally {
        setIsLoading(false);
      }
    });
  };

  const completedCount = steps.filter(
    (s) => normalizeStepStatus(s.status || s.document_status || s.step_status) === 'completed'
  ).length;

  return (
    <div className={`w-full flex flex-col ${isMobile ? '' : 'h-full'} select-none`}>
      {/* Simple Sober Header */}
      {!isMobile && (
        <div className="shrink-0 pb-2 mb-1 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-5 h-5 rounded bg-brand-blue/10 text-brand-blue dark:text-sky-400 flex items-center justify-center shrink-0 text-xs">
                <i className="fa-solid fa-list-check" />
              </span>
              <h2 className="text-xs sm:text-[13px] font-bold text-foreground tracking-tight truncate">
                {dict?.smart_docs?.document_status || 'Document Status'}
              </h2>
            </div>

            {/* Progress Pill */}
            {!isLoading && steps.length > 0 && (
              <span
                className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue dark:text-sky-400 border border-brand-blue/20 dark:border-sky-500/30"
                title={`${completedCount} of ${steps.length} documents completed`}
              >
                {completedCount} / {steps.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stepper Body - Compact High-Density list: fits all 10-12 steps without unnecessary scrolling */}
      <div
        className={
          isMobile
            ? 'w-full pr-0.5'
            : 'flex-1 min-h-0 overflow-y-auto overscroll-contain pr-0.5 custom-scrollbar'
        }
      >
        {isLoading ? (
          <StepperSkeleton count={steps.length > 0 ? steps.length : 11} />
        ) : error && steps.length === 0 ? (
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
        ) : steps.length === 0 ? (
          <div className="py-6 px-3 text-center text-muted-foreground text-xs">
            <i className="fa-regular fa-folder-open text-lg mb-1.5 text-muted-foreground/60 block" />
            {dict?.smart_docs?.no_documents_found || 'No documents in workflow'}
          </div>
        ) : (
          <div className="relative flex flex-col space-y-0.5">
            {steps.map((step, index) => {
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
              const isLast = index === steps.length - 1;
              const isPdfEnabled = isStepPdfEnabled(step);
              const stepNumber = step.step ?? step.step_number ?? step.order ?? index + 1;
              const pdfUrl = step.pdf_url || step.pdf || step.download_url || step.file_url;

              // Step-by-step locking:
              // - Step 0 is unlocked.
              // - Completed steps are unlocked.
              // - Currently active step is unlocked.
              // - Upcoming steps are locked from clicking until previous steps are completed.
              const isStepLocked = (() => {
                if (Boolean(step.is_locked || step.locked || normalized === 'locked')) {
                  return true;
                }
                if (index === 0) return false;
                if (normalized === 'completed') return false;
                if (index <= selectedIndex) return false;

                // Check if all previous steps up to this one are completed
                for (let i = 0; i < index; i++) {
                  const prevStatus = normalizeStepStatus(
                    steps[i]?.status || steps[i]?.document_status || steps[i]?.step_status
                  );
                  if (prevStatus !== 'completed' && i >= selectedIndex) {
                    return true;
                  }
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
                  {/* Step Node Indicator with timeline connector */}
                  <div className="relative flex items-center justify-center shrink-0 w-5 h-5">
                    {/* Top connector line */}
                    {index > 0 && (
                      <div
                        className={`absolute -top-2 left-1/2 -translate-x-1/2 w-0.5 h-2.5 transition-colors ${
                          normalizeStepStatus(steps[index - 1]?.status) === 'completed'
                            ? 'bg-emerald-500/70'
                            : 'bg-border'
                        }`}
                      />
                    )}

                    {/* Bottom connector line */}
                    {!isLast && (
                      <div
                        className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-0.5 h-2.5 transition-colors ${
                          normalized === 'completed'
                            ? 'bg-emerald-500/70'
                            : 'bg-border'
                        }`}
                      />
                    )}

                    {/* Node circle: shows clean step number or checkmark if completed */}
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

                  {/* Document Name & Status Badge (Badge preserves original API status: Pending, In Progress, Completed, etc.) */}
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
                      <StatusBadge status={normalized} rawStatus={rawStatus} dict={dict} />
                    </div>
                  </div>

                  {/* Right-side Action: PDF Button (Larger icon, PDF icon shown on all rows) */}
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
    </div>
  );
}

/**
 * Status Badge Component: strictly displays the status that comes from the API (Pending, In Progress, Completed, etc.)
 */
function StatusBadge({
  status,
  rawStatus,
  dict,
}: {
  status: NormalizedStatus;
  rawStatus?: string;
  dict?: any;
}) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 leading-none">
        <i className="fa-solid fa-check text-[7px]" />
        <span>{dict?.smart_docs?.status_completed || 'Completed'}</span>
      </span>
    );
  }

  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-brand-blue/10 text-brand-blue dark:text-sky-400 border border-brand-blue/20 dark:border-sky-500/30 leading-none">
        <i className="fa-solid fa-circle-notch fa-spin text-[7px]" />
        <span>{dict?.smart_docs?.status_in_progress || 'In Progress'}</span>
      </span>
    );
  }

  // Display raw status or localized "Pending"
  const label =
    rawStatus && typeof rawStatus === 'string' && rawStatus.trim()
      ? rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).replace(/[-_]/g, ' ')
      : dict?.smart_docs?.status_pending || 'Pending';

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 leading-none">
      <i className="fa-regular fa-clock text-[7px]" />
      <span>{label}</span>
    </span>
  );
}

/**
 * Skeleton Loader matching simple sober compact dimensions
 */
function StepperSkeleton({ count = 11 }: { count?: number }) {
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

/**
 * Default fallback steps when initial response is empty
 */
function getDefaultSteps(): StepperDocumentItem[] {
  return [
    {
      id: 'trade-confirmation',
      document_name: 'Trade Confirmation',
      status: 'in_progress',
      step: 1,
      pdf_url: null,
      is_pdf_available: false,
    },
    {
      id: 'sales-contract',
      document_name: 'Sales Contract',
      status: 'pending',
      step: 2,
      pdf_url: null,
      is_pdf_available: false,
    },
    {
      id: 'commercial-invoice',
      document_name: 'Commercial Invoice',
      status: 'pending',
      step: 3,
      pdf_url: null,
      is_pdf_available: false,
    },
    {
      id: 'packing-list',
      document_name: 'Packing List',
      status: 'pending',
      step: 4,
      pdf_url: null,
      is_pdf_available: false,
    },
  ];
}

export default DocumentStatusStepper;

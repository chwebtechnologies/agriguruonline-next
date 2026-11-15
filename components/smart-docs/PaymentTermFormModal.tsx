'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { handleFormFocusScroll } from './form-scroll-utils';

export interface PaymentTermFormData {
  id?: string;
  title: string;
  status: boolean;
  is_active?: boolean;
}

export interface PaymentTermFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  paymentTerm?: any;
  onSave: (data: PaymentTermFormData) => Promise<any> | void;
  dict?: any;
  isLoading?: boolean;
  isSubmitting?: boolean;
  externalErrors?: Record<string, string>;
}

export function PaymentTermFormModal({
  isOpen,
  onClose,
  mode,
  paymentTerm,
  onSave,
  dict,
  isLoading = false,
  isSubmitting = false,
  externalErrors,
}: PaymentTermFormModalProps) {
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<boolean>(true);
  const [error, setError] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const isFirstOpenRef = useRef(false);
  const prevTermIdRef = useRef<string | null>(null);
  const backdropMouseDownRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state when modal opens or editing payment term changes
  useEffect(() => {
    if (!isOpen) {
      isFirstOpenRef.current = false;
      prevTermIdRef.current = null;
      return;
    }

    const currentTermId =
      mode === 'edit' && paymentTerm
        ? String(paymentTerm.id || paymentTerm._id || paymentTerm.title || '')
        : '';

    // Only populate if first open or switched to a different term
    if (!isFirstOpenRef.current || (mode === 'edit' && currentTermId && currentTermId !== prevTermIdRef.current)) {
      isFirstOpenRef.current = true;
      prevTermIdRef.current = currentTermId;

      if (mode === 'edit' && paymentTerm) {
        const rawTitle =
          paymentTerm.title ||
          paymentTerm.name ||
          paymentTerm.label ||
          paymentTerm.term ||
          '';
        setTitle(rawTitle);

        const rawStatus =
          paymentTerm.status !== undefined
            ? paymentTerm.status
            : paymentTerm.is_active !== undefined
            ? paymentTerm.is_active
            : paymentTerm.isActive;

        if (typeof rawStatus === 'boolean') {
          setStatus(rawStatus);
        } else if (typeof rawStatus === 'number') {
          setStatus(rawStatus === 1);
        } else if (typeof rawStatus === 'string') {
          const lower = rawStatus.trim().toLowerCase();
          setStatus(lower === 'true' || lower === '1' || lower === 'active');
        } else {
          setStatus(true);
        }
      } else {
        setTitle('');
        setStatus(true);
      }
      setError('');

      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, mode, paymentTerm]);

  useEffect(() => {
    if (externalErrors && (externalErrors.title || externalErrors.general)) {
      setError(externalErrors.title || externalErrors.general || '');
    }
  }, [externalErrors]);

  // Backdrop Click Handlers - Do NOT close on outside click to prevent data loss
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    // Backdrop click disabled to prevent accidental closure
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Backdrop click disabled - only explicit [X] or Cancel button closes modal
  };

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, isLoading, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(
        dict?.smart_docs?.confirmation_form?.enter_payment_term ||
          'Payment term title is required'
      );
      titleInputRef.current?.focus();
      return;
    }

    const termId =
      paymentTerm?.id ||
      paymentTerm?._id ||
      paymentTerm?.payment_term_id ||
      paymentTerm?.paymentTermId;

    await onSave({
      id: mode === 'edit' && termId ? String(termId) : undefined,
      title: trimmedTitle,
      status,
      is_active: status,
    });
  };

  const modalTitle =
    mode === 'edit'
      ? dict?.smart_docs?.edit_payment_term || 'Edit Payment Term'
      : dict?.smart_docs?.add_payment_term || 'Add New Payment Term';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-term-form-title"
      className="fixed inset-0 w-screen h-screen z-9999 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-lg bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header - Exact matching ProductManageModal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8.5 h-8.5 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm shrink-0">
              <i
                className={`fa-solid ${
                  mode === 'edit' ? 'fa-pen-to-square' : 'fa-file-invoice-dollar'
                }`}
              />
            </span>
            <h3
              id="payment-term-form-title"
              className="text-sm sm:text-base font-bold text-foreground leading-tight"
            >
              {modalTitle}
            </h3>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Modal Body / Form */}
        {isLoading ? (
          <div className="flex flex-col animate-pulse">
            <div className="p-5 flex flex-col gap-4">
              {/* Title Input Skeleton */}
              <div className="flex flex-col gap-1.5">
                <div className="h-3.5 w-20 bg-muted/70 rounded" />
                <div className="w-full h-10 bg-muted/40 rounded-lg border border-border" />
              </div>

              {/* Status Toggle Skeleton */}
              <div className="flex items-center justify-between pt-1">
                <div className="h-3.5 w-16 bg-muted/70 rounded" />
                <div className="w-11 h-6 bg-muted/50 rounded-full" />
              </div>
            </div>

            {/* Sticky Modal Actions Footer Skeleton */}
            <div className="sticky bottom-0 z-20 flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-border bg-card/95 backdrop-blur-xs shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.35)]">
              <button
                type="button"
                onClick={onClose}
                className="h-9.5 px-4 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {dict?.common?.cancel || 'Cancel'}
              </button>
              <div className="h-9.5 w-32 bg-muted/50 rounded-lg border border-border" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} onFocusCapture={handleFormFocusScroll} className="flex flex-col scroll-smooth">
            <div className="p-5 flex flex-col gap-4 text-xs sm:text-sm">
              {/* Title Input */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <span>{dict?.smart_docs?.payment_term_title || 'Title'}</span>
                  <span className="text-destructive">*</span>
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  disabled={isLoading || isSubmitting}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g. 100% Advance, 30% Advance 70% against BL, LC at Sight"
                  className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors placeholder:text-muted-foreground/60 disabled:opacity-50 ${
                    error
                      ? 'border-destructive focus:ring-1 focus:ring-destructive'
                      : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                  }`}
                />
                {error && (
                  <span className="text-[11px] text-destructive font-medium animate-in fade-in flex items-center gap-1 mt-0.5">
                    <i className="fa-solid fa-circle-exclamation text-[10px]" />
                    <span>{error}</span>
                  </span>
                )}
              </div>

              {/* Status Label and Toggle - Directly below Title without extra card */}
              <div className="flex items-center justify-between pt-1">
                <label
                  onClick={() => {
                    if (!isLoading && !isSubmitting) setStatus(!status);
                  }}
                  className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <span>{dict?.smart_docs?.status || 'Status'}</span>
                </label>

                {/* Status Switch - Theme Blue (bg-brand-blue) */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={status}
                  data-no-focus-outline="true"
                  disabled={isLoading || isSubmitting}
                  onClick={() => setStatus(!status)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setStatus((prev) => !prev);
                    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      setStatus(true);
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      setStatus(false);
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out data-no-focus-outline outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:opacity-50 ${
                    status ? 'bg-brand-blue' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span className="sr-only">Toggle Status</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      status ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Sticky Modal Actions Footer - Exact matching ProductManageModal */}
            <div className="sticky bottom-0 z-20 flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-border bg-card/95 backdrop-blur-xs shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.35)]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-9.5 px-4 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
              >
                {dict?.common?.cancel || 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-9.5 px-5 text-xs font-bold rounded-lg bg-brand-green hover:bg-brand-green-hover text-white shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                ) : (
                  <i className="fa-solid fa-check text-xs" />
                )}
                <span>
                  {mode === 'edit'
                    ? dict?.common?.update || 'Update Payment Term'
                    : dict?.common?.save || 'Save Payment Term'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

export default PaymentTermFormModal;

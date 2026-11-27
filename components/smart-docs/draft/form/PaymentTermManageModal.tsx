'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { FormOptionItem } from './ConfirmationDocumentForm';
import { handleFormFocusScroll } from '@/components/smart-docs/form-scroll-utils';

export interface PaymentTermManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  paymentTerm?: FormOptionItem | null;
  onSave: (termData: {
    id: string;
    label: string;
    days?: string;
    description?: string;
  }) => void;
  dict?: any;
}

const QUICK_PRESETS = [
  '100% Advance',
  '30% Advance, 70% against BL copy',
  '20% Advance, 80% against BL copy',
  '100% CAD',
  '100% Irrevocable LC at Sight',
  'LC 30 Days',
  'LC 60 Days',
  'DA 30 Days',
  'DP at Sight',
];

export function PaymentTermManageModal({
  isOpen,
  onClose,
  mode,
  paymentTerm,
  onSave,
  dict,
}: PaymentTermManageModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [days, setDays] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);
  const isFirstOpenRef = useRef(false);
  const prevTermIdRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper to populate term data
  const populateTermData = (term: any) => {
    if (!term) return;
    setName(term.label || term.name || term.title || term.term || '');
    setDays(
      term.days !== undefined && term.days !== null
        ? String(term.days)
        : term.credit_days
        ? String(term.credit_days)
        : ''
    );
    setDescription(
      term.description ||
        term.desc ||
        term.notes ||
        (term.subLabel && !term.subLabel.includes('Days credit period')
          ? term.subLabel
          : '') ||
        ''
    );
  };

  // Sync state when modal opens or editing payment term changes
  useEffect(() => {
    if (!isOpen) {
      isFirstOpenRef.current = false;
      prevTermIdRef.current = null;
      return;
    }

    const currentTermId =
      mode === 'edit' && paymentTerm
        ? String(paymentTerm.value || paymentTerm.id || paymentTerm._id || paymentTerm.label || '')
        : '';

    // Only populate if first open or switched to a different term
    if (!isFirstOpenRef.current || (mode === 'edit' && currentTermId && currentTermId !== prevTermIdRef.current)) {
      isFirstOpenRef.current = true;
      prevTermIdRef.current = currentTermId;

      if (mode === 'edit' && paymentTerm) {
        populateTermData(paymentTerm);
      } else {
        setName(paymentTerm?.label || '');
        setDays('');
        setDescription('');
      }
      setError('');

      // Auto-focus the name input after render
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
      return;
    }

    // Modal was already open, same record (asynchronous detailed fetch returned):
    if (mode === 'edit' && currentTermId && currentTermId === prevTermIdRef.current && paymentTerm) {
      populateTermData(paymentTerm);
    }
  }, [isOpen, mode, paymentTerm]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is active
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(
        dict?.smart_docs?.confirmation_form?.enter_payment_term ||
          'Payment term name or condition is required'
      );
      nameInputRef.current?.focus();
      return;
    }

    const id =
      mode === 'edit' && paymentTerm?.value
        ? paymentTerm.value
        : `pt-custom-${Date.now()}`;

    onSave({
      id,
      label: trimmedName,
      days: days.trim() || undefined,
      description: description.trim() || undefined,
    });

    onClose();
  };

  const title =
    mode === 'edit'
      ? dict?.smart_docs?.confirmation_form?.edit_payment_term || 'Edit Payment Term'
      : dict?.smart_docs?.confirmation_form?.add_payment_term || 'Add Payment Term';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-term-manage-title"
      className="fixed inset-0 w-screen h-screen z-9999 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm">
              <i
                className={`fa-solid ${
                  mode === 'edit' ? 'fa-pen-to-square' : 'fa-file-invoice-dollar'
                }`}
              />
            </span>
            <div>
              <h3
                id="payment-term-manage-title"
                className="text-sm sm:text-base font-bold text-foreground leading-tight"
              >
                {title}
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                {mode === 'edit'
                  ? 'Update payment term terms, credit days, and conditions'
                  : 'Add a new payment term to select in your trade confirmation'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form
          onSubmit={handleSubmit}
          onFocusCapture={handleFormFocusScroll}
          className="p-5 flex flex-col gap-4 text-xs sm:text-sm overflow-y-auto custom-scrollbar flex-1 scroll-smooth"
        >
          {/* Quick preset chips */}
          {mode === 'add' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Suggestions
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    data-no-focus-outline="true"
                    onClick={() => {
                      setName(preset);
                      if (error) setError('');
                      if (preset.includes('30 Days')) setDays('30');
                      else if (preset.includes('60 Days')) setDays('60');
                      else if (preset.includes('Sight')) setDays('At Sight');
                    }}
                    className={`px-2 py-1 text-[11px] rounded-md border transition-colors cursor-pointer data-no-focus-outline outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                      name === preset
                        ? 'bg-primary text-primary-foreground border-primary font-semibold'
                        : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Payment Term Name */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <span>{dict?.smart_docs?.confirmation_form?.payment_term || 'Payment Term / Terms'}</span>
              <span className="text-destructive">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. 30% Advance, 70% against BL copy or 100% LC at Sight"
              className={`w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                error
                  ? 'border-destructive focus:ring-1 focus:ring-destructive'
                  : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
              }`}
            />
            {error && (
              <span className="text-[11px] text-destructive font-medium animate-in fade-in flex items-center gap-1">
                <i className="fa-solid fa-circle-exclamation text-[10px]" />
                <span>{error}</span>
              </span>
            )}
          </div>

          {/* Credit Days / Period */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Credit Period / Days</span>
              <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="e.g. 30, 60, or At Sight"
              className="w-full h-10 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          {/* Description / Additional Conditions */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Additional Details / Description</span>
              <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
                (optional)
              </span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Balance payment within 7 working days upon receipt of scanned BL copy via email"
              className="w-full p-3 px-3.5 text-xs sm:text-sm bg-background text-foreground border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border mt-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {dict?.common?.cancel || 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <i className="fa-solid fa-check text-[11px]" />
              <span>
                {mode === 'edit'
                  ? dict?.common?.update || 'Update Term'
                  : dict?.common?.save || 'Save Term'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default PaymentTermManageModal;


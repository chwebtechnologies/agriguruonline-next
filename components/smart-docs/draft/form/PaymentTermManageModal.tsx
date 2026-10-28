'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { FormOptionItem } from './ConfirmationDocumentForm';

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

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state when modal opens or editing payment term changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && paymentTerm) {
        setName(paymentTerm.label || paymentTerm.name || paymentTerm.title || paymentTerm.term || '');
        setDays(
          paymentTerm.days !== undefined && paymentTerm.days !== null
            ? String(paymentTerm.days)
            : paymentTerm.credit_days
            ? String(paymentTerm.credit_days)
            : ''
        );
        setDescription(
          paymentTerm.description ||
            paymentTerm.desc ||
            paymentTerm.notes ||
            (paymentTerm.subLabel && !paymentTerm.subLabel.includes('Days credit period')
              ? paymentTerm.subLabel
              : '') ||
            ''
        );
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
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
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
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs sm:text-sm">
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
                    onClick={() => {
                      setName(preset);
                      if (error) setError('');
                      if (preset.includes('30 Days')) setDays('30');
                      else if (preset.includes('60 Days')) setDays('60');
                      else if (preset.includes('Sight')) setDays('At Sight');
                    }}
                    className={`px-2 py-1 text-[11px] rounded-md border transition-colors cursor-pointer ${
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
            <label className="font-semibold text-xs text-foreground flex items-center gap-1">
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
              className={`w-full px-3 py-2 text-xs sm:text-sm bg-background text-foreground border rounded-lg outline-none transition-colors ${
                error
                  ? 'border-destructive focus:ring-1 focus:ring-destructive'
                  : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
              }`}
            />
            {error && (
              <span className="text-[11px] text-destructive font-medium animate-in fade-in">
                {error}
              </span>
            )}
          </div>

          {/* Credit Days / Period */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-xs text-foreground">
              Credit Period / Days (Optional)
            </label>
            <input
              type="text"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="e.g. 30, 60, or At Sight"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-background text-foreground border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          {/* Description / Additional Conditions */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-xs text-foreground">
              Additional Details / Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Balance payment within 7 working days upon receipt of scanned BL copy via email"
              className="w-full px-3 py-2 text-xs sm:text-sm bg-background text-foreground border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border mt-1">
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


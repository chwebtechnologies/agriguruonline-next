'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { FormOptionItem } from './ConfirmationDocumentForm';

export interface InstructionManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  partyType: 'seller' | 'buyer';
  party?: FormOptionItem | null;
  onSave: (partyData: {
    id: string;
    label: string;
    instructionText: string;
  }) => void;
  dict?: any;
}

export function InstructionManageModal({
  isOpen,
  onClose,
  mode,
  partyType,
  party,
  onSave,
  dict,
}: InstructionManageModalProps) {
  const [mounted, setMounted] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [instructionText, setInstructionText] = useState('');
  const [error, setError] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state when modal opens or editing party changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && party) {
        setCompanyName(
          party.label ||
            party.company_name ||
            party.name ||
            party.title ||
            ''
        );
        setInstructionText(
          party.instructionText ||
            party.instruction ||
            party.subLabel ||
            party.details ||
            ''
        );
      } else {
        setCompanyName(party?.label || '');
        setInstructionText(party?.instructionText || party?.instruction || party?.subLabel || '');
      }
      setError('');

      // Auto-focus the name input after render
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, mode, party]);

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

  const isSeller = partyType === 'seller';
  const roleName = isSeller
    ? dict?.smart_docs?.confirmation_form?.exporter_seller || 'Exporter (Seller)'
    : dict?.smart_docs?.confirmation_form?.importer_buyer || 'Importer (Buyer)';

  const title =
    mode === 'edit'
      ? `Edit ${roleName}`
      : `Add ${roleName}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = companyName.trim();
    if (!trimmedName) {
      setError('Company name is required');
      nameInputRef.current?.focus();
      return;
    }

    const trimmedInstruction = instructionText.trim() || trimmedName;

    const id =
      mode === 'edit' && party?.value
        ? party.value
        : `inst-custom-${Date.now()}`;

    onSave({
      id,
      label: trimmedName,
      instructionText: trimmedInstruction,
    });

    onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="instruction-manage-title"
      className="fixed inset-0 w-screen h-screen z-9999 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-card text-foreground border border-border rounded-xl shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs">
              <i className="fa-solid fa-building" />
            </span>
            <div>
              <h2 id="instruction-manage-title" className="text-sm font-bold text-foreground">
                {title}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {isSeller ? 'Provide exporter and seller details' : 'Provide importer and buyer details'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-7 h-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-xs shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Company Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Company / Entity Name <span className="text-destructive">*</span></span>
              <span className="text-[10px] text-muted-foreground font-normal">e.g. Agri Trade Global Ltd</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Enter company or trader name"
              className="w-full px-3 py-2 text-xs bg-background text-foreground border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Instruction & Address Details */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Full Address, Contact &amp; Instructions</span>
              <span className="text-[10px] text-muted-foreground font-normal">Address, City, Country, Contact, Email</span>
            </label>
            <textarea
              rows={4}
              value={instructionText}
              onChange={(e) => setInstructionText(e.target.value)}
              placeholder="e.g. 102 Business Bay, Tower 1, Dubai, UAE, Contact: +971-501234567, Email: info@agritrade.com"
              className="w-full px-3 py-2 text-xs bg-background text-foreground border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50 resize-y leading-relaxed"
            />
            <p className="text-[10.5px] text-muted-foreground">
              These details will be populated in the instruction block on your contract and confirmation.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <i className="fa-solid fa-check text-xs" />
              <span>{mode === 'edit' ? 'Update' : 'Add Party'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default InstructionManageModal;


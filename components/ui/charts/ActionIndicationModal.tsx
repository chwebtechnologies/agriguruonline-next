'use client';

import React, { useEffect } from 'react';

interface ActionIndicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  indicationText?: string;
}

export function ActionIndicationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Action Required',
  description = 'An error occurred.',
  indicationText = 'Confirm'
}: ActionIndicationModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-modal-title"
      aria-describedby="action-modal-desc"
    >
      <div className="bg-card rounded-2xl p-5 w-full sm:w-max max-w-[95vw] shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
        <div className="flex gap-4 items-center mb-6">
          <div className="w-12 h-12 bg-brand-red/10 dark:bg-brand-red/20 rounded-full flex items-center justify-center shrink-0 text-brand-red">
            <i className="fa-solid fa-circle-exclamation text-xl"></i>
          </div>
          <div className="flex flex-col justify-center w-full items-center">
            <h3 id="action-modal-title" className="text-[17px] font-bold text-foreground mb-1 leading-none text-center">
              {title}
            </h3>
            <p id="action-modal-desc" className="text-foreground/80 text-[14px] leading-snug text-center">
              {description}
            </p>
          </div>
        </div>

        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-brand-green text-white font-semibold text-[15px] shadow-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group"
          >
            <span className="relative z-10 capitalize">{indicationText.replace(/_/g, ' ')}</span>
            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-button-shine" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-[15px] shadow-sm active:scale-[0.98] transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActionIndicationModal;

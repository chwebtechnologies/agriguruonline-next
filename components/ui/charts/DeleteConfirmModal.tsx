'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/lib/scroll-lock';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  isDeleting?: boolean;
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  common?: any;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isDeleting = false,
  confirmText,
  cancelText,
  icon,
  common = {}
}: DeleteConfirmModalProps) {
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isDeleting]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const content = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-desc"
      onClick={!isDeleting ? onClose : undefined}
    >
      <div 
        className="relative bg-card text-foreground rounded-2xl p-5 sm:p-6 w-[90vw] sm:w-[380px] max-w-[380px] shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200 mx-auto flex flex-col items-center text-center my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Close Button */}
        <button
          type="button"
          onClick={!isDeleting ? onClose : undefined}
          disabled={isDeleting}
          className="absolute top-3.5 right-3.5 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40"
          aria-label="Close"
        >
          <i className="fa-solid fa-xmark text-xs"></i>
        </button>

        {/* Hero Trash / Warning Icon Badge */}
        <div className="relative mb-3.5 flex items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-brand-red/10 dark:bg-brand-red/20 text-brand-red flex items-center justify-center shrink-0 ring-4 ring-brand-red/10 dark:ring-brand-red/15">
            <i className={`${icon || 'fa-solid fa-trash-can'} text-lg`}></i>
          </div>
        </div>

        {/* Title */}
        <h3 id="delete-modal-title" className="text-[17px] sm:text-[18px] font-bold text-foreground mb-1.5 tracking-tight leading-snug">
          {title || common?.delete_item || 'Delete Record'}
        </h3>

        {/* Description */}
        <p id="delete-modal-desc" className="text-muted-foreground text-[13px] sm:text-[13.5px] leading-relaxed max-w-[310px] mb-5">
          {description || common?.delete_confirm_desc || 'Are you sure you want to delete this item?'}
        </p>

        {/* Action Buttons */}
        <div className="flex w-full items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 h-9 sm:h-10 px-3.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold text-[13.5px] shadow-2xs active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelText || common?.cancel || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 h-9 sm:h-10 px-3.5 rounded-xl bg-brand-red hover:bg-brand-red-hover active:bg-brand-red-hover text-white font-semibold text-[13.5px] shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                <span>{common?.deleting || 'Deleting...'}</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-trash-can text-xs"></i>
                <span>{confirmText || common?.delete || 'Delete'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default DeleteConfirmModal;

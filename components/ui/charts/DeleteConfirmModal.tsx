'use client';

import React from 'react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  isDeleting?: boolean;
  common?: any;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isDeleting = false,
  common = {}
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 px-4">
      <div className="bg-card rounded-2xl p-5 w-full sm:w-max max-w-[95vw] shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
        <div className="flex gap-4 items-center mb-6">
          <div className="w-12 h-12 bg-brand-red/10 dark:bg-brand-red/20 rounded-full flex items-center justify-center shrink-0 text-brand-red">
            <i className="fa-solid fa-triangle-exclamation text-xl"></i>
          </div>
          <div className="flex flex-col justify-center w-full items-center">
            <h3 className="text-[17px] font-bold text-brand-red mb-1 leading-none text-center">
              {title || common?.delete_item || 'Delete Item'}
            </h3>
            <p className="text-foreground/80 text-[14px] leading-snug whitespace-nowrap text-center">
              {description || common?.delete_confirm_desc || 'Are you sure you want to delete this item?'}
            </p>
          </div>
        </div>

        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl bg-brand-red text-white font-semibold text-[15px] shadow-sm hover:bg-brand-red-hover active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (common?.deleting || 'Deleting...') : (common?.delete || 'Delete')}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-[15px] shadow-sm active:scale-[0.98] transition-all cursor-pointer"
          >
            {common?.cancel || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;

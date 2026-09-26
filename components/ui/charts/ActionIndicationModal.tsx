'use client';

import React, { useEffect } from 'react';

interface ActionIndicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  indicationText?: string;
  type?: 'error' | 'warning' | 'info' | 'success';
}

export function ActionIndicationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Action Required',
  description = 'An error occurred.',
  indicationText = 'Confirm',
  type = 'error'
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

  const getTypeStyles = () => {
    switch (type) {
      case 'warning':
        return {
          bgClass: 'bg-yellow-500/10 dark:bg-yellow-500/20',
          textClass: 'text-yellow-500 dark:text-yellow-400',
          iconClass: 'fa-solid fa-triangle-exclamation'
        };
      case 'info':
        return {
          bgClass: 'bg-brand-blue/10 dark:bg-brand-blue/20',
          textClass: 'text-brand-blue',
          iconClass: 'fa-solid fa-circle-info'
        };
      case 'success':
        return {
          bgClass: 'bg-brand-green/10 dark:bg-brand-green/20',
          textClass: 'text-brand-green',
          iconClass: 'fa-solid fa-circle-check'
        };
      case 'error':
      default:
        return {
          bgClass: 'bg-brand-red/10 dark:bg-brand-red/20',
          textClass: 'text-brand-red',
          iconClass: 'fa-solid fa-circle-exclamation'
        };
    }
  };

  const { bgClass, textClass, iconClass } = getTypeStyles();

  return (
    <div 
      className="fixed inset-0 z-[600] flex items-center justify-center bg-background/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-modal-title"
      aria-describedby="action-modal-desc"
    >
      <div className="bg-card rounded-3xl p-6 sm:p-7 w-[92vw] sm:w-[420px] shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200 mx-auto flex flex-col items-center text-center">
        <div className={`w-16 h-16 ${bgClass} rounded-full flex items-center justify-center shrink-0 ${textClass} mb-4`}>
          <i className={`${iconClass} text-3xl`}></i>
        </div>
        
        <h3 id="action-modal-title" className="text-[19px] font-bold text-foreground mb-2 leading-none">
          {title}
        </h3>
        
        <p id="action-modal-desc" className="text-foreground/70 text-[14.5px] leading-relaxed break-words mb-6 w-full">
          {description}
        </p>

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

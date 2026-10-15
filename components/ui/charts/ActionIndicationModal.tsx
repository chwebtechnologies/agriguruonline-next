'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/lib/scroll-lock';

interface ActionIndicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  indicationText?: string;
  type?: 'error' | 'warning' | 'info' | 'success';
  icon?: string;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}

export function ActionIndicationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Action Required',
  description = 'An error occurred.',
  indicationText = 'Confirm',
  type = 'error',
  icon,
  secondaryActionText,
  onSecondaryAction
}: ActionIndicationModalProps) {
  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

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
  const effectiveIconClass = icon || iconClass;

  const content = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-modal-title"
      aria-describedby="action-modal-desc"
      onClick={onClose}
    >
      <div 
        className="relative bg-card text-foreground rounded-3xl p-6 sm:p-7 w-[92vw] sm:w-[420px] shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200 mx-auto flex flex-col items-center text-center my-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          aria-label="Close"
        >
          <i className="fa-solid fa-xmark text-sm"></i>
        </button>

        <div className={`w-16 h-16 ${bgClass} rounded-full flex items-center justify-center shrink-0 ${textClass} mb-4`}>
          <i className={`${effectiveIconClass} text-3xl`}></i>
        </div>
        
        <h3 id="action-modal-title" className="text-[19px] font-bold text-foreground mb-2 leading-none">
          {title}
        </h3>
        
        <p id="action-modal-desc" className="text-foreground/70 text-[14.5px] leading-relaxed break-words mb-6 w-full">
          {description}
        </p>

        <div className="flex w-full gap-3">
          {secondaryActionText && onSecondaryAction ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="flex-1 py-2.5 rounded-xl border border-brand-blue/30 bg-card hover:bg-brand-blue/5 text-brand-blue font-semibold text-[15px] shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              {secondaryActionText}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-[15px] shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-brand-green text-white font-semibold text-[15px] shadow-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group"
          >
            <span className="relative z-10 capitalize">{indicationText.replace(/_/g, ' ')}</span>
            <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-button-shine" />
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default ActionIndicationModal;

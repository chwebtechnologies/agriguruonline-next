'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/lib/scroll-lock';

export interface ChartCardOptionsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'product' | 'freight';
  cardNode?: React.ReactNode;
  userType?: string | null;
  onSelectOption: (optionKey: 'inquiry' | 'alert' | 'predict' | 'chart') => void;
  isChartAvailable?: boolean;
  isActionLoading?: boolean;
}

export function ChartCardOptionsBottomSheet({
  isOpen,
  onClose,
  itemType,
  cardNode,
  userType = null,
  onSelectOption,
  isChartAvailable = true,
  isActionLoading = false
}: ChartCardOptionsBottomSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useScrollLock(isOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  // Determine option 1 label & icon based on itemType & userType
  let option1Title = 'Inquiry / Offer';
  let option1Icon = 'fa-solid fa-paper-plane';

  if (itemType === 'product') {
    if (userType === 'buyer') {
      option1Title = 'Post Inquiry';
      option1Icon = 'fa-solid fa-paper-plane';
    } else if (userType === 'seller') {
      option1Title = 'Post Offer';
      option1Icon = 'fa-solid fa-tag';
    } else {
      option1Title = 'Inquiry / Offer';
      option1Icon = 'fa-solid fa-paper-plane';
    }
  } else {
    option1Title = 'Post Inquiry';
    option1Icon = 'fa-solid fa-paper-plane';
  }

  const options = [
    {
      key: 'inquiry' as const,
      title: option1Title,
      icon: option1Icon,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
      disabled: isActionLoading,
    },
    {
      key: 'alert' as const,
      title: 'Create Alert',
      icon: 'fa-solid fa-bell',
      color: 'text-amber-500 dark:text-amber-400 bg-amber-500/10',
      disabled: !isChartAvailable,
    },
    {
      key: 'predict' as const,
      title: 'AI Predict',
      icon: 'fa-solid fa-microchip',
      color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10',
      disabled: !isChartAvailable,
    },
    {
      key: 'chart' as const,
      title: 'View Chart',
      icon: itemType === 'freight' ? 'fa-solid fa-chart-area' : 'fa-solid fa-chart-line',
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
      disabled: !isChartAvailable,
    },
  ];

  const content = (
    <div className="fixed inset-0 z-[600] flex flex-col justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Content */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="Item Options"
        className="relative z-10 w-full max-w-lg mx-auto bg-card border-t border-border rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="pt-2.5 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Listing card view (Same as in list) */}
        {cardNode && (
          <div className="px-3 pb-2 pt-0.5 border-b border-border bg-card">
            <div className="rounded-xl border border-border/80 bg-background/50 overflow-hidden shadow-xs">
              {cardNode}
            </div>
          </div>
        )}

        {/* Sober & Simple 4 Options List */}
        <div className="p-3 space-y-1.5">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              disabled={opt.disabled}
              onClick={() => {
                if (opt.disabled) return;
                onSelectOption(opt.key);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border/50 transition-colors text-left ${
                opt.disabled 
                  ? 'opacity-40 cursor-not-allowed bg-muted/20' 
                  : 'bg-card hover:bg-muted/60 active:bg-muted cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${opt.color}`}>
                  <i className={`${opt.icon} text-sm`}></i>
                </div>
                <span className="font-semibold text-[14px] sm:text-[15px] text-foreground">
                  {opt.title}
                </span>
              </div>
              {opt.disabled && !isActionLoading ? (
                <span className="text-[11px] font-semibold text-muted-foreground/80 px-2 py-0.5 rounded bg-muted/60 border border-border/40">
                  Not Available
                </span>
              ) : (
                <i className="fa-solid fa-chevron-right text-[11px] text-muted-foreground/60"></i>
              )}
            </button>
          ))}
        </div>

        {/* Footer Cancel */}
        <div className="px-3 pb-5 pt-0.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-muted/60 hover:bg-muted text-foreground font-semibold text-[13px] rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default ChartCardOptionsBottomSheet;

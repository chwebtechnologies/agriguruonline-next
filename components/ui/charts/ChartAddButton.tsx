'use client';

import React from 'react';

interface ChartAddButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  tooltipText?: string;
  id?: string;
  variant?: 'desktop' | 'mobile-sticky' | 'mobile-overlay';
  className?: string;
}

export function ChartAddButton({
  onClick,
  disabled = false,
  loading = false,
  label,
  tooltipText = 'Please select all required options',
  id,
  variant = 'desktop',
  className = ''
}: ChartAddButtonProps) {
  if (variant === 'mobile-sticky') {
    return (
      <button
        id={id}
        type="button"
        onClick={onClick}
        className={`w-full max-w-[200px] py-[10px] bg-brand-green hover:bg-brand-green-hover text-white rounded-md text-[14px] shadow-sm transition-colors cursor-pointer ${className}`}
      >
        {label}
      </button>
    );
  }

  if (variant === 'mobile-overlay') {
    return (
      <button
        id={id}
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className={`w-[200px] h-12 rounded-lg text-white font-semibold text-[16px] shadow-sm transition-all flex items-center justify-center ${
          disabled || loading
            ? 'opacity-40 cursor-not-allowed shadow-none bg-muted text-muted-foreground'
            : 'bg-primary-gradient hover:opacity-95 active:scale-95 cursor-pointer shadow-md hover:shadow-lg'
        } ${className}`}
      >
        {loading ? (
          <>
            <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Adding...
          </>
        ) : (
          label
        )}
      </button>
    );
  }

  return (
    <div className={`w-full min-w-0 relative group ${className}`}>
      <button
        id={id}
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className={`w-full h-[45px] rounded-lg bg-primary-gradient text-white text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap px-2 min-w-0 ${
          disabled || loading
            ? 'opacity-40 cursor-not-allowed shadow-none'
            : 'opacity-100 hover:opacity-95 hover:shadow-md cursor-pointer active:scale-[0.98]'
        }`}
      >
        {loading ? (
          <>
            <i className="fa-solid fa-circle-notch fa-spin"></i> Adding...
          </>
        ) : (
          label
        )}
      </button>
      {disabled && tooltipText && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-foreground text-background text-xs rounded py-1.5 px-2.5 whitespace-nowrap z-50 shadow-lg after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-foreground pointer-events-none">
          {tooltipText}
        </div>
      )}
    </div>
  );
}

export default ChartAddButton;

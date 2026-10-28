'use client';

import React from 'react';

export interface DocSegmentedToggleProps {
  id?: string;
  value: boolean | null;
  onChange: (val: boolean) => void;
  trueLabel?: string;
  falseLabel?: string;
  trueIcon?: string;
  falseIcon?: string;
  disabled?: boolean;
  className?: string;
}

export function DocSegmentedToggle({
  id,
  value,
  onChange,
  trueLabel = 'ALLOWED',
  falseLabel = 'NOT ALLOWED',
  trueIcon = 'fa-solid fa-circle-check',
  falseIcon = 'fa-solid fa-circle-xmark',
  disabled = false,
  className = '',
}: DocSegmentedToggleProps) {
  return (
    <div
      id={id}
      className={`inline-flex items-center rounded border border-dotted border-primary/70 dark:border-primary/80 bg-background/50 p-0.5 select-none transition-colors ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      } ${className}`}
    >
      {/* Option 1: TRUE / ALLOWED / YES */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={`px-2.5 py-1 rounded text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed ${
          value === true
            ? 'bg-primary/20 text-primary dark:text-sky-400 font-extrabold shadow-2xs'
            : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 font-medium'
        }`}
      >
        <i className={`${trueIcon} text-[10px] sm:text-[11px] ${value === true ? 'text-primary dark:text-sky-400' : 'opacity-60'}`} />
        <span>{trueLabel}</span>
      </button>

      {/* Vertical Divider */}
      <span className="text-muted-foreground/40 mx-1 select-none font-light text-xs">|</span>

      {/* Option 2: FALSE / NOT ALLOWED / NO */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`px-2.5 py-1 rounded text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed ${
          value === false
            ? 'bg-destructive/15 text-destructive dark:text-rose-400 font-extrabold shadow-2xs'
            : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 font-medium'
        }`}
      >
        <i className={`${falseIcon} text-[10px] sm:text-[11px] ${value === false ? 'text-destructive dark:text-rose-400' : 'opacity-60'}`} />
        <span>{falseLabel}</span>
      </button>
    </div>
  );
}

export default DocSegmentedToggle;


'use client';

import React from 'react';

export interface DocSegmentedToggleOption<T = any> {
  value: T;
  label: string;
  icon?: string;
}

export interface DocSegmentedToggleProps<T = any> {
  id?: string;
  value: T | null;
  onChange: (val: T) => void;
  options?: DocSegmentedToggleOption<T>[];
  trueLabel?: string;
  falseLabel?: string;
  trueIcon?: string;
  falseIcon?: string;
  disabled?: boolean;
  className?: string;
}

export function DocSegmentedToggle<T = any>({
  id,
  value,
  onChange,
  options,
  trueLabel = 'ALLOWED',
  falseLabel = 'NOT ALLOWED',
  trueIcon = 'fa-solid fa-circle-check',
  falseIcon = 'fa-solid fa-circle-xmark',
  disabled = false,
  className = '',
}: DocSegmentedToggleProps<T>) {
  if (options && options.length > 0) {
    return (
      <div
        id={id}
        className={`inline-flex items-center rounded border border-dotted border-primary/70 dark:border-primary/80 bg-background/50 p-0.5 select-none transition-colors ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        } ${className}`}
      >
        {options.map((opt, idx) => {
          const isSelected = value === opt.value;
          return (
            <React.Fragment key={String(opt.value)}>
              {idx > 0 && (
                <span className="text-muted-foreground/40 mx-1 select-none font-light text-xs">|</span>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(opt.value)}
                className={`px-2.5 py-1 rounded text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed ${
                  isSelected
                    ? 'bg-foreground/10 dark:bg-foreground/15 text-foreground font-extrabold shadow-2xs'
                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 font-medium'
                }`}
              >
                {opt.icon && (
                  <i
                    className={`${opt.icon} text-[10px] sm:text-[11px] ${
                      isSelected ? 'text-foreground' : 'opacity-60'
                    }`}
                  />
                )}
                <span>{opt.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

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
        onClick={() => onChange(true as unknown as T)}
        className={`px-2.5 py-1 rounded text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed ${
          value === true
            ? 'bg-foreground/10 dark:bg-foreground/15 text-foreground font-extrabold shadow-2xs'
            : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 font-medium'
        }`}
      >
        <i
          className={`${trueIcon} text-[10px] sm:text-[11px] ${
            value === true ? 'text-foreground' : 'opacity-60'
          }`}
        />
        <span>{trueLabel}</span>
      </button>

      {/* Vertical Divider */}
      <span className="text-muted-foreground/40 mx-1 select-none font-light text-xs">|</span>

      {/* Option 2: FALSE / NOT ALLOWED / NO */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false as unknown as T)}
        className={`px-2.5 py-1 rounded text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed ${
          value === false
            ? 'bg-foreground/10 dark:bg-foreground/15 text-foreground font-extrabold shadow-2xs'
            : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 font-medium'
        }`}
      >
        <i
          className={`${falseIcon} text-[10px] sm:text-[11px] ${
            value === false ? 'text-foreground' : 'opacity-60'
          }`}
        />
        <span>{falseLabel}</span>
      </button>
    </div>
  );
}

export default DocSegmentedToggle;


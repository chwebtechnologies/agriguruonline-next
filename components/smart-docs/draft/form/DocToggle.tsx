'use client';

import React from 'react';

export interface DocToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  icon?: string;
  className?: string;
}

export function DocToggle({
  label,
  checked,
  onChange,
  disabled = false,
  id,
  icon,
  className = '',
}: DocToggleProps) {
  const toggleId = id || `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 select-none ${className}`}>
      {icon && (
        <i
          className={`${icon} text-[11px] transition-colors ${
            checked ? 'text-primary' : 'text-muted-foreground'
          }`}
        />
      )}
      <label
        htmlFor={toggleId}
        className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer px-0.5 ${
          disabled
            ? 'text-muted-foreground/60 cursor-not-allowed'
            : 'text-muted-foreground/85 hover:text-foreground'
        }`}
      >
        {label}
      </label>
      <button
        type="button"
        id={toggleId}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={handleKeyDown}
        style={{ outline: 'none' }}
        className={`relative inline-flex h-4 w-7.5 shrink-0 cursor-pointer rounded-full border border-border/80 transition-colors duration-200 ease-in-out outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-1 focus-visible:ring-primary ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${checked ? 'bg-primary border-primary' : 'bg-muted-foreground/20 dark:bg-muted'}`}
      >
        <span
          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-background shadow-xs ring-0 transition duration-200 ease-in-out my-auto ml-0.5 ${
            checked ? 'translate-x-3.5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default DocToggle;

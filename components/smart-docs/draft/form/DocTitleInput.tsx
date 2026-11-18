'use client';

import React, { forwardRef, useRef, useImperativeHandle } from 'react';

export interface DocTitleInputProps {
  /** The current title string */
  value: string;
  /** Callback when title changes */
  onChange: (value: string) => void;
  /** Fallback placeholder when value is empty */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Validation error message */
  error?: string | null;
  /** Optional company or seller name displayed directly above title */
  companyName?: string;
  /** Accessible label */
  ariaLabel?: string;
  /** DOM element id */
  id?: string;
  /** Data field attribute for error mapping / scrolling */
  dataField?: string;
  /** Additional container class */
  className?: string;
  /** Whether to visually force uppercase display (defaults to true) */
  uppercase?: boolean;
}

/**
 * DocTitleInput
 *
 * Professional trade document PDF title editor.
 * Features:
 * - Fluid auto-sizing to content preventing any text truncation/cut-off
 * - Centered inline-grid layout with ample breathing room
 * - Brand-aligned dotted underline that expands with the title length
 * - Clean focus/active states with pencil edit trigger
 * - Full light/dark mode theme compliance
 */
export const DocTitleInput = forwardRef<HTMLInputElement, DocTitleInputProps>(
  function DocTitleInput(
    {
      value,
      onChange,
      placeholder = 'DOCUMENT TITLE',
      disabled = false,
      readOnly = false,
      error = null,
      companyName,
      ariaLabel,
      id = 'field-documentTitle',
      dataField = 'documentTitle',
      className = '',
      uppercase = true,
    },
    forwardedRef
  ) {
    const localInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(forwardedRef, () => localInputRef.current as HTMLInputElement);

    const isEditable = !disabled && !readOnly;
    const displayValue = value ?? '';
    // Sizer text: ensures the container is always exactly as wide as the text + breathing room
    const sizerText = (displayValue || placeholder || 'DOCUMENT TITLE') + '\u00A0\u00A0';

    const handleFocusInput = () => {
      if (!isEditable) return;
      localInputRef.current?.focus();
      if (localInputRef.current) {
        const len = localInputRef.current.value.length;
        localInputRef.current.setSelectionRange(len, len);
      }
    };

    return (
      <div
        className={`flex flex-col items-center justify-center group/title flex-1 max-w-xl mx-auto order-last sm:order-none w-full sm:w-auto text-center px-2 ${className}`}
        id={id}
        data-field={dataField}
      >
        {/* Optional Company/Seller Name (e.g. in Proforma Invoice) */}
        {companyName && (
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground text-center mb-0.5 truncate max-w-full px-1">
            {companyName}
          </div>
        )}

        {/* Title Content & Underline Group */}
        <div className="inline-flex flex-col items-center max-w-full">
          {/* Top Row: Editable Input + Edit Pen */}
          <div className="inline-flex items-center justify-center gap-1.5 max-w-full">
            {/* Auto-sizing Grid: Span measures width, Input fills grid cell */}
            <div className="inline-grid items-center justify-center relative min-w-[140px] max-w-[calc(100vw-3.5rem)] sm:max-w-xl">
              {/* Invisible Sizer */}
              <span
                aria-hidden="true"
                className={`invisible col-start-1 row-start-1 px-2 py-0.5 text-xs sm:text-sm md:text-[15px] font-bold ${
                  uppercase ? 'uppercase' : ''
                } tracking-wider whitespace-pre pointer-events-none select-none text-center`}
              >
                {sizerText}
              </span>

              {/* Text Input */}
              <input
                ref={localInputRef}
                type="text"
                value={displayValue}
                onChange={(e) => onChange(e.target.value)}
                disabled={!isEditable}
                placeholder={placeholder}
                aria-label={ariaLabel || placeholder || 'Document Title'}
                style={{
                  fieldSizing: 'content' as any,
                  outline: 'none',
                  border: 'none',
                  boxShadow: 'none',
                }}
                className={`col-start-1 row-start-1 w-full min-w-0 text-xs sm:text-sm md:text-[15px] font-bold ${
                  uppercase ? 'uppercase' : ''
                } tracking-wider text-center bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:bg-transparent rounded-sm px-2 py-0.5 transition-all ${
                  isEditable ? 'cursor-text' : 'cursor-default'
                } ${error ? '!text-brand-red' : 'text-foreground'}`}
              />
            </div>

            {/* Edit Pencil Action Button */}
            {isEditable && (
              <button
                type="button"
                tabIndex={-1}
                onClick={handleFocusInput}
                title="Edit document title"
                aria-label="Edit document title"
                style={{ outline: 'none' }}
                className="w-5 h-5 flex items-center justify-center rounded-full text-primary hover:text-primary-hover hover:bg-primary/10 text-[11px] transition-colors cursor-pointer shrink-0 outline-none focus:outline-none"
              >
                <i className="fa-solid fa-pen text-primary" />
              </button>
            )}
          </div>

          {/* Dotted Accent Underline: dynamically spans title width with solid transition on focus */}
          <div
            className={`w-full min-w-[180px] sm:min-w-[220px] border-b-2 ${
              error
                ? 'border-solid !border-brand-red'
                : 'border-dotted border-primary/70 group-focus-within/title:border-solid group-focus-within/title:border-primary'
            } mt-0.5 transition-all`}
          />
        </div>

        {/* Validation Error Message */}
        {error && (
          <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center justify-center gap-1.5">
            <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
            <span className="text-brand-red">{error}</span>
          </span>
        )}
      </div>
    );
  }
);

DocTitleInput.displayName = 'DocTitleInput';

export default DocTitleInput;

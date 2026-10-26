'use client';

import React, { forwardRef, useRef, useImperativeHandle, useState } from 'react';

export interface DocUnderlineInputProps {
  value: string | number;
  onChange?: (val: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'date';
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string | null;
  icon?: string;
  iconPosition?: 'right' | 'left';
  onIconClick?: () => void;
  isChanged?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  inputClassName?: string;
  id?: string;
  name?: string;
  tabIndex?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  ariaLabel?: string;
}

export const DocUnderlineInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, DocUnderlineInputProps>(
  (
    {
      value,
      onChange,
      placeholder = '',
      type = 'text',
      multiline = false,
      rows = 2,
      disabled = false,
      readOnly = false,
      error = null,
      icon,
      iconPosition = 'right',
      onIconClick,
      isChanged = false,
      align = 'left',
      className = '',
      inputClassName = '',
      id,
      name,
      tabIndex,
      min,
      max,
      step,
      autoFocus = false,
      onKeyDown,
      onBlur,
      onClick,
      onFocus,
      ariaLabel,
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => {
      if (multiline) {
        return textareaRef.current as HTMLTextAreaElement;
      }
      return inputRef.current as HTMLInputElement;
    });

    const alignClass =
      align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

    const [isFocused, setIsFocused] = useState(false);

    // Theme-compliant dotted underline matching AgriGuru brand system
    let borderStyle =
      'border-b-2 border-dotted border-primary/70 dark:border-primary/80 hover:border-primary bg-transparent';

    if (error) {
      borderStyle = 'border-b-2 border-solid border-destructive text-destructive bg-transparent';
    } else if (disabled) {
      borderStyle = 'border-b-2 border-dotted border-muted-foreground/30 opacity-60 cursor-not-allowed bg-transparent';
    } else if (isFocused) {
      borderStyle = 'border-b-2 border-solid border-primary bg-transparent shadow-2xs';
    } else if (isChanged) {
      borderStyle = 'border-b-2 border-dotted border-primary bg-transparent';
    }

    const openCalendarPicker = () => {
      if (type === 'date' && !disabled && !readOnly) {
        try {
          inputRef.current?.showPicker?.();
        } catch {
          inputRef.current?.focus();
        }
      }
    };

    const handleIconClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled || readOnly) return;
      if (onIconClick) {
        onIconClick();
      } else if (type === 'date') {
        openCalendarPicker();
      } else if (multiline) {
        textareaRef.current?.focus();
      } else {
        inputRef.current?.focus();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (type === 'date' && e.key === 'Tab') {
        // Find visible focusable elements in form / page so Tab immediately moves to next/prev input
        // instead of browser's default behavior of cycling through day -> month -> year segments
        const root =
          inputRef.current?.closest('#draft-form-card') ||
          inputRef.current?.closest('form') ||
          document;

        const focusableElements = Array.from(
          root.querySelectorAll<HTMLElement>(
            'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]'
          )
        ).filter((el) => {
          return (
            el.offsetParent !== null &&
            !el.hasAttribute('aria-hidden') &&
            el.tabIndex !== -1 &&
            !el.hasAttribute('disabled')
          );
        });

        const currentIndex = focusableElements.indexOf(inputRef.current!);
        if (currentIndex !== -1) {
          e.preventDefault();
          const targetIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
          if (targetIndex >= 0 && targetIndex < focusableElements.length) {
            focusableElements[targetIndex].focus();
          } else {
            inputRef.current?.blur();
          }
          return;
        }
      }
      onKeyDown?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setIsFocused(true);
      if (type === 'date') {
        openCalendarPicker();
      }
      onFocus?.(e as any);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setIsFocused(false);
      onBlur?.(e as any);
    };

    return (
      <div className={`relative inline-flex flex-col w-full group ${className}`}>
        <div
          className={`relative flex ${multiline ? 'items-start pt-1' : 'items-center'} w-full px-1.5 py-0.5 min-h-[26px] sm:min-h-[28px] rounded-t-sm transition-all duration-150 ${borderStyle} focus-within:border-solid focus-within:border-primary bg-transparent print:border-none`}
        >
          {icon && iconPosition === 'left' && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleIconClick}
              disabled={disabled || readOnly}
              style={{ outline: 'none' }}
              className={`mr-1.5 ${isFocused ? 'text-primary scale-110 font-bold' : 'text-primary hover:text-primary-hover'} text-[11px] shrink-0 cursor-pointer outline-none focus:outline-none transition-all ${multiline ? 'mt-1' : ''}`}
              aria-label="Input action"
            >
              <i className={icon} />
            </button>
          )}

          {multiline ? (
            <textarea
              ref={textareaRef}
              id={id}
              name={name}
              rows={rows}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              readOnly={readOnly}
              tabIndex={tabIndex}
              autoFocus={autoFocus}
              onKeyDown={onKeyDown as any}
              onBlur={handleBlur}
              onClick={onClick as any}
              onFocus={handleFocus}
              aria-label={ariaLabel || placeholder}
              aria-invalid={Boolean(error)}
              style={{ outline: 'none', boxShadow: 'none' }}
              className={`w-full bg-transparent px-0 py-0.5 text-xs sm:text-[12.5px] font-semibold text-foreground placeholder:text-muted-foreground/50 border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 resize-y leading-relaxed ${alignClass} ${
                disabled ? 'cursor-not-allowed text-muted-foreground' : ''
              } ${inputClassName}`}
            />
          ) : (
            <input
              ref={inputRef}
              id={id}
              name={name}
              type={type}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              readOnly={readOnly}
              tabIndex={tabIndex}
              min={min}
              max={max}
              step={step}
              autoFocus={autoFocus}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onClick={(e) => {
                if (type === 'date') {
                  openCalendarPicker();
                }
                onClick?.(e);
              }}
              onFocus={handleFocus}
              aria-label={ariaLabel || placeholder}
              aria-invalid={Boolean(error)}
              style={{ outline: 'none', boxShadow: 'none' }}
              className={`w-full bg-transparent px-0 py-0.5 text-xs sm:text-[12.5px] font-semibold text-foreground placeholder:text-muted-foreground/50 border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${alignClass} ${
                type === 'date'
                  ? 'cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                  : ''
              } ${disabled ? 'cursor-not-allowed text-muted-foreground' : ''} ${inputClassName}`}
            />
          )}

          {icon && iconPosition === 'right' && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleIconClick}
              disabled={disabled || readOnly}
              className={`ml-1.5 ${isFocused ? 'text-primary scale-110 font-bold' : 'text-primary hover:text-primary-hover'} text-xs shrink-0 cursor-pointer focus:outline-hidden transition-all ${multiline ? 'mt-1' : ''}`}
              aria-label="Input action"
            >
              <i className={icon} />
            </button>
          )}
        </div>

        {error && (
          <span className="text-[10px] text-destructive font-medium mt-0.5 px-1 tracking-tight animate-in fade-in duration-200">
            {error}
          </span>
        )}
      </div>
    );
  }
);

DocUnderlineInput.displayName = 'DocUnderlineInput';

export default DocUnderlineInput;

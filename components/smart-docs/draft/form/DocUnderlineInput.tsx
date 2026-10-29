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

    const hasValue = String(value ?? '').trim().length > 0;
    const effectivePlaceholder = placeholder || (type === 'date' ? 'Select Date' : '');

    const [isFocused, setIsFocused] = useState(false);

    // Theme-compliant dotted underline matching AgriGuru brand system
    let borderStyle =
      'border-b-2 border-dotted border-primary/70 dark:border-primary/80 hover:border-primary bg-transparent';

    if (error) {
      borderStyle = 'border-b-2 border-solid border-brand-red bg-transparent';
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
          onClick={(e) => {
            if (type === 'date' && !disabled && !readOnly) {
              if (e.target !== inputRef.current) {
                openCalendarPicker();
              }
            }
          }}
          className={`relative flex ${multiline ? 'items-start pt-1' : 'items-center'} w-full px-1.5 py-0.5 min-h-[28px] rounded-t-sm transition-all duration-150 ${borderStyle} ${
            error
              ? 'focus-within:border-brand-red'
              : 'focus-within:border-solid focus-within:border-primary'
          } ${type === 'date' && !disabled && !readOnly ? 'cursor-pointer' : ''} bg-transparent print:border-none`}
        >
          {icon && iconPosition === 'left' && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleIconClick}
              disabled={disabled || readOnly}
              style={{ outline: 'none' }}
              className={`mr-1.5 ${
                error
                  ? 'text-brand-red'
                  : isFocused
                  ? 'text-primary scale-110 font-bold'
                  : 'text-primary hover:text-primary-hover'
              } text-[11px] shrink-0 cursor-pointer outline-none focus:outline-none transition-all ${multiline ? 'mt-1' : ''}`}
              aria-label="Input action"
            >
              <i className={icon} />
            </button>
          )}

          {type === 'date' && !hasValue && effectivePlaceholder && (
            <span
              aria-hidden="true"
              className={`absolute top-1/2 -translate-y-1/2 pointer-events-none select-none text-[13px] font-normal leading-normal truncate transition-opacity ${
                error
                  ? 'text-brand-red/50'
                  : 'text-muted-foreground/50'
              } ${alignClass} ${
                icon && iconPosition === 'right'
                  ? 'left-1.5 right-6 rtl:left-6 rtl:right-1.5'
                  : icon && iconPosition === 'left'
                  ? 'left-6 right-1.5 rtl:left-1.5 rtl:right-6'
                  : 'left-1.5 right-1.5'
              }`}
            >
              {effectivePlaceholder}
            </span>
          )}

          {multiline ? (
            <textarea
              ref={textareaRef}
              id={id}
              name={name}
              rows={rows}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder={effectivePlaceholder}
              disabled={disabled}
              readOnly={readOnly}
              tabIndex={tabIndex}
              autoFocus={autoFocus}
              onKeyDown={onKeyDown as any}
              onBlur={handleBlur}
              onClick={onClick as any}
              onFocus={handleFocus}
              aria-label={ariaLabel || effectivePlaceholder}
              aria-invalid={Boolean(error)}
              style={{ outline: 'none', boxShadow: 'none' }}
              className={`w-full bg-transparent px-0 py-0.5 text-[13px] font-semibold ${
                error
                  ? 'text-brand-red placeholder:text-brand-red/50'
                  : 'text-foreground placeholder:text-muted-foreground/50'
              } placeholder:font-normal border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 resize-y leading-relaxed ${alignClass} ${
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
              placeholder={effectivePlaceholder}
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
              aria-label={ariaLabel || effectivePlaceholder}
              aria-invalid={Boolean(error)}
              style={{ outline: 'none', boxShadow: 'none' }}
              className={`w-full bg-transparent px-0 py-0.5 text-[13px] font-semibold ${
                error
                  ? 'text-brand-red placeholder:text-brand-red/50'
                  : 'text-foreground placeholder:text-muted-foreground/50'
              } placeholder:font-normal border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${alignClass} ${
                type === 'date'
                  ? `cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      !hasValue
                        ? 'text-transparent [&::-webkit-datetime-edit]:text-transparent [&::-webkit-datetime-edit-fields-wrapper]:text-transparent [&::-webkit-datetime-edit-text]:text-transparent [&::-webkit-datetime-edit-month-field]:text-transparent [&::-webkit-datetime-edit-day-field]:text-transparent [&::-webkit-datetime-edit-year-field]:text-transparent'
                        : ''
                    }`
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
              className={`ml-1.5 ${
                error
                  ? 'text-brand-red'
                  : isFocused
                  ? 'text-primary scale-110 font-bold'
                  : 'text-primary hover:text-primary-hover'
              } text-xs shrink-0 cursor-pointer focus:outline-hidden transition-all ${multiline ? 'mt-1' : ''}`}
              aria-label="Input action"
            >
              <i className={icon} />
            </button>
          )}
        </div>

        {error && (
          <span className="text-[11px] text-brand-red font-semibold mt-1 px-0.5 tracking-tight animate-in fade-in duration-200 flex items-center gap-1.5">
            <i className="fa-solid fa-circle-exclamation text-[11px] shrink-0 text-brand-red" />
            <span className="text-brand-red">{error}</span>
          </span>
        )}
      </div>
    );
  }
);

DocUnderlineInput.displayName = 'DocUnderlineInput';

export default DocUnderlineInput;

'use client';

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';

export interface DocSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

export interface DocUnderlineSelectProps {
  options: (DocSelectOption | string)[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string | null;
  isChanged?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  tabIndex?: number;
  id?: string;
  ariaLabel?: string;
  loading?: boolean;
  showEditOption?: boolean;
  onEditOption?: (option: DocSelectOption, e: React.MouseEvent) => void;
  showAddNew?: boolean;
  addNewLabel?: string;
  onAddNew?: () => void;
}

export function DocUnderlineSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  error = null,
  isChanged = false,
  searchable = true,
  searchPlaceholder = 'Search...',
  className = '',
  tabIndex = 0,
  id,
  ariaLabel,
  loading = false,
  showEditOption = false,
  onEditOption,
  showAddNew = false,
  addNewLabel = 'Add New',
  onAddNew,
}: DocUnderlineSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  // Normalize options
  const normalizedOptions: DocSelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  // Filter options based on search query
  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
      (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  });

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      const curIndex = filteredOptions.findIndex((opt) => opt.value === value);
      setHighlightedIndex(curIndex >= 0 ? curIndex : 0);
      setTimeout(() => {
        if (searchable && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, value, searchable]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const items = listRef.current.querySelectorAll('li');
      const item = items[highlightedIndex];
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const [isFocused, setIsFocused] = useState(false);

  // Dotted underline matching AgriGuru brand theme
  let borderStyle =
    'border-b-2 border-dotted border-primary/70 dark:border-primary/80 hover:border-primary bg-transparent';

  if (error) {
    borderStyle = 'border-b-2 border-solid border-destructive text-destructive bg-transparent';
  } else if (disabled) {
    borderStyle = 'border-b-2 border-dotted border-muted-foreground/30 opacity-60 cursor-not-allowed bg-transparent';
  } else if (isOpen || isFocused) {
    borderStyle = 'border-b-2 border-solid border-primary bg-transparent shadow-2xs';
  } else if (isChanged) {
    borderStyle = 'border-b-2 border-dotted border-primary bg-transparent';
  }

  return (
    <div ref={containerRef} className={`relative inline-flex flex-col w-full group ${className}`}>
      {/* Trigger Button - Clearly indicates active state with solid border */}
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        disabled={disabled}
        tabIndex={tabIndex}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || placeholder}
        style={{ outline: 'none', boxShadow: 'none' }}
        className={`w-full flex items-center justify-between gap-1.5 px-1.5 py-0.5 min-h-[26px] sm:min-h-[28px] text-xs sm:text-[12.5px] rounded-t-sm transition-all duration-150 text-left outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 ring-offset-0 border-t-0 border-x-0 ${borderStyle} focus:border-solid focus:border-primary bg-transparent print:border-none cursor-pointer`}
      >
        <span
          className={`truncate flex-1 ${
            selectedOption ? 'font-semibold text-foreground' : 'text-muted-foreground/50'
          }`}
        >
          {loading && !selectedOption ? (searchPlaceholder === 'Search...' ? 'Loading options...' : placeholder) : selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className={`${isOpen || isFocused ? 'text-primary scale-110 font-bold' : 'text-primary hover:text-primary-hover'} text-[11px] shrink-0 transition-all duration-200 flex items-center gap-1`}>
          {loading && (
            <i className="fa-solid fa-circle-notch fa-spin text-[10px] text-primary" />
          )}
          <i
            className={`fa-solid fa-chevron-down transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {error && (
        <span className="text-[10px] text-destructive font-medium mt-0.5 px-1 tracking-tight animate-in fade-in duration-200">
          {error}
        </span>
      )}

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={placeholder}
          onKeyDown={handleListKeyDown}
          className="absolute left-0 top-full mt-1 w-full min-w-[240px] max-w-[380px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Search Box if list has more than 4 items */}
          {searchable && normalizedOptions.length > 4 && (
            <div className="p-2 border-b border-border bg-muted/30">
              <div className="relative flex items-center">
                <i className="fa-solid fa-magnifying-glass text-muted-foreground text-xs absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder={searchPlaceholder}
                  style={{ outline: 'none' }}
                  className="w-full pl-7 pr-2.5 py-1 text-xs bg-background text-foreground border border-border rounded-md outline-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            className="max-h-56 overflow-y-auto overscroll-contain py-1 text-xs"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-center text-muted-foreground italic text-xs">
                {options.length === 0 ? 'No options available' : 'No matching options'}
              </li>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-1.5 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : isHighlighted
                        ? 'bg-muted text-foreground'
                        : 'text-foreground hover:bg-muted/60'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate font-semibold text-foreground text-xs leading-tight">
                        {opt.label}
                      </span>
                      {opt.subLabel && (
                        <span className="text-[10.5px] text-muted-foreground/85 line-clamp-2 leading-tight mt-0.5 whitespace-normal">
                          {opt.subLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="text-[9px] px-1 py-0.5 rounded-sm bg-muted text-muted-foreground font-medium">
                          {opt.badge}
                        </span>
                      )}
                      {showEditOption && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditOption?.(opt, e);
                          }}
                          title="Edit"
                          aria-label={`Edit ${opt.label}`}
                          className="w-5 h-5 flex items-center justify-center text-muted-foreground/70 hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        >
                          <i className="fa-solid fa-pen-to-square text-[11px]" />
                        </button>
                      )}
                      {isSelected && (
                        <i className="fa-solid fa-check text-primary text-xs shrink-0" />
                      )}
                    </div>
                  </li>
                );
              })
            )}

            {showAddNew && (
              <li
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNew?.();
                }}
                onMouseEnter={() => setHighlightedIndex(-1)}
                className="px-3 py-2 cursor-pointer flex items-center gap-2 text-primary font-semibold hover:bg-primary/10 transition-colors border-t border-border/70 mt-1 sticky bottom-0 bg-card select-none"
              >
                <i className="fa-solid fa-plus text-xs" />
                <span>{addNewLabel}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default DocUnderlineSelect;

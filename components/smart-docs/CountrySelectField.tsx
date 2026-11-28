'use client';

import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import flags from 'react-phone-number-input/flags';
import { getCountries, type Country } from 'react-phone-number-input';
import en from 'react-phone-number-input/locale/en.json';

export const countryNames = en as Record<string, string>;

export const POPULAR_COUNTRY_CODES: Country[] = [
  'IN', 'US', 'AE', 'GB', 'SG', 'SA', 'AU', 'CA', 'DE', 'CN', 'BR', 'ZA',
];

export const renderFlag = (code?: Country | null, countryName?: string) => {
  if (!code) {
    return <i className="fa-solid fa-globe text-muted-foreground text-xs shrink-0" />;
  }
  const FlagComponent = flags[code];
  if (!FlagComponent) {
    return <i className="fa-solid fa-globe text-muted-foreground text-xs shrink-0" />;
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center w-4.5 h-3 overflow-hidden rounded-xs shadow-xs border border-border/40"
      title={countryName || code}
    >
      <FlagComponent title={countryName || code} />
    </span>
  );
};

export interface CountryItem {
  code: Country;
  name: string;
  isPopular?: boolean;
}

export interface CountrySelectFieldProps {
  label?: string;
  required?: boolean;
  selectedCountryName: string;
  selectedCountryCode?: Country | null;
  selectedCountryId?: string;
  countries?: any[];
  allCountries?: { code: Country; name: string }[];
  onSelect: (country: { name: string; code: Country | null; id: string }) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  tabIndex?: number;
}

export function CountrySelectField({
  label = 'Country',
  required = false,
  selectedCountryName,
  selectedCountryCode,
  selectedCountryId,
  countries = [],
  allCountries: propAllCountries,
  onSelect,
  error,
  placeholder = 'Select Country',
  disabled = false,
  tabIndex = 0,
}: CountrySelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [openUpwards, setOpenUpwards] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Smart placement: Check space below vs space above relative to scroll container/viewport
  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const modalBody = containerRef.current.closest('.overflow-y-auto') || document.body;
      const bottomLimit = modalBody ? modalBody.getBoundingClientRect().bottom : window.innerHeight;
      const spaceBelow = bottomLimit - rect.bottom;
      const topLimit = modalBody ? modalBody.getBoundingClientRect().top : 0;
      const spaceAbove = rect.top - topLimit;

      if (spaceBelow < 260 && spaceAbove > 180) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [isOpen]);

  // Default allCountries
  const allCountries = useMemo(() => {
    if (propAllCountries && propAllCountries.length > 0) return propAllCountries;
    return getCountries()
      .map((code) => ({
        code,
        name: countryNames[code] || code,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [propAllCountries]);

  // Click outside to close and commit or reset
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsTyping(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const cleanCountryName = useMemo(() => {
    if (!selectedCountryName) return '';
    if (typeof selectedCountryName === 'object') {
      const obj = selectedCountryName as any;
      const n = obj?.name || obj?.country_name || obj?.title || obj?.label;
      if (typeof n === 'string' && n.trim() && n !== '[object Object]') return n.trim();
      return '';
    }
    const str = String(selectedCountryName).trim();
    if (str === '[object Object]' || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null') {
      return '';
    }
    return str;
  }, [selectedCountryName]);

  const currentCode = useMemo<Country | null>(() => {
    if (selectedCountryCode && typeof selectedCountryCode === 'string') {
      const clean = selectedCountryCode.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(clean)) return clean as Country;
    }
    if (selectedCountryId && countries?.length) {
      const match = countries.find((c: any) => String(c.id) === String(selectedCountryId));
      if (match?.iso2) return match.iso2.toUpperCase() as Country;
    }
    if (!cleanCountryName) return null;
    const match = allCountries.find(
      (c) => c.name.toLowerCase() === cleanCountryName.toLowerCase()
    );
    if (match) return match.code;
    const matchMaster = countries?.find(
      (c: any) =>
        c.name?.toLowerCase() === cleanCountryName.toLowerCase() ||
        c.iso2?.toLowerCase() === cleanCountryName.toLowerCase()
    );
    if (matchMaster?.iso2) return matchMaster.iso2.toUpperCase() as Country;
    return null;
  }, [selectedCountryCode, selectedCountryId, cleanCountryName, allCountries, countries]);

  const displayCountryText = useMemo(() => {
    if (cleanCountryName) return cleanCountryName;
    if (currentCode) {
      const match = allCountries.find((c) => c.code === currentCode);
      if (match?.name) return match.name;
    }
    if (selectedCountryId && countries?.length) {
      const match = countries.find((c: any) => String(c.id) === String(selectedCountryId));
      if (match?.name) return match.name;
    }
    return '';
  }, [cleanCountryName, currentCode, selectedCountryId, allCountries, countries]);

  // Filtered country list based on active query
  const filteredCountries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCountries;
    return allCountries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [allCountries, query]);

  // Flattened visible items for 1:1 keyboard arrow navigation
  const visibleItems = useMemo<CountryItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return filteredCountries.map((c) => ({ ...c, isPopular: false }));
    }
    const popularSet = new Set(POPULAR_COUNTRY_CODES);
    const popularList: CountryItem[] = POPULAR_COUNTRY_CODES.map((code) => ({
      code,
      name: countryNames[code] || code,
      isPopular: true,
    }));
    const restList: CountryItem[] = allCountries
      .filter((c) => !popularSet.has(c.code))
      .map((c) => ({ ...c, isPopular: false }));
    return [...popularList, ...restList];
  }, [query, filteredCountries, allCountries]);

  // Reset or initialize highlighted index when typing / opening
  useEffect(() => {
    if (isOpen) {
      if (query.trim()) {
        setHighlightedIndex(0);
      } else {
        const idx = visibleItems.findIndex(
          (item) =>
            (currentCode && item.code === currentCode) ||
            (displayCountryText && item.name.toLowerCase() === displayCountryText.toLowerCase())
        );
        setHighlightedIndex(idx >= 0 ? idx : 0);
      }
    }
  }, [isOpen, query, currentCode, displayCountryText, visibleItems]);

  // Scroll highlighted item into view smoothly
  useLayoutEffect(() => {
    if (isOpen && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [highlightedIndex, isOpen]);

  const commitSelection = (item: { code: Country; name: string }) => {
    let rawCountryId = '';
    const match = countries?.find(
      (c: any) =>
        (item.code && c.iso2?.toUpperCase() === item.code.toUpperCase()) ||
        (item.name && c.name?.toLowerCase() === item.name.toLowerCase())
    );
    if (match?.id) rawCountryId = String(match.id);

    onSelect({
      name: item.name,
      code: item.code,
      id: rawCountryId,
    });
    setIsOpen(false);
    setIsTyping(false);
    setQuery('');
  };

  // Input change handler (User directly types to search!)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsTyping(true);
    if (!isOpen) setIsOpen(true);
  };

  // Input focus handler (Opens dropdown immediately on Tab or click!)
  const handleInputFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    setIsTyping(false);
    setQuery('');
  };

  // Keyboard navigation directly on the input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (visibleItems.length === 0) return;
      setHighlightedIndex((prev) => (prev < visibleItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (visibleItems.length === 0) return;
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : visibleItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && visibleItems.length > 0 && highlightedIndex >= 0 && highlightedIndex < visibleItems.length) {
        commitSelection(visibleItems[highlightedIndex]);
      } else if (!isOpen) {
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setIsTyping(false);
      setQuery('');
    } else if (e.key === 'Tab') {
      // If user typed a query and there is a match, commit it as they tab to the next input!
      if (isOpen && isTyping && query.trim() && visibleItems.length > 0) {
        const targetItem = visibleItems[highlightedIndex] || visibleItems[0];
        commitSelection(targetItem);
      } else {
        setIsOpen(false);
        setIsTyping(false);
        setQuery('');
      }
      // Allow default Tab behavior to smoothly advance focus to the next field in the modal!
    }
  };

  const inputValue = isTyping ? query : (displayCountryText || '');

  return (
    <div className="flex flex-col gap-1.5 relative min-w-0 w-full" ref={containerRef}>
      {label && (
        <label className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1">
            <span>{label}</span>
            {required && <span className="text-destructive">*</span>}
          </span>
          {!required && (
            <span className="text-[10px] lowercase text-muted-foreground/70 font-normal">
              (optional)
            </span>
          )}
        </label>
      )}

      {/* Combobox Input Container - Direct typing, zero double borders */}
      <div
        className={`w-full h-10 bg-background border rounded-lg flex items-center transition-colors relative cursor-text data-no-focus-outline overflow-hidden min-w-0 ${
          error
            ? 'border-destructive ring-1 ring-destructive'
            : isOpen
            ? 'border-primary ring-1 ring-primary'
            : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Flag Icon on Left */}
        <div className="pl-3 pr-1.5 flex items-center shrink-0 pointer-events-none select-none">
          {renderFlag(currentCode, displayCountryText)}
        </div>

        {/* Direct Searchable Input */}
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          tabIndex={tabIndex}
          data-no-focus-outline="true"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={displayCountryText || placeholder}
          style={{ outline: 'none', boxShadow: 'none' }}
          className="flex-1 min-w-0 h-full px-1 text-xs sm:text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none border-none font-medium data-no-focus-outline focus:outline-none focus:ring-0"
        />

        {/* Clear or Chevron Toggle Button */}
        <div className="flex items-center pr-2 shrink-0 gap-0.5">
          {isTyping && query && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                setQuery('');
                setIsTyping(false);
                inputRef.current?.focus();
              }}
              className="w-5 h-5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center text-xs transition-colors cursor-pointer shrink-0"
              title="Clear search"
            >
              <i className="fa-solid fa-xmark text-[11px]" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
              if (!isOpen) {
                inputRef.current?.focus();
              }
            }}
            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
            title="Toggle Country List"
          >
            <i
              className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-150 ${
                isOpen ? 'rotate-180 text-primary' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {error && (
        <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
          <i className="fa-solid fa-circle-exclamation text-[10px]" />
          <span>{error}</span>
        </span>
      )}

      {/* Dropdown Options Popover with Smart Flip (Upwards if near bottom) */}
      {isOpen && (
        <div
          data-dropdown-menu="true"
          ref={listRef}
          style={{
            position: 'absolute',
            top: openUpwards ? undefined : 'calc(100% + 6px)',
            bottom: openUpwards ? 'calc(100% + 6px)' : undefined,
            left: 0,
            zIndex: 9999,
          }}
          className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-64 h-64 animate-in fade-in-50 zoom-in-95 duration-150 min-w-full w-[260px] sm:w-[280px] max-w-[calc(100vw-2rem)]"
        >
          <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
            {visibleItems.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No countries found matching &ldquo;{query}&rdquo;
              </div>
            ) : (
              visibleItems.map((item, index) => {
                const isSelected =
                  (currentCode && item.code === currentCode) ||
                  (displayCountryText && item.name.toLowerCase() === displayCountryText.toLowerCase());
                const isHighlighted = index === highlightedIndex;

                const showPopularHeader = !query.trim() && index === 0;
                const showAllHeader =
                  !query.trim() &&
                  index === POPULAR_COUNTRY_CODES.length &&
                  POPULAR_COUNTRY_CODES.length > 0;

                return (
                  <React.Fragment key={`${item.code}-${index}`}>
                    {showPopularHeader && (
                      <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                        Popular Countries
                      </div>
                    )}
                    {showAllHeader && (
                      <div className="px-2.5 py-1 mt-1 border-t border-border/50 pt-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                        All Countries
                      </div>
                    )}
                    <button
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      type="button"
                      tabIndex={-1}
                      data-no-focus-outline="true"
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => commitSelection(item)}
                      className={`w-full px-2.5 py-1.5 rounded-md flex items-center justify-between text-left text-xs transition-colors cursor-pointer data-no-focus-outline outline-none ${
                        isHighlighted
                          ? 'bg-primary/10 text-primary font-semibold'
                          : isSelected
                          ? 'bg-muted/80 text-foreground font-medium'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {renderFlag(item.code, item.name)}
                        <span className="truncate">{item.name}</span>
                      </span>
                      {isSelected && (
                        <i className="fa-solid fa-check text-[11px] text-primary shrink-0 ml-2" />
                      )}
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CountrySelectField;

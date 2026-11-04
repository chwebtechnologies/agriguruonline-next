'use client';

import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import {
  getCountries,
  getCountryCallingCode,
  type Country,
} from 'react-phone-number-input';
import {
  countryNames,
  renderFlag,
  POPULAR_COUNTRY_CODES,
} from './CountrySelectField';

export interface PhoneCountryItem {
  code: Country;
  name: string;
  callingCode: string;
  isPopular?: boolean;
  isNone?: boolean;
}

export interface PhoneInputFieldProps {
  label?: string;
  required?: boolean;
  phoneCountryCode: string;
  contactNumber: string;
  allPhoneCountries?: { code: Country; name: string; callingCode: string }[];
  onChange: (data: { phoneCountryCode: string; contactNumber: string }) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  tabIndex?: number;
}

export function PhoneInputField({
  label = 'Contact Number',
  required = false,
  phoneCountryCode,
  contactNumber,
  allPhoneCountries: propAllPhoneCountries,
  onChange,
  error,
  placeholder = 'Phone / Mobile number',
  disabled = false,
  tabIndex = 0,
}: PhoneInputFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Default allPhoneCountries if not passed
  const allPhoneCountries = useMemo(() => {
    if (propAllPhoneCountries && propAllPhoneCountries.length > 0) {
      return propAllPhoneCountries;
    }
    return getCountries()
      .map((code) => {
        let callingCode = '';
        try {
          callingCode = `+${getCountryCallingCode(code)}`;
        } catch {}
        return {
          code,
          name: countryNames[code] || code,
          callingCode,
        };
      })
      .filter((c) => c.callingCode)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [propAllPhoneCountries]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const phoneCountry = useMemo<Country | null>(() => {
    if (!phoneCountryCode) return null;
    const trimmed = String(phoneCountryCode).trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') return null;

    // 1. If 2-letter ISO code e.g. 'IN', 'US'
    if (/^[A-Za-z]{2}$/.test(trimmed)) {
      const match = allPhoneCountries.find((c) => c.code.toLowerCase() === trimmed.toLowerCase());
      if (match) return match.code;
    }

    // 2. Calling code e.g. '+91' or '91'
    const cleanCode = trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
    const matched = allPhoneCountries.find((c) => c.callingCode === cleanCode);
    return matched?.code || null;
  }, [phoneCountryCode, allPhoneCountries]);

  const displayCallingCode = useMemo(() => {
    if (!phoneCountryCode) return '';
    const trimmed = String(phoneCountryCode).trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') return '';
    if (trimmed.startsWith('+')) return trimmed;
    if (/^\d+$/.test(trimmed)) return `+${trimmed}`;
    if (phoneCountry) {
      try {
        const calling = getCountryCallingCode(phoneCountry);
        if (calling) return `+${calling}`;
      } catch {}
    }
    return '';
  }, [phoneCountryCode, phoneCountry]);

  // Filtered phone countries
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allPhoneCountries;
    const qClean = q.replace(/^\+/, '');
    return allPhoneCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.callingCode.replace(/^\+/, '').includes(qClean)
    );
  }, [allPhoneCountries, search]);

  // Flattened visible items for 1:1 arrow key navigation
  const visiblePhoneList = useMemo<PhoneCountryItem[]>(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return filtered.map((c) => ({ ...c, isPopular: false }));
    }

    const noneItem: PhoneCountryItem = {
      code: 'IN' as Country, // placeholder, not used when isNone is true
      name: 'No Country Code (None)',
      callingCode: '',
      isNone: true,
    };

    const popularSet = new Set(POPULAR_COUNTRY_CODES);
    const popularList: PhoneCountryItem[] = [];
    for (const code of POPULAR_COUNTRY_CODES) {
      const found = allPhoneCountries.find((c) => c.code === code);
      if (found) {
        popularList.push({ ...found, isPopular: true });
      }
    }

    const restList: PhoneCountryItem[] = allPhoneCountries
      .filter((c) => !popularSet.has(c.code))
      .map((c) => ({ ...c, isPopular: false }));

    return [noneItem, ...popularList, ...restList];
  }, [search, filtered, allPhoneCountries]);

  const [openUpwards, setOpenUpwards] = useState(false);

  // Smart placement: Check space below vs space above relative to scroll container/viewport
  useLayoutEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const modalBody = dropdownRef.current.closest('.overflow-y-auto') || document.body;
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
  useEffect(() => {
    if (isOpen) {
      if (search.trim()) {
        setHighlightedIndex(0);
      } else {
        const idx = visiblePhoneList.findIndex(
          (c) =>
            (!c.isNone && displayCallingCode && c.callingCode === displayCallingCode) ||
            (c.isNone && !displayCallingCode)
        );
        setHighlightedIndex(idx >= 0 ? idx : 0);
      }
    }
  }, [isOpen, search, displayCallingCode, visiblePhoneList]);

  // Scroll highlighted item into view smoothly
  useLayoutEffect(() => {
    if (isOpen && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [highlightedIndex, isOpen]);

  const handleOpenDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleSelectCode = (c: PhoneCountryItem | null) => {
    const newCode = c?.isNone ? '' : c?.callingCode || '';
    onChange({
      phoneCountryCode: newCode,
      contactNumber,
    });
    setIsOpen(false);
    setSearch('');
    // Automatically focus the number input so user can immediately type their phone number!
    setTimeout(() => {
      numberInputRef.current?.focus();
    }, 20);
  };

  const handleNumberChange = (raw: string) => {
    onChange({
      phoneCountryCode: displayCallingCode || phoneCountryCode,
      contactNumber: raw.replace(/[^\d\s-]/g, ''),
    });
  };

  // Keyboard navigation on dial code trigger button
  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      handleOpenDropdown();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenDropdown();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Direct typing into dial code trigger immediately opens and filters!
      e.preventDefault();
      setIsOpen(true);
      setSearch(e.key);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  };

  // Keyboard navigation inside search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (visiblePhoneList.length === 0) return;
      setHighlightedIndex((prev) => (prev < visiblePhoneList.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (visiblePhoneList.length === 0) return;
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : visiblePhoneList.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (visiblePhoneList.length > 0 && highlightedIndex >= 0 && highlightedIndex < visiblePhoneList.length) {
        handleSelectCode(visiblePhoneList[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'Tab') {
      // Close dropdown and let Tab move to number input naturally
      setIsOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 relative">
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

      {/* Outer Input Container - Has single border, highlights cleanly with focus-within */}
      <div
        className={`w-full h-10 bg-background border rounded-lg flex items-center transition-colors shadow-none ${
          error
            ? 'border-destructive ring-1 ring-destructive'
            : isOpen
            ? 'border-primary ring-1 ring-primary'
            : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'
        }`}
      >
        {/* Dial Code Button with Popover */}
        <div className="relative h-full shrink-0" ref={dropdownRef}>
          <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            tabIndex={tabIndex}
            data-no-focus-outline="true"
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
              } else {
                handleOpenDropdown();
              }
            }}
            onKeyDown={handleTriggerKeyDown}
            style={{ outline: 'none', boxShadow: 'none' }}
            className="h-full px-2.5 flex items-center gap-1.5 hover:bg-muted/60 text-foreground transition-colors border-r border-border rounded-l-lg outline-none select-none cursor-pointer shrink-0 whitespace-nowrap data-no-focus-outline focus:outline-none focus-visible:outline-none focus-visible:bg-muted/90 focus-visible:text-primary ring-0 focus:ring-0 focus-visible:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Select Country Calling Code"
          >
            {phoneCountry ? (
              renderFlag(phoneCountry, countryNames[phoneCountry])
            ) : (
              <i className="fa-solid fa-globe text-muted-foreground text-xs shrink-0" />
            )}
            <span className="text-xs font-semibold text-foreground tracking-tight shrink-0 whitespace-nowrap">
              {displayCallingCode || '+ --'}
            </span>
            <i
              className={`fa-solid fa-chevron-down text-[9px] text-muted-foreground transition-transform shrink-0 ${
                isOpen ? 'rotate-180 text-primary' : ''
              }`}
            />
          </button>

          {/* Dial Code Dropdown Menu with Smart Flip (Upwards if near bottom) */}
          {isOpen && (
            <div
              data-dropdown-menu="true"
              style={{
                position: 'absolute',
                top: openUpwards ? undefined : 'calc(100% + 6px)',
                bottom: openUpwards ? 'calc(100% + 6px)' : undefined,
                left: 0,
                zIndex: 9999,
              }}
              className="w-72 max-h-64 h-64 bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150"
            >
              {/* Search Input Box */}
              <div className="p-2 border-b border-border bg-muted/30 sticky top-0 z-10">
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search country or code..."
                    className="w-full h-8 pl-8 pr-7 text-xs bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors data-no-focus-outline"
                    data-no-focus-outline="true"
                  />
                  {search && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => {
                        setSearch('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </div>
              </div>

              {/* Dropdown Options List */}
              <div className="overflow-y-auto custom-scrollbar flex-1 p-1">
                {visiblePhoneList.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No matching countries or codes found
                  </div>
                ) : (
                  visiblePhoneList.map((item, index) => {
                    const isSelected = item.isNone
                      ? !phoneCountryCode
                      : phoneCountryCode === item.callingCode;
                    const isHighlighted = index === highlightedIndex;

                    const showPopularHeader =
                      !search.trim() && item.isPopular && index === 1;
                    const showAllHeader =
                      !search.trim() &&
                      !item.isNone &&
                      !item.isPopular &&
                      index === POPULAR_COUNTRY_CODES.length + 1;

                    return (
                      <React.Fragment key={`${item.code}-${item.callingCode}-${index}`}>
                        {item.isNone && (
                          <button
                            ref={(el) => {
                              itemRefs.current[index] = el;
                            }}
                            type="button"
                            tabIndex={-1}
                            data-no-focus-outline="true"
                            onMouseEnter={() => setHighlightedIndex(index)}
                            onClick={() => handleSelectCode(item)}
                            className={`w-full px-2.5 py-1.5 rounded-md flex items-center justify-between text-left text-xs transition-colors cursor-pointer mb-1 border-b border-border/40 data-no-focus-outline outline-none ${
                              isHighlighted
                                ? 'bg-primary/10 text-primary font-semibold'
                                : isSelected
                                ? 'bg-muted/80 text-foreground font-medium'
                                : 'hover:bg-muted text-muted-foreground'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <i className="fa-solid fa-ban text-xs" />
                              <span>No Country Code (None)</span>
                            </span>
                            {isSelected && (
                              <i className="fa-solid fa-check text-[11px] text-primary" />
                            )}
                          </button>
                        )}

                        {showPopularHeader && (
                          <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Popular
                          </div>
                        )}

                        {showAllHeader && (
                          <div className="px-2.5 py-1 mt-1 border-t border-border/50 pt-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            All Countries
                          </div>
                        )}

                        {!item.isNone && (
                          <button
                            ref={(el) => {
                              itemRefs.current[index] = el;
                            }}
                            type="button"
                            tabIndex={-1}
                            data-no-focus-outline="true"
                            onMouseEnter={() => setHighlightedIndex(index)}
                            onClick={() => handleSelectCode(item)}
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
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <span className="text-[11px] font-mono text-muted-foreground">
                                {item.callingCode}
                              </span>
                              {isSelected && (
                                <i className="fa-solid fa-check text-[11px] text-primary" />
                              )}
                            </div>
                          </button>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Number Input - Clean, borderless inside container */}
        <input
          ref={numberInputRef}
          type="tel"
          inputMode="numeric"
          disabled={disabled}
          value={contactNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={placeholder}
          style={{ outline: 'none', boxShadow: 'none' }}
          className="flex-1 h-full px-3 text-xs sm:text-sm bg-transparent text-foreground outline-none border-none placeholder:text-muted-foreground/60 font-medium focus:outline-none focus:ring-0"
        />
      </div>

      {error && (
        <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
          <i className="fa-solid fa-circle-exclamation text-[10px]" />
          <span>{error}</span>
        </span>
      )}
    </div>
  );
}

export default PhoneInputField;


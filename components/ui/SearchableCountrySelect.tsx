"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import flags from "react-phone-number-input/flags";
import { getCountries, getCountryCallingCode, type Country } from "react-phone-number-input";
import en from "react-phone-number-input/locale/en.json";

const countryNames = en as Record<string, string>;

export interface CountryOption {
  code: Country;
  name: string;
  callingCode: string;
}

const POPULAR_CODES: Country[] = ["IN", "AE", "VN", "TH", "BJ", "KE", "CN", "BR"];

export interface SearchableCountrySelectProps {
  value?: string;
  onChange: (value?: string) => void;
  options?: Array<{ value?: string; label?: string }>;
  disabled?: boolean;
  readOnly?: boolean;
  name?: string;
  ariaLabel?: string;
  className?: string;
  showDialCode?: boolean;
  placeholder?: string;
}

export default function SearchableCountrySelect({
  value,
  onChange,
  options,
  disabled,
  readOnly,
  name,
  ariaLabel,
  className,
  showDialCode = true,
  placeholder,
}: SearchableCountrySelectProps) {
  const actualPlaceholder = placeholder || (showDialCode ? "Search country or code..." : "Search country...");
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build full dataset of countries
  const allCountries: CountryOption[] = useMemo(() => {
    // If react-phone-number-input passed specific options, map those
    if (options && options.length > 0) {
      return options
        .filter((o): o is { value: string; label?: string } => Boolean(o.value))
        .map((o) => {
          const code = o.value as Country;
          const callingCode = getCountryCallingCode(code);
          return {
            code,
            name: o.label || countryNames[code] || code,
            callingCode: callingCode ? `+${callingCode}` : "",
          };
        });
    }

    // Default: all 245 countries from react-phone-number-input
    return getCountries().map((code) => {
      const callingCode = getCountryCallingCode(code);
      return {
        code,
        name: countryNames[code] || code,
        callingCode: callingCode ? `+${callingCode}` : "",
      };
    });
  }, [options]);

  const selectedCountry = useMemo(() => {
    if (!value) return null;
    return allCountries.find((c) => c.code === value) || null;
  }, [value, allCountries]);

  // Filter and rank countries based on search query
  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qClean = q.replace(/^\+/, "");
    if (!q) return allCountries;

    const matches = allCountries.filter((c) => {
      const cClean = c.callingCode.replace("+", "");
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase() === q ||
        c.callingCode.toLowerCase().includes(q) ||
        cClean.includes(qClean)
      );
    });

    return matches.sort((a, b) => {
      const aExactISO = a.code.toLowerCase() === q;
      const bExactISO = b.code.toLowerCase() === q;
      if (aExactISO && !bExactISO) return -1;
      if (!aExactISO && bExactISO) return 1;

      const aClean = a.callingCode.replace("+", "");
      const bClean = b.callingCode.replace("+", "");
      const aExactCode = aClean === qClean;
      const bExactCode = bClean === qClean;
      if (aExactCode && !bExactCode) return -1;
      if (!aExactCode && bExactCode) return 1;

      const aCodeStarts = aClean.startsWith(qClean);
      const bCodeStarts = bClean.startsWith(qClean);
      if (aCodeStarts && !bCodeStarts) return -1;
      if (!aCodeStarts && bCodeStarts) return 1;

      const aNameStarts = a.name.toLowerCase().startsWith(q);
      const bNameStarts = b.name.toLowerCase().startsWith(q);
      if (aNameStarts && !bNameStarts) return -1;
      if (!aNameStarts && bNameStarts) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [search, allCountries]);

  const popularCountries = useMemo(() => {
    if (search.trim() || !showDialCode) return [];
    return POPULAR_CODES.map((code) => allCountries.find((c) => c.code === code)).filter(
      (c): c is CountryOption => Boolean(c)
    );
  }, [search, allCountries, showDialCode]);

  // Handle focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Prevent background scroll on mobile when modal is open
  useEffect(() => {
    if (isOpen && typeof window !== "undefined" && window.innerWidth < 640) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  const handleSelect = (countryCode: string) => {
    onChange(countryCode);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const totalItems = filteredCountries.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < totalItems ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCountries[highlightedIndex]) {
        handleSelect(filteredCountries[highlightedIndex].code);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Render Flag component safely
  const renderFlag = (code?: string) => {
    if (!code) return <i className="fa-solid fa-globe text-foreground/40 text-xs"></i>;
    const FlagComp = flags[code as Country];
    if (FlagComp) {
      return (
        <span className="w-5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden rounded-xs border border-foreground/10 shadow-2xs">
          <FlagComp title={countryNames[code] || code} />
        </span>
      );
    }
    return <i className="fa-solid fa-globe text-foreground/40 text-xs"></i>;
  };

  return (
    <div className={`relative inline-block text-left ${className || ""}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        name={name}
        aria-label={ariaLabel || "Select Country"}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled || readOnly}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`flex items-center justify-between hover:opacity-90 transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none group ${
          !showDialCode
            ? `w-full px-3.5 h-[46px] bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/15 rounded-xl text-foreground font-medium text-sm focus:bg-background focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue ${isOpen ? "bg-background ring-2 ring-brand-blue/50 border-brand-blue" : ""}`
            : "gap-2 pr-3 py-1 border-r border-foreground/15 mr-3 text-foreground"
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {renderFlag(selectedCountry?.code)}
          <span className="text-sm font-medium text-foreground tracking-tight truncate">
            {showDialCode
              ? selectedCountry?.callingCode || selectedCountry?.code || "Select"
              : selectedCountry?.name || "Select Country"}
          </span>
        </span>
        <i
          className={`fa-solid fa-chevron-down text-xs text-foreground/40 group-hover:text-foreground/70 transition-transform duration-200 ml-1 ${
            isOpen ? "rotate-180" : ""
          }`}
        ></i>
      </button>

      {/* Dropdown / Mobile Sheet Overlay */}
      {isOpen && (
        <div className="fixed sm:absolute inset-0 sm:inset-auto sm:top-full sm:left-0 sm:mt-2 z-50 bg-black/60 backdrop-blur-sm transform-gpu sm:bg-transparent sm: flex items-end sm:items-start justify-center p-0 sm:p-0 animate-in fade-in duration-200">
          <div
            className="w-full sm:w-80 md:w-96 bg-background border border-foreground/15 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[440px] overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onKeyDown={handleKeyDown}
          >
            {/* Header with Search & Close */}
            <div className="p-3 border-b border-foreground/10 bg-foreground/[0.02] flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-xs pointer-events-none"></i>
                <input
                  ref={searchInputRef}
                  type="text"
                  aria-label={actualPlaceholder}
                  placeholder={actualPlaceholder}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  className="w-full pl-8 pr-7 py-2 bg-foreground/5 hover:bg-foreground/[0.07] border border-foreground/10 rounded-xl text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all font-medium"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground p-1"
                  >
                    <i className="fa-solid fa-circle-xmark text-xs"></i>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="sm:hidden p-2 text-foreground/60 hover:text-foreground rounded-lg"
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            {/* Scrollable Country List */}
            <div ref={listRef} className="overflow-y-auto p-1.5 custom-scrollbar flex-1 space-y-1">
              {/* Popular Countries (when not searching) */}
              {!search.trim() && popularCountries.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-foreground/40 uppercase">
                    Popular Countries
                  </div>
                  {popularCountries.map((c) => {
                    const isSelected = selectedCountry?.code === c.code;
                    return (
                      <div
                        key={`pop-${c.code}`}
                        onClick={() => handleSelect(c.code)}
                        className={`px-3 py-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors text-xs sm:text-sm ${
                          isSelected
                            ? "bg-brand-blue/10 text-brand-blue font-bold"
                            : "hover:bg-foreground/5 text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {renderFlag(c.code)}
                          <span className="truncate font-medium">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {showDialCode && (
                            <span className="text-xs font-semibold text-foreground/80">{c.callingCode}</span>
                          )}
                          {isSelected && <i className="fa-solid fa-check text-brand-blue text-xs"></i>}
                        </div>
                      </div>
                    );
                  })}
                  <div className="my-1 border-t border-foreground/5"></div>
                </div>
              )}

              {/* All / Filtered Countries Header */}
              {showDialCode && !search.trim() && (
                <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-foreground/40 uppercase">
                  All Countries ({filteredCountries.length})
                </div>
              )}

              {/* Country Items */}
              {filteredCountries.length > 0 ? (
                filteredCountries.map((c, index) => {
                  const isSelected = selectedCountry?.code === c.code;
                  const isHighlighted = highlightedIndex === index;

                  return (
                    <div
                      key={c.code}
                      onClick={() => handleSelect(c.code)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`px-3 py-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors text-xs sm:text-sm ${
                        isSelected
                          ? "bg-brand-blue/10 text-brand-blue font-bold"
                          : isHighlighted
                          ? "bg-foreground/5 text-foreground"
                          : "text-foreground hover:bg-foreground/5"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {renderFlag(c.code)}
                        <span className="truncate font-medium">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {showDialCode && (
                          <span className="text-xs font-semibold text-foreground/80">{c.callingCode}</span>
                        )}
                        {isSelected && <i className="fa-solid fa-check text-brand-blue text-xs"></i>}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center flex flex-col items-center justify-center text-foreground/50">
                  <i className="fa-solid fa-globe text-3xl mb-2 text-foreground/20"></i>
                  <p className="text-xs sm:text-sm font-medium">No countries found for "{search}"</p>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="mt-3 px-3 py-1.5 bg-foreground/5 hover:bg-foreground/10 text-foreground text-xs font-semibold rounded-lg transition-colors"
                  >
                    Clear Search
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

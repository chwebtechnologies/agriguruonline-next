'use client';

import React, { useState, useRef, useEffect } from 'react';

export const STANDARD_TRADE_DOCUMENTS: string[] = [
  'PROFORMA INVOICE',
  'SHIPMENT INSTRUCTION',
  'BILL OF LADING',
  'COMMERCIAL INVOICE',
  'PACKING LIST',
  'PHYTO CERTIFICATE',
  'FUMIGATION CERTIFICATE',
  'CERTIFICATE OF ORIGIN',
  'W AND Q CERTIFICATE',
  'INSURANCE CERTIFICATE',
  'HEALTH CERTIFICATE',
  'NON-GMO CERTIFICATE',
  'CERTIFICATE OF ANALYSIS (COA)',
  'BENEFICIARY CERTIFICATE',
];

export interface DocDocumentMultiSelectProps {
  value: string[];
  onChange: (docs: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DocDocumentMultiSelect({
  value = [],
  onChange,
  disabled = false,
  placeholder = 'Select Documents',
}: DocDocumentMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customInput, setCustomInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleDoc = (doc: string) => {
    if (disabled) return;
    if (value.includes(doc)) {
      onChange(value.filter((d) => d !== doc));
    } else {
      onChange([...value, doc]);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customInput.trim().toUpperCase();
    if (clean && !value.includes(clean)) {
      onChange([...value, clean]);
      setCustomInput('');
    }
  };

  const handleSelectAllStandard = () => {
    const combined = Array.from(new Set([...value, ...STANDARD_TRADE_DOCUMENTS.slice(0, 9)]));
    onChange(combined);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const filteredOptions = STANDARD_TRADE_DOCUMENTS.filter((doc) =>
    doc.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  // Split selected documents into 2 columns for presentation matching Image 4
  const halfCount = Math.ceil(value.length / 2);
  const col1 = value.slice(0, halfCount);
  const col2 = value.slice(halfCount);

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-2">
      {/* Dropdown Trigger */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full text-left py-1.5 flex items-center justify-between border-b-2 border-dotted border-primary/70 dark:border-primary/80 hover:border-primary transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 bg-transparent ${
            isOpen ? 'border-primary' : ''
          }`}
        >
          <span className="text-xs sm:text-[13px] font-semibold text-foreground tracking-wide">
            {placeholder}
          </span>
          <div className="flex items-center gap-2">
            {value.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                {value.length} selected
              </span>
            )}
            <i
              className={`fa-solid fa-chevron-down text-primary dark:text-sky-400 text-xs transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-2.5 flex flex-col gap-2 max-h-72 animate-in fade-in zoom-in-95 duration-150">
            {/* Search Input */}
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search trade documents..."
                className="w-full bg-muted/40 border border-border rounded-md pl-7 pr-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {/* Quick Action Pills */}
            <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5 px-0.5 text-[11px]">
              <button
                type="button"
                onClick={handleSelectAllStandard}
                className="text-primary hover:underline font-semibold cursor-pointer"
              >
                + Standard 9 Docs
              </button>
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-destructive hover:underline font-medium cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Document Checklist */}
            <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col gap-1 pr-1 custom-scrollbar text-xs">
              {filteredOptions.map((doc) => {
                const isSelected = value.includes(doc);
                return (
                  <label
                    key={doc}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/15 text-primary font-bold'
                        : 'hover:bg-muted/60 text-foreground'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDoc(doc)}
                      className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    <span className="truncate">{doc}</span>
                  </label>
                );
              })}
            </div>

            {/* Add Custom Document Input */}
            <form onSubmit={handleAddCustom} className="border-t border-border pt-2 flex items-center gap-1.5">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Add other required document..."
                className="flex-1 bg-muted/40 border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary uppercase"
              />
              <button
                type="submit"
                disabled={!customInput.trim()}
                className="px-2.5 py-1 rounded bg-primary text-primary-foreground font-semibold text-xs disabled:opacity-50 cursor-pointer"
              >
                Add
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Render Selected Documents as Numbered 2-Column List Matching Image 4 */}
      {value.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 pt-1 text-xs uppercase tracking-wide">
          {/* Column 1 */}
          <div className="flex flex-col gap-1">
            {col1.map((doc, idx) => (
              <div
                key={doc}
                className="group flex items-center justify-between py-0.5 px-1 rounded hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <span className="text-muted-foreground font-bold w-4">{idx + 1}.</span>
                  <span>{doc}</span>
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => toggleDoc(doc)}
                    title="Remove document"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-[11px] px-1 cursor-pointer transition-opacity"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-1">
            {col2.map((doc, idx) => (
              <div
                key={doc}
                className="group flex items-center justify-between py-0.5 px-1 rounded hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <span className="text-muted-foreground font-bold w-4">{halfCount + idx + 1}.</span>
                  <span>{doc}</span>
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => toggleDoc(doc)}
                    title="Remove document"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-[11px] px-1 cursor-pointer transition-opacity"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground/70 italic py-1">
          No documents selected. Click &quot;Select Documents&quot; to pick or add documents.
        </div>
      )}
    </div>
  );
}

export default DocDocumentMultiSelect;


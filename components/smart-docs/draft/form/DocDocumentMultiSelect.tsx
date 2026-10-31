'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  type SmartDocsSelectionDocumentOption,
  DEFAULT_DOCUMENT_SELECTION_OPTIONS,
} from '@/lib/api/smart-docs.service';
import { getSmartDocsDocumentListAction } from '@/app/actions/smart-docs';

export const STANDARD_TRADE_DOCUMENTS: string[] = DEFAULT_DOCUMENT_SELECTION_OPTIONS.map(
  (doc) => doc.name
);

export interface DocDocumentMultiSelectProps {
  value: string[];
  onChange: (docs: string[]) => void;
  options?: (SmartDocsSelectionDocumentOption | string)[];
  defaultDocuments?: string[];
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  lang?: string;
  offsetIndex?: number;
}

export function DocDocumentMultiSelect({
  value = [],
  onChange,
  options,
  defaultDocuments = [],
  isLoading: externalLoading = false,
  disabled = false,
  placeholder = 'SELECT DOCUMENTS',
  lang = 'en',
  offsetIndex = 0,
}: DocDocumentMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [internalOptions, setInternalOptions] = useState<SmartDocsSelectionDocumentOption[]>([]);
  const [isInternalLoading, setIsInternalLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options into a uniform format
  const normalizedOptions: SmartDocsSelectionDocumentOption[] = useMemo(() => {
    const listToNormalize =
      options && options.length > 0
        ? options
        : internalOptions.length > 0
        ? internalOptions
        : DEFAULT_DOCUMENT_SELECTION_OPTIONS;

    const seen = new Set<string>();
    const result: SmartDocsSelectionDocumentOption[] = [];

    for (let idx = 0; idx < listToNormalize.length; idx++) {
      const item = listToNormalize[idx];
      if (!item) continue;

      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed && !seen.has(trimmed.toUpperCase())) {
          seen.add(trimmed.toUpperCase());
          result.push({
            id: trimmed,
            name: trimmed,
            label: trimmed,
            value: trimmed,
          });
        }
      } else if (typeof item === 'object') {
        const name = String(
          item.document_name ||
          item.name ||
          item.title ||
          item.label ||
          item.doc_name ||
          ''
        ).trim();

        if (name && !seen.has(name.toUpperCase())) {
          seen.add(name.toUpperCase());
          result.push({
            ...item,
            id: String(item.id || item._id || item.document_id || name),
            name,
            label: name,
            value: name,
          });
        }
      }
    }

    // Seamlessly include any documents present in `value` (e.g. from contract API) that are not in master options
    if (Array.isArray(value)) {
      for (const valItem of value) {
        if (!valItem) continue;
        const valStr = typeof valItem === 'string' ? valItem.trim() : String(valItem || '').trim();
        if (valStr && !seen.has(valStr.toUpperCase())) {
          seen.add(valStr.toUpperCase());
          result.push({
            id: valStr,
            name: valStr,
            label: valStr,
            value: valStr,
            isCustom: true,
          });
        }
      }
    }

    const defaultSet = new Set(
      (defaultDocuments || []).map((d) => String(d).trim().toUpperCase())
    );

    const isValSelected = (name: string) => {
      const nLower = name.trim().toLowerCase();
      return Array.isArray(value) && value.some((v) => String(v).trim().toLowerCase() === nLower);
    };

    return result.filter(
      (opt) => !defaultSet.has(opt.name.trim().toUpperCase()) || isValSelected(opt.name)
    );
  }, [options, internalOptions, value, defaultDocuments]);

  // Self-heal: Fetch document options from API if not provided via props
  useEffect(() => {
    if (!options || options.length === 0) {
      setIsInternalLoading(true);
      getSmartDocsDocumentListAction({ lang })
        .then((res) => {
          if (res?.success && res.documents && res.documents.length > 0) {
            setInternalOptions(res.documents);
          }
        })
        .catch((err) => {
          console.error('[DocDocumentMultiSelect] Error fetching document list:', err);
        })
        .finally(() => {
          setIsInternalLoading(false);
        });
    }
  }, [options, lang]);

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

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const isDocSelected = useCallback(
    (opt: SmartDocsSelectionDocumentOption): boolean => {
      if (!Array.isArray(value) || value.length === 0) return false;
      const optName = String(opt.name || '').trim().toLowerCase();
      const optLabel = String(opt.label || '').trim().toLowerCase();
      const optId = String(opt.id || '').trim().toLowerCase();
      const optVal = String(opt.value || '').trim().toLowerCase();

      return value.some((v) => {
        if (!v) return false;
        const vStr = String(v).trim().toLowerCase();
        return (
          (optName && vStr === optName) ||
          (optLabel && vStr === optLabel) ||
          (optId && vStr === optId) ||
          (optVal && vStr === optVal)
        );
      });
    },
    [value]
  );

  const toggleDoc = (opt: SmartDocsSelectionDocumentOption) => {
    if (disabled) return;
    const docName = String(opt.name || opt.label || opt.id || '').trim();
    if (!docName) return;

    const optNameLower = String(opt.name || '').trim().toLowerCase();
    const optLabelLower = String(opt.label || '').trim().toLowerCase();
    const optIdLower = String(opt.id || '').trim().toLowerCase();

    const isSelected = value.some((v) => {
      const vLower = String(v).trim().toLowerCase();
      return (
        (optNameLower && vLower === optNameLower) ||
        (optLabelLower && vLower === optLabelLower) ||
        (optIdLower && vLower === optIdLower)
      );
    });

    if (isSelected) {
      // Unselect: remove and keep sequence of remaining
      onChange(
        value.filter((v) => {
          const vLower = String(v).trim().toLowerCase();
          return (
            (!optNameLower || vLower !== optNameLower) &&
            (!optLabelLower || vLower !== optLabelLower) &&
            (!optIdLower || vLower !== optIdLower)
          );
        })
      );
    } else {
      // Select: append at end so newly selected appears in subsequent sequence
      onChange([...value, docName]);
    }
  };

  const removeDoc = (docName: string) => {
    if (disabled) return;
    const target = docName.trim().toLowerCase();
    onChange(value.filter((d) => String(d).trim().toLowerCase() !== target));
  };

  const filteredOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return normalizedOptions;
    return normalizedOptions.filter((opt) =>
      opt.name.toLowerCase().includes(term) ||
      (opt.label && opt.label.toLowerCase().includes(term))
    );
  }, [normalizedOptions, searchTerm]);

  const isLoading = externalLoading || isInternalLoading;

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-2">
      {/* Dropdown Trigger */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full text-left py-1 min-h-[30px] flex items-center justify-between border-b-2 border-dotted border-primary/70 dark:border-primary/80 hover:border-primary transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 bg-transparent ${
            isOpen ? 'border-primary' : ''
          }`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span
            className={`truncate flex-1 text-[14px] ${
              value.length > 0 ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground/50 uppercase'
            }`}
          >
            {placeholder}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {value.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
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

        {/* Dropdown Popup */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-2.5 flex flex-col gap-2 max-h-80 animate-in fade-in zoom-in-95 duration-150">
            {/* Search Input */}
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search documents..."
                className="w-full bg-muted/40 border border-border rounded-md pl-7 pr-7 py-1.5 text-[13px] sm:text-[14px] text-foreground placeholder:text-[13px] sm:placeholder:text-[14px] placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                  title="Clear search"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>

            {/* Document Checklist */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain flex flex-col gap-1 pr-1 custom-scrollbar min-h-[140px] max-h-52 text-xs"
              role="listbox"
              aria-multiselectable="true"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                  <i className="fa-solid fa-circle-notch fa-spin text-primary" />
                  <span>Loading documents...</span>
                </div>
              ) : filteredOptions.length > 0 ? (
                <>
                  {filteredOptions.map((opt) => {
                    const isSelected = isDocSelected(opt);
                    return (
                      <label
                        key={opt.id || opt.name}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors select-none ${
                          isSelected
                            ? 'bg-primary/15 text-primary font-bold'
                            : 'hover:bg-muted/60 text-foreground font-medium'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDoc(opt)}
                          className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                        />
                        <span className="truncate flex-1 uppercase tracking-wide">
                          {opt.name}
                        </span>
                        {opt.isCustom && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold tracking-wider">
                            CUSTOM
                          </span>
                        )}
                        {isSelected && (
                          <i className="fa-solid fa-check text-primary text-xs shrink-0" />
                        )}
                      </label>
                    );
                  })}
                  {/* Option to add custom document if search term doesn't exactly match */}
                  {searchTerm.trim() &&
                    !filteredOptions.some(
                      (o) => o.name.toLowerCase() === searchTerm.trim().toLowerCase()
                    ) && (
                      <button
                        type="button"
                        onClick={() => {
                          const newDoc = searchTerm.trim().toUpperCase();
                          if (
                            !value.some(
                              (v) => String(v).trim().toUpperCase() === newDoc
                            )
                          ) {
                            onChange([...value, newDoc]);
                          }
                          setSearchTerm('');
                        }}
                        className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-primary/10 text-primary font-semibold text-xs border border-dashed border-primary/40 cursor-pointer mt-1"
                      >
                        <i className="fa-solid fa-plus text-xs" />
                        <span>Add &quot;{searchTerm.trim().toUpperCase()}&quot; to documents</span>
                      </button>
                    )}
                </>
              ) : (
                <div className="py-4 flex flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground/80">
                  <span>No documents found matching &quot;{searchTerm}&quot;</span>
                  {searchTerm.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        const newDoc = searchTerm.trim().toUpperCase();
                        if (
                          !value.some(
                            (v) => String(v).trim().toUpperCase() === newDoc
                          )
                        ) {
                          onChange([...value, newDoc]);
                        }
                        setSearchTerm('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs border border-primary/30 cursor-pointer"
                    >
                      <i className="fa-solid fa-plus text-xs" />
                      <span>Add &quot;{searchTerm.trim().toUpperCase()}&quot; as document</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Dropdown Footer: Always show Done button at the bottom */}
            <div className="pt-2 border-t border-border flex items-center justify-between gap-2 mt-auto">
              <span className="text-[11px] text-muted-foreground font-medium px-1">
                {value.length > 0 ? `${value.length} selected` : 'None selected'}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-white font-semibold text-xs tracking-wider uppercase transition-colors shadow-sm cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unified Documents List Below Dropdown: 1 to 10 (Default) + 11 onwards (Selected) */}
      {(defaultDocuments.length > 0 || value.length > 0) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 pt-1 text-[13px] sm:text-[14px] uppercase tracking-wide">
          {/* Default Documents: 1 to 10 */}
          {defaultDocuments.map((doc, idx) => (
            <div
              key={`default-${doc}-${idx}`}
              className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/30 transition-colors border border-transparent"
            >
              <div className="flex items-center gap-2.5 text-foreground font-semibold min-w-0">
                <span className="text-muted-foreground/90 font-bold w-5 shrink-0 text-left">
                  {idx + 1}.
                </span>
                <span className="truncate">{doc}</span>
              </div>
            </div>
          ))}

          {/* User-Selected Documents: 11 onwards */}
          {value.map((doc, idx) => (
            <div
              key={doc}
              className="group flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/30 transition-colors border border-transparent hover:border-border/60"
            >
              <div className="flex items-center gap-2.5 text-foreground font-semibold min-w-0">
                <span className="text-muted-foreground/90 font-bold w-5 shrink-0 text-left">
                  {defaultDocuments.length + idx + 1}.
                </span>
                <span className="truncate">{doc}</span>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeDoc(doc)}
                  title="Remove document"
                  aria-label={`Remove ${doc}`}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-[12px] px-1 py-0.5 cursor-pointer transition-opacity shrink-0"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground/70 italic py-1">
          No documents selected. Click &quot;Select Documents&quot; to pick required documents.
        </div>
      )}
    </div>
  );
}

export default DocDocumentMultiSelect;

'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  type SmartDocsSelectionDocumentOption,
  DEFAULT_DOCUMENT_SELECTION_OPTIONS,
} from '@/lib/api/smart-docs.service';

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
  defaultDocuments = [],
  disabled = false,
  placeholder = 'Enter Document',
}: DocDocumentMultiSelectProps) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Unified list of all documents (merging any legacy defaultDocuments into value without duplicates)
  const effectiveList: string[] = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    if (Array.isArray(value)) {
      for (const item of value) {
        if (!item) continue;
        const s = typeof item === 'string' ? item.trim() : String(item).trim();
        if (s && !seen.has(s.toUpperCase())) {
          seen.add(s.toUpperCase());
          list.push(s.toUpperCase());
        }
      }
    }

    if (Array.isArray(defaultDocuments)) {
      for (const item of defaultDocuments) {
        if (!item) continue;
        const s = typeof item === 'string' ? item.trim() : String(item).trim();
        if (s && !seen.has(s.toUpperCase())) {
          seen.add(s.toUpperCase());
          list.push(s.toUpperCase());
        }
      }
    }

    return list;
  }, [value, defaultDocuments]);

  /**
   * Parses raw user text into clean document names:
   * - Splits by comma (,), semicolon (;), or newline (\n)
   * - Preserves multi-word names intact (e.g. "Proforma Invoice", "Bill Of Lading")
   * - Strips leading bullets or numbers (e.g. "1. Proforma Invoice" -> "PROFORMA INVOICE")
   */
  const parseDocumentTokens = useCallback((text: string): string[] => {
    if (!text || !text.trim()) return [];

    const rawTokens = text.split(/[\n,;]+/);
    const parsed: string[] = [];

    for (const token of rawTokens) {
      if (!token) continue;
      const cleaned = token
        .replace(/^\s*(?:\d+[\.\)]|[-•*])\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleaned.length > 0) {
        parsed.push(cleaned.toUpperCase());
      }
    }

    return parsed;
  }, []);

  /**
   * Adds parsed document tokens to the document list without duplicates
   */
  const addDocumentsFromText = useCallback(
    (text: string) => {
      if (disabled) return;
      const tokens = parseDocumentTokens(text);
      if (tokens.length === 0) return;

      const existingSet = new Set(effectiveList.map((d) => d.toUpperCase()));
      const toAdd: string[] = [];

      for (const doc of tokens) {
        if (!existingSet.has(doc.toUpperCase())) {
          existingSet.add(doc.toUpperCase());
          toAdd.push(doc);
        }
      }

      if (toAdd.length > 0) {
        onChange([...effectiveList, ...toAdd]);
      }
      setInputValue('');
      inputRef.current?.focus();
    },
    [disabled, parseDocumentTokens, effectiveList, onChange]
  );

  /**
   * Removes a document from the unified list
   */
  const removeDoc = useCallback(
    (docName: string) => {
      if (disabled) return;
      const target = docName.trim().toUpperCase();
      const updated = effectiveList.filter((d) => d.toUpperCase() !== target);
      onChange(updated);
    },
    [disabled, effectiveList, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        addDocumentsFromText(inputValue);
      }
    } else if (e.key === ',' || e.key === ';') {
      if (inputValue.trim()) {
        e.preventDefault();
        addDocumentsFromText(inputValue);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted && (pasted.includes(',') || pasted.includes(';') || pasted.includes('\n'))) {
      e.preventDefault();
      const combined = (inputValue.trim() ? `${inputValue.trim()}, ` : '') + pasted;
      addDocumentsFromText(combined);
    }
  };

  const isAddEnabled = !disabled && Boolean(inputValue.trim());

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Dotted Underline Input Matching Contract Form Inputs */}
      <div
        className={`w-full py-1 min-h-[32px] flex items-center justify-between gap-3 border-b-2 border-dotted transition-colors bg-transparent ${
          disabled
            ? 'border-muted-foreground/30 opacity-60 cursor-not-allowed'
            : isFocused
            ? 'border-primary'
            : 'border-primary/70 dark:border-primary/80 hover:border-primary'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-[14px] text-foreground font-medium placeholder:font-normal placeholder:text-muted-foreground/50 uppercase tracking-wide disabled:cursor-not-allowed"
        />

        <button
          type="button"
          disabled={!isAddEnabled}
          onClick={() => addDocumentsFromText(inputValue)}
          className={`flex items-center gap-1 text-[13px] sm:text-[14px] font-semibold transition-colors shrink-0 select-none ${
            isAddEnabled
              ? 'text-primary hover:text-primary-hover cursor-pointer'
              : 'text-muted-foreground/40 cursor-not-allowed'
          }`}
          title="Add document"
        >
          <i className="fa-solid fa-plus text-xs" />
          <span>Add</span>
        </button>
      </div>

      {/* Unified 2-Column Documents List */}
      {effectiveList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 pt-1 text-[13px] sm:text-[14px] uppercase tracking-wide">
          {effectiveList.map((doc, idx) => (
            <div
              key={`${doc}-${idx}`}
              className="flex items-center justify-between py-1 px-1 transition-colors"
            >
              <div className="flex items-center gap-2.5 text-foreground font-semibold min-w-0">
                <span className="text-muted-foreground/90 font-bold w-5 shrink-0 text-left">
                  {idx + 1}.
                </span>
                <span className="truncate">{doc}</span>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeDoc(doc)}
                  title={`Remove ${doc}`}
                  aria-label={`Remove ${doc}`}
                  className="text-destructive hover:opacity-80 text-[12px] px-1 py-0.5 cursor-pointer transition-opacity shrink-0"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[12px] text-muted-foreground/60 italic py-1 px-1">
          No documents added yet.
        </div>
      )}
    </div>
  );
}

export default DocDocumentMultiSelect;

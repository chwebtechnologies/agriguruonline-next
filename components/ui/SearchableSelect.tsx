'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface SearchableSelectOption {
  id: string;
  name?: string;
  title?: string;
  flag?: string;
  country?: { flag?: string; name?: string };
}

interface SearchableSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  menuPosition?: 'top' | 'bottom';
  id?: string;
  variant?: 'desktop' | 'mobile';
  className?: string;
  triggerClassName?: string;
  customTriggerClass?: string;
  tabIndex?: number;
}

export function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder,
  disabled = false,
  loading = false,
  menuPosition = 'bottom',
  id,
  variant = 'desktop',
  className = '',
  triggerClassName = '',
  customTriggerClass,
  tabIndex = 0
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [computedMenuPosition, setComputedMenuPosition] = useState<'top' | 'bottom'>(menuPosition);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow < 280 && spaceAbove > spaceBelow) {
        setComputedMenuPosition('top');
      } else {
        setComputedMenuPosition(menuPosition);
        if (spaceBelow < 280) {
          wrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [isOpen, menuPosition]);

  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find(o => String(o.id) === String(value));
  const isSelected = Boolean(selectedOption && value);
  const displayValue = loading
    ? 'Loading...'
    : selectedOption
      ? (selectedOption.name || selectedOption.title || '')
      : placeholder;

  const filteredOptions = safeOptions.filter(o => {
    const label = o.name || o.title || '';
    return label.toLowerCase().includes((search || '').toLowerCase());
  });

  useEffect(() => {
    setFocusedIndex(-1);
  }, [search, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
        onChange(filteredOptions[focusedIndex].id);
        setIsOpen(false);
        setSearch('');
      }
    }
  };

  const isInteractive = !disabled && !loading;
  const isMobile = variant === 'mobile';

  return (
    <div
      className={`relative w-full min-w-0 ${isOpen && isInteractive ? 'z-[9999]' : ''} ${className}`}
      ref={wrapperRef}
      title={displayValue}
    >
      <div
        id={id}
        tabIndex={disabled ? -1 : tabIndex}
        onKeyDown={(e) => {
          if (!disabled && !loading && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(!isOpen);
            if (!isOpen) setSearch('');
          }
        }}
        className={`w-full min-w-0 transition-all flex items-center justify-between ${
          customTriggerClass || (
            isMobile
              ? `py-2.5 px-4 text-sm ${triggerClassName || 'rounded-xl'} ${
                  !isInteractive
                    ? (isSelected ? 'bg-brand-blue border-brand-blue text-white font-semibold cursor-not-allowed shadow-sm' : 'bg-muted border border-border text-muted-foreground font-medium select-none cursor-not-allowed opacity-60')
                    : isSelected
                      ? 'bg-brand-blue border-brand-blue text-white font-semibold cursor-pointer shadow-sm outline-none focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue'
                      : 'bg-card border border-border hover:border-brand-blue/50 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none focus:outline-none dark:hover:border-brand-blue/50 text-foreground font-medium cursor-pointer active:scale-[0.99]'
                }`
              : `h-[45px] px-2 lg:px-2.5 text-xs lg:text-[13px] xl:text-sm ${triggerClassName || 'rounded-lg'} ${
                  !isInteractive
                    ? 'bg-card border border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 font-medium select-none cursor-not-allowed shadow-xs opacity-60'
                    : isSelected
                      ? 'bg-brand-blue text-white border-brand-blue shadow-xs font-bold cursor-pointer focus:ring-1 focus:ring-brand-blue focus:border-brand-blue outline-none focus:outline-none'
                      : 'bg-card border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold hover:border-brand-blue dark:hover:border-brand-blue shadow-xs cursor-pointer focus:ring-1 focus:ring-brand-blue focus:border-brand-blue outline-none focus:outline-none'
                }`
          )
        }`}
        onClick={() => {
          if (isInteractive) {
            setIsOpen(!isOpen);
            if (!isOpen) setSearch('');
          }
        }}
      >
        <span className="truncate pr-0.5 flex items-center gap-1 min-w-0">
          {loading && (
            <i className="fa-solid fa-circle-notch fa-spin text-xs text-brand-blue shrink-0"></i>
          )}
          <span
            className={`truncate min-w-0 ${
              customTriggerClass 
                ? '' 
                : !isSelected && !isInteractive
                  ? 'text-muted-foreground font-medium'
                  : !isSelected
                    ? isMobile
                      ? 'text-muted-foreground font-medium'
                      : 'text-zinc-400 dark:text-zinc-500 font-medium'
                    : isMobile
                      ? 'text-white font-semibold'
                      : 'text-white font-bold'
            }`}
          >
            {displayValue}
          </span>
        </span>

        {loading ? null : isSelected && isInteractive ? (
          <button
            type="button"
            className={`shrink-0 ml-0.5 transition-colors flex items-center justify-center p-0.5 ${isSelected ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setIsOpen(false);
            }}
            title="Clear selection"
          >
            <i className="fa-solid fa-xmark text-xs"></i>
          </button>
        ) : (
          <i
            className={`fa-solid ${
              isOpen ? 'fa-chevron-down' : 'fa-chevron-right'
            } text-[10px] shrink-0 ml-0.5 transition-transform ${
              customTriggerClass
                ? ''
                : !isInteractive
                  ? 'text-muted-foreground/50'
                  : isSelected
                    ? 'text-white/90'
                    : 'text-muted-foreground'
            }`}
          ></i>
        )}
      </div>

      {isOpen && isInteractive && (
        <div
          className={`absolute z-50 w-full min-w-[200px] bg-card border border-border rounded-xl shadow-2xl max-h-[300px] flex flex-col left-0 ${
            computedMenuPosition === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          <div className="p-2 shrink-0 border-b border-border bg-muted/50 rounded-t-xl">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs"></i>
              <input
                type="text"
                aria-label="Search options"
                className="w-full bg-card border border-border rounded-lg px-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue text-foreground transition-all placeholder:text-foreground/40"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
          </div>
          <div className="p-1.5 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-zinc-500 text-center font-medium">
                No results found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const label = opt.name || opt.title || '';
                const active = String(value) === String(opt.id);
                const isFocused = idx === focusedIndex;
                return (
                  <div
                    key={opt.id}
                    className={`px-3 py-2.5 text-sm rounded-lg cursor-pointer transition-colors truncate flex items-center justify-between ${
                      active
                        ? 'bg-brand-blue text-white font-semibold'
                        : isFocused 
                          ? 'bg-muted/80 text-foreground ring-1 ring-border/50' 
                          : 'hover:bg-muted text-foreground'
                    }`}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  >
                    <span className="truncate">{label}</span>
                    {active && <i className="fa-solid fa-check text-xs ml-2"></i>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;

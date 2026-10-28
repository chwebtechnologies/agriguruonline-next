'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isAfter,
  isBefore,
  startOfWeek,
  endOfWeek,
  addDays,
} from 'date-fns';

export interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  tabIndex?: number;
  variant?: 'default' | 'underline';
  formatString?: string;
  error?: string | null;
  className?: string;
  id?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = 'Select Date Range',
  disabled = false,
  tabIndex = 0,
  variant = 'default',
  formatString,
  error = null,
  className = '',
  id,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(startDate || new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [activeDate, setActiveDate] = useState<Date>(startDate || new Date());
  const [isFocused, setIsFocused] = useState(false);

  const [coords, setCoords] = useState<{ top: string; left: string }>({
    top: '0px',
    left: '0px',
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync currentMonth and activeDate when startDate changes
  useEffect(() => {
    if (startDate) {
      setCurrentMonth(startDate);
      setActiveDate(startDate);
    }
  }, [startDate]);

  // Click outside and focus outside listener to close picker immediately
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdown = document.getElementById('daterange-dropdown');
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdown &&
        !dropdown.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleFocusOutside = (event: FocusEvent) => {
      const dropdown = document.getElementById('daterange-dropdown');
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdown &&
        !dropdown.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('focusin', handleFocusOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('focusin', handleFocusOutside);
    };
  }, []);

  const updatePosition = () => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;

      const isMobile = windowWidth < 640;
      const pickerWidth = isMobile ? Math.min(windowWidth - 24, 320) : 580;
      const pickerHeight = isMobile ? 390 : 370;

      // Vertical smart clamping
      let top = rect.bottom + 6;
      if (top + pickerHeight > windowHeight - 12) {
        const topAbove = rect.top - pickerHeight - 6;
        if (topAbove >= 12) {
          top = topAbove;
        } else {
          top = Math.max(12, windowHeight - pickerHeight - 12);
        }
      }

      // Horizontal smart clamping
      let left = rect.left;
      if (left + pickerWidth > windowWidth - 12) {
        left = Math.max(12, windowWidth - pickerWidth - 12);
      }

      setCoords({
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      setActiveDate(startDate || new Date());
      // Focus dropdown container for immediate keyboard interaction
      setTimeout(() => {
        dropdownRef.current?.focus();
      }, 50);

      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, startDate]);

  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Automatically page month if activeDate goes beyond visible calendar view
  const ensureDateVisible = (targetDate: Date) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const viewStart = startOfMonth(currentMonth);
    const viewEnd = endOfMonth(isMobile ? currentMonth : addMonths(currentMonth, 1));

    if (isBefore(targetDate, viewStart)) {
      setCurrentMonth(startOfMonth(targetDate));
    } else if (isAfter(targetDate, viewEnd)) {
      setCurrentMonth(isMobile ? startOfMonth(targetDate) : subMonths(startOfMonth(targetDate), 1));
    }
  };

  const handleDateClick = (date: Date) => {
    setActiveDate(date);
    if (!startDate || (startDate && endDate)) {
      // Begin new range selection with single date
      onChange(date, null);
    } else if (startDate && !endDate) {
      // Second date selection completes the range
      if (isBefore(date, startDate)) {
        onChange(date, startDate);
      } else {
        onChange(startDate, date);
      }
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  const handleKeyboardNavigation = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    let handled = true;
    const currentActive = activeDate || startDate || new Date();

    switch (e.key) {
      case 'ArrowLeft': {
        const next = addDays(currentActive, -1);
        setActiveDate(next);
        ensureDateVisible(next);
        if (startDate && !endDate) setHoverDate(next);
        break;
      }
      case 'ArrowRight': {
        const next = addDays(currentActive, 1);
        setActiveDate(next);
        ensureDateVisible(next);
        if (startDate && !endDate) setHoverDate(next);
        break;
      }
      case 'ArrowUp': {
        const next = addDays(currentActive, -7);
        setActiveDate(next);
        ensureDateVisible(next);
        if (startDate && !endDate) setHoverDate(next);
        break;
      }
      case 'ArrowDown': {
        const next = addDays(currentActive, 7);
        setActiveDate(next);
        ensureDateVisible(next);
        if (startDate && !endDate) setHoverDate(next);
        break;
      }
      case 'PageUp': {
        const next = subMonths(currentActive, 1);
        setActiveDate(next);
        ensureDateVisible(next);
        if (startDate && !endDate) setHoverDate(next);
        break;
      }
      case 'PageDown': {
        const next = addMonths(currentActive, 1);
        setActiveDate(next);
        ensureDateVisible(next);
        if (startDate && !endDate) setHoverDate(next);
        break;
      }
      case 'Home': {
        const next = startOfMonth(currentActive);
        setActiveDate(next);
        ensureDateVisible(next);
        if (startDate && !endDate) setHoverDate(next);
        break;
      }
      case 'End': {
        const next = endOfMonth(currentActive);
        setActiveDate(next);
        ensureDateVisible(next);
        if (startDate && !endDate) setHoverDate(next);
        break;
      }
      case 'Enter':
      case ' ': {
        handleDateClick(currentActive);
        break;
      }
      case 'Escape': {
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      }
      case 'Tab': {
        setIsOpen(false);
        handled = false;
        break;
      }
      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleClear = () => {
    onChange(null, null);
    setActiveDate(new Date());
  };

  const nextMonth = addMonths(currentMonth, 1);

  const getDaysInMonth = (month: Date) => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  const renderCalendar = (month: Date) => {
    const days = getDaysInMonth(month);
    const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    return (
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center justify-center mb-3 px-2">
          <h3 className="font-bold text-foreground text-[14px] text-center">
            {format(month, 'MMMM yyyy')}
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 0' }}>
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-[10px] font-bold text-muted-foreground/70 mb-1 tracking-wider"
            >
              {day}
            </div>
          ))}
          {days.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, month);
            const isStart = startDate && isSameDay(day, startDate);
            const isEnd = endDate && isSameDay(day, endDate);

            const isBetween =
              startDate &&
              endDate &&
              isWithinInterval(day, { start: startDate, end: endDate }) &&
              !isStart &&
              !isEnd;

            const isHoverBetween =
              startDate &&
              !endDate &&
              hoverDate &&
              isWithinInterval(day, {
                start: isBefore(hoverDate, startDate) ? hoverDate : startDate,
                end: isAfter(hoverDate, startDate) ? hoverDate : startDate,
              }) &&
              !isSameDay(day, startDate) &&
              !isSameDay(day, hoverDate);

            const isHoverEnd =
              startDate &&
              !endDate &&
              hoverDate &&
              isSameDay(day, hoverDate) &&
              !isSameDay(day, startDate);

            let bgClass = 'bg-transparent hover:bg-muted/70';
            let textClass = 'text-foreground font-semibold text-[12px] sm:text-[13px]';
            let roundedClass = 'rounded-md';
            let wrapperClass = '';

            if (!isCurrentMonth) {
              textClass = 'text-muted-foreground/30 hover:text-foreground text-[12px] sm:text-[13px]';
              bgClass = 'bg-transparent hover:bg-muted/40';
            } else if (isStart && isEnd) {
              bgClass = 'bg-primary text-white font-bold shadow-xs';
              textClass = 'text-white font-bold text-[12px] sm:text-[13px]';
              roundedClass = 'rounded-md';
            } else if (isStart) {
              bgClass = 'bg-primary text-white font-bold shadow-xs relative z-10';
              textClass = 'text-white font-bold text-[12px] sm:text-[13px]';
              roundedClass = 'rounded-md';
              if (endDate || (hoverDate && isAfter(hoverDate, startDate))) {
                wrapperClass =
                  'relative before:absolute before:right-0 before:top-0 before:w-1/2 before:h-full before:bg-primary/10 dark:before:bg-primary/20 before:z-0';
              }
            } else if (isEnd || isHoverEnd) {
              bgClass = 'bg-primary text-white font-bold shadow-xs relative z-10';
              textClass = 'text-white font-bold text-[12px] sm:text-[13px]';
              roundedClass = 'rounded-md';
              if (startDate && isBefore(startDate, day)) {
                wrapperClass =
                  'relative before:absolute before:left-0 before:top-0 before:w-1/2 before:h-full before:bg-primary/10 dark:before:bg-primary/20 before:z-0';
              }
            } else if (isBetween || isHoverBetween) {
              bgClass = 'bg-primary/10 dark:bg-primary/20';
              textClass = 'text-foreground font-bold text-[12px] sm:text-[13px]';
              roundedClass = 'rounded-none';
              wrapperClass = 'bg-primary/10 dark:bg-primary/20';
            }

            const isSelected = isStart || isEnd || isHoverEnd;
            const isActive = activeDate && isSameDay(day, activeDate);
            const activeRing = isActive && !isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background z-20' : '';

            return (
              <div key={idx} className={`h-8 sm:h-8.5 flex items-center justify-center ${wrapperClass}`}>
                <button
                  type="button"
                  tabIndex={-1}
                  style={isSelected ? { color: '#ffffff' } : undefined}
                  className={`w-7.5 h-7.5 sm:w-8 sm:h-8 flex items-center justify-center transition-all cursor-pointer select-none ${bgClass} ${roundedClass} ${activeRing}`}
                  onClick={() => handleDateClick(day)}
                  onMouseEnter={() => {
                    setHoverDate(day);
                    setActiveDate(day);
                  }}
                  onMouseLeave={() => setHoverDate(null)}
                >
                  <span className={`${textClass} ${isSelected ? '!text-white' : ''} relative z-10`}>{format(day, 'd')}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const fmt = formatString || (variant === 'underline' ? 'dd MMM yyyy' : 'dd-MM-yyyy');
  const displayValue = startDate
    ? `${format(startDate, fmt)}${endDate ? ` to ${format(endDate, fmt)}` : ' to Select end date'}`
    : '';

  // Underline variant border styles
  let borderStyle = 'border-b-2 border-dotted border-primary/70 dark:border-primary/80 hover:border-primary';
  if (error) {
    borderStyle = 'border-b-2 border-solid border-destructive text-destructive bg-destructive/5';
  } else if (disabled) {
    borderStyle = 'border-b-2 border-dotted border-muted-foreground/30 opacity-60 cursor-not-allowed';
  } else if (isOpen || isFocused) {
    borderStyle = 'border-b-2 border-solid border-primary bg-primary/10 shadow-2xs';
  }

  // Handle keyboard navigation on trigger
  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Tab') {
      // Close picker on Tab so browser focus moves smoothly to the next form field
      if (isOpen) {
        setIsOpen(false);
      }
      return;
    }
    if (isOpen) {
      handleKeyboardNavigation(e);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setActiveDate(startDate || new Date());
    }
  };

  return (
    <div
      className={`relative w-full ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      ref={containerRef}
    >
      <div
        ref={triggerRef}
        id={id}
        tabIndex={disabled ? -1 : tabIndex}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{ outline: 'none', boxShadow: 'none' }}
        className={
          variant === 'underline'
            ? `w-full flex items-center justify-between gap-1.5 px-1.5 py-0.5 min-h-[28px] text-[13px] rounded-t-sm transition-all duration-150 text-left outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 border-t-0 border-x-0 ${borderStyle} focus:border-solid focus:border-primary focus:bg-primary/10 cursor-pointer print:border-none`
            : `w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-between transition-colors ${
                disabled
                  ? 'border-border pointer-events-none bg-muted text-muted-foreground'
                  : startDate
                    ? 'bg-primary border-primary text-primary-foreground shadow-xs cursor-pointer'
                    : 'bg-card border-border text-foreground cursor-pointer hover:border-primary/50 focus:border-primary'
              }`
        }
      >
        <span
          className={
            variant === 'underline'
              ? `truncate flex-1 ${displayValue ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground/50'}`
              : `font-semibold ${startDate ? 'text-primary-foreground' : 'font-medium text-muted-foreground'}`
          }
        >
          {displayValue || placeholder}
        </span>
        <i
          className={
            variant === 'underline'
              ? `fa-regular fa-calendar ${isOpen || isFocused ? 'text-primary font-bold scale-110' : 'text-primary hover:text-primary-hover'} text-xs shrink-0 transition-all ml-1.5`
              : `fa-regular fa-calendar ${startDate ? 'text-primary-foreground/90' : 'text-muted-foreground'}`
          }
        />
      </div>

      {variant === 'underline' && error && (
        <span className="text-[10px] text-destructive font-medium mt-0.5 px-1 tracking-tight animate-in fade-in duration-200">
          {error}
        </span>
      )}

      {isOpen && (
        <div
          id="daterange-dropdown"
          ref={dropdownRef}
          tabIndex={-1}
          style={{
            top: coords.top,
            left: coords.left,
            outline: 'none',
          }}
          className="fixed z-[9999] bg-card text-foreground rounded-xl shadow-2xl border border-border p-3.5 sm:p-4.5 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 w-[calc(100vw-24px)] sm:w-[580px] max-w-[95vw] sm:max-w-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyboardNavigation}
        >
          {/* Status info bar */}
          <div className="text-center text-xs font-semibold text-muted-foreground bg-muted/50 py-1.5 px-3 rounded-lg border border-border/60">
            <i className="fa-solid fa-circle-info mr-1.5 text-primary text-[11px]" />
            {!startDate
              ? 'Select start of shipment period (Use Arrows & Enter or Click)'
              : !endDate
                ? `Start: ${format(startDate, 'dd MMM yyyy')}. Select end date.`
                : `${format(startDate, 'dd MMM yyyy')} — ${format(endDate, 'dd MMM yyyy')}`}
          </div>

          {/* Month calendars */}
          <div className="relative">
            {/* Prev month button (tabIndex -1 so it does not hijack form tab navigation) */}
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.preventDefault();
                handlePrevMonth();
              }}
              className="absolute left-1 top-0 w-7.5 h-7.5 flex items-center justify-center rounded-full bg-muted/80 hover:bg-muted text-foreground transition-colors z-10 border border-border/50 cursor-pointer"
              title="Previous Month"
            >
              <i className="fa-solid fa-arrow-left text-[11px]" />
            </button>

            {/* Next month button (tabIndex -1 so it does not hijack form tab navigation) */}
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.preventDefault();
                handleNextMonth();
              }}
              className="absolute right-1 top-0 w-7.5 h-7.5 flex items-center justify-center rounded-full bg-muted/80 hover:bg-muted text-foreground transition-colors z-10 border border-border/50 cursor-pointer"
              title="Next Month"
            >
              <i className="fa-solid fa-arrow-right text-[11px]" />
            </button>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              {renderCalendar(currentMonth)}
              <div className="hidden sm:block w-px bg-border/60 my-1" />
              <div className="hidden sm:block flex-1 min-w-[240px]">
                {renderCalendar(nextMonth)}
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="text-xs font-medium text-muted-foreground hover:text-destructive px-2 py-1 rounded-md transition-colors cursor-pointer"
            >
              <i className="fa-regular fa-trash-can mr-1 text-[11px]" />
              Clear
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border/40">↑↓←→</span>
              <span>Navigate</span>
              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border/40 ml-1">Enter</span>
              <span>Select</span>
              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border/40 ml-1">Esc</span>
              <span>Close</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold px-3 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

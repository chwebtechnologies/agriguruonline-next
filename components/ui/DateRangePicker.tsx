'use client';

import React, { useState, useEffect, useRef } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval, isAfter, isBefore, startOfWeek, endOfWeek, parse, startOfDay } from 'date-fns';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  tabIndex?: number;
}

export function DateRangePicker({ startDate, endDate, onChange, placeholder = "Select Date Range", disabled = false, tabIndex = 0 }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(startDate || new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  
  const [position, setPosition] = useState<'bottom' | 'top'>('bottom');
  
  const [coords, setCoords] = useState({ top: 'auto', bottom: 'auto', left: 'auto', right: 'auto' });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Need to check if clicking inside the fixed dropdown as well
      const dropdown = document.getElementById('daterange-dropdown');
      if (
        containerRef.current && !containerRef.current.contains(event.target as Node) &&
        dropdown && !dropdown.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updatePosition = () => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      
      let isTop = false;
      let isRight = false;

      // Need approx 400px height for the calendar
      if (rect.bottom + 400 > windowHeight && rect.top > 400) {
        isTop = true;
        setPosition('top');
      } else {
        isTop = false;
        setPosition('bottom');
      }
      
      // Need approx 560px width on desktop
      if (windowWidth >= 640) {
        if (rect.left + 560 > windowWidth) {
          isRight = true;
        } else {
          isRight = false;
        }
      } else {
        isRight = false;
      }

      setCoords({
        top: isTop ? 'auto' : `${rect.bottom + 8}px`,
        bottom: isTop ? `${windowHeight - rect.top + 8}px` : 'auto',
        left: isRight ? 'auto' : `${rect.left}px`,
        right: isRight ? `${windowWidth - rect.right}px` : 'auto'
      });
    }
  };

  useEffect(() => {
    updatePosition();
    if (isOpen) {
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const handleDateClick = (date: Date) => {
    if (!startDate || (startDate && endDate)) {
      onChange(date, null);
    } else if (startDate && !endDate) {
      if (isBefore(date, startDate)) {
        onChange(date, startDate);
      } else {
        onChange(startDate, date);
      }
      setIsOpen(false);
    }
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
        <div className="flex items-center justify-center mb-4 px-2">
          <h3 className="font-bold text-foreground text-[14px] text-center">{format(month, 'MMMM yyyy')}</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px 0' }}>
          {weekDays.map(day => (
            <div key={day} className="text-center text-[11px] font-bold text-muted-foreground/60 mb-2 tracking-wider">
              {day}
            </div>
          ))}
          {days.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, month);
            const isPastDate = isBefore(day, startOfDay(new Date()));
            const isStart = startDate && isSameDay(day, startDate);
            const isEnd = endDate && isSameDay(day, endDate);
            
            const isBetween = startDate && endDate && isWithinInterval(day, { start: startDate, end: endDate }) && !isStart && !isEnd;
            
            const isHoverBetween = startDate && !endDate && hoverDate && isWithinInterval(day, { 
              start: isBefore(hoverDate, startDate) ? hoverDate : startDate, 
              end: isAfter(hoverDate, startDate) ? hoverDate : startDate 
            }) && !isSameDay(day, startDate) && !isSameDay(day, hoverDate);

            const isHoverEnd = startDate && !endDate && hoverDate && isSameDay(day, hoverDate) && !isSameDay(day, startDate);

            let bgClass = "bg-transparent hover:bg-muted/60";
            let textClass = "text-foreground font-semibold text-[13px]";
            let roundedClass = "rounded-full"; 
            let wrapperClass = ""; 

            if (!isCurrentMonth) {
              textClass = "text-transparent pointer-events-none"; 
              bgClass = "bg-transparent";
            } else if (isPastDate) {
              textClass = "text-muted-foreground opacity-30 font-semibold text-[13px]";
              bgClass = "bg-transparent cursor-not-allowed";
            } else if (isStart && isEnd) {
              bgClass = "bg-brand-blue shadow-md";
              textClass = "text-white font-bold text-[13px]";
              roundedClass = "rounded-full";
            } else if (isStart) {
              bgClass = "bg-brand-blue shadow-md relative z-10";
              textClass = "text-white font-bold text-[13px]";
              roundedClass = "rounded-full";
              if (endDate || (hoverDate && isAfter(hoverDate, startDate))) {
                wrapperClass = "relative before:absolute before:right-0 before:top-0 before:w-1/2 before:h-full before:bg-brand-blue/10 dark:before:bg-brand-blue/20 before:z-0";
              }
            } else if (isEnd || isHoverEnd) {
              bgClass = "bg-brand-blue shadow-md relative z-10";
              textClass = "text-white font-bold text-[13px]";
              roundedClass = "rounded-full";
              if (startDate && isBefore(startDate, day)) {
                wrapperClass = "relative before:absolute before:left-0 before:top-0 before:w-1/2 before:h-full before:bg-brand-blue/10 dark:before:bg-brand-blue/20 before:z-0";
              }
            } else if (isBetween || isHoverBetween) {
              bgClass = "bg-brand-blue/10 dark:bg-brand-blue/20";
              textClass = "text-foreground font-bold text-[13px]";
              roundedClass = "rounded-none";
              wrapperClass = "bg-brand-blue/10 dark:bg-brand-blue/20"; 
            }

            return (
              <div key={idx} className={`h-9 flex items-center justify-center ${wrapperClass}`}>
                <div 
                  className={`w-9 h-9 flex items-center justify-center transition-all ${!isCurrentMonth ? '' : isPastDate ? 'cursor-not-allowed' : 'cursor-pointer'} ${bgClass} ${roundedClass}`}
                  onClick={() => isCurrentMonth && !isPastDate && handleDateClick(day)}
                  onMouseEnter={() => isCurrentMonth && !isPastDate && setHoverDate(day)}
                  onMouseLeave={() => setHoverDate(null)}
                >
                  <span className={`${textClass} relative z-10`}>{isCurrentMonth ? format(day, 'd') : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const displayValue = startDate 
    ? `${format(startDate, 'dd-MM-yyyy')}${endDate ? ` to ${format(endDate, 'dd-MM-yyyy')}` : ' to Select end date'}`
    : '';

  const animationClass = position === 'top' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2';

  return (
    <div className={`relative w-full ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`} ref={containerRef}>
      <div 
        tabIndex={disabled ? -1 : tabIndex}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/50 flex items-center justify-between transition-colors ${
          disabled ? 'border-border pointer-events-none bg-muted text-muted-foreground' : startDate ? 'bg-brand-blue border-brand-blue text-white shadow-sm cursor-pointer' : 'bg-card border-border text-foreground cursor-pointer hover:border-brand-blue/50 focus:border-brand-blue'
        }`}
      >
        <span className={`font-semibold ${startDate ? 'text-white' : 'font-medium text-muted-foreground'}`}>
          {displayValue || placeholder}
        </span>
        <i className={`fa-regular fa-calendar ${startDate ? 'text-white/90' : 'text-muted-foreground'}`}></i>
      </div>

      {isOpen && (
        <div 
          id="daterange-dropdown"
          style={{ top: coords.top, bottom: coords.bottom, left: coords.left, right: coords.right }}
          className={`fixed z-[9999] bg-card dark:bg-background rounded-2xl shadow-2xl border border-border p-5 flex flex-col gap-5 animate-in fade-in zoom-in-95 ${animationClass} duration-200 w-[calc(100vw-40px)] sm:w-auto max-w-[95vw] sm:max-w-none overflow-x-auto`} 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center text-[13px] font-semibold text-muted-foreground bg-muted/40 py-2.5 px-4 rounded-xl border border-border/50">
            <i className="fa-solid fa-circle-info mr-2 text-brand-blue"></i>
            {!startDate 
              ? "Please select the start date for shipment" 
              : !endDate 
                ? `Start date selected: ${format(startDate, 'dd MMM yyyy')}. Now select end date.` 
                : `Selected: ${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}`
            }
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 relative mt-1">
            <button 
              onClick={(e) => { e.preventDefault(); handlePrevMonth(); }} 
              disabled={isSameMonth(currentMonth, new Date()) || isBefore(currentMonth, startOfMonth(new Date()))}
              className={`absolute left-2 sm:-left-2 top-0 w-8 h-8 flex items-center justify-center rounded-full bg-muted/80 text-foreground transition-colors z-10 border border-border/50 ${
                isSameMonth(currentMonth, new Date()) || isBefore(currentMonth, startOfMonth(new Date())) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-muted'
              }`}
            >
              <i className="fa-solid fa-arrow-left text-[12px]"></i>
            </button>
            <button onClick={(e) => { e.preventDefault(); handleNextMonth(); }} className="absolute right-2 sm:-right-2 top-0 w-8 h-8 flex items-center justify-center rounded-full bg-muted/80 text-foreground hover:bg-muted transition-colors z-10 border border-border/50">
              <i className="fa-solid fa-arrow-right text-[12px]"></i>
            </button>

            {renderCalendar(currentMonth)}
            <div className="hidden sm:block w-px bg-border/60 my-2"></div>
            <div className="hidden sm:block">
               {renderCalendar(nextMonth)}
            </div>
            
            <div className="sm:hidden w-full h-px bg-border/60 my-0"></div>
            <div className="sm:hidden">
               {renderCalendar(nextMonth)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React from 'react';

interface ChartMobileItemCardProps {
  row1Left: React.ReactNode;
  row1Right: React.ReactNode;
  title: React.ReactNode;
  priceDisplay: React.ReactNode;
  onOptionsClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  row3Left: React.ReactNode;
  row3Middle?: React.ReactNode;
  changeValue: string | number;
  isPositive: boolean;
  className?: string;
}

export function ChartMobileItemCard({
  row1Left,
  row1Right,
  title,
  priceDisplay,
  onOptionsClick,
  row3Left,
  row3Middle,
  changeValue,
  isPositive,
  className = ''
}: ChartMobileItemCardProps) {
  const numericChange = Number(changeValue) || 0;

  return (
    <div className={`flex flex-col p-2 select-none ${className}`}>
      {/* Row 1: Left / Right Badges with Flags */}
      <div className="flex justify-between items-center text-[12px] text-foreground/75">
        <div className="flex items-center gap-1.5 font-medium min-w-0">
          {row1Left}
        </div>
        <div className="flex items-center gap-1.5 font-medium min-w-0 justify-end">
          {row1Right}
        </div>
      </div>

      {/* Row 2: Title / Pricing & Options Menu */}
      <div className="flex justify-between items-center gap-3 mt-1">
        <div className="font-bold text-[14px] leading-tight text-foreground truncate min-w-0">
          {title}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="font-bold text-[14px] text-foreground whitespace-nowrap">
            {priceDisplay}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOptionsClick(e);
            }}
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-[#f4f4f5] active:bg-zinc-200 dark:active:bg-zinc-700 rounded-full transition-colors cursor-pointer"
            aria-label="Open item options"
          >
            <i className="fa-solid fa-ellipsis-vertical text-[17px]"></i>
          </button>
        </div>
      </div>

      {/* Row 3: Subtitle / Container / Change Pill */}
      <div className="flex justify-between items-center text-[12px] text-foreground/75 mt-0.5">
        <div className="truncate min-w-0">{row3Left}</div>
        <div className="flex items-center gap-1 shrink-0">
          {row3Middle && <span>{row3Middle}</span>}
          <span
            className={`font-semibold flex items-center ${
              isPositive ? 'text-brand-green' : 'text-red-500'
            }`}
          >
            <i
              className={`fa-solid ${
                isPositive ? 'fa-caret-up' : 'fa-caret-down'
              } mr-0.5`}
            ></i>
            {isPositive ? `+${numericChange}$` : `${numericChange}$`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ChartMobileItemCard;

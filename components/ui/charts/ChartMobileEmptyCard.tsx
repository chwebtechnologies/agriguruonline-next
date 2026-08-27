'use client';

import React from 'react';

interface ChartMobileEmptyCardProps {
  onClick: () => void;
  icon?: string;
  badgeLabel?: string;
  countLabel?: string;
  title: string;
  actionText: string;
  description: string;
  className?: string;
}

export function ChartMobileEmptyCard({
  onClick,
  icon = 'fa-solid fa-chart-line',
  badgeLabel = 'Watchlist',
  countLabel = '0 Items',
  title,
  actionText,
  description,
  className = ''
}: ChartMobileEmptyCardProps) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      className={`lg:hidden relative overflow-hidden bg-card rounded-xl shadow-sm border border-dashed border-border hover:border-brand-green dark:hover:border-brand-green active:scale-[0.99] transition-all cursor-pointer group ${className}`}
    >
      <div className="flex flex-col p-2">
        {/* Row 1: Header & Count */}
        <div className="flex justify-between items-center text-[12px] text-foreground/60">
          <div className="flex items-center gap-1.5 font-medium">
            <i className={`${icon} text-brand-green text-[11px]`}></i>
            <span>{badgeLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span>{countLabel}</span>
          </div>
        </div>

        {/* Row 2: Title & Action */}
        <div className="flex justify-between items-center gap-2 mt-1">
          <div className="font-bold text-[14px] leading-tight text-foreground">
            {title}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-bold text-[13px] text-brand-green group-hover:text-brand-green-hover flex items-center gap-1">
              <i className="fa-solid fa-plus text-[11px]"></i>
              <span>{actionText}</span>
            </span>
          </div>
        </div>

        {/* Row 3: Description & Chevron */}
        <div className="flex justify-between items-center text-[12px] text-foreground/60 mt-0.5">
          <div className="truncate">{description}</div>
          <div className="flex items-center gap-1 shrink-0">
            <i className="fa-solid fa-chevron-right text-[10px] text-zinc-400"></i>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChartMobileEmptyCard;

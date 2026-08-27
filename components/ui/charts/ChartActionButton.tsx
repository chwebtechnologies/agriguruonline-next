'use client';

import React from 'react';

interface ChartActionButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  label?: string;
  userType?: string | null;
  mode?: 'product' | 'freight' | 'custom';
  className?: string;
}

export function ChartActionButton({
  onClick,
  label,
  userType,
  mode = 'custom',
  className = ''
}: ChartActionButtonProps) {
  let displayLabel = label;

  if (!displayLabel) {
    if (mode === 'freight') {
      displayLabel = 'Book';
    } else if (mode === 'product') {
      if (userType === 'seller') {
        displayLabel = 'Sell';
      } else if (userType === 'buyer') {
        displayLabel = 'Buy';
      } else {
        displayLabel = 'Buy/Sell';
      }
    } else {
      displayLabel = 'Action';
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1 bg-card border border-zinc-300 dark:border-zinc-700 text-foreground text-xs font-semibold rounded-full hover:bg-muted transition-colors shadow-xs whitespace-nowrap cursor-pointer ${className}`}
    >
      {displayLabel}
    </button>
  );
}

export default ChartActionButton;

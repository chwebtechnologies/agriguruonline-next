'use client';

import React from 'react';

interface ChartDeleteButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  className?: string;
}

export function ChartDeleteButton({
  onClick,
  title = 'Delete item',
  className = ''
}: ChartDeleteButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-red-500 hover:text-red-600 transition-colors flex items-center justify-center text-lg p-0.5 cursor-pointer ${className}`}
      title={title}
      aria-label={title}
    >
      <i className="fa-regular fa-trash-can"></i>
    </button>
  );
}

export default ChartDeleteButton;

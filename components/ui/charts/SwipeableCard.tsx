'use client';

import React, { useRef, useEffect } from 'react';

interface SwipeableCardProps {
  children: React.ReactNode;
  onDelete: () => void;
  onChart?: () => void;
  className?: string;
}

export function SwipeableCard({
  children,
  onDelete,
  onChart,
  className = ''
}: SwipeableCardProps) {
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      currentXRef.current = 0;
      isDraggingRef.current = true;
      isHorizontalSwipeRef.current = null;
      el.style.transition = 'none';
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const diffX = touchX - startXRef.current;
      const diffY = touchY - startYRef.current;

      if (isHorizontalSwipeRef.current === null) {
        if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
          isHorizontalSwipeRef.current = Math.abs(diffX) > Math.abs(diffY);
        }
      }

      if (isHorizontalSwipeRef.current === true) {
        if (e.cancelable) e.preventDefault();
        const maxSwipe = 120;
        let newTranslate = diffX;
        if (!onChart && newTranslate > 0) {
          newTranslate = 0; // Prevent chart swipe if onChart is disabled
        } else if (newTranslate > maxSwipe) {
          newTranslate = maxSwipe;
        }
        if (newTranslate < -maxSwipe) newTranslate = -maxSwipe;
        currentXRef.current = newTranslate;
        el.style.transform = `translateX(${newTranslate}px)`;
      }
    };

    const handleTouchEnd = () => {
      if (isHorizontalSwipeRef.current === true && isDraggingRef.current) {
        const maxSwipe = 120;
        const threshold = maxSwipe * 0.45;

        if (currentXRef.current < -threshold) {
          onDelete();
        } else if (currentXRef.current > threshold && onChart) {
          onChart();
        }
      }

      if (el) {
        el.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        el.style.transform = 'translateX(0px)';
      }
      currentXRef.current = 0;
      isDraggingRef.current = false;
      isHorizontalSwipeRef.current = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [onChart, onDelete]);

  return (
    <div className={`relative overflow-hidden rounded-xl lg:hidden bg-muted touch-pan-y ${className}`} ref={containerRef}>
      <div className="absolute inset-0 flex justify-between items-center z-0 pointer-events-none">
        <div className="bg-sky-400 w-1/2 h-full flex items-center pl-6 text-white font-bold rounded-l-xl">
          <i className="fa-solid fa-chart-line text-xl"></i>
          <span className="ml-3 text-[15px] tracking-wide">Chart</span>
        </div>
        <div className="bg-red-500 w-1/2 h-full flex items-center justify-end pr-6 text-white font-bold rounded-r-xl">
          <span className="mr-3 text-[15px] tracking-wide">Delete</span>
          <i className="fa-solid fa-trash text-xl"></i>
        </div>
      </div>
      <div 
        ref={swipeRef}
        className="relative z-10 w-full h-full bg-card rounded-xl shadow-sm border border-border will-change-transform"
      >
        {children}
      </div>
    </div>
  );
}

export default SwipeableCard;

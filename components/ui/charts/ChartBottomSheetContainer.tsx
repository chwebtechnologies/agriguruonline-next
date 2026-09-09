'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const MobileCommodityChart = dynamic(() => import('@/components/product-charts/MobileCommodityChart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full min-h-[300px]">
      <i className="fa-solid fa-circle-notch fa-spin text-2xl text-brand-blue"></i>
    </div>
  )
});

export interface ChartBottomSheetItem {
  id: number | string;
  category?: string;
  country?: string;
  countryFlag?: string;
  product: string;
  shipBy?: string;
  term?: string;
  pol?: string;
  polFlag?: string;
  pod?: string;
  podFlag?: string;
  price: string | number;
  change: string | number;
  chartStatus?: boolean;
}

interface ChartBottomSheetContainerProps {
  activeItem: ChartBottomSheetItem | null;
  onClose: () => void;
  userType?: string | null;
  defaultFullScreen?: boolean;
  lang?: string;
  swipeText?: string;
}

export function ChartBottomSheetContainer({
  activeItem,
  onClose,
  userType = null,
  defaultFullScreen = false,
  lang = 'en',
  swipeText = 'Swipe up for Details'
}: ChartBottomSheetContainerProps) {
  const [isFullScreen, setIsFullScreen] = useState(defaultFullScreen);
  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const isFullScreenRef = useRef<boolean>(defaultFullScreen);
  const mountTimeRef = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(105);

  useEffect(() => {
    isFullScreenRef.current = isFullScreen;
    if (sheetRef.current && !isDraggingRef.current) {
      sheetRef.current.style.transition =
        'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.25s ease';
      sheetRef.current.style.transform = isFullScreen
        ? 'translateY(0px)'
        : 'translateY(calc(100% - 52vh))';
    }
  }, [isFullScreen]);

  // Lock document body scroll while bottom sheet is open
  useEffect(() => {
    mountTimeRef.current = Date.now();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const expandToFullScreen = () => {
    setIsFullScreen(true);
    if (sheetRef.current) {
      sheetRef.current.style.transition =
        'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.25s ease';
      sheetRef.current.style.transform = 'translateY(0px)';
    }
    if (typeof window !== 'undefined' && activeItem?.id) {
      const url = new URL(window.location.href);
      url.searchParams.set('chart', String(activeItem.id));
      url.searchParams.set('full', '1');
      window.history.pushState(
        { chart: activeItem.id, full: '1' },
        '',
        url.toString()
      );
    }
  };

  const handleDragStart = (clientY: number) => {
    if (Date.now() - mountTimeRef.current < 200) return;
    startYRef.current = clientY;
    currentYRef.current = clientY;
    startTimeRef.current = Date.now();
    isDraggingRef.current = true;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
  };

  const handleDragMove = (clientY: number) => {
    if (
      !isDraggingRef.current ||
      startYRef.current === null ||
      !sheetRef.current
    )
      return;
    currentYRef.current = clientY;
    const diff = clientY - startYRef.current;

    if (isFullScreenRef.current) {
      if (diff > 0) {
        sheetRef.current.style.transform = `translateY(${diff}px)`;
      }
    } else {
      sheetRef.current.style.transform = `translateY(calc(100% - 52vh + ${diff}px))`;
    }
  };

  const handleDragEnd = () => {
    if (
      startYRef.current === null ||
      currentYRef.current === null ||
      !sheetRef.current
    ) {
      isDraggingRef.current = false;
      startYRef.current = null;
      currentYRef.current = null;
      return;
    }

    const diff = currentYRef.current - startYRef.current;
    const timeTaken = Date.now() - startTimeRef.current;
    const velocity = Math.abs(diff) / (timeTaken || 1);

    isDraggingRef.current = false;
    startYRef.current = null;
    currentYRef.current = null;

    if (!isFullScreenRef.current) {
      // Swiping UP -> Must drag at least 30px or quick flick with velocity > 0.3
      if (diff < -30 || (diff < -15 && velocity > 0.3)) {
        expandToFullScreen();
      } else if (diff > 60 || (diff > 25 && velocity > 0.35)) {
        sheetRef.current.style.transition =
          'transform 0.25s cubic-bezier(0.4, 0, 1, 1)';
        sheetRef.current.style.transform = 'translateY(100%)';
        setTimeout(() => onClose(), 250);
      } else {
        sheetRef.current.style.transition =
          'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
        sheetRef.current.style.transform = 'translateY(calc(100% - 52vh))';
      }
    } else {
      // Swiping DOWN from fullscreen
      if (diff > 70 || (diff > 35 && velocity > 0.4)) {
        sheetRef.current.style.transition =
          'transform 0.25s cubic-bezier(0.4, 0, 1, 1)';
        sheetRef.current.style.transform = 'translateY(100%)';
        setTimeout(() => onClose(), 250);
      } else {
        sheetRef.current.style.transition =
          'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
        sheetRef.current.style.transform = 'translateY(0px)';
      }
    }
  };

  // Dynamically measure header
  useEffect(() => {
    const measureHeader = () => {
      const headerEl = document.querySelector('header');
      if (headerEl) {
        const rect = headerEl.getBoundingClientRect();
        setHeaderHeight(Math.max(Math.round(rect.bottom), 64));
      }
    };
    measureHeader();
    window.addEventListener('resize', measureHeader);
    return () => {
      window.removeEventListener('resize', measureHeader);
    };
  }, []);

  if (!activeItem) return null;

  const maxExpandedHeight = `calc(100dvh - ${headerHeight}px)`;

  return (
    <>
      {/* 1. Desktop Modal Popup (>= lg screens) */}
      <div className="hidden lg:flex fixed inset-0 z-[500] items-center justify-center p-4 xl:p-8 bg-black/60 backdrop-blur-sm transform-gpu animate-in fade-in duration-200 pointer-events-auto select-none">
        {/* Click-away backdrop */}
        <div className="absolute inset-0" onClick={onClose} />

        {/* Desktop Popup Card Container */}
        <div
          className="relative z-10 w-full max-w-6xl xl:max-w-7xl h-[92vh] max-h-[880px] bg-background rounded-2xl xl:rounded-3xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <MobileCommodityChart
            item={activeItem}
            isFullScreen={true}
            onClose={onClose}
            userType={userType}
            lang={lang}
          />
        </div>
      </div>

      {/* 2. Mobile/Tablet Bottom Sheet (< lg screens) */}
      <div
        className="lg:hidden fixed inset-0 z-[500] flex flex-col justify-end pointer-events-none select-none"
        style={{ top: `${headerHeight}px` }}
      >
        {/* Click-away Backdrop below Header */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transform-gpu pointer-events-auto transition-opacity duration-300"
          onClick={onClose}
        />

        {/* Bottom Sheet Modal Container */}
        <div
          ref={sheetRef}
          className={`fixed bottom-0 inset-x-0 w-full max-w-lg mx-auto bg-background shadow-2xl flex flex-col will-change-transform z-[510] pointer-events-auto ${
            isFullScreen
              ? 'rounded-none border-t border-border'
              : 'rounded-t-[28px] border-t border-border'
          }`}
          onClick={(e) => e.stopPropagation()}
          style={{
            height: maxExpandedHeight,
            maxHeight: maxExpandedHeight,
            transform: isFullScreen
              ? 'translateY(0px)'
              : 'translateY(calc(100% - 52vh))',
            transition:
              'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.25s ease',
          }}
        >
          {/* Swipe up for Details Indicator */}
          {!isFullScreen && (
            <div
              onClick={expandToFullScreen}
              onTouchStart={(e) => {
                if (e.cancelable) e.preventDefault();
                handleDragStart(e.touches[0].clientY);
              }}
              onTouchMove={(e) => {
                if (e.cancelable) e.preventDefault();
                handleDragMove(e.touches[0].clientY);
              }}
              onTouchEnd={handleDragEnd}
              onTouchCancel={handleDragEnd}
              className="absolute bottom-[100%] inset-x-0 flex flex-col items-center justify-center gap-1 cursor-pointer touch-none select-none z-[75] pointer-events-auto pb-2.5 transition-opacity duration-200"
            >
              {/* Curved Chevron */}
              <svg
                className="w-14 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-pulse"
                viewBox="0 0 56 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 13L28 3L53 13"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Centered Text */}
              <span className="text-[13px] font-semibold tracking-normal text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                {swipeText}
              </span>
            </div>
          )}

          {/* Drag Handle Top Bar */}
          {!isFullScreen && (
            <div
              className="pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing touch-none flex flex-col items-center justify-center w-full select-none bg-background shrink-0"
              onTouchStart={(e) => {
                if (e.cancelable) e.preventDefault();
                handleDragStart(e.touches[0].clientY);
              }}
              onTouchMove={(e) => {
                if (e.cancelable) e.preventDefault();
                handleDragMove(e.touches[0].clientY);
              }}
              onTouchEnd={handleDragEnd}
              onTouchCancel={handleDragEnd}
              onMouseDown={(e) => {
                e.preventDefault();
                handleDragStart(e.clientY);
                const onMouseMove = (m: MouseEvent) =>
                  handleDragMove(m.clientY);
                const onMouseUp = () => {
                  handleDragEnd();
                  window.removeEventListener('mousemove', onMouseMove);
                  window.removeEventListener('mouseup', onMouseUp);
                };
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
              }}
            >
              <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full"></div>
            </div>
          )}

          {/* Scrollable View inside Flex */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <MobileCommodityChart
              item={activeItem}
              isFullScreen={isFullScreen}
              onClose={onClose}
              userType={userType}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              lang={lang}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default ChartBottomSheetContainer;

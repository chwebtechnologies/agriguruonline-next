'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const MobileCommodityChart = dynamic(() => import('@/components/product-charts/MobileCommodityChart'), {
  loading: () => <div className="flex-1 flex items-center justify-center min-h-[300px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
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
  alertPrice?: string | number;
  alertId?: string | number;
  predictId?: string;
}

interface ChartBottomSheetContainerProps {
  activeItem: ChartBottomSheetItem | null;
  onClose: () => void;
  userType?: string | null;
  defaultFullScreen?: boolean;
  lang?: string;
  swipeText?: string;
  initialTab?: string;
  initialExpandedPredictId?: string;
}

export function ChartBottomSheetContainer({
  activeItem,
  onClose,
  userType = null,
  defaultFullScreen = false,
  lang = 'en',
  swipeText = 'Swipe up for Details',
  initialTab,
  initialExpandedPredictId
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
      if (isFullScreen) {
        sheetRef.current.style.height = `calc(100dvh - ${headerHeight}px)`;
        sheetRef.current.style.transform = 'translateY(0px)';
      } else {
        sheetRef.current.style.height = '72vh';
        sheetRef.current.style.transform = 'translateY(0px)';
      }
    }
  }, [isFullScreen, headerHeight]);

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
        sheetRef.current.style.height = `calc(100dvh - ${headerHeight}px - ${diff}px)`;
      }
    } else {
      if (diff < 0) {
        sheetRef.current.style.height = `calc(72vh + ${-diff}px)`;
      } else {
        sheetRef.current.style.transform = `translateY(${diff}px)`;
      }
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
      } else {
        sheetRef.current.style.transition =
          'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
        sheetRef.current.style.height = '72vh';
        sheetRef.current.style.transform = 'translateY(0px)';
      }
    } else {
      // Swiping DOWN from fullscreen
      sheetRef.current.style.transition =
        'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
      sheetRef.current.style.height = `calc(100dvh - ${headerHeight}px)`;
      sheetRef.current.style.transform = 'translateY(0px)';
    }
  };

  // Dynamically measure header
  useEffect(() => {
    let lastWidth = window.innerWidth;
    const measureHeader = () => {
      const headerEl = document.querySelector('header');
      if (headerEl) {
        const rect = headerEl.getBoundingClientRect();
        setHeaderHeight(Math.max(Math.round(rect.bottom), 64));
      }
    };
    
    measureHeader();
    
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      // Only recalculate on width change (orientation change) to avoid
      // jitter when mobile address bar hides/shows on scroll.
      if (currentWidth !== lastWidth) {
        lastWidth = currentWidth;
        measureHeader();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!activeItem) return null;

  const maxExpandedHeight = `calc(100dvh - ${headerHeight}px)`;

  return (
    <>
      {/* 1. Desktop Modal Popup (>= lg screens) */}
      <div className="hidden lg:flex fixed inset-0 z-[500] items-center justify-center p-4 xl:p-8 pointer-events-auto select-none">
        {/* Backdrop (backdrop click closing disabled) */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transform-gpu" />

        {/* Desktop Popup Card Container */}
        <div
          className="relative z-10 w-full max-w-6xl xl:max-w-7xl h-[92vh] max-h-[880px] bg-background rounded-2xl xl:rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-border flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <MobileCommodityChart
            item={activeItem}
            isFullScreen={true}
            onClose={onClose}
            userType={userType}
            lang={lang}
            initialTab={initialTab}
            initialExpandedPredictId={initialExpandedPredictId}
          />
        </div>
      </div>

      {/* 2. Mobile/Tablet Bottom Sheet (< lg screens) */}
      
      {/* Mobile Backdrop separated from the bottom sheet container to prevent Safari flickering on scroll */}
      <div className="lg:hidden fixed inset-0 z-[490] bg-black/40 backdrop-blur-sm pointer-events-auto transition-opacity duration-300 transform-gpu" />
      
      <div
        className="lg:hidden fixed inset-0 z-[500] flex flex-col justify-end pointer-events-none select-none"
        style={{ top: `${headerHeight}px` }}
      >
        {/* Bottom Sheet Modal Container */}
        <div
          ref={sheetRef}
          className={`fixed bottom-0 inset-x-0 w-full max-w-lg mx-auto bg-background shadow-2xl flex flex-col z-[510] pointer-events-auto ${
            isFullScreen
              ? 'rounded-none border-t border-border'
              : 'rounded-t-[28px] border-t border-border'
          }`}
          onClick={(e) => e.stopPropagation()}
          style={{
            height: isFullScreen ? maxExpandedHeight : '72vh',
            maxHeight: maxExpandedHeight,
            transform: 'translateY(0px)',
            transition:
              'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.32s ease',
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
              onMouseDown={(e) => {
                e.preventDefault();
                handleDragStart(e.clientY);
                const onMouseMove = (m: MouseEvent) => handleDragMove(m.clientY);
                const onMouseUp = () => {
                  handleDragEnd();
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              }}
              className="absolute bottom-[100%] inset-x-0 flex flex-col items-center justify-center gap-1 cursor-pointer touch-none select-none z-[75] pointer-events-auto pb-2.5 transition-opacity duration-200"
            >
              {/* Curved Chevron */}
              <i className="fa-solid fa-chevron-up text-white text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-pulse"></i>

              {/* Centered Text */}
              <span className="text-[13px] font-semibold tracking-normal text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                {swipeText}
              </span>
            </div>
          )}

          {/* Drag Handle Top Bar */}
          {!isFullScreen && (
            <div
              className="pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing touch-none flex flex-col items-center justify-center w-full select-none bg-background shrink-0 rounded-t-[28px]"
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
              <div className="w-10 h-1 bg-border rounded-full"></div>
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
              initialTab={initialTab}
              initialExpandedPredictId={initialExpandedPredictId}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default ChartBottomSheetContainer;

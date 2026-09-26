'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const MobileCommodityChart = dynamic(() => import('@/components/product-charts/MobileCommodityChart'), {
  loading: () => <div className="flex-1 flex items-center justify-center min-h-[300px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
});

export interface ChartBottomSheetItem {
  id: number | string;
  productId?: number | string;
  favoriteProductId?: number | string;
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
  predictId?: string | number;
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
  defaultFullScreen = true,
  lang = 'en',
  swipeText = 'Swipe up for Details',
  initialTab,
  initialExpandedPredictId
}: ChartBottomSheetContainerProps) {
  const [headerHeight, setHeaderHeight] = useState(0);

  // Lock document body scroll while modal is open
  useEffect(() => {
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

  // Dynamically measure header
  useEffect(() => {
    const measureHeader = () => {
      const headerEl = document.querySelector('header');
      if (headerEl) {
        const rect = headerEl.getBoundingClientRect();
        setHeaderHeight(Math.max(Math.round(rect.bottom), 0));
      }
    };
    
    measureHeader();
    
    const handleResize = () => {
      measureHeader();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!activeItem) return null;

  return (
    <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center pointer-events-auto select-none bg-background lg:bg-black/40 lg:backdrop-blur-sm lg:p-4 xl:p-8">
      <div
        className="relative z-10 w-full h-full lg:h-[92vh] lg:max-h-[880px] lg:max-w-6xl xl:max-w-7xl bg-background lg:rounded-2xl xl:rounded-3xl lg:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] lg:border lg:border-border flex flex-col overflow-hidden"
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
  );
}

export default ChartBottomSheetContainer;


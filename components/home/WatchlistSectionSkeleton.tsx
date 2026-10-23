import React from 'react';
import { ProductChartsGridSkeleton } from '@/components/product-charts/ProductChartsGridSkeleton';

interface WatchlistSectionSkeletonProps {
  dict?: any;
}

export default function WatchlistSectionSkeleton({ dict }: WatchlistSectionSkeletonProps) {
  return (
    <div className="mt-5 relative w-full" aria-busy="true">
      {/* Tabs matching WatchlistSectionClient */}
      <div className="flex w-full items-center gap-2 sm:gap-4 mb-2 md:mb-6">
        <div
          className="flex-1 py-3 sm:py-4 px-4 rounded-xl text-sm sm:text-base font-bold bg-primary text-white shadow-md flex items-center justify-center transition-all duration-300 select-none cursor-default"
        >
          <i className="fa-solid fa-chart-line mr-2"></i>
          {dict?.home?.watchlist_tab_products || 'Products Price'}
        </div>
        <div
          className="flex-1 py-3 sm:py-4 px-4 rounded-xl text-sm sm:text-base font-bold bg-card border border-border text-muted-foreground flex items-center justify-center transition-all duration-300 select-none cursor-default"
        >
          <i className="fa-solid fa-ship mr-2"></i>
          {dict?.home?.watchlist_tab_freight || 'Freight Rate'}
        </div>
      </div>

      {/* Tab Content Skeleton */}
      <div className="w-full flex flex-col">
        <ProductChartsGridSkeleton />
      </div>
    </div>
  );
}

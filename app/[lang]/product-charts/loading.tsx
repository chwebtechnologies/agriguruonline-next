import React from 'react';
import { ProductChartsGridSkeleton } from '@/components/product-charts/ProductChartsGridSkeleton';

export default function ProductChartsLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton matching PageHeader */}
          <div className="py-1 sm:py-1.5 flex items-center justify-between w-full mb-1 sm:mb-1.5">
            <div className="h-9 w-24 bg-muted animate-pulse rounded-full" />
            <div className="h-8 w-48 bg-muted animate-pulse rounded-xl" />
            <div className="w-9" />
          </div>

          <div className="mt-1 sm:mt-1.5">
            <ProductChartsGridSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

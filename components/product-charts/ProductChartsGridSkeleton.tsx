import React from 'react';

export const PRODUCT_CHARTS_GRID_COLS =
  'grid-cols-[minmax(0,0.92fr)_minmax(0,0.98fr)_minmax(0,1.75fr)_minmax(0,0.9fr)_minmax(0,0.78fr)_minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,0.68fr)_minmax(0,0.72fr)_minmax(0,0.65fr)_minmax(0,1.32fr)]';

export function ProductChartsRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="w-full">
      {/* Mobile/Tablet Card Skeleton (lg:hidden) */}
      <div className="flex flex-col gap-[7px] lg:hidden">
        {[...Array(count)].map((_, i) => (
          <div
            key={`mob-row-skel-${i}`}
            className="flex flex-col p-2.5 bg-card rounded-xl border border-border shadow-xs animate-pulse space-y-2"
          >
            {/* Row 1: Origins and POD */}
            <div className="flex justify-between items-center text-[12px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-4 h-3 bg-muted rounded-[2px] shrink-0" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0 justify-end">
                <div className="h-3 w-20 bg-muted rounded" />
                <div className="w-4 h-3 bg-muted rounded-[2px] shrink-0" />
              </div>
            </div>

            {/* Row 2: Product Name & Price */}
            <div className="flex justify-between items-center gap-3 mt-1.5">
              <div className="h-4 w-36 bg-muted rounded" />
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="w-6 h-6 bg-muted rounded-full" />
              </div>
            </div>

            {/* Row 3: POL, ShipBy, Change */}
            <div className="flex justify-between items-center text-[12px] mt-0.5">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-3 w-12 bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Rows Skeleton (hidden lg:flex) */}
      <div className="hidden lg:flex flex-col gap-[7px] lg:gap-2 mt-0.5 lg:mt-1">
        {[...Array(count)].map((_, i) => (
          <div
            key={`desk-row-skel-${i}`}
            className={`grid ${PRODUCT_CHARTS_GRID_COLS} gap-1.5 items-center py-3 rounded-lg bg-card shadow-xs border border-border text-sm animate-pulse px-0`}
          >
            {/* 1. Category */}
            <div className="h-4 w-20 bg-muted rounded min-w-0 ml-3" />

            {/* 2. Country */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border" />
              <div className="h-4 w-16 bg-muted rounded" />
            </div>

            {/* 3. Product */}
            <div className="h-4 w-32 bg-muted rounded min-w-0" />

            {/* 4. Ship By */}
            <div className="h-4 w-12 mx-auto bg-muted rounded min-w-0" />

            {/* 5. Term */}
            <div className="h-4 w-10 mx-auto bg-muted rounded min-w-0" />

            {/* 6. POL */}
            <div className="flex items-center gap-2 min-w-0 pl-[2px]">
              <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border" />
              <div className="h-4 w-14 bg-muted rounded" />
            </div>

            {/* 7. POD */}
            <div className="flex items-center gap-2 min-w-0 pl-[2px]">
              <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border" />
              <div className="h-4 w-14 bg-muted rounded" />
            </div>

            {/* 8. Price */}
            <div className="h-5 w-14 mx-auto bg-muted rounded min-w-0" />

            {/* 9. Change */}
            <div className="h-4 w-12 mx-auto bg-muted rounded min-w-0" />

            {/* 10. Chart */}
            <div className="w-5 h-5 mx-auto bg-muted rounded min-w-0" />

            {/* 11. Actions */}
            <div className="flex items-center justify-end gap-2.5 min-w-0 pr-3">
              <div className="h-7 w-16 bg-muted rounded-full min-w-0" />
              <div className="w-6 h-6 bg-muted rounded min-w-0" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductChartsGridSkeleton() {
  return (
    <div className="w-full overflow-visible">
      {/* Top Marketed Products Ticker Skeleton */}
      <div className="w-full bg-card rounded-md border border-border mb-4 h-10 flex items-center shadow-xs px-4 animate-pulse">
        <div className="h-4 w-64 bg-muted rounded" />
      </div>

      {/* Desktop Filter Row Skeleton */}
      <div
        className={`hidden lg:grid ${PRODUCT_CHARTS_GRID_COLS} gap-1.5 mb-1.5 items-end pt-1 pb-1 px-0 animate-pulse`}
      >
        {[...Array(10)].map((_, idx) => (
          <div
            key={idx}
            className="w-full h-[45px] rounded-lg border border-border bg-card"
          />
        ))}
        <div className="w-full h-[45px] rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary/60 text-xs font-bold gap-1 select-none">
          <i className="fa-solid fa-plus text-xs"></i>
          <span>Add Product</span>
        </div>
      </div>

      {/* Rows Skeleton */}
      <ProductChartsRowsSkeleton count={5} />
    </div>
  );
}

export default ProductChartsGridSkeleton;

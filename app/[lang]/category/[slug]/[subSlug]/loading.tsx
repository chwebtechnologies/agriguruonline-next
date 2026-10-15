import React from 'react'

export default function SubCategoryProductsLoading() {
  return (
    <div className="bg-background text-foreground min-h-[60vh]">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton */}
          <div className="py-1 sm:py-1.5 flex items-center justify-between w-full mb-1 sm:mb-1.5 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
              <div className="w-48 h-6 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="w-20 h-8 bg-muted rounded-full animate-pulse" />
          </div>

          {/* Products Grid Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mt-1 sm:mt-1.5">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
                <div className="relative w-full aspect-square bg-muted animate-pulse border-b border-border" />
                <div className="p-2 sm:p-3 flex flex-col flex-1 gap-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4 mx-auto mb-2" />
                  <div className="mt-auto space-y-1.5">
                    <div className="h-8 bg-muted animate-pulse rounded-lg w-full" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="h-8 bg-muted animate-pulse rounded-lg" />
                      <div className="h-8 bg-muted animate-pulse rounded-lg" />
                    </div>
                    <div className="h-8 bg-muted animate-pulse rounded-lg w-full mt-0.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

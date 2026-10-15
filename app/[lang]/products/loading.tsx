import React from 'react'

export default function ProductsLoading() {
  return (
    <div className="bg-background text-foreground min-h-[60vh]">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton */}
          <div className="py-1 sm:py-1.5 flex items-center justify-between w-full mb-1 sm:mb-1.5 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
              <div className="w-40 h-6 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="w-20 h-8 bg-muted rounded-full animate-pulse" />
          </div>

          {/* Categories Grid Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs animate-pulse">
                <div className="relative w-full aspect-[16/10] bg-muted border-b border-border" />
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col gap-2">
                  <div className="h-4 sm:h-5 bg-muted rounded w-3/4" />
                  <div className="flex items-center justify-between mt-1">
                    <div className="h-3 sm:h-4 bg-muted rounded w-1/3" />
                    <div className="w-6 h-6 rounded-full bg-muted" />
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

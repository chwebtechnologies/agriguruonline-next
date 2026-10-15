import React from 'react'

export default function MarketReportsLoading() {
  return (
    <div className="bg-background text-foreground min-h-[60vh]">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton */}
          <div className="py-1 sm:py-1.5 flex items-center justify-between w-full mb-1 sm:mb-1.5 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
              <div className="w-44 h-6 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="w-24 h-8 bg-muted rounded-full animate-pulse" />
          </div>

          {/* Filters Skeleton */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 mb-3">
            {[80, 96, 72, 88].map((w, idx) => (
              <div
                key={idx}
                className="h-9 rounded-full bg-muted animate-pulse shrink-0"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>

          {/* Market Reports Document Grid Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 mt-2">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs animate-pulse"
              >
                <div className="w-full aspect-[794/1120] bg-muted border-b border-border" />
                <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-14 h-4 rounded bg-muted" />
                    <div className="w-16 h-3 rounded bg-muted" />
                  </div>
                  <div className="w-full h-4 rounded bg-muted mb-1.5" />
                  <div className="w-3/4 h-4 rounded bg-muted mb-3" />
                  <div className="flex-grow" />
                  <div className="flex items-center justify-between mt-auto border-t border-border pt-3">
                    <div className="w-20 h-4 rounded bg-muted" />
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

import React from 'react'

export default function EventsLoading() {
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

          {/* Search/Filter Skeleton */}
          <div className="w-full h-10 bg-muted rounded-xl animate-pulse mt-0.5 mb-1.5" />

          {/* Events Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 mt-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-border p-3.5 animate-pulse bg-card shadow-xs">
                <div className="w-full aspect-[4/3] bg-muted rounded-xl" />
                <div className="h-4 bg-muted w-3/4 mt-2 rounded" />
                <div className="h-4 bg-muted w-1/2 rounded" />
                <div className="h-3 bg-muted/70 w-1/4 mt-auto pt-2 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

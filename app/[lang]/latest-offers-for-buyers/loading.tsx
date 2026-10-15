import React from 'react'

export default function LatestOffersLoading() {
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

          {/* Filter Bar Skeleton */}
          <div className="mt-0.5 mb-1.5 sm:mb-2">
            <div className="h-10 bg-muted animate-pulse rounded-lg max-w-sm" />
          </div>

          {/* Offers Grid */}
          <div className="bg-card border border-border rounded-2xl p-3 sm:p-5 lg:p-6 mt-1 sm:mt-1.5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-4 p-4 border border-border rounded-2xl animate-pulse bg-muted/30">
                  <div className="w-20 h-20 bg-muted rounded-full shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-4 bg-muted rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

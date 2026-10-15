import React from 'react'

export default function MarketUpdateDetailLoading() {
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

          <div className="mt-1 sm:mt-1.5 w-full max-w-full overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-0 md:gap-y-6 md:gap-x-6 lg:gap-x-8 items-start w-full max-w-full">
              {/* Featured Image Skeleton */}
              <div className="w-full max-w-full min-w-0 space-y-4">
                <div className="bg-card rounded-t-2xl rounded-b-none md:rounded-2xl border border-border border-b-0 md:border-b p-2 sm:p-2.5 shadow-xs overflow-hidden">
                  <div className="w-full aspect-[1/1.414] bg-muted animate-pulse rounded-t-xl rounded-b-none" />
                  <div className="flex items-center justify-between pt-2.5 pb-0.5 px-1">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </div>

              {/* Content Skeleton */}
              <div className="w-full max-w-full min-w-0 mt-6 md:mt-0 bg-card rounded-b-2xl rounded-t-none md:rounded-2xl border border-border p-4 sm:p-7 md:p-8 space-y-4">
                <div className="w-3/4 h-8 bg-muted animate-pulse rounded mb-2" />
                <div className="w-full h-12 bg-muted/60 animate-pulse rounded-xl" />
                <div className="space-y-3 pt-2">
                  <div className="w-full h-4 bg-muted animate-pulse rounded" />
                  <div className="w-full h-4 bg-muted animate-pulse rounded" />
                  <div className="w-5/6 h-4 bg-muted animate-pulse rounded" />
                  <div className="w-full h-4 bg-muted animate-pulse rounded mt-4" />
                  <div className="w-4/6 h-4 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import React from 'react'

export default function MyOffersLoading() {
  return (
    <div className="bg-background text-foreground min-h-[60vh] transition-theme">
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

          {/* Tabs / Filter Skeleton */}
          <div className="flex items-center gap-3 mt-1 sm:mt-1.5 mb-2">
            <div className="h-10 w-36 bg-muted animate-pulse rounded-xl" />
            <div className="h-10 w-36 bg-muted/60 animate-pulse rounded-xl" />
          </div>

          {/* Table / List Container Skeleton */}
          <div className="w-full bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="h-5 w-32 bg-muted rounded animate-pulse" />
              <div className="h-8 w-24 bg-muted rounded-lg animate-pulse" />
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 w-full bg-muted/40 rounded-xl animate-pulse flex items-center justify-between px-4">
                  <div className="space-y-1.5">
                    <div className="h-4 w-40 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted/60 rounded" />
                  </div>
                  <div className="h-8 w-20 bg-muted rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

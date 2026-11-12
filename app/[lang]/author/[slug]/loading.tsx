import React from 'react'

export default function AuthorLoading() {
  return (
    <div className="bg-background text-foreground min-h-[60vh]">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton */}
          <div className="py-1 sm:py-1.5 flex items-center justify-between w-full mb-3 sm:mb-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
              <div className="w-48 h-6 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="w-20 h-8 bg-muted rounded-full animate-pulse" />
          </div>

          {/* Author Profile Hero Card Skeleton */}
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 md:p-8 shadow-xs mb-6 sm:mb-8">
            <div className="flex flex-col md:flex-row gap-5 sm:gap-7 items-center md:items-start">
              {/* Image Skeleton */}
              <div className="relative shrink-0 w-full sm:w-auto flex justify-center md:block">
                <div className="w-full max-w-[280px] sm:max-w-[320px] md:w-72 lg:w-80 aspect-[3/2] rounded-2xl bg-muted animate-pulse border border-border" />
              </div>

              {/* Bio & Details Skeleton */}
              <div className="flex-1 w-full space-y-3 text-center md:text-left">
                <div className="w-3/4 sm:w-1/2 h-8 bg-muted rounded-lg animate-pulse mx-auto md:mx-0" />
                <div className="w-full h-4 bg-muted rounded animate-pulse" />
                <div className="w-5/6 h-4 bg-muted rounded animate-pulse mx-auto md:mx-0" />
                <div className="w-full h-4 bg-muted rounded animate-pulse mt-2" />
                <div className="w-11/12 h-4 bg-muted rounded animate-pulse" />
                <div className="w-4/5 h-4 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>

          {/* Published Articles Section Heading Skeleton */}
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/60">
            <div className="w-48 h-6 bg-muted rounded animate-pulse" />
            <div className="w-20 h-5 bg-muted rounded-full animate-pulse" />
          </div>

          {/* Published Articles Grid Skeleton (8 items: 2 rows of 4 on desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
                <div className="relative w-full aspect-[3/2] bg-muted animate-pulse border-b border-border" />
                <div className="px-3.5 py-3 sm:px-4 sm:py-4 flex flex-col gap-2.5">
                  <div className="w-24 h-3 bg-muted animate-pulse rounded" />
                  <div className="w-3/4 h-5 bg-muted animate-pulse rounded" />
                  <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between">
                    <div className="w-20 h-3 bg-muted animate-pulse rounded" />
                    <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
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

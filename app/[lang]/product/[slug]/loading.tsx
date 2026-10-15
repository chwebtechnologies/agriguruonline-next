import React from 'react'

export default function ProductDetailLoading() {
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

          {/* Product Detail Card Skeleton */}
          <div className="mt-1 sm:mt-1.5 bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 p-4 sm:p-5 md:p-6">
              {/* Left Column: Image & Mobile Quick Info & Action Buttons */}
              <div className="flex flex-row md:flex-col gap-4 md:gap-0 md:space-y-4 md:col-span-5 lg:col-span-4">
                <div className="relative w-2/5 md:w-full aspect-square bg-muted animate-pulse rounded-xl border border-border shrink-0" />
                <div className="flex flex-col md:hidden justify-start pt-1 flex-1 space-y-2.5">
                  <div className="h-6 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                </div>
                <div className="hidden md:flex flex-col gap-2 mt-2">
                  <div className="h-12 w-full bg-muted animate-pulse rounded-xl" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-12 bg-muted animate-pulse rounded-xl" />
                    <div className="h-12 bg-muted animate-pulse rounded-xl" />
                  </div>
                </div>
              </div>

              {/* Right Column: Title, Badges & Specifications */}
              <div className="flex flex-col space-y-6 md:col-span-7 lg:col-span-8">
                <div className="hidden md:block">
                  <div className="h-8 bg-muted animate-pulse rounded w-2/3 mb-4" />
                  <div className="h-5 bg-muted animate-pulse rounded w-1/3 mb-4" />
                  <div className="flex gap-2">
                    <div className="h-8 w-24 bg-muted animate-pulse rounded-full" />
                    <div className="h-8 w-32 bg-muted animate-pulse rounded-full" />
                  </div>
                </div>
                <hr className="border-border" />
                <div className="space-y-4">
                  <div className="h-6 w-48 bg-muted animate-pulse rounded mb-4" />
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  <div className="h-4 w-5/6 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-4/6 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

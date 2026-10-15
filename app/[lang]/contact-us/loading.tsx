import React from 'react'

export default function ContactUsLoading() {
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

          {/* Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
            {/* Left Column: Office Info & Locations */}
            <div className="lg:col-span-5 flex flex-col gap-3 sm:gap-4">
              {/* Headquarters Card */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted animate-pulse shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-5 w-48 bg-muted animate-pulse rounded" />
                    <div className="h-3.5 w-32 bg-muted/70 animate-pulse rounded" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted/70 animate-pulse rounded" />
                  <div className="h-4 w-5/6 bg-muted/70 animate-pulse rounded" />
                </div>
                <div className="pt-3 border-t border-border space-y-2.5">
                  <div className="h-8 w-3/4 bg-muted animate-pulse rounded-lg" />
                  <div className="h-8 w-2/3 bg-muted animate-pulse rounded-lg" />
                  <div className="h-8 w-1/2 bg-muted animate-pulse rounded-lg" />
                </div>
              </div>

              {/* Global Footprint */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted animate-pulse shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-5 w-40 bg-muted animate-pulse rounded" />
                    <div className="h-3.5 w-28 bg-muted/70 animate-pulse rounded" />
                  </div>
                </div>
                <div className="h-12 w-full bg-muted/60 animate-pulse rounded-xl" />
              </div>
            </div>

            {/* Right Column: Contact Form */}
            <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col space-y-4">
              <div className="h-6 w-48 bg-muted animate-pulse rounded mb-2" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="h-11 bg-muted animate-pulse rounded-xl" />
                <div className="h-11 bg-muted animate-pulse rounded-xl" />
                <div className="h-11 bg-muted animate-pulse rounded-xl" />
                <div className="h-11 bg-muted animate-pulse rounded-xl" />
              </div>
              <div className="h-11 bg-muted animate-pulse rounded-xl" />
              <div className="h-28 bg-muted animate-pulse rounded-xl" />
              <div className="h-11 w-36 bg-muted animate-pulse rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import React from 'react'

export default function DownloadAppLoading() {
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

          {/* 2-Column Hero Skeleton */}
          <section className="relative pt-1 sm:pt-2 pb-8 lg:pb-12">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
              {/* Left Column: Headline & CTA Skeletons */}
              <div className="flex-1 w-full lg:w-1/2 space-y-4">
                <div className="h-6 w-48 bg-muted animate-pulse rounded-full" />
                <div className="h-12 sm:h-16 w-3/4 bg-muted animate-pulse rounded-2xl" />
                <div className="h-4 w-full bg-muted/70 animate-pulse rounded" />
                <div className="h-4 w-5/6 bg-muted/70 animate-pulse rounded" />
                
                {/* Store Buttons Skeleton */}
                <div className="flex flex-wrap gap-4 pt-4">
                  <div className="h-14 w-44 bg-muted animate-pulse rounded-2xl" />
                  <div className="h-14 w-44 bg-muted animate-pulse rounded-2xl" />
                </div>
              </div>

              {/* Right Column: Phone Mockup Skeleton */}
              <div className="w-full lg:w-1/2 flex justify-center">
                <div className="w-[280px] sm:w-[320px] aspect-[9/19] rounded-[48px] bg-card border-4 border-muted p-3 animate-pulse shadow-2xl">
                  <div className="w-full h-full bg-muted/50 rounded-[38px]" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

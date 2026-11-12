import React from "react";

export default function LoginLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton exactly matching PageHeader */}
          <div className="sticky top-[57px] sm:top-[63px] lg:top-[97px] z-40 py-1 sm:py-1.5 mb-1 sm:mb-1.5 flex items-center justify-between w-full bg-background">
            <div className="absolute inset-y-0 -top-px -left-4 -right-4 sm:-left-8 sm:-right-8 lg:-left-14 lg:-right-14 xl:-left-20 xl:-right-20 bg-background z-0 pointer-events-none border-b border-border/40 shadow-xs" />

            {/* Left: Back button placeholder */}
            <div className="flex-none flex items-center justify-start relative z-20">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-card border border-border shadow-xs flex items-center justify-center">
                <div className="w-3.5 h-3.5 rounded-full bg-muted animate-pulse" />
              </div>
            </div>

            {/* Middle: Centered Title Skeleton */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-[45px] sm:px-[120px] z-10">
              <div className="h-6 sm:h-8 w-44 sm:w-56 bg-muted rounded-md animate-pulse" />
            </div>

            {/* Right: Spacer */}
            <div className="flex-none flex items-center justify-end relative z-20 w-[32px] sm:w-[36px]" />
          </div>

          {/* Centered Auth Card Skeleton matching EmailStep */}
          <div className="w-full flex flex-col items-center px-4 sm:px-0">
            <div className="w-full max-w-md mx-auto mt-[5px] p-5 sm:p-6 flex flex-col items-center bg-card border border-foreground/10 rounded-2xl shadow-sm space-y-4">
              {/* Email Input Field Skeleton */}
              <div className="w-full space-y-2 mb-2">
                <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                <div className="h-11 w-full bg-muted/50 border border-foreground/10 rounded-lg animate-pulse" />
              </div>

              {/* Continue Button Skeleton */}
              <div className="h-12 w-full bg-muted animate-pulse rounded-lg" />

              {/* Divider Skeleton */}
              <div className="w-full flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-foreground/15" />
                <div className="w-24 h-3 bg-muted/60 rounded" />
                <div className="flex-1 h-px bg-foreground/15" />
              </div>

              {/* Social Buttons Skeleton */}
              <div className="w-full space-y-3">
                <div className="h-12 w-full bg-muted/40 border border-foreground/15 rounded-lg animate-pulse" />
                <div className="h-12 w-full bg-muted/40 border border-foreground/15 rounded-lg animate-pulse" />
              </div>

              {/* Terms text skeleton */}
              <div className="w-3/4 h-3 bg-muted/40 rounded mt-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

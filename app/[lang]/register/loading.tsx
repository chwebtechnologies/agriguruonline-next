import React from 'react'

export default function RegisterLoading() {
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

          {/* Centered Auth Card */}
          <div className="w-full flex flex-col items-center px-4 sm:px-0">
            <div className="w-full max-w-md mx-auto mt-[5px] p-5 sm:p-6 flex flex-col items-center bg-card border border-border rounded-2xl shadow-sm space-y-4">
              <div className="w-full space-y-2">
                <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                <div className="h-11 w-full bg-muted/60 animate-pulse rounded-xl" />
              </div>

              <div className="h-11 w-full bg-muted animate-pulse rounded-xl" />

              {/* Divider */}
              <div className="w-full flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-border" />
                <div className="w-8 h-3 bg-muted/60 rounded" />
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Social Buttons */}
              <div className="w-full space-y-3">
                <div className="h-11 w-full bg-muted/60 animate-pulse rounded-xl" />
                <div className="h-11 w-full bg-muted/60 animate-pulse rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

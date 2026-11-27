import React from 'react'

export default function VideoDetailLoading() {
  return (
    <div className="bg-background text-foreground min-h-[60vh]">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton */}
          <div className="py-1 sm:py-1.5 flex items-center justify-between w-full mb-1 sm:mb-1.5 border-b border-border/40 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted" />
              <div className="w-48 h-6 bg-muted rounded-md" />
            </div>
            <div className="w-20 h-8 bg-muted rounded-full" />
          </div>

          {/* Video Detail Skeleton */}
          <div className="flex flex-col items-center mt-4 animate-pulse">
            <div className="w-full max-w-4xl aspect-video bg-muted rounded-2xl" />
            <div className="w-full max-w-4xl mt-5 bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="w-3/4 h-7 bg-muted rounded" />
              <div className="w-full h-16 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

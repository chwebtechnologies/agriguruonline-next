import React from 'react'

export default function ParticipationGalleryLoading() {
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

          {/* Albums Grid Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 mt-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col rounded-2xl border border-border p-3.5 animate-pulse bg-card shadow-xs">
                <div className="w-full aspect-square bg-muted rounded-xl mb-3" />
                <div className="h-4 bg-muted w-3/4 rounded" />
                <div className="h-3 bg-muted/70 w-1/3 mt-2 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

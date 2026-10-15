import React from 'react'

export default function ParticipationAlbumLoading() {
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

          {/* Photos Grid Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mt-1 sm:mt-1.5">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-card border border-border overflow-hidden shadow-xs animate-pulse">
                <div className="w-full h-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

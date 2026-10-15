import React from 'react'

export default function RootLocalizedLoading() {
  return (
    <div className="bg-background text-foreground min-h-[60vh]">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5 space-y-4">
          {/* Universal Header Skeleton */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
              <div className="w-48 h-6 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="w-20 h-8 bg-muted rounded-full animate-pulse" />
          </div>

          {/* Universal Content Skeleton */}
          <div className="w-full bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs animate-pulse space-y-4">
            <div className="w-1/3 h-6 bg-muted rounded-md" />
            <div className="w-full h-4 bg-muted/70 rounded" />
            <div className="w-4/5 h-4 bg-muted/70 rounded" />
            <div className="w-3/5 h-4 bg-muted/70 rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
              <div className="h-32 bg-muted/50 rounded-xl" />
              <div className="h-32 bg-muted/50 rounded-xl" />
              <div className="h-32 bg-muted/50 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

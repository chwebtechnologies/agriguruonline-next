import React from 'react'

export default function AlertsSetupsLoading() {
  return (
    <div className="bg-background text-foreground min-h-[60vh] transition-theme pb-5">
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

          {/* Alerts Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between h-[150px] animate-pulse"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-36 bg-muted rounded" />
                      <div className="h-3 w-24 bg-muted/70 rounded" />
                    </div>
                  </div>
                  <div className="w-10 h-6 bg-muted rounded-full" />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="h-5 w-24 bg-muted rounded" />
                  <div className="h-5 w-20 bg-muted rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

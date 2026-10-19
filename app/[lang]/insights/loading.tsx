import React from 'react'

export default function InsightsLoading() {
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

          {/* 4 Carousels Sections Skeleton */}
          <div className="w-full space-y-12 animate-pulse pt-4 pb-8">
            {[0, 1, 2, 3].map((sectionIndex) => (
              <div key={sectionIndex} className="space-y-4">
                <div className="flex flex-col items-center space-y-2 max-w-3xl mx-auto">
                  <div className="h-8 w-64 bg-muted rounded-lg" />
                  <div className="h-4 w-96 max-w-full bg-muted/60 rounded-md" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-72 rounded-2xl bg-card border border-border" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

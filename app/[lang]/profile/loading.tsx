import React from 'react'

export default function ProfileLoading() {
  return (
    <div className="bg-background text-foreground min-h-[60vh] transition-theme">
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

          <div className="mt-1 sm:mt-1.5">
            {/* Banner Skeleton */}
            <div className="w-full h-12 bg-muted rounded-xl animate-pulse mb-4" />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-6 items-start">
              {/* Left Column (Main Form Content) */}
              <div className="lg:col-span-8 flex flex-col gap-2 lg:gap-6">
                <div className="w-full h-[600px] bg-card border border-border rounded-2xl animate-pulse p-6 space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-muted" />
                    <div className="space-y-2">
                      <div className="w-40 h-5 bg-muted rounded" />
                      <div className="w-28 h-4 bg-muted/70 rounded" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <div className="h-10 bg-muted/70 rounded-xl" />
                    <div className="h-10 bg-muted/70 rounded-xl" />
                    <div className="h-10 bg-muted/70 rounded-xl" />
                    <div className="h-10 bg-muted/70 rounded-xl" />
                  </div>
                </div>
              </div>

              {/* Right Column (Sidebar Widgets) */}
              <div className="lg:col-span-4 flex flex-col gap-2 lg:gap-6">
                <div className="w-full h-[200px] bg-card border border-border rounded-2xl animate-pulse p-5 space-y-3">
                  <div className="w-32 h-5 bg-muted rounded" />
                  <div className="w-full h-24 bg-muted/60 rounded-xl" />
                </div>
                <div className="w-full h-[360px] bg-card border border-border rounded-2xl animate-pulse p-5 space-y-4">
                  <div className="w-28 h-5 bg-muted rounded" />
                  <div className="space-y-3">
                    <div className="h-10 bg-muted/60 rounded-xl" />
                    <div className="h-10 bg-muted/60 rounded-xl" />
                    <div className="h-10 bg-muted/60 rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

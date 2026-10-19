import React from 'react';

export default function SettingsLoading() {
  return (
    <div className="bg-background text-foreground transition-theme">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton */}
          <div className="py-1 sm:py-1.5 flex items-center justify-between w-full mb-3 sm:mb-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
              <div className="w-36 h-6 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="w-20 h-8 bg-muted rounded-full animate-pulse" />
          </div>

          <div className="mt-2 sm:mt-3 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              {/* User strip skeleton */}
              <div className="h-14 bg-card border border-border/70 rounded-2xl animate-pulse" />

              {/* Appearance */}
              <div className="bg-card border border-border/70 rounded-2xl overflow-hidden animate-pulse">
                <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded bg-muted" />
                  <div className="w-28 h-4 rounded bg-muted" />
                </div>
                <div className="px-5 py-4">
                  <div className="h-20 bg-muted/60 rounded-xl" />
                </div>
              </div>

              {/* Notifications */}
              <div className="bg-card border border-border/70 rounded-2xl overflow-hidden animate-pulse">
                <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded bg-muted" />
                    <div className="w-28 h-4 rounded bg-muted" />
                  </div>
                  <div className="w-16 h-5 rounded bg-muted" />
                </div>
                <div className="px-5 py-4 space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-8 bg-muted/60 rounded-xl" />
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="bg-card border border-border/70 rounded-2xl overflow-hidden animate-pulse">
                <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded bg-muted" />
                  <div className="w-28 h-4 rounded bg-muted" />
                </div>
                <div className="px-5 py-4">
                  <div className="h-16 bg-muted/60 rounded-xl" />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="h-32 bg-card border border-border/70 rounded-2xl animate-pulse" />
              <div className="h-44 bg-card border border-border/70 rounded-2xl animate-pulse" />
              <div className="h-24 bg-card border border-rose-500/20 rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

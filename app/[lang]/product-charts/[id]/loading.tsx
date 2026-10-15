import React from 'react';

export default function DedicatedChartLoading() {
  return (
    <div className="bg-background text-foreground min-h-[100dvh]">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5 space-y-4">
          {/* Header Bar Skeleton */}
          <div className="bg-card rounded-2xl border border-border p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted animate-pulse"></div>
              <div className="space-y-1.5">
                <div className="w-48 h-5 bg-muted rounded-md animate-pulse"></div>
                <div className="w-32 h-3.5 bg-muted rounded-md animate-pulse"></div>
              </div>
            </div>
            <div className="w-24 h-8 bg-muted rounded-xl animate-pulse"></div>
          </div>

          {/* Main 2-column Grid */}
          <div className="w-full flex flex-col lg:flex-row gap-4">
            {/* Left Column (Chart + Content) */}
            <div className="w-full lg:flex-1 space-y-3.5">
              {/* Chart Card Skeleton */}
              <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="w-36 h-4 bg-muted rounded-md animate-pulse"></div>
                  <div className="w-20 h-4 bg-muted rounded-md animate-pulse"></div>
                </div>

                {/* Chart Area */}
                <div className="w-full h-[220px] lg:h-[280px] bg-muted/40 rounded-xl flex items-center justify-center relative overflow-hidden">
                  <div className="w-full h-full flex flex-col justify-end p-4 opacity-30 gap-3">
                    <div className="h-1/3 border-b border-border w-full flex items-end">
                      <div className="w-full h-[2px] bg-brand-blue/30 scale-x-75 origin-left rounded-full"></div>
                    </div>
                    <div className="h-1/3 border-b border-border w-full flex items-end">
                      <div className="w-full h-[2px] bg-brand-blue/30 scale-x-50 origin-left rounded-full"></div>
                    </div>
                    <div className="h-1/3 w-full flex items-end">
                      <div className="w-full h-[2px] bg-brand-blue/30 scale-x-90 origin-left rounded-full"></div>
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-full shadow-xs border border-border">
                      <i className="fa-solid fa-chart-line text-brand-blue animate-pulse"></i>
                      <span className="text-[12px] font-semibold text-foreground/70">Loading Chart...</span>
                    </div>
                  </div>
                </div>

                {/* Timeframe Buttons Skeleton */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  {['1W', '1M', '6M', '1Y', '5Y', 'ALL'].map((r) => (
                    <div key={r} className="w-10 h-7 bg-muted rounded-lg animate-pulse"></div>
                  ))}
                </div>
              </div>

              {/* Overview Details Skeleton */}
              <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
                <div className="w-40 h-4 bg-muted rounded-md animate-pulse"></div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="h-16 bg-muted/50 rounded-xl animate-pulse"></div>
                  <div className="h-16 bg-muted/50 rounded-xl animate-pulse"></div>
                  <div className="h-16 bg-muted/50 rounded-xl animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Right Column Skeleton (Desktop) */}
            <div className="hidden lg:flex lg:w-[320px] xl:w-[350px] flex-col space-y-3.5 shrink-0">
              <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
                <div className="w-32 h-4 bg-muted rounded-md animate-pulse"></div>
                <div className="h-24 bg-muted/50 rounded-xl animate-pulse"></div>
                <div className="h-10 bg-muted rounded-xl animate-pulse"></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-9 bg-muted rounded-xl animate-pulse"></div>
                  <div className="h-9 bg-muted rounded-xl animate-pulse"></div>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
                <div className="w-36 h-4 bg-muted rounded-md animate-pulse"></div>
                <div className="h-14 bg-muted/50 rounded-xl animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

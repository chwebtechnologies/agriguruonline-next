import React from 'react';

export default function SmartDocsDraftLoading() {
  return (
    <div className="bg-background text-foreground transition-theme flex-1 flex flex-col min-h-0 h-full overflow-hidden">
      <div className="w-full pad-for-badges flex-1 flex flex-col min-h-0 h-full overflow-hidden">
        <div className="max-w-7xl w-full mx-auto pt-0 sm:pt-0.5 pb-0.5 sm:pb-1 px-3 sm:px-4 lg:px-0 flex-1 flex flex-col min-h-0 h-full overflow-hidden">
          {/* PageHeader Skeleton */}
          <div className="py-0.5 sm:py-1 flex items-center justify-between w-full mb-0.5 sm:mb-1 animate-pulse shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-card border border-border" />
            <div className="h-7 sm:h-8 w-44 sm:w-56 bg-muted/60 rounded-lg mx-auto" />
            <div className="w-8 sm:w-9" />
          </div>

          {/* Cards Layout Skeleton */}
          <div className="mt-0.5 flex-1 min-h-0 flex flex-col lg:flex-row items-stretch justify-start gap-3 sm:gap-4 lg:gap-5 overflow-hidden">
            {/* Left Form Card Skeleton */}
            <div className="flex-1 min-w-0 h-full min-h-0 bg-card border border-border rounded-xl shadow-xs animate-pulse overflow-hidden p-4 sm:p-6 lg:p-8 flex flex-col gap-4">
              <div className="h-6 w-48 bg-muted/40 rounded-md" />
              <div className="h-10 w-full bg-muted/20 rounded-md" />
              <div className="h-24 w-full bg-muted/15 rounded-md" />
            </div>

            {/* Right Stepper Card Skeleton */}
            <div className="w-full lg:w-[340px] xl:w-[370px] 2xl:w-[390px] shrink-0 h-full min-h-0 bg-card border border-border rounded-xl shadow-xs animate-pulse overflow-hidden p-3 sm:p-3.5 flex flex-col gap-2">
              <div className="h-5 w-32 bg-muted/40 rounded-md" />
              <div className="h-8 w-full bg-muted/20 rounded-md" />
              <div className="h-8 w-full bg-muted/20 rounded-md" />
              <div className="h-8 w-full bg-muted/20 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

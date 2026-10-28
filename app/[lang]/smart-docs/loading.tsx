import React from 'react';

export default function SmartDocsLoading() {
  return (
    <div className="bg-background text-foreground transition-theme flex-1 flex flex-col min-h-0 lg:h-full overflow-y-auto lg:overflow-hidden">
      <div className="w-full pad-for-badges flex-1 flex flex-col min-h-0 lg:h-full">
        <div className="max-w-7xl w-full mx-auto pt-0 sm:pt-0.5 pb-1 sm:pb-1.5 lg:pb-2 flex-1 flex flex-col min-h-0 lg:h-full">
          {/* PageHeader Skeleton */}
          <div className="py-1 sm:py-1.5 flex items-center justify-between w-full mb-1 sm:mb-1.5 animate-pulse shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-card border border-border" />
            <div className="h-7 sm:h-8 w-48 sm:w-64 bg-muted/60 rounded-lg mx-auto" />
            <div className="w-8 sm:w-9" />
          </div>

          {/* Table Container Skeleton */}
          <div className="w-full bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col animate-pulse mt-0.5 sm:mt-1 h-auto max-h-full flex-1">
            {/* Search & Actions bar */}
            <div className="px-3 sm:px-3.5 py-2 sm:py-2.5 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-2.5">
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full sm:w-auto">
                <div className="h-8.5 sm:h-9 w-full sm:w-36 bg-muted/40 rounded-md" />
                <div className="h-8.5 sm:h-9 w-full sm:w-40 bg-muted/40 rounded-md" />
                <div className="h-8.5 sm:h-9 w-full sm:w-64 md:w-72 bg-muted/40 rounded-md" />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <div className="h-8.5 sm:h-9 w-36 bg-muted/60 rounded-md" />
              </div>
            </div>

            {/* Table Rows Skeleton */}
            <div className="p-3 sm:p-4 flex flex-col gap-2.5">
              <div className="h-8 sm:h-9 w-full bg-muted/30 rounded-md" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 sm:h-10 w-full bg-muted/20 rounded-md" />
              ))}
            </div>

            {/* Pagination Bar Skeleton */}
            <div className="px-3 sm:px-3.5 py-1.5 sm:py-2 border-t border-border bg-muted/10 flex items-center justify-between">
              <div className="h-4 w-36 bg-muted/40 rounded-md" />
              <div className="h-8 w-52 bg-muted/40 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


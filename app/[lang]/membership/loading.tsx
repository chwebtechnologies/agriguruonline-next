import React from 'react';

export default function MembershipLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton */}
          <div className="py-1 sm:py-1.5 flex items-center justify-between w-full mb-1 sm:mb-1.5">
            <div className="h-9 w-24 bg-muted animate-pulse rounded-full" />
            <div className="h-8 w-48 bg-muted animate-pulse rounded-xl" />
            <div className="w-9" />
          </div>

          <MembershipInnerSkeleton />
        </div>
      </div>
    </div>
  );
}

export function MembershipInnerSkeleton() {
  return (
    <div className="w-full">
      {/* Streamlined Controls Skeleton - w-full */}
      <div className="text-center w-full mt-1 mb-6 sm:mb-8 flex flex-col items-center">
        <div className="h-4 w-72 sm:w-96 bg-muted animate-pulse rounded-lg mb-4" />

        {/* Switchers Skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-48 bg-muted animate-pulse rounded-2xl" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded-2xl" />
        </div>
      </div>

      {/* 3 Compact Plan Cards Skeleton - max-w-6xl mx-auto */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 items-stretch max-w-6xl mx-auto">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-3xl bg-card border border-border p-5 sm:p-6 flex flex-col justify-between shadow-xs animate-pulse relative overflow-hidden"
          >
            <div className="h-1.5 bg-muted absolute top-0 inset-x-0" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-6 w-28 bg-muted rounded-lg" />
                    <div className="h-3.5 w-20 bg-muted rounded" />
                  </div>
                </div>
                <div className="h-5 w-24 bg-muted rounded-full" />
              </div>

              <div className="h-4 w-4/5 bg-muted rounded mb-4" />

              {/* Price Block Skeleton */}
              <div className="h-20 w-full bg-muted/50 rounded-2xl mb-5" />

              {/* Action Button Skeleton */}
              <div className="h-12 w-full bg-muted rounded-xl mb-5" />

              {/* Deliverables list skeleton with larger items */}
              <div className="space-y-3 pt-3 border-t border-border/60">
                <div className="flex items-center justify-between pb-1">
                  <div className="h-3.5 w-32 bg-muted rounded" />
                  <div className="h-3.5 w-20 bg-muted rounded" />
                </div>
                {[...Array(8)].map((_, j) => (
                  <div key={j} className="flex items-center gap-3 py-1">
                    <div className="w-4 h-4 rounded-full bg-muted shrink-0" />
                    <div className="h-4 w-4/5 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-border/50">
              <div className="h-8 w-full bg-muted/40 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

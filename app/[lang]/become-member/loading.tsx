import React from 'react';

export default function BecomeMemberLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton */}
          <div className="py-1 sm:py-1.5 flex items-center justify-between w-full mb-1 sm:mb-1.5">
            <div className="h-8 w-24 bg-muted animate-pulse rounded-full" />
            <div className="h-7 w-48 bg-muted animate-pulse rounded-xl" />
            <div className="w-8" />
          </div>

          <BecomeMemberInnerSkeleton />
        </div>
      </div>
    </div>
  );
}

export function BecomeMemberInnerSkeleton() {
  return (
    <div className="max-w-xl mx-auto space-y-3.5">
      {/* Selected Plan Banner Skeleton */}
      <div className="px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-2xs animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-muted" />
          <div className="flex items-center gap-2">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-4 w-14 bg-muted rounded-full" />
          </div>
        </div>
        <div className="h-6 w-16 bg-muted rounded-lg" />
      </div>

      {/* Form Container Skeleton */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs space-y-3.5 animate-pulse">
        {/* Header Skeleton */}
        <div className="border-b border-border/70 pb-2.5 space-y-1">
          <div className="h-5 w-44 bg-muted rounded" />
          <div className="h-3 w-64 bg-muted/70 rounded" />
        </div>

        {/* User Type Skeleton */}
        <div className="space-y-1.5">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="grid grid-cols-2 gap-2.5">
            <div className="h-11 rounded-xl bg-muted/60" />
            <div className="h-11 rounded-xl bg-muted/60" />
          </div>
        </div>

        {/* Categories Skeleton */}
        <div className="space-y-1.5 pt-2 border-t border-border/60">
          <div className="h-4 w-36 bg-muted rounded" />
          <div className="h-11 w-full bg-muted/50 rounded-xl" />
        </div>

        {/* Country Skeleton */}
        <div className="space-y-1.5 pt-2 border-t border-border/60">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-11 w-full bg-muted/50 rounded-xl" />
        </div>

        {/* Button Skeleton */}
        <div className="pt-2">
          <div className="h-11 w-full bg-muted rounded-xl" />
        </div>
      </div>
    </div>
  );
}

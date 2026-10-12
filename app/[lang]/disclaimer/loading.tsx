export default function DisclaimerLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton */}
          <div className="py-2 sm:py-2.5 flex items-center justify-between w-full mb-2">
            <div className="w-9 h-9 rounded-full bg-muted animate-pulse border border-border" />
            <div className="h-8 sm:h-9 bg-muted animate-pulse rounded-lg w-48 sm:w-64 mx-auto" />
            <div className="w-9 h-9" />
          </div>

          {/* Disclaimer Card Skeleton */}
          <div className="mt-1 sm:mt-2 space-y-4 sm:space-y-6">
            <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
              <div className="space-y-3">
                <div className="h-5 bg-muted animate-pulse rounded w-full" />
                <div className="h-5 bg-muted animate-pulse rounded w-[96%]" />
                <div className="h-5 bg-muted animate-pulse rounded w-[92%]" />
                <div className="h-5 bg-muted animate-pulse rounded w-[70%]" />
              </div>

              <div className="pt-4 space-y-3">
                <div className="h-5 bg-muted animate-pulse rounded w-full" />
                <div className="h-5 bg-muted animate-pulse rounded w-[94%]" />
                <div className="h-5 bg-muted animate-pulse rounded w-[88%]" />
              </div>

              <div className="pt-4 space-y-3">
                <div className="h-5 bg-muted animate-pulse rounded w-full" />
                <div className="h-5 bg-muted animate-pulse rounded w-[92%]" />
                <div className="h-5 bg-muted animate-pulse rounded w-[85%]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

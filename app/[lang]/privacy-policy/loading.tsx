export default function PrivacyPolicyLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton */}
          <div className="py-1 sm:py-1.5 flex items-center justify-between w-full mb-1 sm:mb-1.5">
            <div className="w-9 h-9 rounded-full bg-muted animate-pulse border border-border" />
            <div className="h-8 sm:h-9 bg-muted animate-pulse rounded-lg w-48 sm:w-64 mx-auto" />
            <div className="w-9 h-9" />
          </div>

          {/* Privacy Policy Card Skeleton */}
          <div className="mt-1 sm:mt-2 space-y-4 sm:space-y-6">
            <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
              {/* Intro lines */}
              <div className="space-y-3">
                <div className="h-5 bg-muted animate-pulse rounded w-full" />
                <div className="h-5 bg-muted animate-pulse rounded w-[96%]" />
                <div className="h-5 bg-muted animate-pulse rounded w-[92%]" />
                <div className="h-5 bg-muted animate-pulse rounded w-[70%]" />
              </div>

              {/* Section 1 Skeleton */}
              <div className="pt-4 space-y-3">
                <div className="h-6 bg-muted animate-pulse rounded w-64 mb-3" />
                <div className="h-5 bg-muted animate-pulse rounded w-full" />
                <div className="h-5 bg-muted animate-pulse rounded w-[94%]" />
                <div className="h-5 bg-muted animate-pulse rounded w-[88%]" />
                <div className="pl-6 space-y-2 pt-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-[85%]" />
                  <div className="h-4 bg-muted animate-pulse rounded w-[80%]" />
                  <div className="h-4 bg-muted animate-pulse rounded w-[75%]" />
                </div>
              </div>

              {/* Section 2 Skeleton */}
              <div className="pt-4 space-y-3">
                <div className="h-6 bg-muted animate-pulse rounded w-72 mb-3" />
                <div className="h-5 bg-muted animate-pulse rounded w-full" />
                <div className="h-5 bg-muted animate-pulse rounded w-[92%]" />
                <div className="pl-6 space-y-2 pt-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-[90%]" />
                  <div className="h-4 bg-muted animate-pulse rounded w-[82%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CareerLoading() {
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

          {/* Cards Skeleton matching career page layout */}
          <div className="mt-1 sm:mt-2 space-y-4 sm:space-y-6">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs lg:bg-transparent lg:border-0 lg:shadow-none lg:p-0 lg:rounded-none lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start"
              >
                {/* Image Skeleton */}
                <div className="w-full lg:bg-card lg:border lg:border-border lg:rounded-2xl lg:p-6 lg:shadow-xs">
                  <div className="relative w-full aspect-[600/400] rounded-xl bg-muted animate-pulse border border-border" />
                </div>

                {/* Content Skeleton */}
                <div className="mt-4 sm:mt-5 lg:mt-0 lg:bg-card lg:border lg:border-border lg:rounded-2xl lg:p-6 lg:shadow-xs space-y-4">
                  <div className="h-6 bg-muted animate-pulse rounded w-3/4 pb-2" />
                  <div className="h-5 bg-muted animate-pulse rounded w-full" />
                  <div className="h-5 bg-muted animate-pulse rounded w-[96%]" />
                  <div className="h-5 bg-muted animate-pulse rounded w-[92%]" />
                  <div className="h-5 bg-muted animate-pulse rounded w-[85%]" />

                  <div className="pt-3 space-y-3">
                    <div className="h-5 bg-muted animate-pulse rounded w-[60%]" />
                    <div className="h-5 bg-muted animate-pulse rounded w-[75%]" />
                  </div>

                  <div className="pt-4 border-t border-border flex gap-3">
                    <div className="h-9 w-32 bg-muted animate-pulse rounded-lg" />
                    <div className="h-9 w-36 bg-muted animate-pulse rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

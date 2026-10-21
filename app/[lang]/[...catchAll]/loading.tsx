export default function DynamicCmsLoading() {
  return (
    <div className="bg-background text-foreground animate-pulse">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton */}
          <div className="mb-4 sm:mb-6 flex items-center justify-between">
            <div className="h-8 sm:h-9 w-48 sm:w-64 bg-muted/70 rounded-lg" />
            <div className="h-7 w-20 bg-muted/50 rounded-lg" />
          </div>

          {/* Dynamic Content Skeletons */}
          <div className="mt-1 sm:mt-2 space-y-4 sm:space-y-6">
            {/* Skeleton 1: Grid card with Image and Content */}
            <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col lg:bg-transparent lg:border-0 lg:shadow-none lg:p-0 lg:rounded-none lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
              {/* Image Skeleton */}
              <div className="w-full order-1 lg:order-1 lg:bg-card lg:border lg:border-border lg:rounded-2xl lg:p-6 lg:shadow-xs">
                <div className="w-full aspect-[600/400] rounded-xl bg-muted/60" />
              </div>
              {/* Text Skeleton */}
              <div className="w-full order-2 mt-4 sm:mt-5 lg:mt-0 lg:order-2 lg:bg-card lg:border lg:border-border lg:rounded-2xl lg:p-6 lg:shadow-xs space-y-3">
                <div className="h-6 w-1/2 bg-muted/60 rounded mb-3" />
                <div className="h-4 w-full bg-muted/50 rounded" />
                <div className="h-4 w-11/12 bg-muted/50 rounded" />
                <div className="h-4 w-4/5 bg-muted/50 rounded" />
                <div className="h-4 w-full bg-muted/40 rounded" />
                <div className="h-4 w-5/6 bg-muted/40 rounded" />
              </div>
            </div>

            {/* Skeleton 2: Clean content card */}
            <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 sm:p-8 shadow-xs space-y-3.5">
              <div className="h-6 w-1/3 bg-muted/60 rounded mb-4" />
              <div className="h-4 w-full bg-muted/50 rounded" />
              <div className="h-4 w-11/12 bg-muted/50 rounded" />
              <div className="h-4 w-4/5 bg-muted/50 rounded" />
              <div className="h-4 w-full bg-muted/40 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

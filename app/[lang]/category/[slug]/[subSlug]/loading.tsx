export default function Loading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header Skeleton */}
          <div className="relative flex items-center justify-center mb-6 w-full min-h-[40px]">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-ag-subheader-border animate-pulse"></div>
              <div className="hidden sm:block h-6 w-16 bg-ag-subheader-border rounded animate-pulse"></div>
            </div>
            <div className="h-8 sm:h-10 bg-ag-subheader-border rounded-md w-48 sm:w-64 animate-pulse"></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="rounded-xl overflow-hidden bg-background border border-ag-header-border shadow-sm flex flex-col">
              <div className="w-full aspect-square bg-ag-subheader-border animate-pulse" />
              <div className="p-2 flex flex-col flex-1 gap-1.5">
                <div className="h-4 sm:h-5 bg-ag-subheader-border rounded w-3/4 mx-auto animate-pulse mb-0.5" />
                
                <div className="mt-auto space-y-1.5">
                  <div className="h-6 sm:h-8 bg-ag-subheader-border rounded animate-pulse w-full" />
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="h-6 sm:h-8 bg-ag-subheader-border rounded animate-pulse" />
                    <div className="h-6 sm:h-8 bg-ag-subheader-border rounded animate-pulse" />
                  </div>
                  <div className="h-6 sm:h-8 bg-ag-subheader-border rounded animate-pulse w-full mt-0.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  )
}

import { PageHeader } from '@/components/ui/PageHeader'

export default function Loading() {
  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
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

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 px-2 sm:px-0">
            {Array.from({ length: 8 }).map((_, index) => (
              <div 
                key={index} 
                className="flex flex-col rounded-xl bg-background border border-ag-header-border overflow-hidden shadow-sm"
              >
                {/* Image Skeleton */}
                <div className="relative w-full aspect-[16/10] bg-ag-subheader-border animate-pulse border-b border-ag-header-border block">
                </div>
                
                <div className="px-2 sm:px-3 py-2 sm:py-2.5 flex flex-col gap-2">
                  {/* Title Skeleton */}
                  <div className="h-5 sm:h-6 bg-ag-subheader-border rounded w-3/4 animate-pulse mt-1"></div>
                  
                  {/* Footer Skeleton */}
                  <div className="flex items-center justify-between mt-1">
                    <div className="h-4 bg-ag-subheader-border rounded w-16 animate-pulse"></div>
                    <div className="h-4 w-4 bg-ag-subheader-border rounded-full animate-pulse"></div>
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

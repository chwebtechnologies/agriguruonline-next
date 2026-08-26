import { PageHeader } from '@/components/ui/PageHeader'

export default function ProductChartsLoading() {
  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Product Charts" backText="Back" />

          <div className="mt-4">
            {/* Search and Filters Skeleton */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="h-10 w-full sm:w-64 bg-ag-header-border/50 rounded-lg animate-pulse"></div>
              <div className="flex gap-2">
                <div className="h-10 w-24 bg-ag-header-border/50 rounded-lg animate-pulse"></div>
                <div className="h-10 w-24 bg-ag-header-border/50 rounded-lg animate-pulse"></div>
              </div>
            </div>

            {/* Charts Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex flex-col rounded-xl bg-background border border-ag-header-border overflow-hidden shadow-sm animate-pulse">
                  <div className="p-4 border-b border-ag-header-border">
                    <div className="h-5 w-3/4 bg-ag-header-border/50 rounded mb-2"></div>
                    <div className="h-4 w-1/2 bg-ag-header-border/50 rounded"></div>
                  </div>
                  <div className="w-full aspect-video bg-ag-header-border/30"></div>
                  <div className="p-4">
                    <div className="h-8 w-full bg-ag-header-border/50 rounded mb-3"></div>
                    <div className="flex justify-between">
                      <div className="h-4 w-1/3 bg-ag-header-border/50 rounded"></div>
                      <div className="h-4 w-1/4 bg-ag-header-border/50 rounded"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

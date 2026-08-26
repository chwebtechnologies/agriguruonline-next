import { PageHeader } from '@/components/ui/PageHeader'
import ListingFilters from '@/components/shared/ListingFilters'

export default function SubCategoryLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <div className="animate-pulse mb-6">
            <div className="h-10 w-48 bg-ag-header-border/50 rounded-lg"></div>
          </div>
          
          <ListingFilters categories={[]} />

          {/* Products Grid Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 mt-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="group flex flex-col rounded-2xl bg-card border border-ag-header-border overflow-hidden shadow-xs animate-pulse"
              >
                <div className="relative w-full aspect-square bg-ag-header-border/50 border-b border-ag-header-border"></div>

                <div className="p-2 sm:p-3 flex flex-col flex-1 items-center justify-between">
                  <div className="h-4 w-3/4 bg-ag-header-border/50 rounded mb-4"></div>
                  
                  <div className="w-full flex items-center justify-center gap-2">
                    <div className="h-8 w-1/2 bg-ag-header-border/50 rounded-lg"></div>
                    <div className="h-8 w-1/2 bg-ag-header-border/50 rounded-lg"></div>
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

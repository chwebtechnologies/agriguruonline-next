import { PageHeader } from '@/components/ui/PageHeader'

export default function MarketUpdatesLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Market Updates" backText="Back" />
          
          {/* ListingFilters Skeleton */}
          <div className="mb-4 flex flex-wrap gap-2 animate-pulse mt-4">
            <div className="h-10 w-24 bg-muted rounded-full"></div>
            <div className="h-10 w-32 bg-muted rounded-full"></div>
            <div className="h-10 ml-auto w-48 bg-muted rounded-lg"></div>
          </div>

          {/* MarketUpdatesGrid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs animate-pulse"
              >
                <div className="w-full aspect-[794/1120] bg-muted border-b border-border"></div>
                <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
                  <div className="w-full h-5 rounded bg-muted mb-2"></div>
                  <div className="w-3/4 h-5 rounded bg-muted mb-4"></div>
                  <div className="w-full h-3 rounded bg-muted mb-1.5"></div>
                  <div className="w-full h-3 rounded bg-muted mb-1.5"></div>
                  <div className="w-4/5 h-3 rounded bg-muted mb-4"></div>
                  <div className="flex items-center justify-between mt-auto border-t border-border pt-3">
                    <div className="w-20 h-4 rounded bg-muted"></div>
                    <div className="w-6 h-6 rounded-full bg-muted"></div>
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

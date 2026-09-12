import { PageHeader } from '@/components/ui/PageHeader'

export default function NewsLoading() {
  return (
    <div data-skeleton-wrapper className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Latest News" backText="Back" />
          
          {/* ListingFilters Skeleton */}
          <div className="flex flex-row gap-2 sm:gap-3 w-full mt-4 mb-2 animate-pulse">
            <div className="w-1/2">
              <div className="w-full h-[46px] bg-muted rounded-xl"></div>
            </div>
            <div className="w-1/2">
              <div className="w-full h-[46px] bg-muted rounded-xl"></div>
            </div>
          </div>

          {/* NewsGrid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs animate-pulse"
              >
                <div className="w-full aspect-[3/2] bg-muted border-b border-border"></div>
                <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
                  <div className="flex items-center mb-2">
                    <div className="w-4 h-4 rounded bg-muted mr-2"></div>
                    <div className="w-24 h-3 rounded bg-muted"></div>
                  </div>
                  <div className="w-full h-5 rounded bg-muted mb-2"></div>
                  <div className="w-3/4 h-5 rounded bg-muted mb-4"></div>
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

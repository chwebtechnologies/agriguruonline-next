import { PageHeader } from '@/components/ui/PageHeader'

export default function EventsLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Latest Events" backText="Back" />
          
          {/* ListingFilters Skeleton */}
          <div className="mb-4 flex flex-wrap gap-2 animate-pulse mt-4">
            <div className="h-10 w-24 bg-foreground/10 rounded-full"></div>
            <div className="h-10 w-32 bg-foreground/10 rounded-full"></div>
            <div className="h-10 w-28 bg-foreground/10 rounded-full"></div>
            <div className="h-10 ml-auto w-48 bg-foreground/10 rounded-lg"></div>
          </div>

          {/* EventsGrid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mt-2">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col rounded-xl bg-background border border-foreground/10 overflow-hidden h-full shadow-sm animate-pulse"
              >
                <div className="w-full aspect-[16/9] bg-foreground/10 border-b border-foreground/10"></div>
                <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
                  <div className="w-32 h-3 rounded bg-foreground/10 mb-3"></div>
                  <div className="w-full h-5 rounded bg-foreground/10 mb-2"></div>
                  <div className="w-3/4 h-5 rounded bg-foreground/10 mb-4"></div>
                  <div className="w-full h-3 rounded bg-foreground/10 mb-1.5"></div>
                  <div className="w-full h-3 rounded bg-foreground/10 mb-1.5"></div>
                  <div className="w-4/5 h-3 rounded bg-foreground/10 mb-4"></div>
                  <div className="flex items-center justify-between mt-auto border-t border-foreground/10 pt-3">
                    <div className="w-24 h-4 rounded bg-foreground/10"></div>
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

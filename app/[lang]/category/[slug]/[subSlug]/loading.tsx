import { PageHeader } from '@/components/ui/PageHeader'

export default function SubCategoryLoading() {
  return (
    <div data-skeleton-wrapper className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Products" backText="Back" />

          {/* Products Grid Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mt-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs animate-pulse"
              >
                <div className="relative w-full aspect-square bg-muted border-b border-border"></div>

                <div className="p-2 sm:p-3 flex flex-col flex-1">
                  <div className="h-4 sm:h-5 bg-muted rounded w-3/4 mx-auto mb-3"></div>

                  <div className="mt-auto space-y-1.5">
                    <div className="h-8 bg-muted rounded-lg w-full"></div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="h-8 bg-muted rounded-lg"></div>
                      <div className="h-8 bg-muted rounded-lg"></div>
                    </div>
                    <div className="h-8 bg-muted rounded-lg w-full mt-0.5"></div>
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

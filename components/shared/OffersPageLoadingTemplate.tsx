import { PageHeader } from '@/components/ui/PageHeader'

interface OffersPageLoadingTemplateProps {
  pageTitle: string
}

export function OffersPageLoadingTemplate({ pageTitle }: OffersPageLoadingTemplateProps) {
  return (
    <div data-skeleton-wrapper className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={pageTitle} backText="Back" />

          {/* Search Skeleton */}
          <div className="h-10 w-full animate-pulse bg-muted rounded-xl mt-4 mb-2"></div>

          <div className="bg-card border border-border rounded-2xl p-3 sm:p-5 lg:p-6 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="group flex flex-col rounded-xl bg-muted/40 border border-border/50 overflow-hidden animate-pulse"
                >
                  <div className="px-4 py-3 sm:py-4">
                    <div className="grid grid-cols-[65px_1fr] sm:grid-cols-[75px_1fr] gap-x-2 gap-y-3">
                      {/* Row 1: Country */}
                      <div className="text-muted-foreground font-medium text-[12px] sm:text-[13px] self-center">Country:</div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 sm:w-20 h-4 bg-muted rounded"></div>
                          <div className="w-[16px] h-[11px] bg-muted rounded-sm"></div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-8 h-4 bg-muted rounded"></div>
                          <div className="w-20 sm:w-24 h-4 bg-muted rounded"></div>
                        </div>
                      </div>
                      
                      {/* Row 2: Product */}
                      <div className="text-muted-foreground font-medium text-[12px] sm:text-[13px] self-center">Product:</div>
                      <div className="w-3/4 h-4 bg-muted rounded"></div>
                      
                      {/* Row 3: Price & Buy */}
                      <div className="text-muted-foreground font-medium text-[12px] sm:text-[13px] self-center">Price:</div>
                      <div className="flex items-center justify-between">
                        <div className="w-20 sm:w-24 h-4 bg-muted rounded"></div>
                        <div className="w-[60px] sm:w-[68px] h-[28px] sm:h-[32px] bg-muted rounded"></div>
                      </div>
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

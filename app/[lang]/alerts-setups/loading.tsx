import { PageHeader } from '@/components/ui/PageHeader'

export default function Loading() {
  return (
    <div data-skeleton-wrapper className="bg-background text-foreground transition-theme pb-5">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Alerts Setups" backText="Back" />
          
          <div className="flex flex-col gap-4 sm:gap-5">
            {/* Top Action Bar Skeleton */}
            <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 shadow-sm h-[68px] sm:h-[80px] animate-pulse">
              <div className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 bg-muted rounded-lg"></div>
              <div className="flex-1">
                <div className="h-11 sm:h-12 bg-muted rounded-lg w-full"></div>
              </div>
            </div>

            {/* Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl shadow-sm p-4 sm:p-5 flex items-stretch gap-4 sm:gap-5 h-[116px] sm:h-[132px]">
                  {/* Left Column Skeleton */}
                  <div className="flex flex-col items-center shrink-0 w-6">
                    <div className="h-6 w-6 sm:h-7 sm:w-7 bg-muted rounded-full"></div>
                    <div className="flex-1"></div>
                    <div className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] bg-muted rounded"></div>
                  </div>
                  
                  {/* Right Column Skeleton */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-center h-6 sm:h-7">
                      <div className="h-4 bg-muted rounded w-1/3"></div>
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                    </div>
                    <div className="flex justify-between items-center mt-2 sm:mt-1.5 h-[24px] sm:h-[30px]">
                      <div className="h-5 sm:h-6 bg-muted rounded w-2/3"></div>
                      <div className="h-5 sm:h-6 bg-muted rounded w-1/4"></div>
                    </div>
                    <div className="flex justify-between items-center mt-3 sm:mt-2.5 h-[18px] sm:h-[22px]">
                      <div className="h-4 bg-muted rounded w-2/5"></div>
                      <div className="h-4 bg-muted rounded w-1/5"></div>
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

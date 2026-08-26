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
              <div className="h-10 w-full sm:w-64 bg-muted rounded-lg animate-pulse"></div>
              <div className="flex gap-2">
                <div className="h-10 w-24 bg-muted rounded-lg animate-pulse"></div>
                <div className="h-10 w-24 bg-muted rounded-lg animate-pulse"></div>
              </div>
            </div>

            {/* Mobile/Tablet List Skeleton (Hidden on lg) */}
            <div className="flex flex-col gap-[7px] lg:hidden">
              {[...Array(6)].map((_, i) => (
                <div key={`mob-${i}`} className="flex flex-col rounded-xl bg-card border border-border overflow-hidden shadow-sm animate-pulse p-3">
                  {/* Row 1 */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="h-3 w-20 bg-muted rounded"></div>
                    <div className="h-3 w-16 bg-muted rounded"></div>
                  </div>
                  {/* Row 2 */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="h-4 w-32 bg-muted rounded"></div>
                    <div className="h-4 w-24 bg-muted rounded"></div>
                  </div>
                  {/* Row 3 */}
                  <div className="flex justify-between items-center">
                    <div className="h-3 w-16 bg-muted rounded"></div>
                    <div className="h-3 w-28 bg-muted rounded"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Row Skeleton (Visible on lg) */}
            <div className="hidden lg:flex flex-col gap-2">
              {[...Array(8)].map((_, i) => (
                <div key={`desk-${i}`} className="grid grid-cols-[1.1fr_1.2fr_2fr_1.1fr_0.9fr_1.2fr_1.1fr_1fr_1fr_0.8fr_1.4fr] gap-2 items-center px-4 py-3.5 rounded-lg bg-card shadow-sm border border-border animate-pulse">
                  <div className="h-4 w-full bg-muted rounded"></div>
                  <div className="h-4 w-5/6 bg-muted rounded"></div>
                  <div className="h-4 w-full bg-muted rounded"></div>
                  <div className="h-4 w-3/4 bg-muted rounded"></div>
                  <div className="h-4 w-4/5 bg-muted rounded"></div>
                  <div className="h-4 w-full bg-muted rounded"></div>
                  <div className="h-4 w-3/4 bg-muted rounded"></div>
                  <div className="h-4 w-4/5 bg-muted rounded"></div>
                  <div className="h-4 w-full bg-muted rounded"></div>
                  <div className="h-4 w-1/2 mx-auto bg-muted rounded"></div>
                  <div className="h-7 w-20 ml-auto bg-muted rounded-full"></div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

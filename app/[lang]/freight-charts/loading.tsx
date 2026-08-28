import { PageHeader } from '@/components/ui/PageHeader'

export default function Loading() {
  const gridCols = 'grid-cols-[1.2fr_1.4fr_1.4fr_0.9fr_1fr_0.9fr_0.7fr_1.3fr]'

  return (
    <div data-skeleton-wrapper className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-0 sm:pt-1.5 pb-4">
          <PageHeader title="Freight Charts" backText="Back" />

          <div className="mt-0 sm:mt-1.5">
            <div className="w-full overflow-visible">
              {/* Desktop Filter Row Skeleton */}
              <div className={`hidden lg:grid ${gridCols} gap-1.5 mb-1.5 items-end pt-1 pb-1 px-0 animate-pulse`}>
                <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
                <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
                <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
                <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
                <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
                <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
                <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
                <div className="w-full h-[45px] rounded-lg bg-muted"></div>
              </div>

              {/* Mobile/Tablet List Skeleton (lg:hidden) */}
              <div className="flex flex-col gap-[7px] lg:hidden">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={`mob-${i}`}
                    className="flex flex-col p-3 bg-card rounded-2xl border border-border shadow-xs animate-pulse"
                  >
                    <div className="flex justify-between items-center">
                      <div className="h-3.5 w-24 bg-muted rounded"></div>
                      <div className="h-3.5 w-28 bg-muted rounded"></div>
                    </div>
                    <div className="flex justify-between items-center gap-3 mt-2.5">
                      <div className="h-4 w-36 bg-muted rounded"></div>
                      <div className="h-4 w-28 bg-muted rounded"></div>
                    </div>
                    <div className="flex justify-between items-center mt-2.5">
                      <div className="h-3.5 w-20 bg-muted rounded"></div>
                      <div className="h-3.5 w-16 bg-muted rounded"></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table Rows Skeleton (hidden lg:flex) */}
              <div className="hidden lg:flex flex-col gap-[7px] lg:gap-2 mt-0.5 lg:mt-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={`desk-${i}`}
                    className={`grid ${gridCols} gap-1.5 items-center px-3.5 py-3.5 rounded-lg ${
                      i % 2 === 0 ? 'bg-card' : 'bg-[#eef3f8] dark:bg-[#202630]'
                    } shadow-xs border border-border text-sm animate-pulse`}
                  >
                    <div className="h-4 w-24 bg-muted rounded min-w-0"></div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border"></div>
                      <div className="h-4 w-20 bg-muted rounded"></div>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border"></div>
                      <div className="h-4 w-20 bg-muted rounded"></div>
                    </div>
                    <div className="h-4 w-14 mx-auto bg-muted rounded min-w-0"></div>
                    <div className="h-4 w-14 mx-auto bg-muted rounded min-w-0"></div>
                    <div className="h-4 w-12 mx-auto bg-muted rounded min-w-0"></div>
                    <div className="w-5 h-5 mx-auto bg-muted rounded min-w-0"></div>
                    <div className="flex items-center justify-end gap-2.5 min-w-0">
                      <div className="h-7 w-16 bg-muted rounded-full min-w-0"></div>
                      <div className="w-6 h-6 bg-muted rounded min-w-0"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

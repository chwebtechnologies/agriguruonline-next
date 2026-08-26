import { PageHeader } from '@/components/ui/PageHeader'

export default function ProductChartsLoading() {
  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Product Charts" backText="Back" />

          <div className="mt-4 w-full overflow-visible">
            {/* Top Marketed Products Ticker Skeleton */}
            <div className="w-full bg-card rounded-md border border-border mb-4 h-10 flex items-center shadow-sm px-4 animate-pulse">
              <div className="h-4 w-64 bg-muted rounded"></div>
            </div>

            {/* Desktop Filter Row Skeleton (Visible on Desktop) */}
            <div className="hidden lg:grid grid-cols-[1.1fr_1.2fr_2fr_1.1fr_0.9fr_1.2fr_1.1fr_1fr_1fr_0.8fr_1.4fr] gap-2 mb-3 items-end py-2 px-0 animate-pulse">
              <div className="w-full h-10 rounded-md border border-border bg-card"></div>
              <div className="w-full h-10 rounded-md border border-border bg-card"></div>
              <div className="w-full h-10 rounded-md border border-border bg-card"></div>
              <div className="w-full h-10 rounded-md border border-border bg-card"></div>
              <div className="w-full h-10 rounded-md border border-border bg-card"></div>
              <div className="w-full h-10 rounded-md border border-border bg-card"></div>
              <div className="w-full h-10 rounded-md border border-border bg-card"></div>
              <div className="w-full h-10 rounded-md border border-border bg-card"></div>
              <div className="w-full h-10 rounded-md border border-border bg-card"></div>
              <div className="w-full h-10 rounded-md border border-border bg-card"></div>
              <div className="w-full h-10 rounded-md bg-muted"></div>
            </div>

            {/* Mobile/Tablet List Skeleton (lg:hidden) */}
            <div className="flex flex-col gap-[7px] lg:hidden">
              {[...Array(6)].map((_, i) => (
                <div
                  key={`mob-${i}`}
                  className="flex flex-col p-2 bg-card rounded-xl border border-border shadow-xs animate-pulse"
                >
                  {/* Row 1: Origins and POD */}
                  <div className="flex justify-between items-center text-[12px]">
                    <div className="h-3 w-20 bg-muted rounded"></div>
                    <div className="h-3 w-24 bg-muted rounded"></div>
                  </div>

                  {/* Row 2: Product Name & Price */}
                  <div className="flex justify-between items-center gap-3 mt-1.5">
                    <div className="h-4 w-32 bg-muted rounded"></div>
                    <div className="h-4 w-16 bg-muted rounded"></div>
                  </div>

                  {/* Row 3: POL, ShipBy, Change */}
                  <div className="flex justify-between items-center text-[12px] mt-1">
                    <div className="h-3 w-20 bg-muted rounded"></div>
                    <div className="h-3 w-24 bg-muted rounded"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Rows Skeleton (hidden lg:flex) */}
            <div className="hidden lg:flex flex-col gap-[7px] lg:gap-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={`desk-${i}`}
                  className="grid grid-cols-[1.1fr_1.2fr_2fr_1.1fr_0.9fr_1.2fr_1.1fr_1fr_1fr_0.8fr_1.4fr] gap-2 items-center px-4 py-3.5 rounded-lg bg-card shadow-sm border border-border text-sm animate-pulse"
                >
                  <div className="h-4 w-3/4 bg-muted rounded min-w-0"></div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border"></div>
                    <div className="h-4 w-16 bg-muted rounded"></div>
                  </div>
                  <div className="h-4 w-full bg-muted rounded min-w-0"></div>
                  <div className="h-4 w-12 bg-muted rounded min-w-0"></div>
                  <div className="h-4 w-10 mx-auto bg-muted rounded min-w-0"></div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border"></div>
                    <div className="h-4 w-12 bg-muted rounded"></div>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border"></div>
                    <div className="h-4 w-12 bg-muted rounded"></div>
                  </div>
                  <div className="h-4 w-12 mx-auto bg-muted rounded min-w-0"></div>
                  <div className="h-4 w-12 mx-auto bg-muted rounded min-w-0"></div>
                  <div className="w-5 h-5 mx-auto bg-muted rounded min-w-0"></div>
                  <div className="h-7 w-16 ml-auto bg-muted rounded-full min-w-0"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

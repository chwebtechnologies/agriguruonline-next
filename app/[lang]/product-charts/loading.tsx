import { PageHeader } from '@/components/ui/PageHeader'

export default function ChartsLoading() {
  const gridCols = "grid-cols-[1.1fr_1.2fr_2fr_1.1fr_0.9fr_1.2fr_1.1fr_1fr_1fr_0.8fr_1.4fr]";

  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Product Charts" backText="Back" />

          <div className="mt-4">
            <div className="w-full overflow-visible">
              
              {/* Marquee Skeleton */}
              <div className="overflow-hidden whitespace-nowrap w-full bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 mb-4 flex items-center shadow-sm h-10">
                <div className="flex items-center gap-6 px-4 w-full overflow-hidden">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 shrink-0">
                      <div className="w-5 h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded-[2px] animate-pulse"></div>
                      <div className="h-3.5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div>
                      <div className="h-3.5 w-12 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div>
                      <div className="h-3.5 w-10 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full">
                {/* Desktop View (Hidden on mobile) */}
                <div className="hidden lg:block">
                  {/* Header Row Skeletons */}
                  <div className={`grid ${gridCols} gap-2 mb-3 items-end`}>
                    {[...Array(11)].map((_, i) => (
                      <div key={i} className="h-10 rounded-md bg-zinc-200 dark:bg-zinc-800 animate-pulse"></div>
                    ))}
                  </div>

                  {/* Data Row Skeletons */}
                  <div className="mt-2 min-h-[240px]">
                    <div className="flex flex-col gap-2.5">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className={`grid ${gridCols} gap-2 items-center px-4 py-3.5 rounded-lg bg-white dark:bg-[#1a1a1c] shadow-sm border border-zinc-200/80 dark:border-zinc-800 animate-pulse`}>
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4"></div>
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3"></div>
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-4/5"></div>
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3 mx-auto"></div>
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3"></div>
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3"></div>
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2 mx-auto"></div>
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2 mx-auto"></div>
                          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-6 mx-auto"></div>
                          <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded-full w-16 ml-auto"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Mobile View (Hidden on desktop) */}
                <div className="lg:hidden flex flex-col">
                  {/* Global Actions Bar Skeleton */}
                  <div className="flex justify-between items-center pt-4 pb-2">
                    <div className="h-[38px] w-[130px] bg-zinc-200 dark:bg-zinc-800 rounded-md animate-pulse"></div>
                    <div className="h-[22px] w-[22px] bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse"></div>
                    <div className="w-[45px] h-[45px] rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse"></div>
                  </div>

                  {/* Mobile Card Skeletons */}
                  <div className="mt-2 min-h-[240px]">
                    <div className="flex flex-col gap-1.5">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="relative overflow-hidden rounded-xl bg-zinc-50 dark:bg-[#1c1c1e] shadow-sm border border-zinc-200 dark:border-[#2a2a2c] animate-pulse">
                          <div className="flex flex-col p-2">
                            {/* Row 1: Origins and POD */}
                            <div className="flex justify-between items-center text-[12px]">
                              <div className="flex items-center gap-1.5">
                                <div className="w-[16px] h-[12px] rounded-[2px] bg-zinc-200 dark:bg-zinc-800"></div>
                                <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                                <div className="w-[16px] h-[12px] rounded-[2px] bg-zinc-200 dark:bg-zinc-800"></div>
                              </div>
                            </div>
                            
                            {/* Row 2: Product Name & Price */}
                            <div className="flex justify-between items-center gap-3 mt-1">
                              <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800"></div>
                              </div>
                            </div>

                            {/* Row 3: POL, ShipBy, Change */}
                            <div className="flex justify-between items-center text-[12px] mt-0.5">
                              <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                              <div className="flex items-center gap-1.5">
                                <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                                <div className="h-3 w-12 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChartsLoading() {
  const gridCols = "grid-cols-[1.1fr_1.2fr_2fr_1.1fr_0.9fr_1.2fr_1.1fr_1fr_1fr_0.8fr_1.4fr]";

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Breadcrumb Skeleton */}
          <div className="h-5 w-44 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-3"></div>
          
          {/* Header Title Skeleton */}
          <div className="h-8 w-56 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse mb-6"></div>
          
          <div className="mt-4 px-2 sm:px-0">
            <div className="w-full overflow-visible">
              <div className="w-full">
                {/* Header Row Skeletons */}
                <div className={`grid ${gridCols} gap-2 mb-3 items-center px-0`}>
                  {[...Array(11)].map((_, i) => (
                    <div key={i} className="h-10 rounded-md bg-zinc-200 dark:bg-zinc-800 animate-pulse"></div>
                  ))}
                </div>

                {/* Data Row Skeletons */}
                <div className="mt-2 flex flex-col gap-2.5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`grid ${gridCols} gap-2 items-center px-4 py-3.5 rounded-lg bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200/80 dark:border-zinc-800 animate-pulse`}>
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
          </div>
        </div>
      </div>
    </div>
  );
}

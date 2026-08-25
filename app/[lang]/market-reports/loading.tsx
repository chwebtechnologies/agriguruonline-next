import React from 'react'

export default function MarketReportsLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <div className="mb-6 animate-pulse">
            <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 mb-6 animate-pulse">
            <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded flex-grow"></div>
            <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded w-full md:w-64"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col bg-white dark:bg-zinc-900 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="w-full aspect-[3/2] bg-zinc-200 dark:bg-zinc-800" />
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
                  </div>
                  <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

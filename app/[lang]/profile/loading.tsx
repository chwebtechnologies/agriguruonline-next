import React from 'react'

export default function ProfileLoading() {
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <div className="mb-6 animate-pulse">
            <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 animate-pulse">
            {/* Left Column Skeleton */}
            <div className="w-full lg:w-2/3 space-y-6 lg:space-y-8">
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0"></div>
                  <div className="space-y-3 flex-grow">
                    <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4"></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4"></div>
                      <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column Skeleton */}
            <div className="w-full lg:w-1/3 space-y-6 lg:space-y-8">
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 h-32"></div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 h-48"></div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 h-64"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

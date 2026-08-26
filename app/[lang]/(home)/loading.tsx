import React from 'react'

export default function HomeLoading() {
  return (
    <div className="bg-background text-foreground animate-pulse">
      {/* Hero Skeleton */}
      <div className="w-full h-[60vh] min-h-[400px] bg-zinc-200 dark:bg-zinc-800 relative">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <div className="h-10 md:h-16 bg-white/20 rounded-md w-3/4 max-w-2xl mb-4"></div>
          <div className="h-6 md:h-8 bg-white/20 rounded-md w-1/2 max-w-lg mb-8"></div>
          <div className="h-12 bg-white/20 rounded-full w-full max-w-md"></div>
        </div>
      </div>
      
      {/* Categories Skeleton */}
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-48 mb-8 mx-auto"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col items-center p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-800 mb-4"></div>
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

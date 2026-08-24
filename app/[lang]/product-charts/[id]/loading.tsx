import React from 'react';

export default function Loading() {
  return (
    <main className="bg-white dark:bg-[#121214] text-foreground min-h-[100dvh] w-full flex flex-col items-center">
      <div className="w-full max-w-lg min-h-[100dvh] flex flex-col bg-white dark:bg-[#121214] border-x border-zinc-100 dark:border-zinc-800 shadow-sm animate-pulse">
        {/* Top Header skeleton */}
        <div className="shrink-0 px-4 pt-3.5 pb-2.5 flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800"></div>
            <div className="space-y-1.5">
              <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              <div className="h-3 w-24 bg-zinc-100 dark:bg-zinc-800/60 rounded"></div>
            </div>
          </div>
          <div className="space-y-1.5 flex flex-col items-end">
            <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
            <div className="h-3 w-12 bg-zinc-100 dark:bg-zinc-800/60 rounded"></div>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="shrink-0 flex items-center px-4 py-2.5 gap-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          <div className="h-4 w-16 bg-zinc-100 dark:bg-zinc-800/50 rounded"></div>
          <div className="h-4 w-20 bg-zinc-100 dark:bg-zinc-800/50 rounded"></div>
          <div className="h-4 w-16 bg-zinc-100 dark:bg-zinc-800/50 rounded"></div>
        </div>

        {/* Chart card skeleton */}
        <div className="p-3 space-y-3">
          <div className="w-full bg-[#f8fafc] dark:bg-[#18181b] rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-4 space-y-4">
            <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto"></div>
            <div className="h-[200px] w-full bg-zinc-200/50 dark:bg-zinc-800/40 rounded-xl"></div>
            <div className="flex justify-around pt-2">
              <div className="h-3 w-6 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              <div className="h-3 w-6 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              <div className="h-3 w-6 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              <div className="h-3 w-6 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              <div className="h-3 w-6 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';

export default function Loading() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Chart Details" backText="Back" />
          <div className="mt-4 px-2 sm:px-0">
            <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 animate-pulse">
              <div className="h-6 w-48 bg-zinc-200 dark:bg-zinc-800 rounded mb-6"></div>
              <div className="h-8 w-full max-w-md bg-zinc-200 dark:bg-zinc-800 rounded-full mb-8 mx-auto"></div>
              <div className="h-[380px] w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-xl mb-4"></div>
              <div className="h-4 w-72 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

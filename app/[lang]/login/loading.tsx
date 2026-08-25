import React from "react";

export default function LoginLoading() {
  return (
    <div className="bg-background text-foreground min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 p-8 animate-pulse">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
        </div>
        <div className="h-6 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto mb-2" />
        <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto mb-8" />
        
        <div className="space-y-4">
          <div className="h-10 w-full bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-10 w-full bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-12 w-full bg-zinc-200 dark:bg-zinc-800 rounded-md mt-6" />
        </div>
      </div>
    </div>
  );
}

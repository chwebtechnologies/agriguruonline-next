'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-24 text-center">
      <div className="space-y-6 max-w-md w-full">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-red-600 dark:text-red-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Something went wrong!
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-base">
            We apologize for the inconvenience. An unexpected error has occurred on this page.
          </p>
        </div>
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center h-12 px-8 text-sm font-medium transition-all duration-200 rounded-full bg-[#1D92EB] text-white hover:bg-[#157dc9] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#1D92EB] focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
          >
            <i className="fa-solid fa-rotate-right mr-2" />
            Try again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center h-12 px-8 text-sm font-medium transition-all duration-200 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#1D92EB] focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
          >
            <i className="fa-solid fa-home mr-2" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}

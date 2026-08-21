'use client'

export default function GlobalError({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
          integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen px-6 py-24 text-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans">
          <div className="space-y-6 max-w-md w-full">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
              <i className="fa-solid fa-triangle-exclamation text-2xl text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Critical Error
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-base">
                A critical error occurred while loading the application.
              </p>
            </div>
            <div className="pt-8 flex justify-center">
              <button
                onClick={() => reset()}
                className="inline-flex items-center justify-center h-12 px-8 text-sm font-medium transition-all duration-200 rounded-full bg-[#1D92EB] text-white hover:bg-[#157dc9] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#1D92EB] focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
              >
                <i className="fa-solid fa-rotate-right mr-2" />
                Try again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

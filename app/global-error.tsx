'use client'

export default function GlobalError({
   
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
      <body className="bg-background text-foreground transition-colors duration-200">
        <div className="flex flex-col items-center justify-center min-h-screen px-6 py-24 text-center bg-background text-foreground font-sans">
          <div className="space-y-6 max-w-md w-full">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-6">
              <i className="fa-solid fa-triangle-exclamation text-2xl text-[#DB5F67]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Critical Error
              </h2>
              <p className="text-foreground/80 text-sm md:text-base">
                A critical error occurred while loading the application.
              </p>
              {error && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-950/60 rounded text-red-800 dark:text-red-200 text-xs font-mono break-all text-left">
                  {error.message || String(error)}
                </div>
              )}
            </div>
            <div className="pt-8 flex justify-center">
              <button
                onClick={() => reset()}
                className="inline-flex items-center justify-center h-12 px-8 text-sm font-medium transition-all duration-200 rounded-full bg-brand-blue text-white hover:opacity-90 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
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

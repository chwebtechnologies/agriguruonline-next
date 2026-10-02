'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isArabic = typeof window !== 'undefined' && window.location.pathname.startsWith('/ar');
  const isFrench = typeof window !== 'undefined' && window.location.pathname.startsWith('/fr');
  const isChinese = typeof window !== 'undefined' && window.location.pathname.startsWith('/zh');
  
  const dict = {
    critical_error: isArabic ? 'خطأ فادح' : isFrench ? 'Erreur critique' : isChinese ? '严重错误' : 'Critical Error',
    error_desc: isArabic ? 'حدث خطأ فادح أثناء تحميل التطبيق.' : isFrench ? 'Une erreur critique sest produite lors du chargement de lapplication.' : isChinese ? '加载应用程序时发生严重错误。' : 'A critical error occurred while loading the application.',
    try_again: isArabic ? 'حاول مرة أخرى' : isFrench ? 'Réessayer' : isChinese ? '重试' : 'Try again'
  };

  return (
    <html lang="en">
      <body className="bg-background text-foreground transition-colors duration-200">
        <div className="flex flex-col items-center justify-center min-h-screen px-6 py-24 text-center bg-background text-foreground font-sans">
          <div className="space-y-6 max-w-md w-full">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-[#DB5F67]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {dict.critical_error}
              </h2>
              <p className="text-foreground/80 text-sm md:text-base">
                {dict.error_desc}
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
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {dict.try_again}
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

'use client'
import '@fortawesome/fontawesome-free/css/all.min.css'

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
              <i className="fa-solid fa-triangle-exclamation text-2xl text-[#DB5F67]" />
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
                <i className="fa-solid fa-rotate-right mr-2" />
                {dict.try_again}
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

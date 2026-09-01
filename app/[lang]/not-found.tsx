import Link from 'next/link'
import { headers } from 'next/headers'
import { getDictionary } from '@/app/[lang]/dictionaries'

export default async function NotFound() {
  const headersList = await headers()
  const pathname = headersList.get('x-invoke-path') || ''
  const activeLang = (pathname.split('/')[1] || 'en') as 'en' | 'ar' | 'fr' | 'zh'
  
  let dict: any = {};
  try {
    dict = await getDictionary(activeLang)
  } catch (error) {
    console.error("Error loading dictionary for not-found page:", error)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 py-24 text-center bg-background text-foreground">
      <div className="space-y-8 max-w-lg w-full">

        {/* Code */}
        <div>
          <h1 className="text-[120px] sm:text-[160px] font-black leading-none tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-brand-blue via-sky-500 to-brand-blue-hover dark:from-sky-400 dark:via-sky-300 dark:to-sky-500">
            404
          </h1>
          <div className="mx-auto mt-2 mb-6 h-1 w-16 rounded-full bg-gradient-to-r from-brand-blue to-sky-500" />
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {dict.not_found?.title || "Page Not Found"}
          </h2>
          <p className="text-foreground/80 text-sm md:text-base leading-relaxed max-w-sm mx-auto">
            {dict.not_found?.description || "The page you're looking for doesn't exist, has been moved, or is temporarily unavailable."}
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/${activeLang}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-8 text-sm font-bold transition-all duration-200 rounded-full bg-brand-blue text-white shadow-md hover:opacity-95 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
          >
            <i className="fa-solid fa-house text-sm" />
            {dict.not_found?.return_home || "Return Home"}
          </Link>
          <Link
            href={`/${activeLang}/contact`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-8 text-sm font-semibold transition-all duration-200 rounded-full border border-border bg-card text-foreground hover:bg-muted hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
          >
            <i className="fa-solid fa-headset text-sm" />
            {dict.not_found?.contact_support || "Contact Support"}
          </Link>
        </div>

      </div>
    </div>
  )
}

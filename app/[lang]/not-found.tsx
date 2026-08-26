import Link from 'next/link'
import { lang } from 'next/root-params'

export default async function NotFound() {
  const activeLang = await lang()

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
            Page Not Found
          </h2>
          <p className="text-foreground/70 text-sm md:text-base leading-relaxed max-w-sm mx-auto">
            The page you&apos;re looking for doesn&apos;t exist, has been moved,
            or is temporarily unavailable.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/${activeLang}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-8 text-sm font-bold transition-all duration-200 rounded-full bg-brand-blue text-white shadow-md hover:opacity-95 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
          >
            <i className="fa-solid fa-house text-sm" />
            Return Home
          </Link>
          <Link
            href={`/${activeLang}/contact`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-8 text-sm font-semibold transition-all duration-200 rounded-full border border-ag-header-border bg-ag-subheader-bg text-foreground hover:bg-ag-dropdown-hover-bg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
          >
            <i className="fa-solid fa-headset text-sm" />
            Contact Support
          </Link>
        </div>

      </div>
    </div>
  )
}

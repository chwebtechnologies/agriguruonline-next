import Link from 'next/link'
import { lang } from 'next/root-params'

export default async function NotFound() {
  const activeLang = await lang()

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 py-24 text-center bg-background text-foreground">
      <div className="space-y-8 max-w-lg w-full">

        

        {/* Code */}
        <div>
          <h1 className="text-[120px] sm:text-[160px] font-black leading-none tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-[#0c5a53] via-emerald-500 to-[#1D92EB] dark:from-emerald-400 dark:via-emerald-300 dark:to-sky-400">
            404
          </h1>
          <div className="mx-auto mt-2 mb-6 h-1 w-16 rounded-full bg-gradient-to-r from-[#0c5a53] to-emerald-500" />
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Page Not Found
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-base leading-relaxed max-w-sm mx-auto">
            The page you&apos;re looking for doesn&apos;t exist, has been moved,
            or is temporarily unavailable.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/${activeLang}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-8 text-sm font-bold transition-all duration-200 rounded-full bg-gradient-to-r from-[#0c5a53] to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
          >
            <i className="fa-solid fa-house text-sm" />
            Return Home
          </Link>
          <Link
            href={`/${activeLang}/contact`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-8 text-sm font-semibold transition-all duration-200 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#0c5a53] focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
          >
            <i className="fa-solid fa-headset text-sm" />
            Contact Support
          </Link>
        </div>

      </div>
    </div>
  )
}

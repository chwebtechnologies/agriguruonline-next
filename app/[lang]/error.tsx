'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  const [lang, setLang] = useState<'en'|'ar'|'fr'|'zh'>('en')
  useEffect(() => {
    const currentLang = window.location.pathname.split('/')[1] as any
    if (['en', 'ar', 'fr', 'zh'].includes(currentLang)) {
      setLang(currentLang)
    }
  }, [])

  const dict = {
    en: {
      title: "Something went wrong!",
      desc: "We apologize for the inconvenience. An unexpected error has occurred on this page.",
      retry: "Try again",
      home: "Go Home"
    },
    ar: {
      title: "حدث خطأ ما!",
      desc: "نعتذر عن الإزعاج. حدث خطأ غير متوقع في هذه الصفحة.",
      retry: "حاول مرة أخرى",
      home: "الرئيسية"
    },
    fr: {
      title: "Quelque chose s'est mal passé !",
      desc: "Nous nous excusons pour la gêne occasionnée. Une erreur inattendue s'est produite sur cette page.",
      retry: "Réessayer",
      home: "Accueil"
    },
    zh: {
      title: "出错了！",
      desc: "对于给您带来的不便，我们深表歉意。此页面发生了意外错误。",
      retry: "重试",
      home: "返回首页"
    }
  }

  const t = dict[lang]

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-24 text-center">
      <div className="space-y-6 max-w-md w-full">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-red-600 dark:text-red-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            {t.title}
          </h2>
          <p className="text-foreground/80 text-sm md:text-base">
            {t.desc}
          </p>
        </div>
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center h-12 px-8 text-sm font-medium transition-all duration-200 rounded-full bg-brand-blue text-white hover:bg-brand-blue-hover hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
          >
            <i className="fa-solid fa-rotate-right mr-2" />
            {t.retry}
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center h-12 px-8 text-sm font-medium transition-all duration-200 rounded-full border border-border bg-card text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
          >
            <i className="fa-solid fa-home mr-2" />
            {t.home}
          </Link>
        </div>
      </div>
    </div>
  )
}

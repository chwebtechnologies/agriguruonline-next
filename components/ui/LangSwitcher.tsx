'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'

const languages = [
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'ar', name: 'العربية', short: 'AR' },
  { code: 'zh', name: '中文', short: 'ZH' },
  { code: 'fr', name: 'Français', short: 'FR' },
]

export default function LangSwitcher() {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const activeLang = (params?.lang as string) || 'en'
  const [isPending, startTransition] = useTransition()

  const getLocalizedPath = (targetLocale: string) => {
    if (!pathname) return `/${targetLocale}`
    const segments = pathname.split('/')
    // Index 0 is "", Index 1 is the language code (e.g. "en")
    if (segments.length > 1 && (segments[1] === 'en' || segments[1] === 'ar' || segments[1] === 'zh' || segments[1] === 'fr')) {
      segments[1] = targetLocale
      return segments.join('/')
    }
    return `/${targetLocale}${pathname}`
  }

  const handleLangChange = (e: React.MouseEvent, code: string) => {
    e.preventDefault()
    if (code === activeLang) return
    const path = getLocalizedPath(code)
    startTransition(() => {
      router.replace(path, { scroll: false })
    })
  }

  return (
    <div className="relative inline-block text-left" dir="ltr">
      <div className="flex items-center gap-1.5 rounded-full bg-muted/50 p-1 border border-border">
        {languages.map((lang) => (
          <Link
            key={lang.code}
            href={getLocalizedPath(lang.code)}
            prefetch={true}
            scroll={false}
            onMouseEnter={() => router.prefetch(getLocalizedPath(lang.code))}
            onClick={(e) => handleLangChange(e, lang.code)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              activeLang === lang.code
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={lang.name}
          >
            {lang.short}
          </Link>
        ))}
      </div>
    </div>
  )
}

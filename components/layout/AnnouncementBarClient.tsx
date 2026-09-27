'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Announcement {
  id: string
  title: string
  label?: string
  link?: string
  translations?: Array<{
    lang_code: string
    title: string
    label?: string
  }>
}

interface AnnouncementBarClientProps {
  announcements: Announcement[]
  dict: {
    header: {
      download_app: string
      contact_us: string
    }
  }
  activeLang: string
}

export default function AnnouncementBarClient({ announcements, dict, activeLang }: AnnouncementBarClientProps) {
  const pathname = usePathname() || '/'
  const router = useRouter()

  const [isPending, startTransition] = useTransition()
  const { theme, setTheme } = useTheme()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      setCurrentQuery(window.location.search)
    }
  }, [])

  // Keep html dir and lang attribute in sync seamlessly
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = activeLang === 'ar' ? 'rtl' : 'ltr'
      document.documentElement.lang = activeLang
    }
  }, [activeLang])

  // Auto-scroll loop for announcements
  useEffect(() => {
    if (announcements.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length)
    }, 4500)
    return () => clearInterval(interval)
  }, [announcements.length])

  const getLangUrl = (newLang: string) => {
    const p = pathname || '/'
    const s = currentQuery
    const segments = p.split('/').filter(Boolean)
    const isFirstSegmentLang = ['en', 'ar', 'zh', 'fr'].includes(segments[0])
    
    if (isFirstSegmentLang) {
      segments[0] = newLang
    } else {
      segments.unshift(newLang)
    }
    
    return '/' + segments.join('/') + s
  }

  const handleLanguageSelect = (e: React.MouseEvent, targetLang: string) => {
    e.preventDefault()
    if (targetLang === activeLang) return

    const targetUrl = getLangUrl(targetLang)
    startTransition(() => {
      router.replace(targetUrl, { scroll: false })
    })
  }

  const changeTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
  }

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
  ]

  const activeLanguage = languages.find(l => l.code === activeLang) || languages[0]
  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  const currentTheme = mounted ? theme : 'system'

  return (
    <div
      className="w-full bg-primary-gradient text-white px-4 text-sm font-semibold shadow-sm flex items-center relative z-[60] border-b border-emerald-950/20 max-h-[40px] h-10 py-2 overflow-visible"
      dir={dir}
    >
      <div className="mx-auto w-full max-w-7xl flex justify-between items-center gap-6">
        {/* Left: Dynamic Vertically Animating Announcements */}
        <div className="relative h-6 overflow-hidden flex-1 select-none text-[13.5px]">
          <div
            className="transition-transform duration-500 ease-in-out"
            style={{ transform: `translateY(-${currentIndex * 24}px)` }}
          >
            {announcements.map((ann, idx) => {
              // Extract localized translation if present
              const title = ann.title
              const label = ann.label

              return (
                <div key={ann.id || idx} className="h-6 flex items-center gap-2 truncate">
                  <span className="tracking-wide">{title}</span>
                  {label && ann.link && (
                    <a
                      href={ann.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-emerald-300 transition-colors font-extrabold whitespace-nowrap"
                      aria-label={`${label} for ${title || 'App'}`}
                    >
                      {label} <span className="sr-only">for {title || 'App'}</span>
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Sub actions */}
        <div className="flex items-center gap-5 text-[13.5px] shrink-0 font-bold">
          <Link href={`/${activeLang}/download-application`} className="hidden sm:flex items-center gap-2 hover:text-emerald-300 transition-colors">
            <i className="fa-solid fa-mobile-screen-button text-[14px]"></i>
            <span>{dict.header.download_app}</span>
          </Link>

          <Link href={`/${activeLang}/contact-us`} className="hidden sm:flex items-center gap-2 hover:text-emerald-300 transition-colors">
            <i className="fa-solid fa-headset text-[14px]"></i>
            <span>{dict.header.contact_us}</span>
          </Link>

          {/* Language Dropdown */}
          <div className="relative inline-block text-left group">
            <button
              className="flex items-center gap-2 text-white hover:text-emerald-300 transition-colors focus:outline-none cursor-pointer select-none py-1"
              aria-label="Select Language"
              onMouseEnter={() => {
                languages.forEach((l) => {
                  if (l.code !== activeLang) {
                    router.prefetch(getLangUrl(l.code))
                  }
                })
              }}
            >
              <span className="text-[15.5px] leading-none">{activeLanguage.flag}</span>
              <span>{activeLanguage.name}</span>
              {isPending ? (
                <i className="fa-solid fa-circle-notch fa-spin text-[11px] text-emerald-300"></i>
              ) : (
                <i className="fa-solid fa-chevron-down text-[10px] ml-0.5 text-emerald-300 transition-transform duration-200 group-hover:rotate-180"></i>
              )}
            </button>
            <div className={`invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute ${activeLang === 'ar' ? 'left-0' : 'right-0'} top-full mt-0 pt-2 w-36 transition-all duration-150 z-50`}>
              <div className="rounded-lg bg-card border border-border shadow-xl overflow-hidden">
                <div className="py-1">
                  {languages.map((l) => (
                    <Link
                      key={l.code}
                      href={getLangUrl(l.code)}
                      prefetch={true}
                      scroll={false}
                      onMouseEnter={() => router.prefetch(getLangUrl(l.code))}
                      onClick={(e) => handleLanguageSelect(e, l.code)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-muted transition-colors ${activeLang === l.code ? 'text-primary bg-primary/10 font-bold' : 'text-muted-foreground font-semibold'
                        }`}
                    >
                      <span className="text-[16px]">{l.flag}</span>
                      <span>{l.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Theme Switcher Bar */}
          <div className="hidden md:flex items-center gap-1.5 bg-black/35 p-0.5 rounded-full border border-white/10 shadow-inner select-none">
            <button
              onClick={() => changeTheme('system')}
              className={`p-1 rounded-full transition-all focus:outline-none flex items-center justify-center w-5 h-5 ${currentTheme === 'system' ? 'bg-white text-zinc-950 scale-105 shadow-sm' : 'text-white/80 hover:text-white hover:scale-105'
                }`}
              title="System Mode"
            >
              <i className="fa-solid fa-desktop text-[11px]"></i>
            </button>
            <button
              onClick={() => changeTheme('light')}
              className={`p-1 rounded-full transition-all focus:outline-none flex items-center justify-center w-5 h-5 ${currentTheme === 'light' ? 'bg-white text-zinc-950 scale-105 shadow-sm' : 'text-white/80 hover:text-white hover:scale-105'
                }`}
              title="Light Mode"
            >
              <i className="fa-solid fa-sun text-[11px]"></i>
            </button>
            <button
              onClick={() => changeTheme('dark')}
              className={`p-1 rounded-full transition-all focus:outline-none flex items-center justify-center w-5 h-5 ${currentTheme === 'dark' ? 'bg-white text-zinc-950 scale-105 shadow-sm' : 'text-white/80 hover:text-white hover:scale-105'
                }`}
              title="Dark Mode"
            >
              <i className="fa-solid fa-moon text-[11px]"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

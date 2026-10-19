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
  const [isTransitioning, setIsTransitioning] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [isLangOpen, setIsLangOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')

  const displayList = announcements.length === 0
    ? []
    : announcements.length === 1
      ? [announcements[0], announcements[0]]
      : [...announcements, announcements[0]]

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

  // Auto-scroll loop for announcements (continuous even for a single item)
  useEffect(() => {
    if (announcements.length === 0) return

    const interval = setInterval(() => {
      if (!isPaused) {
        setIsTransitioning(true)
        setCurrentIndex((prev) => prev + 1)
      }
    }, 3800)

    return () => clearInterval(interval)
  }, [announcements.length, isPaused])

  // Reset to index 0 smoothly without backward jump after reaching the cloned item
  useEffect(() => {
    const targetCount = announcements.length === 1 ? 1 : announcements.length
    if (targetCount <= 0) return

    if (currentIndex >= targetCount) {
      const snapTimeout = setTimeout(() => {
        setIsTransitioning(false)
        setCurrentIndex(0)
      }, 500)

      return () => clearTimeout(snapTimeout)
    }
  }, [currentIndex, announcements.length])

  // Re-enable CSS transition after the instant snap to 0
  useEffect(() => {
    if (!isTransitioning && currentIndex === 0) {
      const enableTimeout = setTimeout(() => {
        setIsTransitioning(true)
      }, 50)
      return () => clearTimeout(enableTimeout)
    }
  }, [isTransitioning, currentIndex])

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
      className="w-full bg-primary-gradient text-white text-sm font-semibold shadow-sm flex items-center relative z-[75] border-b border-emerald-950/20 max-h-[40px] h-10 py-2 overflow-visible"
      style={{ paddingLeft: 'var(--ag-container-px)', paddingRight: 'var(--ag-container-px)' }}
      dir={dir}
    >
      <div className="mx-auto w-full max-w-7xl flex justify-between items-center gap-6">
        {/* Left: Dynamic Vertically Animating Announcements */}
        <div 
          className="relative h-6 overflow-hidden flex-1 select-none text-[13.5px]"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            className={isTransitioning ? "transition-transform duration-500 ease-in-out" : ""}
            style={{ 
              transform: `translateY(-${currentIndex * 24}px)`,
              transition: isTransitioning ? undefined : 'none'
            }}
          >
            {displayList.map((ann, idx) => {
              // Extract localized translation if present
              const trans = ann.translations?.find((t) => t.lang_code === activeLang)
              const title = trans?.title || ann.title
              const label = trans?.label || ann.label
              const isExternal = Boolean(ann.link && (ann.link.startsWith('http://') || ann.link.startsWith('https://')))

              return (
                <div key={`${ann.id || 'ann'}-${idx}`} className="h-6 flex items-center gap-2.5 overflow-hidden w-full">
                  <span className="tracking-wide truncate min-w-0">{title}</span>
                  {label && ann.link && (
                    <a
                      href={ann.link}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                      className="inline-flex items-center gap-1.5 px-2.5 h-[22px] rounded-full bg-white/20 hover:bg-white text-white hover:text-emerald-950 text-xs font-bold transition-all duration-200 border border-white/25 shadow-sm whitespace-nowrap shrink-0 group cursor-pointer"
                      aria-label={`${label} for ${title || 'App'}`}
                    >
                      <span>{label}</span>
                      <i className="fa-solid fa-arrow-right text-[10px] rtl:rotate-180 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Sub actions */}
        <div className="hidden md:flex items-center gap-4 text-[13.5px] shrink-0 font-bold">
          <Link href={`/${activeLang}/download-application`} className="hidden lg:flex items-center gap-2 hover:text-emerald-300 transition-colors">
            <i className="fa-solid fa-mobile-screen-button text-[14px]"></i>
            <span>{dict.header.download_app}</span>
          </Link>

          <Link href={`/${activeLang}/contact-us`} className="hidden lg:flex items-center gap-2 hover:text-emerald-300 transition-colors">
            <i className="fa-solid fa-headset text-[14px]"></i>
            <span>{dict.header.contact_us}</span>
          </Link>

          {/* Language Dropdown - Visible on Tablet and Desktop */}
          <div className="relative inline-block text-left group">
            <button
              type="button"
              onClick={() => setIsLangOpen(!isLangOpen)}
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
                <i className={`fa-solid fa-chevron-down text-[10px] ml-0.5 text-emerald-300 transition-transform duration-200 ${isLangOpen ? 'rotate-180' : 'group-hover:rotate-180'}`}></i>
              )}
            </button>
            {isLangOpen && (
              <div 
                className="fixed inset-0 z-[105]" 
                onClick={() => setIsLangOpen(false)} 
              />
            )}
            <div className={`${isLangOpen ? 'visible opacity-100' : 'invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100'} absolute ${activeLang === 'ar' ? 'left-0' : 'right-0'} top-full mt-0 pt-2 w-36 transition-all duration-150 z-[110]`}>
              <div className="rounded-lg bg-card border border-border shadow-xl overflow-hidden">
                <div className="py-1">
                  {languages.map((l) => (
                    <Link
                      key={l.code}
                      href={getLangUrl(l.code)}
                      scroll={false}
                      onMouseEnter={() => router.prefetch(getLangUrl(l.code))}
                      onClick={(e) => {
                        setIsLangOpen(false);
                        handleLanguageSelect(e, l.code);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-muted transition-colors ${activeLang === l.code ? 'text-primary bg-primary/10 font-bold' : 'text-foreground font-semibold'
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
          <div className="flex items-center gap-1.5 bg-black/35 p-0.5 rounded-full border border-white/10 shadow-inner select-none">
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

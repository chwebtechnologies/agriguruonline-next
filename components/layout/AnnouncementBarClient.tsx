'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

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
  const pathname = usePathname()
  const router = useRouter()
  const langDropdownRef = useRef<HTMLDivElement>(null)
  
  const [isScrolled, setIsScrolled] = useState(false)
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [currentIndex, setCurrentIndex] = useState(0)

  // Scroll listener to collapse the announcement bar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Sync theme state from localStorage
  useEffect(() => {
    const t = localStorage.getItem('theme') as 'light' | 'dark' | 'system' || 'system'
    setTimeout(() => setTheme(t), 0)
  }, [])

  // Auto-scroll loop for announcements
  useEffect(() => {
    if (announcements.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length)
    }, 4500)
    return () => clearInterval(interval)
  }, [announcements.length])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const changeLanguage = (code: string) => {
    setLangDropdownOpen(false)
    if (!pathname) return
    const segments = pathname.split('/')
    let newPath = ''
    if (segments.length > 1 && ['en', 'ar', 'zh', 'fr'].includes(segments[1])) {
      segments[1] = code
      newPath = segments.join('/')
    } else {
      newPath = `/${code}${pathname}`
    }
    router.push(newPath)
  }

  const changeTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    const d = document.documentElement
    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      d.classList.add('dark')
    } else {
      d.classList.remove('dark')
    }
  }

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
  ]

  const activeLanguage = languages.find(l => l.code === activeLang) || languages[0]
  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  return (
    <div
      className={`w-full bg-primary-gradient text-white px-4 text-sm font-semibold shadow-sm transition-all duration-350 ease-in-out flex items-center relative z-55 ${
        isScrolled ? 'h-0 opacity-0 py-0 border-b-0 overflow-hidden' : 'h-10 opacity-100 py-2 border-b border-emerald-950/20 overflow-visible'
      }`}
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
              const translation = ann.translations?.find(t => t.lang_code === activeLang)
              const title = translation?.title || ann.title
              const label = translation?.label || ann.label
              
              return (
                <div key={ann.id || idx} className="h-6 flex items-center gap-2 truncate">
                  <span className="tracking-wide">{title}</span>
                  {label && ann.link && (
                    <a
                      href={ann.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-emerald-300 transition-colors font-extrabold whitespace-nowrap"
                    >
                      {label}
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Sub actions */}
        <div className="flex items-center gap-5 text-[13.5px] shrink-0 font-bold">
          <Link href="#download-section" className="hidden sm:flex items-center gap-2 hover:text-emerald-300 transition-colors">
            <i className="fa-solid fa-mobile-screen-button text-[14px]"></i>
            <span>{dict.header.download_app}</span>
          </Link>

          <Link href="#footer" className="hidden sm:flex items-center gap-2 hover:text-emerald-300 transition-colors">
            <i className="fa-solid fa-headset text-[14px]"></i>
            <span>{dict.header.contact_us}</span>
          </Link>

          {/* Language Dropdown */}
          <div className="relative inline-block text-left" ref={langDropdownRef}>
            <button
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center gap-2 text-white hover:text-emerald-300 transition-colors focus:outline-none"
            >
              <span className="text-[15.5px] leading-none">{activeLanguage.flag}</span>
              <span>{activeLanguage.name}</span>
              <i className="fa-solid fa-chevron-down text-[10px] ml-0.5 text-emerald-300"></i>
            </button>
            {langDropdownOpen && (
              <div className="absolute right-0 mt-2 w-32 rounded-lg bg-zinc-900 border border-zinc-800 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="py-1">
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => changeLanguage(l.code)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold hover:bg-zinc-800 transition-colors ${
                        activeLang === l.code ? 'text-emerald-400 bg-zinc-800/40' : 'text-zinc-300'
                      }`}
                    >
                      <span className="text-[15px]">{l.flag}</span>
                      <span>{l.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Theme Switcher Bar */}
          <div className="flex items-center gap-1.5 bg-black/35 p-0.5 rounded-full border border-white/10 shadow-inner select-none">
            <button
              onClick={() => changeTheme('system')}
              className={`p-1 rounded-full transition-all focus:outline-none flex items-center justify-center w-5 h-5 ${
                theme === 'system' ? 'bg-white text-zinc-950 scale-105 shadow-sm' : 'text-white/80 hover:text-white hover:scale-105'
              }`}
              title="System Mode"
            >
              <i className="fa-solid fa-desktop text-[11px]"></i>
            </button>
            <button
              onClick={() => changeTheme('light')}
              className={`p-1 rounded-full transition-all focus:outline-none flex items-center justify-center w-5 h-5 ${
                theme === 'light' ? 'bg-white text-zinc-950 scale-105 shadow-sm' : 'text-white/80 hover:text-white hover:scale-105'
              }`}
              title="Light Mode"
            >
              <i className="fa-solid fa-sun text-[11px]"></i>
            </button>
            <button
              onClick={() => changeTheme('dark')}
              className={`p-1 rounded-full transition-all focus:outline-none flex items-center justify-center w-5 h-5 ${
                theme === 'dark' ? 'bg-white text-zinc-950 scale-105 shadow-sm' : 'text-white/80 hover:text-white hover:scale-105'
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

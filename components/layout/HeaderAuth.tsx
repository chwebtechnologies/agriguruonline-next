'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import CategoryLink from '@/components/ui/CategoryLink'
import { usePathname } from 'next/navigation'
import MobileMenu from './MobileMenu'
import { AgriGuruLogo } from './HeaderGuest'

interface HeaderAuthProps {
  token: string
  dict: {
    navigation: {
      login: string
      register: string
      logout: string
      dashboard?: string
    }
    header: {
      announcement: string
      download_app: string
      contact_us: string
      search_placeholder: string
      home: string
      about_us: string
      register_here: string
      menu: string
      categories: {
        rice: string
        sugar: string
        grains: string
        pulses: string
        spices: string
        oil_seeds: string
        feed_meal: string
        flours: string
        edible_oil: string
        others: string
        fertilizers?: string
        pesticides?: string
        machinery?: string
      }
    }
  }
  activeLang: string
  categories?: Array<{ name: string; href: string }>
}

// Client Side Mock fetch profile coordinate
async function fetchUserProfile(token: string) {
  // Simulate minimal server-side network delay
  if (!token) return null
  await new Promise((resolve) => setTimeout(resolve, 50))
  return {
    name: 'Harshit',
    email: 'harshit@example.com',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=face',
  }
}

export function HeaderAuth({ token, dict, activeLang, categories: apiCategories }: HeaderAuthProps) {
  const [profile, setProfile] = useState<{ name: string; email: string; avatar: string } | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const categoriesRef = useRef<HTMLDivElement>(null)

  const pathname = usePathname()
  const isHomeActive = pathname === `/${activeLang}` || pathname === `/` || pathname === `/${activeLang}/`
  const isAboutActive = pathname === `/${activeLang}/about` || pathname === `/about`
  const isDashboardActive = pathname === `/${activeLang}/dashboard` || pathname === `/dashboard`
  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  // Scroll horizontal categories on vertical mouse wheel event
  useEffect(() => {
    const el = categoriesRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // Fetch mock user details on mount
  useEffect(() => {
    fetchUserProfile(token).then((data) => setProfile(data))
  }, [token])

  // Scroll listener for sticky collapse behavior with hysteresis to prevent blinking loops
  useEffect(() => {
    let scrolled = false
    const handleScroll = () => {
      // Prevent blinking when page content is too short
      if (document.documentElement.scrollHeight <= window.innerHeight + 100) {
        if (scrolled) {
          scrolled = false
          setIsScrolled(false)
        }
        return
      }

      const sy = window.scrollY
      if (!scrolled && sy > 20) {
        scrolled = true
        setIsScrolled(true)
      } else if (scrolled && sy < 10) {
        scrolled = false
        setIsScrolled(false)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])



  const [isMac, setIsMac] = useState(false)

  // OS and Keyboard shortcut listener
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(navigator.userAgent.toUpperCase().indexOf('MAC') >= 0)

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])



  const categoriesList = apiCategories || []

  // Hydration-safe responsive logic to prevent category item overflow
  const [mounted, setMounted] = useState(false)
  const [width, setWidth] = useState(1280)

  useEffect(() => {
    setTimeout(() => {
      setMounted(true)
      setWidth(window.innerWidth)
    }, 0)
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate dynamic fit based on estimated text width to keep items within bounds
  // Available width is screen width minus spacing for logo, dropdowns, and margins
  const availableWidth = mounted ? Math.max(200, width - 220) : 950
  let accumulatedWidth = 0
  let fitCount = 0
  const othersWidth = 100

  for (let i = 0; i < categoriesList.length; i++) {
    const cat = categoriesList[i]
    // Estimation formula: charLength * 7.5px + 20px (paddings and gaps)
    const estimatedWidth = cat.name.length * 7.5 + 20
    // If it is the last item and all fit, we don't reserve space for "Others" trigger
    const neededSpace = (i === categoriesList.length - 1) ? estimatedWidth : (estimatedWidth + othersWidth)

    if (accumulatedWidth + neededSpace <= availableWidth) {
      accumulatedWidth += estimatedWidth
      fitCount++
    } else {
      break
    }
  }

  const finalFitCount = categoriesList.length > 0 ? Math.max(1, fitCount) : 0
  const displayCategories = categoriesList.slice(0, finalFitCount)
  const dropdownCategories = categoriesList.slice(finalFitCount)

  return (
    <div className="w-full flex flex-col z-50 bg-[#121212] transition-theme sticky top-0" dir={dir}>

      {/* 2. Main Header Bar (Always sticky) */}
      <header className="w-full bg-ag-header-bg text-ag-header-text py-2.5 px-4 border-b border-ag-header-border shadow-md transition-all duration-300">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">

          {/* Left side group containing Logo/Menu and Search bar with short spacing */}
          <div className="flex items-center flex-1 gap-3 md:gap-4">
            {/* Mobile & Desktop Menu Trigger and Logo inline */}
            <div className="flex items-center shrink-0 md:w-[110px] rtl:md:w-[130px] w-auto">
              {/* On Mobile: Always show Hamburger Menu.
                  On Desktop (md+): Only show Hamburger Menu when scrolled (replacing Logo). */}
              <div className="md:hidden">
                <MobileMenu dict={dict} activeLang={activeLang} categories={categoriesList} />
              </div>
              {isScrolled && (
                <div className="hidden md:block animate-in fade-in duration-300">
                  <MobileMenu dict={dict} activeLang={activeLang} label={dict.header.menu} showLabel categories={categoriesList} />
                </div>
              )}

              {/* Logo:
                  On Mobile: Always show.
                  On Desktop (md+): Show ONLY when NOT scrolled (replaced by Hamburger Menu when scrolled). */}
              {!isScrolled ? (
                <Link href={`/${activeLang}`} className="flex items-center gap-1.5 focus:outline-none rounded shrink-0">
                  <AgriGuruLogo size={42} />
                </Link>
              ) : (
                <div className="md:hidden">
                  <Link href={`/${activeLang}`} className="flex items-center gap-1.5 focus:outline-none rounded shrink-0">
                    <AgriGuruLogo size={42} />
                  </Link>
                </div>
              )}
            </div>

            {/* Search bar next to logo */}
            <div className="flex-1 max-w-sm md:max-w-md lg:max-w-lg">
              <form action={`/${activeLang}/search`} method="GET" className="relative w-full">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <i className="fa-solid fa-magnifying-glass text-ag-search-placeholder text-[14px]"></i>
                </div>
                <input
                  type="search"
                  name="q"
                  placeholder={dict.header.search_placeholder}
                  className="w-full h-10 rounded-lg border border-ag-search-border bg-ag-search-bg pl-10 pr-12 text-sm text-ag-search-text placeholder-ag-search-placeholder focus:border-brand-blue focus:bg-background focus:ring-0 outline-none transition-all"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 h-5.5 select-none rounded border border-ag-search-border bg-ag-search-bg px-1.5 font-mono text-[9px] font-bold text-ag-search-placeholder">
                    <span>{isMac ? '⌘' : 'Ctrl'}</span>K
                  </kbd>
                </div>
              </form>
            </div>
          </div>

          {/* Right Section: Navigation Links & Profile */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Desktop link shortcuts - matching category styling but in main header */}
            <nav className="hidden lg:flex items-center gap-8 text-[18px] whitespace-nowrap">
              <Link
                href={`/${activeLang}`}
                className={`transition-colors duration-150 font-extrabold ${isHomeActive ? 'text-primary' : 'text-ag-nav-link hover:text-ag-nav-link-hover'
                  }`}
              >
                {dict.header.home}
              </Link>
              <Link
                href={`/${activeLang}/about`}
                className={`transition-colors duration-150 font-extrabold ${isAboutActive ? 'text-primary' : 'text-ag-nav-link hover:text-ag-nav-link-hover'
                  }`}
              >
                {dict.header.about_us}
              </Link>
              {dict.navigation.dashboard && (
                <Link
                  href={`/${activeLang}/dashboard`}
                  className={`transition-colors duration-150 font-extrabold ${isDashboardActive ? 'text-primary' : 'text-ag-nav-link hover:text-ag-nav-link-hover'
                    }`}
                >
                  {dict.navigation.dashboard}
                </Link>
              )}
            </nav>

            {/* User Profile Info */}
            <div className="flex items-center gap-2 select-none border-l border-ag-subheader-border pl-2.5 dir-none">
              <div className="hidden lg:flex flex-col text-right leading-none select-none">
                <span className="text-xs font-bold text-ag-header-text">{profile?.name || 'User'}</span>
                <span className="text-[9px] text-ag-search-placeholder mt-0.5">{profile?.email || 'email@example.com'}</span>
              </div>

              <Link
                href={`/${activeLang}/profile`}
                className="relative flex h-9.5 w-9.5 shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 active:scale-95 transition-transform"
              >
                {profile?.avatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    className="h-full w-full rounded-full border-2 border-emerald-500/60 object-cover"
                    src={profile.avatar}
                    alt={profile.name}
                  />
                ) : (
                  <div className="h-full w-full rounded-full bg-ag-login-bg border-2 border-emerald-500/40 animate-pulse" />
                )}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-ag-header-bg ring-2 ring-emerald-500/20" />
              </Link>

              {/* Log out button */}
              <button
                onClick={() => {
                  if (typeof document !== 'undefined') {
                    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                    window.location.reload();
                  }
                }}
                className="rounded px-2 py-1 text-[10px] font-bold text-ag-search-placeholder hover:text-rose-500 transition-colors focus:outline-none focus:ring-1 focus:ring-rose-500"
              >
                {dict.navigation.logout}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 3. Categories Subheader Bar */}
      <div
        className={`hidden md:block w-full bg-ag-subheader-bg text-ag-subheader-text px-4 shadow-inner transition-all duration-355 ease-in-out border-b border-ag-subheader-border ${
          isScrolled ? 'h-0 py-0 border-b-0 overflow-hidden' : 'py-1 opacity-100 overflow-visible'
        }`}
      >
        <div className="mx-auto w-full max-w-7xl flex items-center justify-between gap-6">
          {/* Left-aligned Menu Trigger */}
          <div className="shrink-0 border-e border-ag-subheader-border pe-5 flex items-center">
            <MobileMenu dict={dict} activeLang={activeLang} label={dict.header.menu} showLabel categories={categoriesList} />
          </div>

          {/* Right-aligned container containing all categories with Others at the very last */}
          <div ref={categoriesRef} className="flex-1 flex justify-end items-center gap-6 overflow-visible">
            <nav className="flex items-center gap-5 text-[16px] font-bold tracking-wide whitespace-nowrap">
              {displayCategories.map((category, index) => {
                const isActive = pathname === category.href
                return (
                  <CategoryLink
                    key={index}
                    href={category.href}
                    isActive={isActive}
                    baseClassName="transition-colors border-y-2 border-t-transparent pt-1 pb-1"
                    activeClassName="text-primary border-b-primary font-extrabold"
                    inactiveClassName="text-ag-nav-link border-b-transparent hover:text-ag-nav-link-hover hover:border-b-primary font-bold"
                  >
                    {category.name}
                  </CategoryLink>
                )
              })}

              {/* "Others" Dropdown inside the same row, at the very last (on the right) */}
              {dropdownCategories.length > 0 && (
                <div className="relative group">
                  <button className="flex items-center gap-1.5 text-ag-nav-link hover:text-ag-nav-link-hover font-bold text-[16px] focus:outline-none border-y-2 border-t-transparent border-b-transparent hover:border-b-primary pt-1 pb-1">
                    <span>{dict.header.categories.others}</span>
                    <i className="fa-solid fa-chevron-down text-[11px] ml-1 text-ag-nav-link group-hover:text-ag-nav-link-hover"></i>
                  </button>
                  <div className={`absolute ${activeLang === 'ar' ? 'left-0' : 'right-0'} mt-3.5 w-48 rounded-md bg-ag-dropdown-bg border border-ag-dropdown-border p-1.5 shadow-xl invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-150 z-50`}>
                    {dropdownCategories.map((category, index) => (
                      <Link
                        key={index}
                        href={category.href}
                        className="block px-3.5 py-2.5 text-sm text-ag-dropdown-text hover:bg-ag-dropdown-hover-bg hover:text-ag-dropdown-hover-text rounded transition-colors"
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}

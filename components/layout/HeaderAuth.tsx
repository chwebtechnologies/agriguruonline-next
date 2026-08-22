'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import CategoryLink from '@/components/ui/CategoryLink'
import { usePathname, useRouter } from 'next/navigation'

import { AgriGuruLogo } from './HeaderGuest'
import { AppMenu } from '@/components/ui/AppMenu'

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
  profile?: any
}

export function HeaderAuth({ token, dict, activeLang, categories: apiCategories, profile: initialProfile }: HeaderAuthProps) {
  const [profile, setProfile] = useState<any>(initialProfile || null)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const categoriesRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)

  const router = useRouter()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')

  // Debounce global search
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = searchQuery.trim()
      if (q.length >= 3) {
        router.push(`/${activeLang}/search?q=${encodeURIComponent(q)}`)
      } else if (q.length === 0 && pathname === `/${activeLang}/search`) {
        // Optionally clear search if on search page and input is empty
        router.push(`/${activeLang}/search`)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [searchQuery, router, activeLang, pathname])
  const isHomeActive = pathname === `/${activeLang}` || pathname === `/` || pathname === `/${activeLang}/`
  const isAboutActive = pathname === `/${activeLang}/about` || pathname === `/about`
  const isDashboardActive = pathname === `/${activeLang}/dashboard` || pathname === `/dashboard`
  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile)
    }
  }, [initialProfile])

  // Scroll listener for sticky collapse behavior with hysteresis to prevent blinking loops
  useEffect(() => {
    let scrolled = false
    const handleScroll = () => {
      const sy = window.scrollY

      if (scrolled) {
        if (sy < 20) {
          scrolled = false
          setIsScrolled(false)
        }
      } else {
        // Protect against Mac rubber-banding collapsing the bar on short pages
        if (document.documentElement.scrollHeight > window.innerHeight + 150) {
          // Use a threshold gap (120px vs 20px) that exceeds the header shrink amount (~80px).
          // This prevents the browser's scroll anchoring from forcing an infinite loop.
          if (sy > 120) {
            scrolled = true
            setIsScrolled(true)
          }
        }
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
                <AppMenu align="left" profile={profile}>
                  <button className="flex items-center gap-3 text-ag-header-text hover:text-primary focus:outline-none p-1.5 -ml-1.5 rounded transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-8 w-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                  </button>
                </AppMenu>
              </div>
              {isScrolled && (
                <div className="hidden md:block animate-in fade-in duration-300">
                  <AppMenu align="left" profile={profile}>
                    <button className="flex items-center gap-3 text-ag-header-text hover:text-primary focus:outline-none p-1.5 -ml-1.5 rounded transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-8 w-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                      </svg>
                      <span className="font-bold text-[21px] tracking-wide leading-none">{dict.header.menu}</span>
                    </button>
                  </AppMenu>
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
              <form 
                action={`/${activeLang}/search`} 
                method="GET" 
                className="relative w-full"
                onSubmit={(e) => {
                  if (searchQuery.trim().length > 0 && searchQuery.trim().length < 3) {
                    e.preventDefault();
                  }
                }}
              >
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <i className="fa-solid fa-magnifying-glass text-ag-search-placeholder text-[14px]"></i>
                </div>
                <input
                  type="search"
                  name="q"
                  placeholder={dict.header.search_placeholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 rounded-lg border border-ag-search-border bg-ag-search-bg pl-10 pr-20 text-sm text-ag-search-text placeholder-ag-search-placeholder focus:border-brand-blue focus:bg-background focus:ring-0 outline-none transition-all"
                />
                
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-12 flex items-center px-2 text-ag-search-placeholder hover:text-ag-search-text focus:outline-none z-10"
                    aria-label="Clear search"
                  >
                    <i className="fa-solid fa-circle-xmark text-[15px]"></i>
                  </button>
                )}

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
                href="#"
                className="transition-colors duration-150 font-extrabold text-ag-nav-link hover:text-ag-nav-link-hover"
              >
                Products
              </Link>
            </nav>

            <div className="flex items-center gap-4 select-none border-l border-ag-subheader-border pl-4 dir-none">
              <div className="flex items-center gap-3">
                <Link
                  href="#"
                  className="h-10 px-5 hidden lg:inline-flex items-center justify-center rounded-lg bg-primary-gradient text-[15px] font-black text-white shadow-md hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  {profile?.membership ? 'Upgrade Plan' : 'Free Trial'}
                </Link>

                <div className="relative" ref={notificationsRef}>
                  <button 
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="relative flex items-center justify-center p-2 text-ag-nav-link hover:text-primary transition-colors focus:outline-none hover:scale-110 active:scale-95 duration-200"
                  >
                    <i className="fa-solid fa-bell text-[30px]"></i>
                  </button>
                  
                  {isNotificationsOpen && (
                    <div className={`absolute ${activeLang === 'ar' ? 'left-0' : 'right-0'} mt-3 w-64 md:w-80 rounded-lg bg-ag-dropdown-bg border border-ag-dropdown-border p-4 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200`}>
                      <div className="flex items-center justify-between border-b border-ag-dropdown-border pb-2 mb-2">
                        <h3 className="font-bold text-[16px] text-ag-dropdown-text">Notifications</h3>
                      </div>
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <i className="fa-regular fa-bell-slash text-3xl text-zinc-400 mb-3"></i>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">No notifications</p>
                      </div>
                    </div>
                  )}
                </div>

                <Link href={`/${activeLang}/profile`}>
                  <div
                    className="relative flex flex-col items-center justify-center w-12 h-12 shrink-0 rounded-full bg-ag-login-bg text-ag-login-text hover:bg-zinc-200 dark:hover:bg-zinc-850 transition-all border border-ag-login-border shadow-lg hover:scale-105 active:scale-95 duration-200"
                  >
                    {profile?.profile_image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        className="h-full w-full rounded-full border border-ag-login-border object-cover"
                        src={profile.profile_image.startsWith('http') ? profile.profile_image : `${process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com'}${profile.profile_image.startsWith('/') ? '' : '/'}${profile.profile_image}`}
                        alt="Profile"
                        onError={(e) => {
                          // Fallback to icon on error
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextElementSibling) {
                            (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    
                    <div 
                      className="flex flex-col items-center justify-center w-full h-full"
                      style={{ display: profile?.profile_image ? 'none' : 'flex' }}
                    >
                      <i className="fa-solid fa-user text-[15px] mb-0.5"></i>
                      <span className="text-[9px] font-extrabold leading-none mt-0.5">Profile</span>
                    </div>
                    
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-ag-header-bg ring-2 ring-emerald-500/20" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 3. Categories Subheader Bar */}
      <div
        className={`hidden md:block w-full bg-ag-subheader-bg text-ag-subheader-text px-4 shadow-inner transition-all duration-300 ease-in-out border-b border-ag-subheader-border ${
          isScrolled ? 'max-h-0 py-0 border-b-0 opacity-0 overflow-hidden' : 'max-h-[100px] py-1 opacity-100 overflow-visible'
        }`}
      >
        <div className="mx-auto w-full max-w-7xl flex items-center justify-between gap-6">
          {/* Left-aligned Menu Trigger */}
          <div className="shrink-0 border-e border-ag-subheader-border pe-5 flex items-center">
            <AppMenu align="left" profile={profile}>
              <button className="flex items-center gap-3 text-ag-header-text hover:text-primary focus:outline-none p-1.5 -ml-1.5 rounded transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-8 w-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
                <span className="font-bold text-[21px] tracking-wide leading-none">{dict.header.menu}</span>
              </button>
            </AppMenu>
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

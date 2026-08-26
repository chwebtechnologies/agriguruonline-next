'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import CategoryLink from '@/components/ui/CategoryLink'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { AppMenu } from '@/components/ui/AppMenu'

interface HeaderGuestProps {
  dict?: {
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
  activeLang?: string
  categories?: Array<{ name: string; href: string }>
  loading?: boolean
}

export function AgriGuruLogo({ size = 42 }: { size?: number }) {
  return (
    <Image
      src="/logo.svg"
      alt="AgriGuru Logo"
      width={size}
      height={size}
      className="h-auto object-contain shrink-0"
      priority
    />
  )
}

interface HeaderGuestBaseProps extends HeaderGuestProps {
  pathname: string;
}

export function HeaderGuestBase({
  dict: rawDict,
  activeLang = 'en',
  categories: apiCategories = [],
  loading = false,
  pathname,
}: HeaderGuestBaseProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const categoriesRef = useRef<HTMLDivElement>(null)
  
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  // Debounce global search
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = searchQuery.trim()
      if (q.length >= 3) {
        router.push(`/${activeLang}/search?q=${encodeURIComponent(q)}`)
      } else if (q.length === 0 && pathname === `/${activeLang}/search`) {
        router.push(`/${activeLang}/search`)
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [searchQuery, router, activeLang, pathname])


  const isHomeActive = pathname === `/${activeLang}` || pathname === `/` || pathname === `/${activeLang}/`
  const isAboutActive = pathname === `/${activeLang}/about` || pathname === `/about`
  
  const [hideInsights, setHideInsights] = useState(false)
  const isNewsActive = pathname === `/${activeLang}/news` || pathname === `/news`
  const isEventsActive = pathname === `/${activeLang}/events` || pathname === `/events`
  const isMarketUpdatesActive = pathname === `/${activeLang}/market-updates` || pathname === `/market-updates`
  const isVideoGalleryActive = pathname === `/${activeLang}/video-gallery` || pathname === `/video-gallery`
  const isPhotoGalleryActive = pathname === `/${activeLang}/photo-gallery` || pathname === `/photo-gallery`
  const isInsightsActive = isNewsActive || isEventsActive || isMarketUpdatesActive || isVideoGalleryActive || isPhotoGalleryActive
  
  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  // Default values to prevent undefined errors when rendering skeleton fallback
  const defaultNavigation = {
    login: "Login",
    register: "Register",
    logout: "Log Out",
    dashboard: "Dashboard"
  }

  const defaultHeader = {
    announcement: "Download Our Mobile App Now ! Click Here",
    download_app: "Download Application",
    contact_us: "Contact Us",
    search_placeholder: "Search Product",
    home: "Home",
    about_us: "About Us",
    register_here: "Register Here",
    menu: "Menu",
    categories: {
      rice: "Rice",
      sugar: "Sugar",
      grains: "Grains",
      pulses: "Pulses",
      spices: "Spices",
      oil_seeds: "Oil Seeds",
      feed_meal: "Feed Meal",
      flours: "Flours",
      edible_oil: "Edible Oil",
      others: "Others",
      fertilizers: "Fertilizers",
      pesticides: "Pesticides",
      machinery: "Machinery"
    }
  }

  const dict = {
    navigation: {
      ...defaultNavigation,
      ...rawDict?.navigation
    },
    header: {
      ...defaultHeader,
      ...rawDict?.header,
      categories: {
        ...defaultHeader.categories,
        ...rawDict?.header?.categories
      }
    }
  }

  // Scroll listener for sticky collapse behavior
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

  const [isMac, setIsMac] = useState(false)

  // OS and Keyboard shortcut listener
  useEffect(() => {
    setTimeout(() => setIsMac(navigator.userAgent.toUpperCase().indexOf('MAC') >= 0), 0)

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


  const categoriesList = apiCategories || []

  // Calculate dynamic fit based on estimated text width
  const availableWidth = mounted ? Math.max(200, width - 220) : 950
  let accumulatedWidth = 0
  let fitCount = 0
  const othersWidth = 100

  for (let i = 0; i < categoriesList.length; i++) {
    const cat = categoriesList[i]
    const estimatedWidth = cat.name.length * 7.5 + 20
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
    <div className="w-full flex flex-col z-50 bg-background transition-theme sticky top-0" dir={dir}>

      {/* 2. Main Header Bar */}
      <header className="w-full bg-ag-header-bg text-ag-header-text py-2.5 px-4 border-b border-ag-header-border shadow-sm transition-all duration-300">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          
          <div className="flex items-center flex-1 gap-3 md:gap-4">
            <div className="flex items-center shrink-0 md:w-[110px] rtl:md:w-[130px] w-auto">
              <div className="md:hidden">
                <AppMenu align="left">
                  <div className="flex items-center gap-3 text-ag-header-text hover:text-primary p-1.5 -ml-1.5 rounded transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-8 w-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                  </div>
                </AppMenu>
              </div>
              {isScrolled && (
                <div className="hidden md:block animate-in fade-in duration-300">
                  <AppMenu align="left">
                    <div className="flex items-center gap-3 text-ag-header-text hover:text-primary p-1.5 -ml-1.5 rounded transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-8 w-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                      </svg>
                      <span className="font-bold text-[21px] tracking-wide leading-none">{dict.header.menu}</span>
                    </div>
                  </AppMenu>
                </div>
              )}

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
              {loading ? (
                <div className="w-full h-10 rounded-full bg-ag-search-bg border border-ag-search-border animate-pulse" />
              ) : (
                <form 
                  action={`/${activeLang}/search`} 
                  method="GET" 
                  className="group relative w-full"
                  onSubmit={(e) => {
                    if (searchQuery.trim().length > 0 && searchQuery.trim().length < 3) {
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <i className="fa-solid fa-magnifying-glass text-ag-search-placeholder group-focus-within:text-brand-blue transition-colors text-[13px]"></i>
                  </div>
                  <input
                    type="search"
                    name="q"
                    placeholder={dict.header.search_placeholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 rounded-lg border border-ag-search-border bg-ag-search-bg pl-9 sm:pl-10 pr-3 sm:pr-20 text-xs sm:text-[13.5px] font-medium text-ag-search-text placeholder:text-ag-search-placeholder focus:bg-ag-card-bg focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/20 outline-none transition-all duration-200 shadow-2xs"
                  />
                  
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-2 sm:right-12 flex items-center px-2 text-ag-search-placeholder hover:text-ag-search-text focus:outline-none z-10 cursor-pointer"
                      aria-label="Clear search"
                    >
                      <i className="fa-solid fa-circle-xmark text-[14px]"></i>
                    </button>
                  )}

                  <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 h-5 select-none rounded-full border border-ag-search-kbd-border bg-ag-search-kbd-bg px-2 font-mono text-[10px] font-bold text-ag-search-kbd-text shadow-2xs">
                      <span>{isMac ? '⌘' : 'Ctrl'}</span>K
                    </kbd>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Right Section: Navigation Links & Actions */}
          <div className="flex items-center gap-4 shrink-0">
            <nav className="hidden lg:flex items-center gap-8 text-[18px] whitespace-nowrap">
              {loading ? (
                <>
                  <div className="h-5 w-16 bg-ag-nav-link/25 animate-pulse rounded" />
                  <div className="h-5 w-16 bg-ag-nav-link/25 animate-pulse rounded" />
                </>
              ) : (
                <>
                  <Link
                    href={`/${activeLang}`}
                    className={`transition-colors duration-150 font-extrabold ${isHomeActive ? 'text-primary' : 'text-ag-nav-link hover:text-ag-nav-link-hover'}`}
                  >
                    {dict.header.home}
                  </Link>
                  <Link
                    href={`/${activeLang}/about`}
                    className={`transition-colors duration-150 font-extrabold ${isAboutActive ? 'text-primary' : 'text-ag-nav-link hover:text-ag-nav-link-hover'}`}
                  >
                    {dict.header.about_us}
                  </Link>
                  <div className="relative group" onMouseLeave={() => setHideInsights(false)}>
                    <button className={`flex items-center gap-1.5 transition-colors duration-150 font-extrabold focus:outline-none ${isInsightsActive ? 'text-primary' : 'text-ag-nav-link hover:text-ag-nav-link-hover'}`}>
                      <span>Insights</span>
                      <i className={`fa-solid fa-chevron-down text-[11px] ml-0.5 ${isInsightsActive ? 'text-primary' : 'text-ag-nav-link group-hover:text-ag-nav-link-hover'}`}></i>
                    </button>
                    <div className={`absolute ${activeLang === 'ar' ? 'right-0' : 'left-0'} mt-5 w-48 rounded-md bg-ag-dropdown-bg border border-ag-dropdown-border p-1.5 shadow-xl transition-all duration-150 z-50 ${hideInsights ? 'hidden' : 'invisible opacity-0 group-hover:visible group-hover:opacity-100'}`}>
                      <Link href={`/${activeLang}/news`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isNewsActive ? 'bg-primary text-white' : 'text-ag-dropdown-text hover:bg-ag-dropdown-hover-bg hover:text-ag-dropdown-hover-text'}`}>News</Link>
                      <Link href={`/${activeLang}/events`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isEventsActive ? 'bg-primary text-white' : 'text-ag-dropdown-text hover:bg-ag-dropdown-hover-bg hover:text-ag-dropdown-hover-text'}`}>Events</Link>
                      <Link href={`/${activeLang}/market-updates`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isMarketUpdatesActive ? 'bg-primary text-white' : 'text-ag-dropdown-text hover:bg-ag-dropdown-hover-bg hover:text-ag-dropdown-hover-text'}`}>Market Updates</Link>
                      <Link href={`/${activeLang}/video-gallery`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isVideoGalleryActive ? 'bg-primary text-white' : 'text-ag-dropdown-text hover:bg-ag-dropdown-hover-bg hover:text-ag-dropdown-hover-text'}`}>Video Gallery</Link>
                      <Link href={`/${activeLang}/photo-gallery`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isPhotoGalleryActive ? 'bg-primary text-white' : 'text-ag-dropdown-text hover:bg-ag-dropdown-hover-bg hover:text-ag-dropdown-hover-text'}`}>Photo Gallery</Link>
                    </div>
                  </div>
                </>
              )}
            </nav>

            {/* Simple profile links area (Guest/Auth) */}
            <div className="flex items-center gap-4 select-none border-l border-ag-subheader-border pl-4 dir-none">
              {loading ? (
                <div className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-28 bg-ag-login-bg rounded-lg border border-ag-login-border/40" />
                  <div className="w-12 h-12 rounded-full bg-zinc-850" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    href={`/${activeLang}/register`}
                    className="h-10 px-5 hidden lg:inline-flex items-center justify-center rounded-lg bg-primary-gradient text-[15px] font-black text-white shadow-md hover:scale-105 active:scale-95 transition-all duration-200"
                  >
                    {dict.header.register_here}
                  </Link>
                  <Link
                    href={`/${activeLang}/login`}
                    className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-ag-login-bg text-ag-login-text hover:bg-ag-dropdown-hover-bg hover:text-ag-dropdown-hover-text transition-all border border-ag-login-border shadow-sm hover:scale-105 active:scale-95 duration-200"
                  >
                    <i className="fa-solid fa-user text-[15px] mb-0.5"></i>
                    <span className="text-[9px] font-extrabold leading-none mt-0.5">{dict.navigation.login}</span>
                  </Link>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* 3. Categories Subheader Bar */}
      <div
        className={`hidden md:block w-full bg-ag-subheader-bg text-ag-subheader-text px-4 transition-all duration-300 ease-in-out border-b border-ag-subheader-border ${
          isScrolled ? 'max-h-0 py-0 border-b-0 opacity-0 overflow-hidden' : 'max-h-[100px] py-1 opacity-100 overflow-visible'
        }`}
      >
        <div className="mx-auto w-full max-w-7xl flex items-center justify-between gap-6">
          <div className="shrink-0 border-e border-ag-subheader-border pe-5 flex items-center">
            {loading ? (
              <div className="h-5 w-16 bg-ag-subheader-text/25 animate-pulse rounded" />
            ) : (
              <AppMenu align="left">
                <button className="flex items-center gap-3 text-ag-header-text hover:text-primary focus:outline-none p-1.5 -ml-1.5 rounded transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-8 w-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                  <span className="font-bold text-[21px] tracking-wide leading-none">{dict.header.menu}</span>
                </button>
              </AppMenu>
            )}
          </div>

          <div ref={categoriesRef} className="flex-1 flex justify-end items-center gap-6 overflow-visible">
            <nav className="flex items-center gap-5 text-[16px] font-bold tracking-wide whitespace-nowrap">
              {loading ? (
                <>
                  <div className="h-4 w-12 bg-ag-subheader-text/25 animate-pulse rounded" />
                  <div className="h-4 w-14 bg-ag-subheader-text/25 animate-pulse rounded" />
                  <div className="h-4 w-10 bg-ag-subheader-text/25 animate-pulse rounded" />
                </>
              ) : (
                displayCategories.map((category, index) => {
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
                })
              )}

              {dropdownCategories.length > 0 && !loading && (
                <div className="relative group">
                  <button className="flex items-center gap-1.5 text-ag-nav-link hover:text-ag-nav-link-hover font-bold text-[16px] focus:outline-none border-y-2 border-t-transparent border-b-transparent hover:border-b-primary pt-1 pb-1">
                    <span>{dict.header.categories.others}</span>
                    <i className="fa-solid fa-chevron-down text-[11px] ml-1 text-ag-nav-link group-hover:text-ag-nav-link-hover"></i>
                  </button>
                  <div className={`absolute ${activeLang === 'ar' ? 'left-0' : 'right-0'} mt-3.5 w-48 rounded-md bg-ag-dropdown-bg border border-ag-dropdown-border p-1.5 shadow-xl invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-155 z-50`}>
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

export function HeaderGuest(props: HeaderGuestProps) {
  const pathname = usePathname() || '/'
  return <HeaderGuestBase {...props} pathname={pathname} />
}

export function HeaderGuestSkeleton(props: Omit<HeaderGuestProps, 'loading'>) {
  return <HeaderGuestBase {...props} pathname="/" loading={true} />
}


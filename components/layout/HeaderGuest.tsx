'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import CategoryLink from '@/components/category/CategoryLink'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { AppMenu } from '@/components/layout/AppMenu'
import { HeaderSearch } from '@/components/search/HeaderSearch'

import { SearchProduct } from '@/types/search'

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
      insights?: string
      news?: string
      events?: string
      market_updates?: string
      video_gallery?: string
      participation_gallery?: string
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
    common?: any
  }
  activeLang?: string
  categories?: Array<{ name: string; href: string }>
  loading?: boolean
  initialSearchProducts?: SearchProduct[]
}

export function AgriGuruLogo({ size = 42 }: { size?: number }) {
  return (
    <Image
      src="/logo.webp"
      alt="AgriGuru Logo"
      title="AgriGuru Online Logo"
      width={size}
      height={size}
      className="h-auto object-contain shrink-0"
      priority={true}
      fetchPriority="high"
      sizes={`${size}px`}
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
  initialSearchProducts = [],
}: HeaderGuestBaseProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const categoriesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])


  const isHomeActive = pathname === `/${activeLang}` || pathname === `/` || pathname === `/${activeLang}/`
  const isAboutActive = pathname === `/${activeLang}/about` || pathname === `/about`
  
  const [hideInsights, setHideInsights] = useState(false)
  const isNewsActive = pathname === `/${activeLang}/news` || pathname === `/news`
  const isEventsActive = pathname === `/${activeLang}/events` || pathname === `/events`
  const isMarketUpdatesActive = pathname === `/${activeLang}/market-updates` || pathname === `/market-updates`
  const isVideoGalleryActive = pathname === `/${activeLang}/video-gallery` || pathname === `/video-gallery`
  const isParticipationGalleryActive = pathname === `/${activeLang}/participation-gallery` || pathname === `/participation-gallery` || pathname?.startsWith(`/${activeLang}/participation-gallery/`) || pathname?.startsWith('/participation-gallery/') || pathname === `/${activeLang}/photo-gallery` || pathname === `/photo-gallery`
  const isInsightsActive = isNewsActive || isEventsActive || isMarketUpdatesActive || isVideoGalleryActive || isParticipationGalleryActive
  
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
    },
    common: rawDict?.common || {}
  }

  // Scroll listener for sticky collapse behavior
  useEffect(() => {
    let scrolled = false
    const handleScroll = () => {
      const sy = window.scrollY

      if (scrolled) {
        if (sy < 15) {
          scrolled = false
          setIsScrolled(false)
        }
      } else {
        if (sy > 45) {
          scrolled = true
          setIsScrolled(true)
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






  const [width, setWidth] = useState(1280)

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    // Defer to after first paint to avoid blocking main thread (TBT)
    const raf = requestAnimationFrame(() => {
      setWidth(window.innerWidth)
    })
    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', handleResize)
    }
  }, [])


  const categoriesList = apiCategories || []

  // Calculate dynamic fit based on estimated text width and max layout width
  // width defaults to 1280 (SSR-safe), so initial render = after-hydration render → no CLS
  const layoutWidth = Math.min(width, 1280)
  const horizontalPadding = width >= 1280 ? 160 : (width >= 1024 ? 112 : 32)
  const otherElementsWidth = 220
  const availableWidth = Math.max(200, layoutWidth - horizontalPadding - otherElementsWidth)
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
    <div id="site-header" className="w-full flex flex-col z-50 bg-background transition-all duration-300 ease-in-out sticky top-0" dir={dir}>

        {/* 2. Main Header Bar */}
      <header className="relative w-full bg-card text-foreground py-2.5 border-b border-border shadow-sm transition-all duration-300" style={{ paddingLeft: 'var(--ag-container-px)', paddingRight: 'var(--ag-container-px)' }}>
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          
          <div className="flex items-center flex-1 gap-3 md:gap-4">
            <div className="flex items-center shrink-0 lg:w-[110px] rtl:lg:w-[130px] w-auto">
              {/* On Mobile & Tablet (< 1024px): Always show Hamburger Menu */}
              <div className="lg:hidden">
                <AppMenu dict={dict} align="left" isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
                  <div className="flex items-center gap-3 text-foreground hover:text-primary p-1.5 -ml-1.5 rounded transition-colors">
                    <i className="fa-solid fa-bars text-3xl"></i>
                  </div>
                </AppMenu>
              </div>
              {/* On Desktop / Laptop (>= 1024px): Only show Hamburger Menu when scrolled */}
              {isScrolled && (
                <div className="hidden lg:block animate-in fade-in duration-300">
                  <AppMenu dict={dict} align="left" isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
                    <div className="flex items-center gap-3 text-foreground hover:text-primary p-1.5 -ml-1.5 rounded transition-colors">
                      <i className="fa-solid fa-bars text-3xl"></i>
                      <span className="font-bold text-[21px] tracking-wide leading-none">{dict.header.menu}</span>
                    </div>
                  </AppMenu>
                </div>
              )}

              {/* Logo:
                  On Desktop / Laptop (>= 1024px): Show only when NOT scrolled.
                  On Mobile & Tablet (< 1024px): Always show. */}
              {!isScrolled ? (
                <Link prefetch={false} href={`/${activeLang}`} aria-label="AgriGuru Online Home" className="flex items-center gap-1.5 focus:outline-none rounded shrink-0">
                  <AgriGuruLogo size={42} />
                </Link>
              ) : (
                <div className="lg:hidden">
                  <Link prefetch={false} href={`/${activeLang}`} aria-label="AgriGuru Online Home" className="flex items-center gap-1.5 focus:outline-none rounded shrink-0">
                    <AgriGuruLogo size={42} />
                  </Link>
                </div>
              )}
            </div>

            {/* Search bar next to logo */}
            <div className="flex-1 max-w-sm md:max-w-md lg:max-w-lg">
              {loading ? (
                <div className="w-full h-10 rounded-full bg-muted border border-border animate-pulse" />
              ) : (
                <HeaderSearch
                  placeholder={dict.header?.search_placeholder}
                  lang={activeLang}
                  categories={categoriesList}
                  dict={dict.common}
                  initialSearchProducts={initialSearchProducts}
                />
              )}
            </div>
          </div>

          {/* Right Section: Navigation Links & Actions */}
          <div className="flex items-center gap-4 shrink-0">
            <nav className="hidden lg:flex items-center gap-8 text-[19px] whitespace-nowrap">
              {loading ? (
                <>
                  <div className="h-5 w-16 bg-muted animate-pulse rounded" />
                  <div className="h-5 w-16 bg-muted animate-pulse rounded" />
                </>
              ) : (
                <>
                  <Link
                    href={`/${activeLang}`}
                    className={`transition-colors duration-150 font-extrabold ${isHomeActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {dict.header.home}
                  </Link>
                  <Link
                    href={`/${activeLang}/about`}
                    className={`transition-colors duration-150 font-extrabold ${isAboutActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {dict.header.about_us}
                  </Link>
                  <div className="relative group" onMouseLeave={() => setHideInsights(false)}>
                    <button className={`flex items-center gap-1.5 transition-colors duration-150 font-extrabold focus:outline-none ${isInsightsActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                      <span>{dict.header.insights || 'Insights'}</span>
                      <i className={`fa-solid fa-chevron-down text-[11px] ml-0.5 ${isInsightsActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}></i>
                    </button>
                    <div className={`absolute ${activeLang === 'ar' ? 'right-0' : 'left-0'} mt-5 w-48 rounded-md bg-card border border-border p-1.5 shadow-xl transition-all duration-150 z-50 ${hideInsights ? 'hidden' : 'invisible opacity-0 group-hover:visible group-hover:opacity-100'}`}>
                      <Link prefetch={false} href={`/${activeLang}/news`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isNewsActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted hover:text-foreground'}`}>{dict.header.news || 'News'}</Link>
                      <Link prefetch={false} href={`/${activeLang}/events`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isEventsActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted hover:text-foreground'}`}>{dict.header.events || 'Events'}</Link>
                      <Link prefetch={false} href={`/${activeLang}/market-updates`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isMarketUpdatesActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted hover:text-foreground'}`}>{dict.header.market_updates || 'Market Updates'}</Link>
                      <Link prefetch={false} href={`/${activeLang}/video-gallery`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isVideoGalleryActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted hover:text-foreground'}`}>{dict.header.video_gallery || 'Video Gallery'}</Link>
                      <Link prefetch={false} href={`/${activeLang}/participation-gallery`} onClick={() => setHideInsights(true)} className={`block px-3.5 py-2.5 text-sm font-semibold rounded transition-colors ${isParticipationGalleryActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted hover:text-foreground'}`}>{dict.header.participation_gallery || 'Participation Gallery'}</Link>
                    </div>
                  </div>
                </>
              )}
            </nav>

            {/* Simple profile links area (Guest/Auth) */}
            <div className="flex items-center gap-4 select-none border-l border-border pl-4 dir-none">
              {loading ? (
                <div className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-28 bg-muted rounded-lg border border-border/40" />
                  <div className="w-12 h-12 rounded-full bg-muted" />
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
                    className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-muted text-foreground hover:bg-muted hover:text-foreground transition-all border border-border shadow-sm hover:scale-105 active:scale-95 duration-200"
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
        className={`hidden lg:block w-full bg-card text-muted-foreground transition-all duration-300 ease-in-out border-b border-border ${
          isScrolled ? 'max-h-0 py-0 border-b-0 opacity-0 overflow-hidden' : 'max-h-[100px] py-1 opacity-100 overflow-visible'
        }`}
        style={{ paddingLeft: 'var(--ag-container-px)', paddingRight: 'var(--ag-container-px)' }}
      >
        <div className="mx-auto w-full max-w-7xl flex items-center justify-between gap-6">
          <div className="shrink-0 border-e border-border pe-5 flex items-center">
            {loading ? (
              <div className="h-5 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <AppMenu dict={dict} align="left" isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <div className="flex items-center gap-3 text-foreground hover:text-primary p-1.5 -ml-1.5 rounded transition-colors">
                  <i className="fa-solid fa-bars text-3xl"></i>
                  <span className="font-bold text-[21px] tracking-wide leading-none">{dict.header.menu}</span>
                </div>
              </AppMenu>
            )}
          </div>

          <div ref={categoriesRef} className="flex-1 flex justify-end items-center gap-6 overflow-visible">
            <nav className="flex items-center gap-5 text-[16px] font-bold tracking-wide whitespace-nowrap">
              {loading ? (
                <>
                  <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-14 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-10 bg-muted animate-pulse rounded" />
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
                      inactiveClassName="text-muted-foreground border-b-transparent hover:text-foreground hover:border-b-primary font-bold"
                    >
                      {category.name}
                    </CategoryLink>
                  )
                })
              )}

              {dropdownCategories.length > 0 && !loading && (
                <div className="relative group">
                  <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-bold text-[16px] focus:outline-none border-y-2 border-t-transparent border-b-transparent hover:border-b-primary pt-1 pb-1">
                    <span>{dict.header.categories.others}</span>
                    <i className="fa-solid fa-chevron-down text-[11px] ml-1 text-muted-foreground group-hover:text-foreground"></i>
                  </button>
                  <div className={`absolute ${activeLang === 'ar' ? 'left-0' : 'right-0'} mt-3.5 w-48 rounded-md bg-card border border-border p-1.5 shadow-xl invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-155 z-50`}>
                    {dropdownCategories.map((category, index) => (
                      <Link
                        key={index}
                        href={category.href}
                        className="block px-3.5 py-2.5 text-sm text-foreground hover:bg-muted hover:text-foreground rounded transition-colors"
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

export function HeaderGuest(props: Omit<HeaderGuestProps, 'loading'>) {
  const pathname = usePathname() || '/'
  return <HeaderGuestBase {...props} pathname={pathname} />
}

export function HeaderGuestStatic(props: HeaderGuestProps) {
  return <HeaderGuestBase {...props} pathname="" />
}

export function HeaderGuestSkeleton(props: Omit<HeaderGuestProps, 'loading'>) {
  return <HeaderGuestBase {...props} pathname="" loading={true} />
}

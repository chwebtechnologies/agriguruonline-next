'use client'

import { useState, useEffect, useRef, useCallback, useMemo, useTransition, useId } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SearchProduct, SearchApiResponse } from '@/types/search'
import { getAssetsUrl } from '@/lib/api-utils'
import { tradingService } from '@/lib/api'
import { AgriGuruLogo } from '@/components/layout/HeaderGuest'
import { MarketedProductCard } from '@/components/marketed-products/MarketedProductCard'

interface HeaderSearchProps {
  placeholder?: string
  lang?: string
  categories?: Array<{ name: string; href: string }>
  dict?: any
  initialSearchProducts?: SearchProduct[]
  userType?: string | null
}

export function HeaderSearch({
  placeholder = 'Search Product',
  lang = 'en',
  dict = {},
  initialSearchProducts = [],
  userType,
}: HeaderSearchProps) {
  const router = useRouter()
  const searchId = useId()
  const [, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)
  const desktopInputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Desktop Scroll container refs & state for permanent custom scrollbar
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scrollRatio, setScrollRatio] = useState(0)
  const [thumbHeightPercent, setThumbHeightPercent] = useState(30)
  const [canScroll, setCanScroll] = useState(false)

  // State
  const [isOpen, setIsOpen] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isMac, setIsMac] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(null)
  const [selectedSpecsProduct, setSelectedSpecsProduct] = useState<SearchProduct | null>(null)

  // Reset query and close views on page navigation
  useEffect(() => {
    const handleNav = () => {
      setIsOpen(false)
      setIsMobileSearchOpen(false)
      setQuery('')
    }
    window.addEventListener('popstate', handleNav)
    return () => window.removeEventListener('popstate', handleNav)
  }, [])

  // Data states
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const cacheRef = useRef<Map<string, SearchProduct[]>>(new Map())

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`

  const isRtl = lang === 'ar'

  // Detect OS for shortcut
  useEffect(() => {
    setIsMac(typeof navigator !== 'undefined' && navigator.userAgent.toUpperCase().indexOf('MAC') >= 0)
  }, [])

  // Keyboard shortcut (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (window.innerWidth < 1024) {
          setIsMobileSearchOpen(true)
          setTimeout(() => mobileInputRef.current?.focus(), 50)
        } else {
          desktopInputRef.current?.focus()
          setIsOpen(true)
        }
      } else if (e.key === 'Escape') {
        if (selectedSpecsProduct) {
          setSelectedSpecsProduct(null)
        } else if (isMobileSearchOpen) {
          setIsMobileSearchOpen(false)
          setQuery('')
        } else {
          setIsOpen(false)
          setQuery('')
          desktopInputRef.current?.blur()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSpecsProduct, isMobileSearchOpen])

  // Comprehensive outside click / touch / blur handler to immediately clear search query on desktop
  useEffect(() => {
    const handleOutsideInteraction = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('pointerdown', handleOutsideInteraction, true)
    document.addEventListener('mousedown', handleOutsideInteraction, true)
    document.addEventListener('touchstart', handleOutsideInteraction, true)
    document.addEventListener('click', handleOutsideInteraction, true)

    return () => {
      document.removeEventListener('pointerdown', handleOutsideInteraction, true)
      document.removeEventListener('mousedown', handleOutsideInteraction, true)
      document.removeEventListener('touchstart', handleOutsideInteraction, true)
      document.removeEventListener('click', handleOutsideInteraction, true)
    }
  }, [])

  const [fetchError, setFetchError] = useState<string | null>(null)

  // Open desktop dropdown
  const handleDesktopFocus = () => {
    setIsOpen(true)
  }

  // Open mobile full search view
  const handleMobileClick = () => {
    setIsMobileSearchOpen(true)
    setTimeout(() => {
      mobileInputRef.current?.focus()
    }, 50)
  }

  // Filtered initial sections (ensuring no duplicates and active products only)
  const { frequentlySearchedList, marketedProductsList, bestSellerList } = useMemo(() => {
    const activeProducts = initialSearchProducts.filter((p) => p.is_active !== false)

    const freq = activeProducts.filter((p) => p.frequently_search).slice(0, 4)
    const freqIds = new Set(freq.map((p) => p.id))

    const marketed = activeProducts
      .filter((p) => p.is_marketed && !freqIds.has(p.id))
      .slice(0, 4)
    const marketedIds = new Set(marketed.map((p) => p.id))

    const best = activeProducts
      .filter((p) => p.best_seller && !freqIds.has(p.id) && !marketedIds.has(p.id))
      .slice(0, 4)

    return {
      frequentlySearchedList: freq,
      marketedProductsList: marketed,
      bestSellerList: best,
    }
  }, [initialSearchProducts])

  // Debounced Search API (Starts on 4th keypress / >= 4 chars)
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 4) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const cacheKey = `${lang}_${trimmed.toLowerCase()}`
    if (cacheRef.current.has(cacheKey)) {
      setSearchResults(cacheRef.current.get(cacheKey) || [])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timeoutId = setTimeout(async () => {
      try {
        const json = await tradingService.searchProducts({ isActive: true, query: trimmed, lang });
        
        let prods: SearchProduct[] = []
        if (json?.data?.products && Array.isArray(json.data.products)) {
          prods = json.data.products
        } else if (json?.data && Array.isArray(json.data)) {
          prods = json.data
        } else if (Array.isArray(json)) {
          prods = json
        }
        
        if (prods.length > 0) {
          cacheRef.current.set(cacheKey, prods)
          setSearchResults(prods)
        } else {
          setSearchResults([])
        }
      } catch (err) {
        console.error('Error during product search:', err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, lang])

  // Select a product
  const handleProductSelect = (product: SearchProduct) => {
    setIsOpen(false)
    setIsMobileSearchOpen(false)
    setQuery('')
    desktopInputRef.current?.blur()
    const productSlug = product.slug || product.id
    startTransition(() => {
      router.push(`/${lang}/product/${encodeURIComponent(productSlug)}`)
    })
  }

  // Handle Buy/Sell Action from Mobile Cards
  const handleActionClick = (e: React.MouseEvent, product: SearchProduct, action: 'buy' | 'sell' | 'add') => {
    e.stopPropagation()
    setIsMobileSearchOpen(false)
    setQuery('')
    const productSlug = product.slug || product.id
    startTransition(() => {
      if (action === 'buy' || action === 'sell') {
        router.push(`/${lang}/product/${encodeURIComponent(productSlug)}?action=${action}`)
      } else {
        router.push(`/${lang}/product/${encodeURIComponent(productSlug)}`)
      }
    })
  }

  const getProductImageUrl = (product: SearchProduct) => {
    const raw = product.thumbnail || product.image
    if (!raw) return '/logo.webp'
    return raw.startsWith('http') ? raw : `${imageBaseUrl}${raw}`
  }

  const getCountryFlagUrl = (product: SearchProduct) => {
    const flag = product.country?.flag
    if (!flag) return null
    return flag.startsWith('http') ? flag : `${imageBaseUrl}${flag}`
  }

  const scrollRafRef = useRef<number | null>(null)

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    }
  }, [])

  // Update permanent custom scrollbar positions for desktop dropdown
  const updateScrollMetrics = useCallback(() => {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current)
    }
    scrollRafRef.current = requestAnimationFrame(() => {
      const el = scrollContainerRef.current
      if (!el) return
      const { scrollTop, scrollHeight, clientHeight } = el
      const maxScroll = scrollHeight - clientHeight
      if (maxScroll > 10) {
        setCanScroll(true)
        const ratio = scrollTop / maxScroll
        setScrollRatio(Math.min(1, Math.max(0, ratio)))
        const heightPercent = Math.max(20, Math.min(80, (clientHeight / scrollHeight) * 100))
        setThumbHeightPercent(heightPercent)
      } else {
        setCanScroll(false)
      }
    })
  }, [])

  useEffect(() => {
    updateScrollMetrics()
  }, [isOpen, query, searchResults, initialSearchProducts, isSearching, updateScrollMetrics])

  // Parse HTML quality specification
  const parseSpecifications = (html?: string) => {
    if (!html) return { tableData: [], otherData: [] }
    const decoded = html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
    const textWithNewlines = decoded
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
    const items = textWithNewlines.split('\n').map((s) => s.trim()).filter(Boolean)
    const tableData: { key: string; value: string }[] = []
    const otherData: string[] = []

    items.forEach((item) => {
      const cleanItem = item.replace(/,$/, '').trim()
      const colonIndex = cleanItem.indexOf(':')
      if (colonIndex > 0) {
        const key = cleanItem.substring(0, colonIndex).trim()
        const value = cleanItem.substring(colonIndex + 1).trim()
        if (key.length < 50 && value) {
          tableData.push({ key, value })
        } else {
          otherData.push(cleanItem)
        }
      } else {
        otherData.push(cleanItem)
      }
    })
    return { tableData, otherData }
  }

  // Active products to display on mobile: searchResults if query >= 4, else marketedProductsList
  const mobileDisplayProducts = query.trim().length >= 4 ? searchResults : marketedProductsList

  return (
    <div ref={containerRef} className="relative w-full" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* ========================================================================= */}
      {/* 1. DESKTOP HEADER SEARCH INPUT BAR (Shown on Large screens: lg and up)    */}
      {/* ========================================================================= */}
      <div className="hidden lg:block group relative w-full">
        <div className="pointer-events-none absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 flex items-center pl-3.5 rtl:pl-0 rtl:pr-3.5 z-10">
          {isSearching ? (
            <i className="fa-solid fa-spinner fa-spin text-primary text-[14px]"></i>
          ) : (
            <i className="fa-solid fa-magnifying-glass text-muted-foreground group-focus-within:text-primary transition-colors text-[14px]"></i>
          )}
        </div>

        <input
          ref={desktopInputRef}
          type="text"
          id="header-search-desktop"
          aria-label="Search commodities and markets"
          name="q"
          value={query}
          onFocus={handleDesktopFocus}
          onClick={handleDesktopFocus}
          onBlur={(e) => {
            if (!containerRef.current?.contains(e.relatedTarget as Node)) {
              setIsOpen(false)
              setQuery('')
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full h-10 rounded-lg sm:rounded-xl border border-border bg-muted/80 pl-9 rtl:pl-8 sm:pl-10 pr-9 rtl:pr-9 sm:pr-20 text-xs sm:text-[13.5px] font-medium text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 shadow-2xs [&::-webkit-search-cancel-button]:hidden"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              desktopInputRef.current?.focus()
            }}
            className="absolute inset-y-0 right-2.5 rtl:right-auto rtl:left-2.5 sm:right-11 rtl:sm:left-11 flex items-center justify-center text-muted-foreground/70 hover:text-foreground focus:outline-none z-10 cursor-pointer"
            aria-label="Clear search"
          >
            <i className="fa-solid fa-circle-xmark text-[16px]"></i>
          </button>
        )}

        <div className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 flex items-center pr-2.5 rtl:pr-0 rtl:pl-2.5 pointer-events-none">
          <kbd className="hidden sm:inline-flex items-center gap-0.5 h-5 select-none rounded-md border border-border bg-card px-1.5 font-mono text-[10px] font-bold text-muted-foreground shadow-2xs">
            <span>{isMac ? '⌘' : 'Ctrl'}</span>K
          </kbd>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MOBILE HEADER TRIGGER INPUT (Shown on Screens < lg)                     */}
      {/* ========================================================================= */}
      <div className="lg:hidden w-full">
        <button
          type="button"
          onClick={handleMobileClick}
          className="w-full h-10 rounded-lg border border-border bg-muted/80 px-3 flex items-center gap-2.5 text-xs text-muted-foreground focus:outline-none cursor-pointer block select-none"
        >
          <i className="fa-solid fa-magnifying-glass text-[13px] text-muted-foreground pointer-events-none"></i>
          <span className="truncate pointer-events-none select-none">{query || placeholder}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. DESKTOP DROPDOWN WINDOW (Anchored under search bar on lg+)              */}
      {/* ========================================================================= */}
      {isOpen && (
        <div className="hidden lg:block absolute top-full left-0 right-0 mt-1.5 z-50 w-full bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 transition-theme">
          <div className="relative">
            {/* Scrollable Container with Native Scrollbar Hidden and Custom DOM Scrollbar */}
            <div
              ref={scrollContainerRef}
              onScroll={updateScrollMetrics}
              className="max-h-[85vh] sm:max-h-[500px] overflow-y-auto overscroll-contain pr-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {/* STATE A: Search Results (Grid format matching screenshot) */}
              {query.trim().length >= 4 ? (
                <div className="p-3.5 sm:p-4">
                  <div className="flex items-center gap-2 mb-3 text-foreground font-bold text-[14px] sm:text-[15px]">
                    <i className="fa-solid fa-mug-hot text-foreground/80 text-[14px]"></i>
                    <span>{dict?.search_result_for || 'Search Result for'} &ldquo;{query}&rdquo;</span>
                  </div>

                  {isSearching ? (
                    <div className="grid grid-cols-4 gap-2.5">
                      {[1, 2, 3, 4].map((n) => (
                        <div key={n} className="flex flex-col items-center animate-pulse">
                          <div className="w-full aspect-square rounded-xl bg-muted/80 border border-border/60"></div>
                          <div className="w-4/5 h-2.5 bg-muted/80 rounded mt-1.5"></div>
                          <div className="w-3/5 h-2 bg-muted/60 rounded mt-1"></div>
                        </div>
                      ))}
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2.5 animate-in fade-in duration-200">
                      {searchResults.map((product) => {
                        const imageUrl = getProductImageUrl(product)

                        return (
                          <div
                            key={product.id}
                            title={product.name}
                            onClick={() => handleProductSelect(product)}
                            className="group flex flex-col items-center cursor-pointer"
                          >
                            <div className="relative w-full aspect-square rounded-xl border border-border/80 overflow-hidden bg-muted/40 shadow-xs group-hover:border-primary/50 group-hover:shadow-sm transition-all">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  e.currentTarget.src = '/logo.svg'
                                }}
                              />
                            </div>
                            <span className="text-[11px] sm:text-[11.5px] font-medium text-foreground/90 group-hover:text-primary transition-colors text-center line-clamp-2 leading-[13.5px] min-h-[27px] w-full mt-1.5 px-0.5 break-words">
                              {product.name}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-7 px-3 text-center animate-in fade-in duration-200">
                      <i className="fa-solid fa-wheat-awn-circle-exclamation text-2xl text-muted-foreground mb-2"></i>
                      <p className="text-xs font-bold text-foreground">{dict?.no_search_results_found_for || 'No search results found for'} &ldquo;{query}&rdquo;</p>
                    </div>
                  )}
                </div>
              ) : (
                /* STATE B: Initial State (Frequently Searched, Marketed Products, Best Sellers) */
                <div className="p-3.5 sm:p-4 pb-5 space-y-3.5">
                  {/* SECTION 1: Frequently Searched */}
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-foreground font-bold text-[13.5px] sm:text-[14.5px]">
                      <i className="fa-solid fa-spinner text-foreground/80 text-[13px]"></i>
                      <span>{dict?.frequently_searched || 'Frequently Searched'}</span>
                    </div>

                    {frequentlySearchedList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {frequentlySearchedList.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => handleProductSelect(product)}
                            className="px-3 py-1 rounded-xl bg-muted/80 hover:bg-muted hover:text-primary border border-border/60 text-foreground text-[11.5px] sm:text-[12px] font-medium transition-colors text-left cursor-pointer"
                          >
                            {product.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: Marketed Products */}
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-foreground font-bold text-[13.5px] sm:text-[14.5px]">
                      <i className="fa-solid fa-mug-hot text-foreground/80 text-[13px]"></i>
                      <span>{dict?.marketed_products || 'Marketed Products'}</span>
                    </div>

                    {marketedProductsList.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {marketedProductsList.map((product) => {
                          const imageUrl = getProductImageUrl(product)
                          return (
                            <div
                              key={product.id}
                              title={product.name}
                              onClick={() => handleProductSelect(product)}
                              className="group flex flex-col items-center cursor-pointer"
                            >
                              <div className="relative w-full aspect-square rounded-xl border border-border/80 overflow-hidden bg-muted/40 shadow-xs group-hover:border-primary/50 group-hover:shadow-sm transition-all">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imageUrl}
                                  alt={product.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  onError={(e) => {
                                    e.currentTarget.src = '/logo.svg'
                                  }}
                                />
                              </div>
                              <span className="text-[10.5px] sm:text-[11px] font-medium text-foreground/90 group-hover:text-primary transition-colors text-center line-clamp-2 leading-[13px] min-h-[26px] w-full mt-1 px-0.5 break-words">
                                {product.name}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* SECTION 3: Best Sellers */}
                  <div className="pb-1">
                    <div className="flex items-center gap-2 mb-2 text-foreground font-bold text-[13.5px] sm:text-[14.5px]">
                      <i className="fa-solid fa-medal text-foreground/80 text-[13px]"></i>
                      <span>{dict?.best_sellers || 'Best Sellers'}</span>
                    </div>

                    {bestSellerList.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {bestSellerList.map((product) => {
                          const imageUrl = getProductImageUrl(product)
                          return (
                            <div
                              key={product.id}
                              title={product.name}
                              onClick={() => handleProductSelect(product)}
                              className="group flex flex-col items-center cursor-pointer"
                            >
                              <div className="relative w-full aspect-square rounded-xl border border-border/80 overflow-hidden bg-muted/40 shadow-xs group-hover:border-primary/50 group-hover:shadow-sm transition-all">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imageUrl}
                                  alt={product.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  onError={(e) => {
                                    e.currentTarget.src = '/logo.svg'
                                  }}
                                />
                              </div>
                              <span className="text-[10.5px] sm:text-[11px] font-medium text-foreground/90 group-hover:text-primary transition-colors text-center line-clamp-2 leading-[13px] min-h-[26px] w-full mt-1 px-0.5 break-words">
                                {product.name}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* PERMANENT CUSTOM SCROLLBAR: Real DOM Element that NEVER auto-hides */}
            {canScroll && (
              <div
                className="absolute right-1 top-3 bottom-3 w-1.5 rounded-full bg-muted/80 pointer-events-none z-20"
                aria-hidden="true"
              >
                <div
                  className="w-full rounded-full bg-muted-foreground/70 transition-[top] duration-75"
                  style={{
                    height: `${thumbHeightPercent}%`,
                    position: 'absolute',
                    top: `${scrollRatio * (100 - thumbHeightPercent)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MOBILE / TABLET FULL-SCREEN SEARCH VIEW (Portaled to document.body)     */}
      {/* ========================================================================= */}
      {isMobileSearchOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div className="lg:hidden fixed inset-0 z-[999999] bg-background text-foreground flex flex-col animate-in fade-in duration-150">
          {/* Mobile Header Bar matching main header bg-card, border-border, text-foreground */}
          <header className="sticky top-0 z-20 w-full bg-card text-foreground border-b border-border py-2.5 px-3 sm:px-4 flex items-center gap-3 shadow-sm">
            {/* Back Button '<' */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setIsMobileSearchOpen(false);
                setQuery('');
              }}
              className="w-10 h-10 rounded-full bg-muted text-foreground hover:text-primary flex items-center justify-center border border-border shrink-0 transition-colors cursor-pointer select-none"
            >
              <span className="sr-only">Back</span>
              <i className="fa-solid fa-chevron-left text-base" aria-hidden="true"></i>
            </button>

            {/* AgriGuru Logo */}
            <Link
              href={`/${lang}`}
              onClick={() => {
                setIsMobileSearchOpen(false)
                setQuery('')
              }}
              className="shrink-0 flex items-center focus:outline-none"
            >
              <AgriGuruLogo size={42} />
            </Link>

            {/* Full Width Search Input (Login/Register removed) */}
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 flex items-center pl-3.5 rtl:pl-0 rtl:pr-3.5 z-10">
                {isSearching ? (
                  <i className="fa-solid fa-spinner fa-spin text-primary text-[14px]"></i>
                ) : (
                  <i className="fa-solid fa-magnifying-glass text-muted-foreground text-[14px]"></i>
                )}
              </div>

              <input
                ref={mobileInputRef}
                type="text"
                id="header-search-mobile"
                aria-label="Search commodities and markets"
                name="mobile_q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                className="w-full h-10 rounded-lg sm:rounded-xl border border-border bg-muted/80 pl-9 rtl:pl-8 pr-9 rtl:pr-9 text-xs sm:text-[13.5px] font-medium text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 shadow-2xs [&::-webkit-search-cancel-button]:hidden"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    mobileInputRef.current?.focus()
                  }}
                  className="absolute inset-y-0 right-2.5 rtl:right-auto rtl:left-2.5 flex items-center justify-center text-muted-foreground hover:text-foreground focus:outline-none z-10 cursor-pointer"
                  aria-label="Clear search"
                >
                  <i className="fa-solid fa-circle-xmark text-[16px]"></i>
                </button>
              )}
            </div>
          </header>

          {/* Mobile Results Body: 2-Column Product Cards reusing MarketedProductCard */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 overscroll-contain bg-background">
            <div className="max-w-7xl mx-auto">
              {isSearching && query.trim().length >= 4 ? (
                /* Loading Skeletons for 2-column cards */
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="rounded-2xl bg-card border border-border overflow-hidden animate-pulse">
                      <div className="w-full aspect-square bg-muted/60"></div>
                      <div className="p-2 space-y-2">
                        <div className="h-3.5 w-3/4 bg-muted rounded mx-auto"></div>
                        <div className="h-3.5 w-1/2 bg-muted rounded mx-auto"></div>
                        <div className="h-7 w-full bg-muted rounded-lg"></div>
                        <div className="flex gap-1.5 w-full">
                          <div className="h-7 flex-1 bg-muted rounded-lg"></div>
                          <div className="h-7 flex-1 bg-muted rounded-lg"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : mobileDisplayProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {mobileDisplayProducts.map((product, index) => (
                    <MarketedProductCard
                      key={product.id}
                      product={product as any}
                      lang={lang}
                      common={{
                        buy: 'Buy',
                        sell: 'Sell',
                        addProduct: 'Add Product',
                        viewDetails: 'View Details',
                      }}
                      imageBaseUrl={imageBaseUrl}
                      isLCP={index === 0}
                      userType={userType}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 px-4 text-center">
                  <i className="fa-solid fa-wheat-awn-circle-exclamation text-3xl text-muted-foreground mb-3"></i>
                  <p className="text-sm font-bold text-foreground">{dict?.no_commodities_found_for || 'No commodities found for'} &ldquo;{query}&rdquo;</p>
                  <p className="text-xs text-muted-foreground mt-1">{dict?.try_searching_another || 'Try searching another commodity name'}</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* 5. EMBEDDED SPECIFICATIONS MODAL (When tapping Info icon)                 */}
      {/* ========================================================================= */}
      {selectedSpecsProduct && mounted && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedSpecsProduct(null)
          }}
        >
          <div
            className="bg-card text-foreground rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-border flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card">
              <h2 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                <i className="fa-solid fa-file-lines text-primary text-xs"></i>
                <span className="truncate">{selectedSpecsProduct.name} {dict?.specifications || 'Specifications'}</span>
              </h2>
              <button
                onClick={() => setSelectedSpecsProduct(null)}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                aria-label="Close specifications"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[55vh] space-y-3">
              {(() => {
                const { tableData, otherData } = parseSpecifications(selectedSpecsProduct.quality_specification)
                return (
                  <>
                    {tableData.length > 0 ? (
                      <div className="border border-border rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <tbody>
                            {tableData.map((row, idx) => (
                              <tr key={idx} className={`border-b border-border/60 ${idx % 2 === 0 ? 'bg-muted/20' : 'bg-card'}`}>
                                <td className="py-2 px-3 font-bold text-foreground w-1/2 border-r border-border/60">
                                  {row.key}
                                </td>
                                <td className="py-2 px-3 text-muted-foreground w-1/2">
                                  {row.value}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {otherData.length > 0 ? (
                      <div className="p-2.5 bg-muted/40 rounded-xl border border-border text-xs text-foreground/90 space-y-1">
                        {otherData.map((item, idx) => (
                          <div key={idx}>• {item}</div>
                        ))}
                      </div>
                    ) : null}

                    {tableData.length === 0 && otherData.length === 0 && (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        No detailed specifications found for this commodity.
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            <div className="px-4 py-2.5 border-t border-border bg-card/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const prod = selectedSpecsProduct
                  setSelectedSpecsProduct(null)
                  handleProductSelect(prod)
                }}
                className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors"
              >
                View Product Details
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

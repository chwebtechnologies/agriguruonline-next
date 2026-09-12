'use client'

import { useState, useEffect, useRef, useTransition, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SearchProduct, SearchApiResponse, RecentSearchItem } from '@/types/search'
import { getTradingApiUrl, getAssetsUrl } from '@/lib/api-utils'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  lang: string
  categories?: Array<{ name: string; href: string }>
}

const POPULAR_CATEGORIES = [
  { name: 'Rice', slug: 'rice', icon: 'fa-solid fa-bowl-rice' },
  { name: 'Sugar', slug: 'sugar', icon: 'fa-solid fa-cubes-stacked' },
  { name: 'Grains', slug: 'grains', icon: 'fa-solid fa-wheat-awn' },
  { name: 'Pulses', slug: 'pulses', icon: 'fa-solid fa-seedling' },
  { name: 'Spices', slug: 'spices', icon: 'fa-solid fa-pepper-hot' },
  { name: 'Oil Seeds', slug: 'oil-seeds', icon: 'fa-solid fa-oil-can' },
  { name: 'Flours', slug: 'flours', icon: 'fa-solid fa-bag-shopping' },
  { name: 'Edible Oil', slug: 'edible-oil', icon: 'fa-solid fa-bottle-droplet' },
]

export function SearchModal({ isOpen, onClose, lang = 'en', categories = [] }: SearchModalProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchProduct[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [trendingProducts, setTrendingProducts] = useState<SearchProduct[]>([])
  const [isTrendingLoading, setIsTrendingLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [selectedSpecsProduct, setSelectedSpecsProduct] = useState<SearchProduct | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)
  const cacheRef = useRef<Map<string, { products: SearchProduct[]; total: number }>>(new Map())

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  const tradingApiUrl = getTradingApiUrl()

  const isRtl = lang === 'ar'

  // Load Recent Searches from localStorage on open
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('agriguru_recent_searches')
        if (stored) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setRecentSearches(JSON.parse(stored))
        }
      } catch (err) {
        console.error('Error loading recent searches:', err)
      }
    }
  }, [isOpen])

  // Save Recent Search
  const saveRecentSearch = useCallback((searchTerm: string, productTitle?: string) => {
    const trimmed = searchTerm.trim()
    if (!trimmed) return

    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.query.toLowerCase() !== trimmed.toLowerCase())
      const newItem: RecentSearchItem = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        query: trimmed,
        title: productTitle || trimmed,
        timestamp: Date.now(),
      }
      const updated = [newItem, ...filtered].slice(0, 6)
      try {
        localStorage.setItem('agriguru_recent_searches', JSON.stringify(updated))
      } catch (e) {
        console.error('Error saving recent search:', e)
      }
      return updated
    })
  }, [])

  // Remove Single Recent Search
  const removeRecentSearch = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item.id !== id)
      try {
        localStorage.setItem('agriguru_recent_searches', JSON.stringify(updated))
      } catch (err) {
        console.error('Error saving recent searches:', err)
      }
      return updated
    })
  }

  // Clear All Recent Searches
  const clearAllRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRecentSearches([])
    try {
      localStorage.removeItem('agriguru_recent_searches')
    } catch (err) {
      console.error('Error clearing recent searches:', err)
    }
  }

  // Pre-fetch Trending / Marketed Products on first modal open
  useEffect(() => {
    if (!isOpen) return
    if (trendingProducts.length > 0) return

    let isMounted = true

    const fetchTrending = async () => {
      setIsTrendingLoading(true)
      try {
        const url = `${tradingApiUrl}/product?is_active=true&lang_code=${lang}&source=web`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch trending products')
        const json: SearchApiResponse = await res.json()
        if (isMounted && json.success && json.data?.products) {
          // Filter products with images and marketed/best_seller if available, or first 6 products
          const items = json.data.products
            .filter((p) => p.is_active !== false)
            .slice(0, 6)
          setTrendingProducts(items)
        }
      } catch (err) {
        console.error('Failed to load initial trending products:', err)
      } finally {
        if (isMounted) setIsTrendingLoading(false)
      }
    }

    fetchTrending()

    return () => {
      isMounted = false
    }
  }, [isOpen, lang, tradingApiUrl, trendingProducts.length])

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (!isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(-1)
      setSelectedSpecsProduct(null)
    }
  }

  const [prevQuery, setPrevQuery] = useState(query)
  if (query !== prevQuery) {
    setPrevQuery(query)
    const trimmed = query.trim()
    if (trimmed.length < 3) {
      setResults([])
      setTotalCount(0)
      setIsLoading(false)
      setSelectedIndex(-1)
    }
  }

  // Handle open state side-effects (focus and body scroll)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => {
        document.body.style.overflow = ''
        clearTimeout(timer)
      }
    } else {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Debounced API Search
  useEffect(() => {
    const trimmed = query.trim()

    // Reset results if query is too short
    if (trimmed.length < 3) {
      return
    }

    // Check cache first
    const cacheKey = `${lang}_${trimmed.toLowerCase()}`
    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey)!
      setResults(cached.products)
      setTotalCount(cached.total)
      setIsLoading(false)
      setSelectedIndex(-1)
      return
    }

    setIsLoading(true)
    const timeoutId = setTimeout(async () => {
      try {
        const url = `${tradingApiUrl}/product?is_active=true&search=${encodeURIComponent(trimmed)}&lang_code=${lang}&source=web`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Search failed')
        const json: SearchApiResponse = await res.json()

        if (json.success && json.data) {
          const prods = json.data.products || []
          const total = json.data.total || prods.length
          cacheRef.current.set(cacheKey, { products: prods, total })
          setResults(prods)
          setTotalCount(total)
        } else {
          setResults([])
          setTotalCount(0)
        }
      } catch (err) {
        console.error('Search error:', err)
        setResults([])
        setTotalCount(0)
      } finally {
        setIsLoading(false)
        setSelectedIndex(-1)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, lang, tradingApiUrl])

  // Navigate to product chart/details
  const handleProductSelect = useCallback((product: SearchProduct) => {
    saveRecentSearch(query.trim() || product.name, product.name)
    onClose()
    startTransition(() => {
      // Direct navigation to product charts for specific commodity or category
      router.push(`/${lang}/product-charts?product=${encodeURIComponent(product.slug || product.id)}`)
    })
  }, [query, saveRecentSearch, onClose, startTransition, router, lang])

  // Navigate to category
  const handleCategorySelect = (categorySlug: string, categoryName: string) => {
    saveRecentSearch(categoryName)
    onClose()
    startTransition(() => {
      router.push(`/${lang}/category/${categorySlug}`)
    })
  }

  // Keyboard navigation inside modal
  const activeItemsCount = useMemo(() => {
    if (query.trim().length >= 3) {
      return results.length
    }
    return trendingProducts.length
  }, [query, results.length, trendingProducts.length])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        if (selectedSpecsProduct) {
          setSelectedSpecsProduct(null)
          return
        }
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < activeItemsCount - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : activeItemsCount - 1))
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0) {
          e.preventDefault()
          if (query.trim().length >= 3 && results[selectedIndex]) {
            handleProductSelect(results[selectedIndex])
          } else if (trendingProducts[selectedIndex]) {
            handleProductSelect(trendingProducts[selectedIndex])
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedSpecsProduct, onClose, activeItemsCount, selectedIndex, query, results, trendingProducts, handleProductSelect])

  // Scroll active item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsContainerRef.current) {
      const activeEl = resultsContainerRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  // Highlight search keyword in text
  const highlightMatch = (text: string, highlight: string) => {
    if (!highlight.trim()) return text
    const parts = text.split(new RegExp(`(${highlight.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'))
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <span key={i} className="text-primary font-black bg-primary/10 rounded px-0.5">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    )
  }

  // Parse HTML specifications helper
  const parseSpecifications = (html?: string) => {
    if (!html) return { tableData: [], otherData: [] }
    let decoded = html
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

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-start pt-12 sm:pt-20 px-3 sm:px-4 bg-black/60 backdrop-blur-sm transform-gpu overflow-hidden animate-in fade-in duration-200"
      dir={isRtl ? 'rtl' : 'ltr'}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search Commodity Database"
    >
      {/* Modal Dialog */}
      <div
        className="w-full max-w-3xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[82vh] animate-in zoom-in-95 duration-200 transition-theme"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-border bg-card">
          <div className="flex items-center justify-center w-6 h-6 text-muted-foreground mr-3 rtl:mr-0 rtl:ml-3">
            {isLoading ? (
              <i className="fa-solid fa-spinner fa-spin text-primary text-[17px]"></i>
            ) : (
              <i className="fa-solid fa-magnifying-glass text-muted-foreground text-[16px]"></i>
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            id="global-search-modal-input"
            aria-label="Search commodities, origins, products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commodities, origins, products (e.g. Rice, Sugar, Santos)..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm sm:text-base font-semibold outline-none focus:outline-none"
          />

          <div className="flex items-center gap-2">
            {query.length > 0 && (
              <button
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <i className="fa-solid fa-circle-xmark text-[15px]"></i>
              </button>
            )}

            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold font-mono uppercase bg-muted text-muted-foreground border border-border rounded-md select-none">
              ESC
            </kbd>

            <button
              onClick={onClose}
              className="sm:hidden p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Close modal"
            >
              <i className="fa-solid fa-xmark text-[16px]"></i>
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div ref={resultsContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain">
          {/* STATE 1: Typing Hint (1-2 characters) */}
          {query.trim().length > 0 && query.trim().length < 3 && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs sm:text-sm font-semibold animate-in fade-in duration-150">
              <i className="fa-solid fa-circle-info text-[14px]"></i>
              <span>Type at least 3 characters to search across live commodity pricing...</span>
            </div>
          )}

          {/* STATE 2: Active Results (query >= 3) */}
          {query.trim().length >= 3 && (
            <div>
              {/* Header result stats */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {isLoading ? 'Searching...' : `Found ${totalCount} commodit${totalCount === 1 ? 'y' : 'ies'}`}
                </span>
                {totalCount > 0 && !isLoading && (
                  <span className="text-[11px] font-semibold text-primary">Use ↑ ↓ and Enter to open</span>
                )}
              </div>

              {/* Skeletons while loading */}
              {isLoading && results.length === 0 && (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/40 animate-pulse"
                    >
                      <div className="w-12 h-12 rounded-lg bg-muted shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/3 bg-muted rounded"></div>
                        <div className="h-3 w-1/2 bg-muted rounded"></div>
                      </div>
                      <div className="w-16 h-6 bg-muted rounded"></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Search Results List */}
              {!isLoading && results.length > 0 && (
                <div className="space-y-2">
                  {results.map((product, index) => {
                    const isSelected = selectedIndex === index
                    const imageUrl = product.thumbnail || product.image
                      ? (product.thumbnail || product.image)!.startsWith('http')
                        ? (product.thumbnail || product.image)!
                        : `${imageBaseUrl}${product.thumbnail || product.image}`
                      : '/logo.webp'

                    const flagUrl = product.country?.flag
                      ? product.country.flag.startsWith('http')
                        ? product.country.flag
                        : `${imageBaseUrl}${product.country.flag}`
                      : null

                    const price = product.loading_ports?.[0]?.price
                    const portName = product.loading_ports?.[0]?.port?.name

                    return (
                      <div
                        key={product.id}
                        data-index={index}
                        onClick={() => handleProductSelect(product)}
                        className={`group relative flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary ring-1 ring-primary shadow-sm'
                            : 'bg-card hover:bg-muted/60 border-border hover:border-primary/40 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Product Image Thumbnail */}
                          <div className="relative w-12 h-12 rounded-lg border border-border overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                e.currentTarget.src = '/logo.svg'
                              }}
                            />
                            {flagUrl && (
                              <div className="absolute top-0.5 left-0.5 w-4 h-3 rounded-[1px] overflow-hidden border border-black/10 shadow-2xs bg-white">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={flagUrl} alt={product.country?.name || 'Flag'} className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>

                          {/* Product Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {product.category?.name && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                                  {product.category.name}
                                </span>
                              )}
                              {product.country?.name && (
                                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                                  <span>•</span>
                                  <span>{product.country.name}</span>
                                </span>
                              )}
                              {product.product_code && (
                                <span className="text-[10px] font-mono text-muted-foreground/70">
                                  ({product.product_code})
                                </span>
                              )}
                            </div>

                            <h4 className="text-[13.5px] sm:text-[15px] font-bold text-foreground truncate mt-0.5">
                              {highlightMatch(product.name, query)}
                            </h4>

                            {portName && (
                              <p className="text-[11px] font-medium text-muted-foreground truncate">
                                Port: <span className="text-foreground/80">{portName}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Price & Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {price && price > 0 ? (
                            <div className="text-right">
                              <div className="flex items-baseline gap-1 justify-end">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">FOB</span>
                                <span className="text-sm sm:text-base font-black text-brand-green tracking-tight">
                                  ${price}
                                </span>
                              </div>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">/ MT</span>
                            </div>
                          ) : null}

                          {product.quality_specification && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedSpecsProduct(product)
                              }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                              title="View Specifications"
                              aria-label="View Specifications"
                            >
                              <i className="fa-solid fa-file-lines text-sm"></i>
                            </button>
                          )}

                          <i className="fa-solid fa-arrow-right text-xs text-muted-foreground group-hover:text-primary group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-all"></i>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* No Results Empty State */}
              {!isLoading && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground mb-3">
                    <i className="fa-solid fa-wheat-awn-circle-exclamation text-2xl"></i>
                  </div>
                  <h4 className="text-base font-bold text-foreground">No commodities found for &ldquo;{query}&rdquo;</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                    Try checking your spelling or explore popular agricultural commodity categories below.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STATE 3: Default Initial View (when query is empty or short) */}
          {query.trim().length < 3 && (
            <div className="space-y-6">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5 px-1">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-clock-rotate-left text-[11px]"></i>
                      Recent Searches
                    </span>
                    <button
                      onClick={clearAllRecentSearches}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setQuery(item.query)}
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted hover:bg-primary/10 border border-border hover:border-primary/30 text-foreground text-xs font-semibold cursor-pointer transition-all shadow-2xs"
                      >
                        <i className="fa-solid fa-magnifying-glass text-[10px] text-muted-foreground group-hover:text-primary"></i>
                        <span>{item.title || item.query}</span>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(e, item.id)}
                          className="text-muted-foreground/60 hover:text-foreground text-[11px] ml-0.5 rtl:ml-0 rtl:mr-0.5"
                          title="Remove item"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Browse By Category */}
              <div>
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <i className="fa-solid fa-layer-group text-[11px]"></i>
                    Popular Categories
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {POPULAR_CATEGORIES.map((cat) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => handleCategorySelect(cat.slug, cat.name)}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-muted/40 hover:bg-primary/10 hover:border-primary/40 transition-all text-left rtl:text-right group cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <i className={`${cat.icon} text-sm`}></i>
                      </div>
                      <span className="text-xs font-bold text-foreground group-hover:text-primary truncate">
                        {cat.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trending & Featured Commodities */}
              <div>
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <i className="fa-solid fa-fire text-brand-orange text-[11px]"></i>
                    Trending Commodities
                  </span>
                  <Link
                    href={`/${lang}/product-charts`}
                    onClick={onClose}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>All Charts</span>
                    <i className="fa-solid fa-chevron-right text-[9px] rtl:rotate-180"></i>
                  </Link>
                </div>

                {isTrendingLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/40 animate-pulse">
                        <div className="w-10 h-10 rounded-lg bg-muted shrink-0"></div>
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-2/3 bg-muted rounded"></div>
                          <div className="h-2.5 w-1/3 bg-muted rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {trendingProducts.map((product, index) => {
                      const imageUrl = product.thumbnail || product.image
                        ? (product.thumbnail || product.image)!.startsWith('http')
                          ? (product.thumbnail || product.image)!
                          : `${imageBaseUrl}${product.thumbnail || product.image}`
                        : '/logo.webp'

                      const flagUrl = product.country?.flag
                        ? product.country.flag.startsWith('http')
                          ? product.country.flag
                          : `${imageBaseUrl}${product.country.flag}`
                        : null

                      const price = product.loading_ports?.[0]?.price

                      return (
                        <div
                          key={product.id}
                          onClick={() => handleProductSelect(product)}
                          className="group flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/40 transition-all cursor-pointer shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="relative w-10 h-10 rounded-lg border border-border overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                onError={(e) => {
                                  e.currentTarget.src = '/logo.webp'
                                }}
                              />
                              {flagUrl && (
                                <div className="absolute top-0.5 left-0.5 w-3.5 h-2.5 rounded-[1px] overflow-hidden border border-black/10 bg-white">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={flagUrl} alt="Flag" className="w-full h-full object-cover" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h5 className="text-[13px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                {product.name}
                              </h5>
                              <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground truncate">
                                <span>{product.category?.name || 'Commodity'}</span>
                                {product.country?.name && (
                                  <>
                                    <span>•</span>
                                    <span>{product.country.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {price && price > 0 ? (
                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-brand-green tracking-tight">
                                ${price}
                              </span>
                              <span className="block text-[8px] font-bold text-muted-foreground uppercase">
                                FOB / MT
                              </span>
                            </div>
                          ) : (
                            <i className="fa-solid fa-arrow-right text-[11px] text-muted-foreground group-hover:text-primary transition-colors shrink-0"></i>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Quick Jump Shortcuts */}
              <div>
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <i className="fa-solid fa-compass text-[11px]"></i>
                    Quick Navigation
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Link
                    href={`/${lang}/product-charts`}
                    onClick={onClose}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-primary/10 border border-border text-xs font-bold text-foreground hover:text-primary transition-colors"
                  >
                    <i className="fa-solid fa-chart-line text-brand-blue"></i>
                    <span>Price Charts</span>
                  </Link>
                  <Link
                    href={`/${lang}/market-reports`}
                    onClick={onClose}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-primary/10 border border-border text-xs font-bold text-foreground hover:text-primary transition-colors"
                  >
                    <i className="fa-solid fa-file-pdf text-brand-red"></i>
                    <span>Market Reports</span>
                  </Link>
                  <Link
                    href={`/${lang}/market-updates`}
                    onClick={onClose}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-primary/10 border border-border text-xs font-bold text-foreground hover:text-primary transition-colors"
                  >
                    <i className="fa-solid fa-newspaper text-brand-green"></i>
                    <span>Market Updates</span>
                  </Link>
                  <Link
                    href={`/${lang}/news`}
                    onClick={onClose}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-primary/10 border border-border text-xs font-bold text-foreground hover:text-primary transition-colors"
                  >
                    <i className="fa-solid fa-bullhorn text-brand-orange"></i>
                    <span>Latest News</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 border-t border-border bg-card/60 flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[9px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[9px]">↓</kbd>
              Navigate
            </span>
            <span className="hidden sm:inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[9px]">↵</kbd>
              Select
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[9px]">ESC</kbd>
              Close
            </span>
          </div>

          <div className="flex items-center gap-1 text-primary">
            <i className="fa-solid fa-shield-halved text-[10px]"></i>
            <span className="font-bold">AgriGuru Commodity Engine</span>
          </div>
        </div>
      </div>

      {/* Embedded Specifications Modal */}
      {selectedSpecsProduct && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm transform-gpu p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedSpecsProduct(null)
          }}
        >
          <div
            className="bg-card text-foreground rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-border flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Spec Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-card">
              <h2 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                <i className="fa-solid fa-file-lines text-primary text-xs"></i>
                <span className="truncate">{selectedSpecsProduct.name} Specifications</span>
              </h2>
              <button
                onClick={() => setSelectedSpecsProduct(null)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                aria-label="Close specifications"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Spec Content Table */}
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
              {(() => {
                const { tableData, otherData } = parseSpecifications(selectedSpecsProduct.quality_specification)
                return (
                  <>
                    {tableData.length > 0 ? (
                      <div className="border border-border rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <tbody>
                            {tableData.map((row, idx) => (
                              <tr key={idx} className={`border-b border-border/60 ${idx % 2 === 0 ? 'bg-muted/20' : 'bg-card'}`}>
                                <td className="py-2.5 px-3.5 font-bold text-foreground w-1/2 border-r border-border/60">
                                  {row.key}
                                </td>
                                <td className="py-2.5 px-3.5 text-muted-foreground w-1/2">
                                  {row.value}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}

                    {otherData.length > 0 ? (
                      <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs text-foreground/90 space-y-1">
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

            {/* Spec Footer */}
            <div className="px-5 py-3 border-t border-border bg-card/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const prod = selectedSpecsProduct
                  setSelectedSpecsProduct(null)
                  handleProductSelect(prod)
                }}
                className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors"
              >
                Open Commodity Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

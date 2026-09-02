'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback, Suspense, useTransition } from 'react'

interface CategoryOption {
  slug: string
  name: string
}

interface ListingFiltersProps {
  categories?: CategoryOption[]
}

function ListingFiltersInner({ categories = [] }: ListingFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const initialSearch = searchParams.get('search') || ''
  const initialCategory = searchParams.get('category') || ''
  const [searchTerm, setSearchTerm] = useState(initialSearch)

  const pushParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [name, value] of Object.entries(updates)) {
        if (value) {
          params.set(name, value)
        } else {
          params.delete(name)
        }
      }
      params.set('page', '1')
      return pathname + '?' + params.toString()
    },
    [searchParams, pathname]
  )

  // Debounced search (snappy 300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== (searchParams.get('search') || '')) {
        const len = searchTerm?.length || 0
        if (len === 0 || len >= 3) {
          startTransition(() => {
            router.push(pushParams({ search: searchTerm || '' }))
          })
        }
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, router, pushParams, searchParams, startTransition])

  const handleCategoryChange = (slug: string) => {
    startTransition(() => {
      router.push(pushParams({ category: slug }))
    })
  }

  return (
    <form method="GET" action="" className={`flex flex-row gap-2 sm:gap-3 w-full mt-1 mb-2 ${categories.length === 0 ? 'justify-end' : ''}`}>
      {/* Category Filter - LEFT */}
      {categories.length > 0 && (
        <div className="relative w-1/2">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="fa-solid fa-filter text-foreground/40 text-sm"></i>
          </div>
          <select
            name="category"
            id="category-filter"
            aria-label="Filter by category"
            className="block w-full pl-9 pr-8 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue transition-all appearance-none cursor-pointer shadow-2xs"
            value={initialCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <i className="fa-solid fa-chevron-down text-foreground/40 text-[10px]"></i>
          </div>
        </div>
      )}

      {/* Search - RIGHT */}
      <div className={`relative ${categories.length > 0 ? 'w-1/2' : 'w-full sm:w-1/2'}`}>
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <i className="fa-solid fa-magnifying-glass text-foreground/40 text-sm"></i>
        </div>
        <input
          type="text"
          name="search"
          id="search-filter"
          aria-label="Search items"
          className="block w-full pl-9 pr-10 py-2.5 bg-card border border-border rounded-xl text-sm placeholder-foreground/50 text-foreground focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue transition-all shadow-2xs"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground/40 hover:text-foreground transition-colors focus:outline-none"
            aria-label="Clear search"
          >
            <i className="fa-solid fa-circle-xmark text-[15px]"></i>
          </button>
        )}
      </div>
      
      {/* Hidden submit button for Enter key support natively */}
      <button type="submit" className="hidden" aria-hidden="true"></button>
    </form>
  )
}

export default function ListingFilters(props: ListingFiltersProps) {
  const FallbackUI = (
    <form method="GET" action="" className={`flex flex-row gap-2 sm:gap-3 w-full mt-1 mb-2 ${!props.categories || props.categories.length === 0 ? 'justify-end' : ''}`}>
      {props.categories && props.categories.length > 0 && (
        <div className="relative w-1/2">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="fa-solid fa-filter text-foreground/40 text-sm"></i>
          </div>
          <select
            name="category"
            aria-label="Filter by category"
            className="block w-full pl-9 pr-8 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue transition-all appearance-none cursor-pointer shadow-2xs"
          >
            <option value="">All Categories</option>
            {props.categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <i className="fa-solid fa-chevron-down text-foreground/40 text-[10px]"></i>
          </div>
        </div>
      )}
      <div className={`relative ${props.categories && props.categories.length > 0 ? 'w-1/2' : 'w-full sm:w-1/2'}`}>
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <i className="fa-solid fa-magnifying-glass text-foreground/40 text-sm"></i>
        </div>
        <input
          type="text"
          name="search"
          aria-label="Search items"
          className="block w-full pl-9 pr-10 py-2.5 bg-card border border-border rounded-xl text-sm placeholder-foreground/50 text-foreground focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue transition-all shadow-2xs"
          placeholder="Search..."
        />
        <button type="submit" className="hidden" aria-hidden="true"></button>
      </div>
    </form>
  )

  return (
    <Suspense fallback={FallbackUI}>
      <ListingFiltersInner {...props} />
    </Suspense>
  )
}

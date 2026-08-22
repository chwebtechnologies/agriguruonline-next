'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

export default function SearchFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const initialSearch = searchParams.get('search') || ''
  const [searchTerm, setSearchTerm] = useState(initialSearch)

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(name, value)
      } else {
        params.delete(name)
      }
      // Reset to page 1 on new search
      params.set('page', '1')
      return params.toString()
    },
    [searchParams]
  )

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm !== (searchParams.get('search') || '')) {
        const len = searchTerm?.length || 0
        if (len === 0 || len >= 3) {
          router.push(pathname + '?' + createQueryString('search', searchTerm || ''))
        }
      }
    }, 600)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm, pathname, router, createQueryString, searchParams])

  return (
    <div className="w-full max-w-md mb-6 px-2 sm:px-0">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <i className="fa-solid fa-magnifying-glass text-foreground/40 text-sm"></i>
        </div>
        <input
          type="text"
          className="block w-full pl-9 pr-10 py-2.5 bg-background border border-ag-header-border rounded-xl text-sm placeholder-foreground/50 text-foreground focus:outline-none focus:ring-1 focus:ring-brand-blue focus:border-brand-blue transition-all"
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
    </div>
  )
}

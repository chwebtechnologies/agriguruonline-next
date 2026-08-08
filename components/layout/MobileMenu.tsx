'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import CategoryLink from '@/components/ui/CategoryLink'

interface MobileMenuProps {
  dict: {
    header: {
      menu: string
      home: string
      about_us: string
      register_here: string
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
    navigation: {
      login: string
      register: string
    }
  }
  activeLang: string
  label?: string
  showLabel?: boolean
  categories?: Array<{ name: string; href: string }>
}

import { Suspense } from 'react'

export default function MobileMenu(props: MobileMenuProps) {
  return (
    <Suspense fallback={
      <button className="flex flex-col items-center justify-center p-2 text-ag-menu-text">
        <i className="fa-solid fa-bars text-xl mb-1"></i>
        {props.showLabel && <span className="text-[10px] leading-tight font-medium">{props.label}</span>}
      </button>
    }>
      <MobileMenuContent {...props} />
    </Suspense>
  )
}

function MobileMenuContent({ dict, activeLang, label, showLabel = false, categories: apiCategories }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // Prevent scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const categories = apiCategories || []

  return (
    <>
      {/* Hamburger Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 text-ag-header-text hover:text-primary focus:outline-none p-1.5 -ml-1.5 rounded transition-colors"
        aria-label="Open Menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-8 w-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
        {showLabel && (
          <span className="font-bold text-[21px] tracking-wide leading-none">{label || dict.header.menu}</span>
        )}
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-sm bg-background text-foreground h-full shadow-2xl flex flex-col p-6 overflow-y-auto border-l border-ag-header-border animate-in slide-in-from-right duration-200">
            {/* Close Button */}
            <div className="flex items-center justify-between pb-6 border-b border-ag-header-border">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 font-mono text-base font-bold text-white shadow-md shadow-emerald-900/30">A</span>
                <span className="text-lg font-bold tracking-tight font-sans">AgriGuru</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded bg-ag-search-bg hover:bg-ag-dropdown-hover-bg text-ag-search-placeholder hover:text-ag-nav-link-hover transition-colors focus:ring-2 focus:ring-emerald-500"
                aria-label="Close Menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation Links */}
            <div className="flex flex-col gap-4 py-6 border-b border-ag-header-border">
              <Link
                href={`/${activeLang}`}
                onClick={() => setIsOpen(false)}
                className="text-lg font-semibold hover:text-primary transition-colors py-1"
              >
                {dict.header.home}
              </Link>
              <Link
                href={`/${activeLang}/about`}
                onClick={() => setIsOpen(false)}
                className="text-lg font-semibold hover:text-primary transition-colors py-1"
              >
                {dict.header.about_us}
              </Link>
              <Link
                href={`/${activeLang}/login`}
                onClick={() => setIsOpen(false)}
                className="text-lg font-semibold hover:text-primary transition-colors py-1"
              >
                {dict.navigation.login}
              </Link>
              <Link
                href={`/${activeLang}/register`}
                onClick={() => setIsOpen(false)}
                className="inline-flex justify-center items-center rounded-lg bg-primary-gradient px-4 py-2.5 text-base font-semibold text-white shadow-md hover:opacity-90 active:scale-95 transition-all text-center mt-2"
              >
                {dict.header.register_here}
              </Link>
            </div>

            {/* Category Section */}
            {categories.length > 0 && (
              <div className="flex flex-col py-6">
                <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-4">{dict.header.menu}</h3>
                <div className="grid grid-cols-1 gap-2">
                  {categories.map((cat, i) => (
                    <CategoryLink
                      key={i}
                      href={cat.href}
                      onClick={() => setIsOpen(false)}
                      isActive={pathname === cat.href}
                      baseClassName="flex items-center justify-between text-[17px] py-2 px-3 rounded-lg border-b border-ag-search-border/30 last:border-0 hover:bg-ag-dropdown-hover-bg"
                      activeClassName="text-primary font-bold"
                      inactiveClassName="text-ag-nav-link"
                    >
                      {cat.name}
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 text-zinc-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </CategoryLink>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

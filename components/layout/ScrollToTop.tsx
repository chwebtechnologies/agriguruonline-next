'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function ScrollToTop() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Disable automatic browser scroll restoration so navigating to pages always starts at top
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // If there's an intentional in-page hash anchor (e.g. #market-watchlist or #faq), let the hash handler take care of it
    if (window.location.hash) return

    // Check if a designated scroll action is pending (e.g. market watchlist from homepage)
    try {
      if (sessionStorage.getItem('ag_scroll_to_watchlist') === 'true') {
        return
      }
    } catch {}

    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      if (document.documentElement) document.documentElement.scrollTop = 0
      if (document.body) document.body.scrollTop = 0
    }

    // 1. Instant scroll to top
    scrollToTop()

    // 2. Next animation frame to ensure layout shifts / rendering do not retain scroll
    const rafId = requestAnimationFrame(scrollToTop)

    // 3. Follow-up safety check for dynamic / streaming components
    const timerId = setTimeout(() => {
      if (!window.location.hash) {
        scrollToTop()
      }
    }, 60)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(timerId)
    }
  }, [pathname, searchParams])

  return null
}

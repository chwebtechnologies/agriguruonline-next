'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { forceUnlockScroll } from '@/lib/scroll-lock'

export default function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  const currentUrl = `${pathname}?${searchParams.toString()}`
  const prevUrlRef = useRef(currentUrl)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const trickleRef = useRef<NodeJS.Timeout | null>(null)

  const completeProgress = useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current)
      trickleRef.current = null
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    setProgress(100)
    const fadeTimer = setTimeout(() => {
      setIsVisible(false)
      setProgress(0)
    }, 250)

    return () => clearTimeout(fadeTimer)
  }, [])

  const startProgress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (trickleRef.current) clearInterval(trickleRef.current)

    setIsVisible(true)
    setProgress(25)

    // Smooth trickle forward so it feels responsive and alive
    trickleRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          if (trickleRef.current) clearInterval(trickleRef.current)
          return 85
        }
        const step = Math.max(2, (85 - prev) * 0.25)
        return Math.min(85, prev + step)
      })
    }, 180)

    // Safety timeout: Auto-complete and clear after 4.5 seconds so it NEVER stays stuck
    timerRef.current = setTimeout(() => {
      completeProgress()
    }, 4500)
  }, [completeProgress])

  // When pathname or searchParams change, navigation completed
  useEffect(() => {
    if (currentUrl !== prevUrlRef.current) {
      prevUrlRef.current = currentUrl
      // Ensure any leftover scroll locks are cleared on page change
      forceUnlockScroll()
      completeProgress()
    }
  }, [currentUrl, completeProgress])

  // Global anchor click listener
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      // Ignore if default was prevented (e.g. modals, tabs, JS click handlers)
      if (e.defaultPrevented) return
      // Only left clicks without modifier keys
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const target = (e.target as HTMLElement).closest('a')
      if (!target || !target.href) return

      // Ignore download links
      if (target.hasAttribute('download')) return

      // Ignore target="_blank"
      const targetAttr = target.getAttribute('target')
      if (targetAttr && targetAttr !== '_self') return

      try {
        const targetUrl = new URL(target.href, window.location.href)

        // Must be same origin
        if (targetUrl.origin !== window.location.origin) return

        // Ignore hash-only changes or same page anchor links
        if (
          targetUrl.pathname === window.location.pathname &&
          targetUrl.search === window.location.search
        ) {
          return
        }

        // Ignore non-http/https protocols (e.g. mailto, tel, javascript)
        if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') return

        // Ignore static asset downloads or API routes
        if (
          targetUrl.pathname.startsWith('/api/') ||
          /\.(pdf|zip|xlsx|xls|png|jpg|jpeg|svg|webp|csv)$/i.test(targetUrl.pathname)
        ) {
          return
        }

        startProgress()
      } catch {
        // invalid URL, ignore
      }
    }

    // Use bubbling phase so e.defaultPrevented is accurately checked
    document.addEventListener('click', handleAnchorClick, false)
    window.addEventListener('popstate', startProgress)

    return () => {
      document.removeEventListener('click', handleAnchorClick, false)
      window.removeEventListener('popstate', startProgress)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (trickleRef.current) clearInterval(trickleRef.current)
    }
  }, [startProgress])

  if (!isVisible && progress === 0) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[999999] h-[3px] pointer-events-none overflow-hidden bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-brand-blue shadow-[0_0_8px_rgba(21,108,179,0.8)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition:
            progress === 100
              ? 'width 150ms ease-out, opacity 250ms ease-out 100ms'
              : 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  )
}


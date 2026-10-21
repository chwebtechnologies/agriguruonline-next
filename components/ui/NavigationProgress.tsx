'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { forceUnlockScroll } from '@/lib/scroll-lock'

export default function NavigationProgress() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  const currentUrl = `${pathname}?${searchParams.toString()}`
  const prevUrlRef = useRef(currentUrl)
  const pendingUrlRef = useRef<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const trickleRef = useRef<NodeJS.Timeout | null>(null)
  const prefetchedUrls = useRef<Set<string>>(new Set())

  const completeProgress = useCallback(() => {
    if (trickleRef.current) {
      clearInterval(trickleRef.current)
      trickleRef.current = null
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    pendingUrlRef.current = null
    setProgress(100)
    const fadeTimer = setTimeout(() => {
      setIsVisible(false)
      setProgress(0)
    }, 250)

    return () => clearTimeout(fadeTimer)
  }, [])

  const startProgress = useCallback((targetHref?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (trickleRef.current) clearInterval(trickleRef.current)

    if (targetHref) {
      pendingUrlRef.current = targetHref
    }

    setIsVisible(true)
    setProgress(30)

    // Smooth trickle forward so it feels responsive and alive
    trickleRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          if (trickleRef.current) clearInterval(trickleRef.current)
          return 90
        }
        const step = Math.max(1.5, (90 - prev) * 0.2)
        return Math.min(90, prev + step)
      })
    }, 150)

    // Safety timeout: 20s for high-latency connections (e.g. 4000ms profiles) so it stays visible until completion
    timerRef.current = setTimeout(() => {
      completeProgress()
    }, 20000)
  }, [completeProgress])

  // When pathname or searchParams change, navigation completed
  useEffect(() => {
    if (currentUrl !== prevUrlRef.current) {
      prevUrlRef.current = currentUrl
      pendingUrlRef.current = null
      // Ensure any leftover scroll locks are cleared on page change
      forceUnlockScroll()
      if (typeof window !== 'undefined' && !window.location.hash) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      }
      completeProgress()
    }
  }, [currentUrl, completeProgress])

  // Global anchor click listener and instant prefetch warmup
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

        // Prevent rage clicking the exact same pending link while waiting for high latency response
        if (pendingUrlRef.current === targetUrl.href) {
          e.preventDefault()
          return
        }

        startProgress(targetUrl.href)
      } catch {
        // invalid URL, ignore
      }
    }

    // Prefetch warmup on hover / touchstart so skeleton is ready at 0ms before click completes
    const handleWarmup = (e: Event) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target || !target.href) return
      if (target.hasAttribute('download')) return
      const targetAttr = target.getAttribute('target')
      if (targetAttr && targetAttr !== '_self') return

      try {
        const targetUrl = new URL(target.href, window.location.href)
        if (targetUrl.origin !== window.location.origin) return
        if (
          targetUrl.pathname === window.location.pathname &&
          targetUrl.search === window.location.search
        ) {
          return
        }
        if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') return
        if (
          targetUrl.pathname.startsWith('/api/') ||
          /\.(pdf|zip|xlsx|xls|png|jpg|jpeg|svg|webp|csv)$/i.test(targetUrl.pathname)
        ) {
          return
        }

        const fullPath = targetUrl.pathname + targetUrl.search
        if (!prefetchedUrls.current.has(fullPath)) {
          prefetchedUrls.current.add(fullPath)
          router.prefetch(fullPath)
        }
      } catch {}
    }

    // Use bubbling phase so e.defaultPrevented is accurately checked
    document.addEventListener('click', handleAnchorClick, false)
    document.addEventListener('pointerover', handleWarmup, { passive: true, capture: true })
    document.addEventListener('touchstart', handleWarmup, { passive: true, capture: true })
    window.addEventListener('popstate', () => startProgress())

    return () => {
      document.removeEventListener('click', handleAnchorClick, false)
      document.removeEventListener('pointerover', handleWarmup, { capture: true })
      document.removeEventListener('touchstart', handleWarmup, { capture: true })
      window.removeEventListener('popstate', () => startProgress())
      if (timerRef.current) clearTimeout(timerRef.current)
      if (trickleRef.current) clearInterval(trickleRef.current)
    }
  }, [router, startProgress])

  if (!isVisible && progress === 0) return null

  return (
    <>
      {/* Top Progress Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-[999999] h-[3.5px] pointer-events-none overflow-hidden bg-transparent"
        aria-hidden="true"
      >
        <div
          className="h-full bg-brand-blue shadow-[0_0_12px_rgba(21,108,179,0.9),0_0_4px_rgba(255,255,255,0.8)]"
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

      {/* Instant Floating Navigation Feedback Badge */}
      {isVisible && progress < 100 && (
        <div 
          className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[999999] pointer-events-none flex items-center gap-2 bg-background/95 backdrop-blur-md border border-border shadow-xl px-3.5 py-1.5 rounded-full text-xs font-medium text-foreground animate-in fade-in slide-in-from-top-2 duration-200"
          aria-live="polite"
        >
          <i className="fa-solid fa-spinner fa-spin text-brand-blue text-sm" />
          <span>Loading...</span>
        </div>
      )}
    </>
  )
}

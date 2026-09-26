'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)

  const currentUrl = `${pathname}?${searchParams.toString()}`
  const [prevUrl, setPrevUrl] = useState(currentUrl)

  if (currentUrl !== prevUrl) {
    setPrevUrl(currentUrl)
    setProgress(100)
  }

  useEffect(() => {
    if (progress === 100) {
      const timer = setTimeout(() => {
        setProgress(0)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [progress])

  useEffect(() => {


    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (
        target &&
        target.href &&
        !target.target &&
        target.origin === window.location.origin &&
        target.href !== window.location.href &&
        !target.href.startsWith('mailto:') &&
        !target.href.startsWith('tel:')
      ) {
        setProgress(35)
        setTimeout(() => {
          setProgress((prev) => (prev > 0 && prev < 80 ? 75 : prev))
        }, 80)
      }
    }

    document.addEventListener('click', handleAnchorClick, true)
    return () => document.removeEventListener('click', handleAnchorClick, true)
  }, [])

  if (progress === 0) return null

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
              ? 'width 100ms ease-out, opacity 150ms ease-out 100ms'
              : 'width 180ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  )
}

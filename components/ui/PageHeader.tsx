'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export function PageHeader({ title, backText = "Back", hideBack = false, backHref, onBackClick }: { title: string, backText?: string, hideBack?: boolean, backHref?: string, onBackClick?: () => void }) {
  const router = useRouter()
  const [headerHeight, setHeaderHeight] = useState<number>(0)

  useEffect(() => {
    const updateHeaderHeight = () => {
      const header = document.getElementById('site-header')
      if (header) {
        setHeaderHeight(header.offsetHeight)
      }
    }

    updateHeaderHeight()

    const header = document.getElementById('site-header')
    let observer: ResizeObserver | null = null
    if (header && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updateHeaderHeight()
      })
      observer.observe(header)
    }

    window.addEventListener('resize', updateHeaderHeight)
    window.addEventListener('scroll', updateHeaderHeight, { passive: true })

    return () => {
      if (observer) observer.disconnect()
      window.removeEventListener('resize', updateHeaderHeight)
      window.removeEventListener('scroll', updateHeaderHeight)
    }
  }, [])

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick()
    } else if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <div
      style={{ top: headerHeight ? `${headerHeight}px` : undefined }}
      className="sticky top-[69px] md:top-[122px] z-40 -mt-3 py-1.5 sm:py-2 flex items-center justify-between w-full mb-1 sm:mb-2 bg-background relative"
    >
      {/* Full-width background bleed */}
      <div className="absolute inset-y-0 w-[100vw] left-1/2 -translate-x-1/2 bg-background z-0 pointer-events-none" />
      
      {/* Left Column: Back Button */}
      <div className="flex-none flex items-center justify-start relative z-20">
        {!hideBack && (
          <button 
            type="button"
            onClick={handleBackClick}
            className="group flex items-center gap-1.5 sm:gap-2 text-foreground hover:text-brand-blue dark:hover:text-brand-blue transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <div className="flex shrink-0 items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-card border border-border shadow-xs group-hover:border-brand-blue transition-colors">
              <i className="fa-solid fa-arrow-left text-[14px] sm:text-[15px] text-foreground rtl:rotate-180 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 transition-transform"></i>
            </div>
            <span className="text-[19px] sm:text-[21px] font-bold hidden sm:block leading-none pb-[2px] truncate max-w-[140px]">{backText}</span>
          </button>
        )}
      </div>

      {/* Middle Column: Centered Title */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-[45px] sm:px-[120px] z-10">
        <h1 
          className="pointer-events-auto text-xl min-[375px]:text-[22px] min-[410px]:text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-extrabold text-center truncate tracking-tight leading-tight w-full"
          style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}
        >
          {(title || '').split(' ').map((word, index, arr) => (
            <span key={index}>
              <span className="bg-[image:var(--ag-gradient-heading)] bg-clip-text text-transparent">
                {word}
              </span>
              {index < arr.length - 1 && ' '}
            </span>
          ))}
        </h1>
      </div>

      {/* Right Column: Spacer for perfect centering */}
      <div className="flex-none flex items-center justify-end relative z-20 w-[32px] sm:w-[36px]"></div>
    </div>
  )
}


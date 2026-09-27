'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export function PageHeader({ title, backText = "Back", hideBack = false, backHref, onBackClick }: { title: string, backText?: string, hideBack?: boolean, backHref?: string, onBackClick?: () => void }) {
  const router = useRouter()
  const [headerHeight, setHeaderHeight] = useState<number>(65)

  useEffect(() => {
    const updateHeaderHeight = () => {
      const header = document.getElementById('site-header')
      if (header) {
        const mainHeader = header.querySelector('header')
        if (mainHeader && mainHeader.offsetHeight > 0) {
          setHeaderHeight(mainHeader.offsetHeight)
        } else if (header.offsetHeight > 0) {
          setHeaderHeight(header.offsetHeight)
        }
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

    return () => {
      if (observer) observer.disconnect()
      window.removeEventListener('resize', updateHeaderHeight)
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
      style={{ top: `${headerHeight}px` }}
      className="sticky top-[63px] z-40 py-2 sm:py-2.5 flex items-center justify-between w-full mb-2 bg-background relative"
    >
      {/* Full-width background bleed to hide scrolling content behind PageHeader */}
      <div className="absolute inset-y-0 w-screen left-1/2 -translate-x-1/2 bg-background z-0 pointer-events-none border-b border-border/40 shadow-xs" />
      
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


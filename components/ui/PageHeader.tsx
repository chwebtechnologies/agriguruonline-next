'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export function PageHeader({ 
  title, 
  backText = "Back", 
  hideBack = false, 
  backHref, 
  onBackClick,
  headingTag: Heading = 'h1',
  className = '',
  size = 'default',
}: { 
  title: string, 
  backText?: string, 
  hideBack?: boolean, 
  backHref?: string, 
  onBackClick?: () => void,
  headingTag?: 'h1' | 'h2' | 'p' | 'div',
  className?: string,
  size?: 'default' | 'sm',
}) {
  const router = useRouter()
  // Only track dynamic header height on desktop when the categories subheader bar collapses
  const [dynamicDesktopTop, setDynamicDesktopTop] = useState<number | null>(null)

  useEffect(() => {
    // Only desktop has a collapsible subheader that changes height on scroll
    if (window.innerWidth < 1024) return

    const updateHeaderHeight = () => {
      const header = document.getElementById('site-header')
      if (header && header.offsetHeight > 0) {
        setDynamicDesktopTop(header.offsetHeight)
      }
    }

    const header = document.getElementById('site-header')
    let observer: ResizeObserver | null = null
    if (header && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (window.innerWidth >= 1024) {
          updateHeaderHeight()
        }
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

  const isCompact = size === 'sm';
  const hasCustomTop = className.includes('top-0') || className.includes('!top-0');

  return (
    <div
      style={!hasCustomTop && dynamicDesktopTop ? { top: `${dynamicDesktopTop}px` } : undefined}
      className={`sticky top-[57px] sm:top-[63px] lg:top-[97px] z-40 ${
        isCompact ? 'py-0.5 sm:py-0.5 mb-0.5 sm:mb-1' : 'py-1 sm:py-1.5 mb-1 sm:mb-1.5'
      } flex items-center justify-between w-full bg-background ${className}`}
    >
      {/* Full-width background bleed to hide scrolling content behind PageHeader */}
      <div className="absolute inset-y-0 -top-px -left-4 -right-4 sm:-left-8 sm:-right-8 lg:-left-14 lg:-right-14 xl:-left-20 xl:-right-20 bg-background z-0 pointer-events-none border-b border-border/40 shadow-xs" />
      
      {/* Left Column: Back Button */}
      <div className="flex-none flex items-center justify-start relative z-20">
        {!hideBack && (
          <button 
            type="button"
            onClick={handleBackClick}
            className="group flex items-center gap-1.5 sm:gap-2 text-foreground hover:text-brand-blue dark:hover:text-brand-blue transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <div className={`flex shrink-0 items-center justify-center ${
              isCompact ? 'w-8 h-8 sm:w-8.5 sm:h-8.5' : 'w-8 h-8 sm:w-9 sm:h-9'
            } rounded-full bg-card border border-border shadow-xs group-hover:border-brand-blue transition-colors`}>
              <i className={`fa-solid fa-arrow-left ${
                isCompact ? 'text-[13px] sm:text-[14px]' : 'text-[14px] sm:text-[15px]'
              } text-foreground rtl:rotate-180 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 transition-transform`}></i>
            </div>
            <span className={`${
              isCompact
                ? 'text-[15px] sm:text-[16px] font-bold pb-[1px] max-w-[130px]'
                : 'text-[19px] sm:text-[21px] font-bold pb-[2px] max-w-[140px]'
            } hidden sm:block leading-none truncate`}>
              {backText}
            </span>
          </button>
        )}
      </div>

      {/* Middle Column: Centered Title */}
      <div className={`absolute inset-0 pointer-events-none flex items-center justify-center ${
        isCompact ? 'px-10 sm:px-20 lg:px-24' : 'px-[45px] sm:px-[120px]'
      } z-10`}>
        <Heading 
          className={`pointer-events-auto ${
            isCompact
              ? 'text-xl min-[375px]:text-[22px] min-[410px]:text-2xl sm:text-[26px] lg:text-[28px]'
              : 'text-xl min-[375px]:text-[22px] min-[410px]:text-2xl sm:text-3xl md:text-3xl lg:text-4xl'
          } font-extrabold text-center truncate tracking-tight leading-tight w-full`}
        >
          {(title || '').split(' ').map((word, index, arr) => (
            <span key={index}>
              <span className="bg-[image:var(--ag-gradient-heading)] bg-clip-text text-transparent">
                {word}
              </span>
              {index < arr.length - 1 && ' '}
            </span>
          ))}
        </Heading>
      </div>

      {/* Right Column: Spacer for perfect centering */}
      <div className={`flex-none flex items-center justify-end relative z-20 ${
        isCompact ? 'w-8 sm:w-8.5' : 'w-[32px] sm:w-[36px]'
      }`}></div>
    </div>
  )
}


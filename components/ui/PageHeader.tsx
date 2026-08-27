'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export function PageHeader({ title, backText = "Back", hideBack = false }: { title: string, backText?: string, hideBack?: boolean }) {
  const router = useRouter()
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false)

  useEffect(() => {
    let scrolled = false
    const handleScroll = () => {
      const sy = window.scrollY
      if (scrolled) {
        if (sy < 20) {
          scrolled = false
          setIsHeaderScrolled(false)
        }
      } else {
        if (sy > 120) {
          scrolled = true
          setIsHeaderScrolled(true)
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // On mobile: always 69px. On desktop: 69px when category bar collapsed, 109px when category bar open.
  const stickyTopClass = isHeaderScrolled ? 'top-[69px]' : 'top-[69px] md:top-[109px]'

  return (
    <div className={`sticky ${stickyTopClass} z-40 py-1 sm:py-1.5 grid grid-cols-[1fr_auto_1fr] items-center w-full mb-1 sm:mb-2 bg-background transition-[top] duration-200`}>
      {/* Full-width background bleed */}
      <div className="absolute inset-y-0 w-[100vw] left-1/2 -translate-x-1/2 bg-background z-0 pointer-events-none" />
      
      {/* Left Column: Back Button */}
      <div className="flex items-center justify-start min-w-0 relative z-10">
        {!hideBack && (
          <button 
            type="button"
            onClick={() => router.back()}
            className="group flex items-center gap-1.5 sm:gap-2 text-foreground hover:text-brand-blue dark:hover:text-brand-blue transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <div className="flex shrink-0 items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-card border border-border shadow-xs group-hover:border-brand-blue transition-colors">
              <i className="fa-solid fa-arrow-left text-[14px] sm:text-[15px] text-foreground rtl:rotate-180 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 transition-transform"></i>
            </div>
            <span className="text-[19px] sm:text-[21px] font-bold hidden sm:block leading-none pb-[2px] truncate">{backText}</span>
          </button>
        )}
      </div>

      {/* Middle Column: Centered Title */}
      <div className="flex items-center justify-center px-1 sm:px-4 min-w-0 relative z-10">
        <h1 
          className="text-xl min-[375px]:text-[22px] min-[410px]:text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-extrabold text-center truncate tracking-tight leading-tight"
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
      <div className="flex items-center justify-end min-w-0 relative z-10"></div>
    </div>
  )
}


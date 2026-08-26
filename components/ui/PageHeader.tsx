'use client'

import { useRouter } from 'next/navigation'

export function PageHeader({ title, backText = "Back", hideBack = false }: { title: string, backText?: string, hideBack?: boolean }) {
  const router = useRouter()
  return (
    <div className="sticky top-[69px] z-40 py-2 grid grid-cols-[1fr_auto_1fr] items-center w-full mb-2 min-h-[40px]">
      {/* Full-width background bleed */}
      <div className="absolute inset-y-0 w-[100vw] left-1/2 -translate-x-1/2 bg-background -z-10 pointer-events-none" />
      
      {/* Left Column: Back Button */}
      <div className="flex items-center justify-start min-w-0">
        {!hideBack && (
          <button 
            type="button"
            onClick={() => router.back()}
            className="group flex items-center gap-2 text-foreground hover:text-brand-blue dark:hover:text-brand-blue transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <div className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-card border border-border shadow-sm group-hover:border-brand-blue transition-colors">
              <i className="fa-solid fa-arrow-left text-[14px] text-foreground rtl:rotate-180 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 transition-transform"></i>
            </div>
            <span className="text-[19px] sm:text-[21px] font-bold hidden sm:block leading-none pb-[2px] truncate">{backText}</span>
          </button>
        )}
      </div>

      {/* Middle Column: Centered Title */}
      <div className="flex items-center justify-center px-2 sm:px-4 min-w-0">
        <h1 
          className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-center truncate"
          style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}
        >
          {title.split(' ').map((word, index, arr) => (
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
      <div className="flex items-center justify-end min-w-0"></div>
    </div>
  )
}


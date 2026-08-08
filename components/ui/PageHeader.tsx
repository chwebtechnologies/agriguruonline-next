'use client'

import { useRouter } from 'next/navigation'

export function PageHeader({ title, backText = "Back" }: { title: string, backText?: string }) {
  const router = useRouter()
  return (
    <div className="sticky top-[69px] z-40 py-2 flex items-center justify-center w-full mb-2 min-h-[40px]">
      {/* Full-width background bleed */}
      <div className="absolute inset-y-0 w-[100vw] left-1/2 -translate-x-1/2 bg-background -z-10" />
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <button 
          onClick={() => router.back()}
          className="group flex items-center gap-2.5 text-foreground hover:text-[#0c5a53] dark:hover:text-[#138a7f] transition-colors"
          aria-label="Go back"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background border border-ag-header-border shadow-sm group-hover:border-ag-primary transition-colors">
            <i className="fa-solid fa-arrow-left text-[14px] group-hover:-translate-x-0.5 transition-transform"></i>
          </div>
          <span className="text-[21px] font-bold hidden sm:block leading-none pb-[2px]">{backText}</span>
        </button>
      </div>
      
      <h1 
        className="text-lg sm:text-xl md:text-3xl font-bold text-center pl-10 pr-2 sm:px-16 md:px-24 truncate whitespace-nowrap"
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
  )
}

'use client'

import { useRouter } from 'next/navigation'

export function PageHeader({ title }: { title: string }) {
  const router = useRouter()
  return (
    <div className="sticky top-[63px] z-40 bg-background/95 backdrop-blur-md py-2 flex items-center justify-center w-full mb-2 min-h-[40px]">
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <button 
          onClick={() => router.back()}
          className="group flex items-center gap-2.5 text-foreground hover:text-[#0c5a53] dark:hover:text-[#138a7f] transition-colors"
          aria-label="Go back"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background border border-ag-header-border shadow-sm group-hover:border-ag-primary transition-colors">
            <i className="fa-solid fa-arrow-left text-[14px] group-hover:-translate-x-0.5 transition-transform"></i>
          </div>
          <span className="text-[21px] font-bold hidden sm:block leading-none pb-[2px]">Back</span>
        </button>
      </div>
      
      <h1 
        className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#0c5a53] to-[#138a7f] bg-clip-text text-transparent text-center px-24"
        style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}
      >
        {title}
      </h1>
    </div>
  )
}

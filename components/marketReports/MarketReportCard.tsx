'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { MarketReportItem } from '@/types/marketReports'
import dynamic from 'next/dynamic'

const ReportReaderModal = dynamic(() => import('./ReportReaderModal'), {
  ssr: false,
})

interface MarketReportCardProps {
  report: MarketReportItem
  lang: string
}

export default function MarketReportCard({ report, lang }: MarketReportCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const assetsUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.cloud'
  const imageUrl = report.thumbnail?.startsWith('http') 
    ? report.thumbnail 
    : report.thumbnail 
      ? `${assetsUrl}/${report.thumbnail}`
      : '/placeholder-image.jpg' // You might want to provide a default placeholder

  // Use translated title if available, otherwise fallback to default
  const title = (report.translations?.find(t => t.lang_code === lang) as any)?.subject_title 
    || report.translations?.find(t => t.lang_code === lang)?.title 
    || report.subject_title 
    || report.title 
    || 'Market Report'

  // Strip HTML from description for the summary
  const rawDesc = report.translations?.find(t => t.lang_code === lang)?.description || report.description || ''
  const cleanDesc = rawDesc.replace(/<[^>]*>?/gm, '')
  const description = cleanDesc.length > 100 ? `${cleanDesc.substring(0, 100)}...` : cleanDesc

  // Extract category name dynamically
  const cat: any = (report as any).category
  const categoryName = (cat && typeof cat === 'object' && cat.name) 
    ? cat.name 
    : (typeof cat === 'string' ? cat : 'Report')

  // Extract and format date
  const rawDate = (report as any).publish_date || (report as any).created_at || (report as any).report_date
  const publishDate = rawDate 
    ? new Date(rawDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  // Format an ID for display using id_no if available, falling back to id
  const displayId = report.id_no ? `#REP-${report.id_no}` : (
    report.id ? (report.id.length > 8 ? `#REP-${report.id.substring(report.id.length - 6).toUpperCase()}` : `#${report.id}`) : ''
  )

  const handleOpenReport = (e: React.MouseEvent) => {
    e.preventDefault()
    if (report.file_url || report.file) {
      setIsModalOpen(true)
    } else {
      alert("This report file is currently unavailable.")
    }
  }

  return (
    <>
      <button 
        onClick={handleOpenReport}
        className="group flex flex-col rounded-xl bg-background border border-ag-header-border overflow-hidden h-full shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 relative text-left w-full focus:outline-none"
      >
        {/* Label Badge */}
        <div className="absolute top-3 right-3 z-10 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1.5">
          <i className="fa-solid fa-file-pdf"></i>
          <span>{categoryName}</span>
        </div>

        <div className="relative w-full aspect-[794/1120] bg-ag-header-border/30 overflow-hidden border-b border-ag-header-border">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-contain transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 20vw"
          />
        </div>
        
        <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
          
          {/* Meta Info (ID & Date) */}
          <div className="flex items-center justify-between text-[11px] text-foreground/60 mb-2 font-medium">
            <span className="bg-foreground/5 px-1.5 py-0.5 rounded border border-ag-header-border font-mono">{displayId}</span>
            {publishDate && <span><i className="fa-regular fa-calendar-days mr-1"></i>{publishDate}</span>}
          </div>

          <h3 className="text-sm sm:text-base font-bold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors leading-tight">
            {title}
          </h3>
          
          {description && (
            <p className="text-xs sm:text-sm text-foreground/70 line-clamp-2 mb-4 flex-grow">
              {description}
            </p>
          )}
          
          <div className="flex items-center justify-between mt-auto border-t border-ag-header-border pt-3">
            <span className="text-xs font-semibold text-primary">Read Report</span>
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <i className="fa-solid fa-book-open text-[10px]"></i>
            </div>
          </div>
        </div>
      </button>

      {/* 3D Flipbook Modal */}
      {(report.file_url || report.file) && (
        <ReportReaderModal 
          fileUrl={report.file_url || report.file || ''} 
          title={title} 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </>
  )
}

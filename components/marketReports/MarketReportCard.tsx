'use client'

import { useState } from 'react'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import type { MarketReportItem } from '@/types/marketReports'
import dynamic from 'next/dynamic'
import { getAssetsUrl } from '@/lib/api-utils';

const ReportReaderModal = dynamic(() => import('./ReportReaderModal'), {
  ssr: false,
})

interface MarketReportCardProps {
  report: MarketReportItem
  lang: string
  priority?: boolean;
}

export default function MarketReportCard({ report, lang, priority = false }: MarketReportCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const assetsUrl = getAssetsUrl();
  const imageUrl = report.thumbnail
    ? report.thumbnail.startsWith('http')
      ? report.thumbnail
      : `${assetsUrl}/${report.thumbnail}`
    : '/logo.webp'

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
  const displayId = report.id_no ? `${report.id_no}` : (
    report.id ? (report.id.length > 8 ? `${report.id.substring(report.id.length - 6).toUpperCase()}` : `ID: ${report.id}`) : ''
  )

  const rawFileUrl = report.file_url || report.file || ''
  const fileUrl = rawFileUrl.startsWith('http') 
    ? rawFileUrl 
    : rawFileUrl 
      ? `${assetsUrl}/${rawFileUrl.startsWith('/') ? rawFileUrl.slice(1) : rawFileUrl}`
      : ''
      
  const isPdf = fileUrl.toLowerCase().endsWith('.pdf')

  const handleOpenReport = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!fileUrl) {
      alert("This report file is currently unavailable.")
      return
    }
    
    if (isPdf) {
      setIsModalOpen(true)
    } else {
      const a = document.createElement('a')
      a.href = fileUrl
      a.target = '_blank'
      a.download = title || 'download'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <>
      <button 
        onClick={handleOpenReport}
        className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs hover:shadow-lg hover:border-primary/40 transition-all duration-300 relative text-left w-full focus:outline-none cursor-pointer"
      >
        {/* Label Badge */}
        <div className="absolute top-3 right-3 z-10 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center">
          <span>{categoryName}</span>
        </div>

        <div className="relative w-full aspect-[794/1120] bg-muted/60 overflow-hidden border-b border-border">
          <ImageWithSkeleton
            src={imageUrl}
            alt={title}
            title={title}
            fill
            className="transition-transform duration-500 group-hover:scale-105"
            style={{ objectFit: 'contain' }}
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 20vw"
            priority={priority}
          />
        </div>
        
        <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
          
          {/* Meta Info (ID & Date) */}
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-foreground/80 mb-2 font-medium gap-2">
            {displayId && (
              <span className="bg-primary/5 text-primary px-1.5 sm:px-2 py-0.5 rounded border border-primary/20 font-mono whitespace-nowrap overflow-hidden text-ellipsis font-semibold">
                {displayId}
              </span>
            )}
            {publishDate && (
              <span className="whitespace-nowrap flex-shrink-0">
                <i className="fa-regular fa-calendar-days mr-1"></i>{publishDate}
              </span>
            )}
          </div>

          <h3 className="text-sm sm:text-base font-bold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors leading-tight">
            {title}
          </h3>
          
          {description && (
            <p className="text-xs sm:text-sm text-foreground/80 line-clamp-2 mb-4 flex-grow">
              {description}
            </p>
          )}
          
          <div className="flex items-center justify-between mt-auto border-t border-border pt-3">
            <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">
              {isPdf ? 'Read Report' : 'Download Report'}
            </span>
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sky-700 dark:text-sky-400 group-hover:bg-primary group-hover:text-white transition-colors">
              <i className={`fa-solid ${isPdf ? 'fa-book-open' : 'fa-download'} text-[10px]`}></i>
            </div>
          </div>
        </div>
      </button>

      {/* 3D Flipbook Modal */}
      {isPdf && fileUrl && (
        <ReportReaderModal 
          fileUrl={fileUrl} 
          title={title} 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </>
  )
}

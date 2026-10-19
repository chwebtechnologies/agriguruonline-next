'use client'

import { useState } from 'react'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import type { MarketReportItem } from '@/types/marketReports'
import dynamic from 'next/dynamic'
import { lazyWithRetry } from '@/lib/dynamic-import'
import { getAssetsUrl } from '@/lib/api-utils';

const ReportReaderModal = dynamic(() => lazyWithRetry(() => import('./ReportReaderModal')), {
  ssr: false,
})

interface MarketReportCardProps {
  report: MarketReportItem
  lang: string
  priority?: boolean;
  dict?: any;
  isLoggedIn?: boolean;
}

export default function MarketReportCard({ report, lang, priority = false, dict = {}, isLoggedIn = false }: MarketReportCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const assetsUrl = getAssetsUrl();
  const thumb = report.thumbnail || report.image;
  const imageUrl = thumb
    ? thumb.startsWith('http')
      ? thumb
      : `${assetsUrl}/${thumb.startsWith('/') ? thumb.slice(1) : thumb}`
    : '/logo.webp'

  // Extract localized or fallback title
  const translation = report.translations?.find((t: any) => t.lang_code === lang)
  const title = translation?.subject_title || translation?.title || report.subject_title || report.title || 'Market Report'

  // Strip HTML from description for the summary
  const rawDesc = translation?.description || report.description || report.page_description || ''
  const cleanDesc = rawDesc.replace(/<[^>]*>?/gm, '')
  const description = cleanDesc.length > 100 ? `${cleanDesc.substring(0, 100)}...` : cleanDesc

  // Extract category name dynamically
  const cat: any = report.category || (report.categories && report.categories[0]) || report.category_name
  const categoryName = (cat && typeof cat === 'object') 
    ? (cat.name || cat.category_name || cat.title || 'Report') 
    : (typeof cat === 'string' && cat.trim() ? cat : 'Report')

  // Extract and format date
  const rawDate = report.publish_date || report.created_at || report.report_date || report.posting_date || report.date
  const publishDate = rawDate 
    ? new Date(rawDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  // Format an ID for display using id_no if available, falling back to id
  const rawIdNo = report.id_no || report.report_no
  const displayId = rawIdNo ? `${rawIdNo}` : (
    report.id ? (report.id.length > 8 ? `${report.id.substring(report.id.length - 6).toUpperCase()}` : `ID: ${report.id}`) : ''
  )

  const rawFileUrl = report.file_url || report.file || report.pdf_file || ''
  const fileUrl = rawFileUrl.startsWith('http') 
    ? rawFileUrl 
    : rawFileUrl 
      ? `${assetsUrl}/${rawFileUrl.startsWith('/') ? rawFileUrl.slice(1) : rawFileUrl}`
      : ''
      
  const isPdf = fileUrl.toLowerCase().endsWith('.pdf')

  const handleOpenReport = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isLoggedIn || !fileUrl) {
      window.location.href = `/${lang}/login?callbackUrl=/${lang}/market-reports`
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
        <div className="absolute top-3 left-3 z-10 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center">
          <span>{categoryName}</span>
        </div>

        {/* Report Cover Image: Clear portrait aspect-[3/4] so report cover is prominently and properly visible */}
        <div className="relative w-full aspect-[3/4] bg-muted/60 overflow-hidden border-b border-border flex items-center justify-center">
          <ImageWithSkeleton
            src={imageUrl}
            alt={title}
            title={title}
            fill
            className="object-contain"
            style={{ objectFit: 'contain' }}
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 25vw, 20vw"
            priority={priority}
          />
        </div>
        
        {/* Content Section: Compact & only taking necessary space */}
        <div className="p-3 sm:p-3.5 flex flex-col flex-1 justify-between">
          <div>
            {/* Meta Info (ID & Date) */}
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-foreground/80 mb-1.5 font-medium gap-2">
              {displayId ? (
                <span className="bg-primary/5 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-mono whitespace-nowrap overflow-hidden text-ellipsis font-semibold">
                  {displayId}
                </span>
              ) : <span />}
              {publishDate && (
                <span className="whitespace-nowrap flex-shrink-0 text-[10px] sm:text-[11px]">
                  <i className="fa-regular fa-calendar-days mr-1 text-foreground/70"></i>{publishDate}
                </span>
              )}
            </div>

            {/* Title: Max 2 lines */}
            <h2 className="text-xs sm:text-sm font-bold text-foreground mb-1 group-hover:text-primary transition-colors leading-snug line-clamp-2 break-words">
              {title}
            </h2>
            
            {/* Description: Max 2 lines (renders only if description exists, no blank placeholder space) */}
            {description && (
              <p className="text-[11px] sm:text-xs text-foreground/80 line-clamp-2 break-words mb-2 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          
          {/* Action Row */}
          <div className="flex items-center justify-between mt-auto border-t border-border pt-2.5">
            <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">
              {isPdf ? (dict?.read_report || 'Read Report') : (dict?.download_report || 'Download Report')}
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

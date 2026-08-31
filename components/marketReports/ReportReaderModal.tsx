'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import HTMLFlipBook from 'react-pageflip'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Set up the PDF.js worker using explicit HTTPS to prevent redirect issues
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface ReportReaderModalProps {
  fileUrl: string
  title: string
  isOpen: boolean
  onClose: () => void
}

const PageContent = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(({ children }, ref) => {
  return (
    <div className="page overflow-hidden bg-white shadow-md flex items-center justify-center select-none" ref={ref} data-density="soft">
      {children}
    </div>
  );
});
PageContent.displayName = 'PageContent';

export default function ReportReaderModal({ fileUrl, title, isOpen, onClose }: ReportReaderModalProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [dimensions, setDimensions] = useState({ width: 400, height: 565, isMobile: false })
  const bookRef = useRef<any>(null)

  // Ensure we have a valid absolute URL
  const baseUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com'
  const finalFileUrl = fileUrl.startsWith('http') 
    ? fileUrl 
    : `${baseUrl.replace(/\/$/, '')}/${fileUrl.replace(/^\//, '')}`

  useEffect(() => {
    if (!isOpen) return

    document.body.style.overflow = 'hidden'

    const updateDimensions = () => {
      const isMob = window.innerWidth < 768
      const topBarHeight = 56
      const bottomBarHeight = isMob ? 56 : 20
      const availableH = Math.max(window.innerHeight - topBarHeight - bottomBarHeight, 300)
      const availableW = isMob ? window.innerWidth - 24 : Math.min(window.innerWidth - 80, 1300)

      let pageW = 400
      let pageH = 565

      if (isMob) {
        // Single page mode on mobile
        pageH = availableH
        pageW = Math.round(pageH / 1.414)
        if (pageW > availableW) {
          pageW = availableW
          pageH = Math.round(pageW * 1.414)
        }
      } else {
        // 2-page spread mode on desktop
        pageH = availableH
        pageW = Math.round(pageH / 1.414)
        if (pageW * 2 > availableW) {
          pageW = Math.floor(availableW / 2)
          pageH = Math.round(pageW * 1.414)
        }
      }

      setDimensions({ width: pageW, height: pageH, isMobile: isMob })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('resize', updateDimensions)
    }
  }, [isOpen])

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    setIsLoading(false)
  }

  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF:', error)
    console.error('Attempted to load URL:', finalFileUrl)
    setIsLoading(false)
  }

  const handlePrev = () => {
    try {
      bookRef.current?.pageFlip()?.flipPrev()
    } catch (e) {
      console.error(e)
    }
  }

  const handleNext = () => {
    try {
      bookRef.current?.pageFlip()?.flipNext()
    } catch (e) {
      console.error(e)
    }
  }

  const patchFlipController = (pageFlipInstance: any) => {
    if (!pageFlipInstance) return
    try {
      // Ensure all loaded pages have soft density for realistic curl
      const pages = pageFlipInstance.getPageCollection?.()?.getPages?.()
      if (pages) {
        pages.forEach((p: any) => {
          p.setDensity?.('soft')
          p.setDrawingDensity?.('soft')
        })
      }

      // 1. Patch PageCollection for Portrait Mode to make Prev flips reveal the previous page naturally
      const pageCollection = pageFlipInstance.getPageCollection?.()
      if (pageCollection) {
        const collectionProto = Object.getPrototypeOf(pageCollection)
        if (!collectionProto._customPortraitPatched) {
          collectionProto.getFlippingPage = function (direction: any) {
            const current = this.currentSpreadIndex
            if (this.render.getOrientation() === 'portrait') {
              // In portrait mode, peel the current page copy so nothing flies in from off-screen
              return this.pages[current]?.newTemporaryCopy() || this.pages[current]
            }
            const spread = direction === 0 ? this.getSpread()[current + 1] : this.getSpread()[current - 1]
            if (!spread || spread.length === 1) return this.pages[spread?.[0] || 0]
            return direction === 0 ? this.pages[spread[0]] : this.pages[spread[1]]
          }

          collectionProto.getBottomPage = function (direction: any) {
            const current = this.currentSpreadIndex
            if (this.render.getOrientation() === 'portrait') {
              return direction === 0
                ? this.pages[current + 1]
                : this.pages[current - 1]
            }
            const spread = direction === 0 ? this.getSpread()[current + 1] : this.getSpread()[current - 1]
            if (!spread || spread.length === 1) return this.pages[spread?.[0] || 0]
            return direction === 0 ? this.pages[spread[1]] : this.pages[spread[0]]
          }

          collectionProto._customPortraitPatched = true
        }
      }

      // 2. Patch HTMLRender so bottomPage is always drawn cleanly during portrait flips
      const render = pageFlipInstance.getRender?.()
      if (render) {
        const renderProto = Object.getPrototypeOf(render)
        if (!renderProto._customDrawBottomPatched) {
          renderProto.drawBottomPage = function () {
            if (this.bottomPage === null) return
            const tempDensity = this.flippingPage != null ? this.flippingPage.getDrawingDensity() : null
            this.bottomPage.getElement().style.zIndex = (this.getSettings().startZIndex + 3).toString(10)
            this.bottomPage.draw(tempDensity)
          }

          renderProto.drawRightPage = function () {
            if (this.rightPage === null) return
            if (this.orientation === 'portrait' && this.flippingPage !== null) {
              return
            }
            this.rightPage.simpleDraw(1)
          }

          renderProto._customDrawBottomPatched = true
        }
      }

      // 3. Patch FlipController for drag thresholds and touch partitioning
      const flipController = pageFlipInstance.getFlipController?.()
      if (flipController) {
        const proto = Object.getPrototypeOf(flipController)
        if (!proto._customStopMovePatched) {
          proto.stopMove = function () {
            if (this.calc === null) return
            const pos = this.calc.getPosition()
            const rect = this.getBoundsRect()
            const y = this.calc.getCorner() === 'bottom' ? rect.height : 0

            const threshold = rect.pageWidth * 0.88
            if (pos.x <= threshold) {
              this.animateFlippingTo(pos, { x: -rect.pageWidth, y }, true)
            } else {
              this.animateFlippingTo(pos, { x: rect.pageWidth, y }, false)
            }
          }

          proto.getDirectionByPoint = function (touchPos: any) {
            const rect = this.getBoundsRect()
            if (this.render.getOrientation() === 'portrait') {
              if (touchPos.x - rect.pageWidth <= rect.pageWidth / 2) {
                return 1 // FlipDirection.BACK (Prev)
              }
              return 0 // FlipDirection.FORWARD (Next)
            }
            if (touchPos.x < rect.width / 2) {
              return 1 // FlipDirection.BACK
            }
            return 0 // FlipDirection.FORWARD
          }

          const origStart = proto.start
          proto.start = function (globalPos: any) {
            const result = origStart.call(this, globalPos)
            if (result) {
              if (this.flippingPage) {
                this.flippingPage.setDensity?.('soft')
                this.flippingPage.setDrawingDensity?.('soft')
              }
              if (this.bottomPage) {
                this.bottomPage.setDensity?.('soft')
                this.bottomPage.setDrawingDensity?.('soft')
              }
            }
            return result
          }

          proto._customStopMovePatched = true
        }
      }
    } catch (e) {
      console.error('Error patching flip controller:', e)
    }
  }

  useEffect(() => {
    if (bookRef.current?.pageFlip()) {
      patchFlipController(bookRef.current.pageFlip())
    }
  }, [numPages, dimensions])

  if (!isOpen) return null

  // Route the URL through our internal proxy to completely bypass CORS restrictions
  const pdfUrl = `/api/proxy-pdf?url=${encodeURIComponent(finalFileUrl)}`;

  // Human-readable page label (e.g. "Cover (Page 1)" or "Pages 2-3")
  const getPageLabel = () => {
    if (!numPages) return ''
    if (dimensions.isMobile) return `Page ${pageNumber} of ${numPages}`
    if (pageNumber === 1) return `Cover (Page 1) of ${numPages}`
    const leftPage = pageNumber % 2 === 0 ? pageNumber : pageNumber - 1
    const rightPage = leftPage + 1
    if (rightPage > numPages) return `Page ${leftPage} of ${numPages}`
    return `Pages ${leftPage}-${rightPage} of ${numPages}`
  }

  // Navigation boundary checks
  const isPrevDisabled = pageNumber <= 1
  const isNextDisabled = Boolean(
    !numPages || 
    (dimensions.isMobile ? pageNumber >= numPages : pageNumber >= numPages - 1)
  )

  return (
    <div className="fixed inset-0 z-[500] flex flex-col items-center justify-between bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-200">
      
      {/* Top Bar */}
      <div className="w-full h-14 flex items-center justify-between px-3 sm:px-6 bg-black/80 border-b border-white/10 shrink-0 z-[510]">
        <div className="flex items-center gap-2 sm:gap-3 text-white min-w-0">
          <div className="w-8 h-8 rounded-full bg-brand-blue/20 flex items-center justify-center text-brand-blue shrink-0">
            <i className="fa-solid fa-book-open text-sm"></i>
          </div>
          <h2 className="font-bold text-xs sm:text-base text-white truncate max-w-[150px] sm:max-w-md">{title}</h2>
        </div>

        {/* Center / Right Toolbar Controls */}
        <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
          <a 
            href={finalFileUrl}
            target="_blank"
            rel="noreferrer"
            download
            className="flex items-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/20 px-2.5 sm:px-3 py-1.5 rounded-full text-white/70 hover:text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-file-pdf text-red-400 text-xs sm:text-sm"></i>
            <span>Download Report</span>
          </a>

          {numPages && (
            <div className="text-white/50 text-xs sm:text-sm font-mono bg-white/10 px-3 py-1 rounded-full hidden sm:block">
              {getPageLabel()}
            </div>
          )}

          <button 
            onClick={onClose}
            aria-label="Close reader"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-xmark text-sm sm:text-base"></i>
          </button>
        </div>
      </div>

      {/* Book Container */}
      <div className="flex-1 w-full overflow-auto flex relative py-2 sm:py-4 px-2 sm:px-14">
        
        {/* Navigation Arrow Left (Desktop only) */}
        {!isLoading && numPages && numPages > 1 && (
          <button
            onClick={handlePrev}
            disabled={isPrevDisabled}
            aria-label="Previous Page"
            className={`hidden sm:flex fixed left-4 sm:left-6 top-1/2 -translate-y-1/2 z-40 sm:w-auto sm:px-5 sm:h-12 rounded-full bg-white/10 hover:bg-white/25 text-white items-center justify-center gap-2 backdrop-blur-md transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer ${isPrevDisabled ? 'opacity-20 cursor-not-allowed pointer-events-none' : 'opacity-100'}`}
          >
            <i className="fa-solid fa-chevron-left text-lg"></i>
            <span className="font-medium text-sm pr-1">Prev</span>
          </button>
        )}

        {/* Navigation Arrow Right (Desktop only) */}
        {!isLoading && numPages && numPages > 1 && (
          <button
            onClick={handleNext}
            disabled={isNextDisabled}
            aria-label="Next Page"
            className={`hidden sm:flex fixed right-4 sm:right-6 top-1/2 -translate-y-1/2 z-40 sm:w-auto sm:px-5 sm:h-12 rounded-full bg-white/10 hover:bg-white/25 text-white items-center justify-center gap-2 backdrop-blur-md transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer ${isNextDisabled ? 'opacity-20 cursor-not-allowed pointer-events-none' : 'opacity-100'}`}
          >
            <span className="font-medium text-sm pl-1">Next</span>
            <i className="fa-solid fa-chevron-right text-lg"></i>
          </button>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-50">
            <i className="fa-solid fa-circle-notch fa-spin text-4xl text-brand-blue mb-4"></i>
            <p className="font-semibold tracking-wider animate-pulse text-sm">Loading Report...</p>
          </div>
        )}

        <div 
          className="m-auto flex justify-center items-center"
          style={{ 
            width: dimensions.isMobile ? dimensions.width : dimensions.width * 2, 
            height: dimensions.height
          }}
        >
          <div className={`w-full h-full transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
              className="flex items-center justify-center w-full h-full"
              error={
                <div className="text-white bg-red-500/20 p-6 rounded-xl border border-red-500 text-center flex flex-col items-center z-50">
                  <i className="fa-solid fa-triangle-exclamation text-3xl text-red-500 mb-3 block"></i>
                  <p className="mb-4 text-sm font-medium">Failed to load PDF preview.</p>
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="px-5 py-2 bg-brand-blue text-white rounded shadow font-bold transition-colors">
                    Open PDF Directly
                  </a>
                </div>
              }
            >
              {numPages && numPages > 0 && (
                /* @ts-ignore */
                <HTMLFlipBook
                  ref={bookRef}
                  width={dimensions.width}
                  height={dimensions.height}
                  size="fixed"
                  usePortrait={dimensions.isMobile}
                  maxShadowOpacity={0.6}
                  showCover={true}
                  mobileScrollSupport={false}
                  useMouseEvents={true}
                  drawShadow={true}
                  showPageCorners={true}
                  clickEventForward={false}
                  flippingTime={400}
                  swipeDistance={25}
                  className="shadow-[0_0_50px_rgba(0,0,0,0.9)] mx-auto"
                  onFlip={(e: any) => setPageNumber(e.data + 1)}
                  onInit={(e: any) => patchFlipController(e?.object || bookRef.current?.pageFlip())}
                  style={{ margin: '0 auto' }}
                >
                  {Array.from(new Array(numPages), (el, index) => (
                    <PageContent key={`page_${index + 1}`}>
                      <Page 
                        pageNumber={index + 1} 
                        width={dimensions.width}
                        height={dimensions.height}
                        renderTextLayer={false} 
                        renderAnnotationLayer={false}
                        className="w-full h-full block"
                      />
                    </PageContent>
                  ))}
                </HTMLFlipBook>
              )}
            </Document>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      {!isLoading && numPages && numPages > 1 && (
        <div className="w-full h-14 sm:hidden flex items-center justify-between px-4 bg-black/90 border-t border-white/10 shrink-0 z-[510]">
          <button
            onClick={handlePrev}
            disabled={isPrevDisabled}
            aria-label="Previous Page"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium backdrop-blur-md transition-all ${isPrevDisabled ? 'opacity-20 cursor-not-allowed pointer-events-none' : 'opacity-100 active:scale-95'}`}
          >
            <i className="fa-solid fa-chevron-left text-xs"></i>
            <span>Previous</span>
          </button>

          <div className="text-white/60 text-xs font-mono bg-white/10 px-3 py-1 rounded-full">
            {getPageLabel()}
          </div>

          <button
            onClick={handleNext}
            disabled={isNextDisabled}
            aria-label="Next Page"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium backdrop-blur-md transition-all ${isNextDisabled ? 'opacity-20 cursor-not-allowed pointer-events-none' : 'opacity-100 active:scale-95'}`}
          >
            <span>Next</span>
            <i className="fa-solid fa-chevron-right text-xs"></i>
          </button>
        </div>
      )}
    </div>
  )
}

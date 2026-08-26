'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ShareButton } from '@/components/ui/ShareButton'
import type { ParticipationPhotoItem } from '@/types/participationGallery'
import { getAssetsUrl } from '@/lib/api-utils'

interface ParticipationAlbumClientProps {
  photos: ParticipationPhotoItem[]
  albumTitle: string
  albumSlug?: string
  lang: string
}

const PHOTOS_PER_PAGE = 50

export default function ParticipationAlbumClient({
  photos,
  albumTitle,
  albumSlug = '',
  lang,
}: ParticipationAlbumClientProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const thumbnailContainerRef = useRef<HTMLDivElement>(null)
  const activeThumbnailRef = useRef<HTMLButtonElement>(null)

  const totalPages = Math.ceil(photos.length / PHOTOS_PER_PAGE)
  const startIndex = (currentPage - 1) * PHOTOS_PER_PAGE
  const currentPhotos = photos.slice(startIndex, startIndex + PHOTOS_PER_PAGE)

  // Low-res thumbnail for listings and bottom thumbnail tiles
  const getThumbnailUrl = (photo: ParticipationPhotoItem) => {
    const path = photo.thumbnail || photo.image
    if (!path) return '/placeholder-image.jpg'
    if (path.startsWith('http')) return path
    const assetsUrl = getAssetsUrl()
    const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
    return `${imageBaseUrl}${path}`
  }

  // Full high-res actual image for the lightbox center view
  const getActualImageUrl = (photo: ParticipationPhotoItem) => {
    const path = photo.image || photo.thumbnail
    if (!path) return '/placeholder-image.jpg'
    if (path.startsWith('http')) return path
    const assetsUrl = getAssetsUrl()
    const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
    return `${imageBaseUrl}${path}`
  }

  const getPhotoTitle = (photo: ParticipationPhotoItem, idx: number) => {
    if (photo.translations && Array.isArray(photo.translations)) {
      const tr = photo.translations.find((t) => t.lang_code === lang)
      if (tr?.title && tr.title.trim().length > 0) return tr.title
    }
    if (photo.title && photo.title.trim().length > 0) return photo.title
    return `${albumTitle} - Photo ${idx + 1}`
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (selectedIndex === null) return

      if (e.key === 'Escape') {
        setSelectedIndex(null)
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex((prev) =>
          prev !== null ? (prev + 1) % photos.length : null
        )
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex((prev) =>
          prev !== null ? (prev - 1 + photos.length) % photos.length : null
        )
      }
    },
    [selectedIndex, photos.length]
  )

  // Preload adjacent full-res images for instant flipping
  useEffect(() => {
    if (selectedIndex !== null) {
      const nextIdx = (selectedIndex + 1) % photos.length
      const prevIdx = (selectedIndex - 1 + photos.length) % photos.length
      const nextImg = new Image()
      nextImg.src = getActualImageUrl(photos[nextIdx])
      const prevImg = new Image()
      prevImg.src = getActualImageUrl(photos[prevIdx])
    }
  }, [selectedIndex, photos])

  // Auto-scroll the active thumbnail into center when selectedIndex changes
  useEffect(() => {
    if (selectedIndex !== null && activeThumbnailRef.current) {
      activeThumbnailRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
    }
  }, [selectedIndex])

  // Auto open lightbox if ?photo= is present in URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const photoParam = params.get('photo')
    if (photoParam) {
      const idx = photos.findIndex(
        (p, i) => p.id === photoParam || p.slug === photoParam || String(i + 1) === photoParam
      )
      if (idx !== -1) {
        setSelectedIndex(idx)
      }
    }
  }, [photos])

  // Sync selected photo to browser URL query param
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (selectedIndex !== null && photos[selectedIndex]) {
      const p = photos[selectedIndex]
      url.searchParams.set('photo', p.slug || p.id || String(selectedIndex + 1))
    } else {
      url.searchParams.delete('photo')
    }
    window.history.replaceState(null, '', url.pathname + url.search)
  }, [selectedIndex, photos])

  useEffect(() => {
    if (selectedIndex !== null) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedIndex, handleKeyDown])

  const currentPhoto = selectedIndex !== null ? photos[selectedIndex] : null
  const currentPhotoTitle = currentPhoto && selectedIndex !== null ? getPhotoTitle(currentPhoto, selectedIndex) : albumTitle
  const currentPhotoKey = currentPhoto ? (currentPhoto.slug || currentPhoto.id || String((selectedIndex ?? 0) + 1)) : ''
  const currentShareUrl = `/${lang}/participation-gallery/${albumSlug}?photo=${currentPhotoKey}`

  return (
    <div>
      {/* Grid of Square Photos (1:1) with Thumbnails & Share button on every card */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 mt-2">
        {currentPhotos.map((photo, index) => {
          const globalIndex = startIndex + index
          const photoThumbUrl = getThumbnailUrl(photo)
          const title = getPhotoTitle(photo, globalIndex)
          const photoKey = photo.slug || photo.id || String(globalIndex + 1)
          const shareUrl = `/${lang}/participation-gallery/${albumSlug}?photo=${photoKey}`

          return (
            <div
              key={photo.id || globalIndex}
              className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all duration-200 shadow-xs"
            >
              {/* Square Thumbnail Box (Click to open lightbox) */}
              <div
                onClick={() => setSelectedIndex(globalIndex)}
                className="relative w-full aspect-square bg-muted overflow-hidden block cursor-pointer"
              >
                <ImageWithSkeleton
                  src={photoThumbUrl}
                  alt={title}
                  title={title}
                  fill
                  unoptimized={true}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  priority={index < 4}
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Hover Expand Icon Overlay */}
                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-background/85 backdrop-blur-xs flex items-center justify-center text-foreground shadow-md">
                    <i className="fa-solid fa-expand text-sm"></i>
                  </div>
                </div>
              </div>

              {/* Card Footer with Title & Share button */}
              <div className="px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center justify-between border-t border-border bg-card">
                <button
                  type="button"
                  onClick={() => setSelectedIndex(globalIndex)}
                  className="text-left font-bold text-xs sm:text-[13px] text-foreground truncate hover:text-primary transition-colors flex-1 mr-2 leading-tight cursor-pointer"
                  style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}
                >
                  {title}
                </button>

                <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <ShareButton
                    title={`${albumTitle} Memories with AgriGuru Online`}
                    url={shareUrl}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination for Album Photos */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-1 sm:space-x-2 mt-8">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border bg-card text-foreground hover:bg-primary hover:text-white hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold cursor-pointer"
            aria-label="Previous page"
          >
            <i className="fa-solid fa-chevron-left text-xs rtl:rotate-180"></i>
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
            <button
              key={pg}
              type="button"
              onClick={() => setCurrentPage(pg)}
              className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border font-bold text-sm transition-colors cursor-pointer ${
                currentPage === pg
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'border-border bg-card text-foreground hover:bg-primary/10 hover:border-primary/50'
              }`}
            >
              {pg}
            </button>
          ))}

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border bg-card text-foreground hover:bg-primary hover:text-white hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold cursor-pointer"
            aria-label="Next page"
          >
            <i className="fa-solid fa-chevron-right text-xs rtl:rotate-180"></i>
          </button>
        </div>
      )}

      {/* Full Screen Lightbox Modal - z-[9999] so it overlays the announcement bar and header completely */}
      {selectedIndex !== null && currentPhoto && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setSelectedIndex(null)}
        >
          {/* Lightbox Top Header */}
          <div
            className="flex items-center justify-between w-full max-w-7xl mx-auto z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-md bg-white/10 text-white text-xs font-semibold">
                {selectedIndex + 1} / {photos.length}
              </span>
              <h4 className="text-white font-medium text-xs sm:text-sm hidden sm:block truncate max-w-md">
                {currentPhotoTitle}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <ShareButton
                title={`${albumTitle} Memories with AgriGuru Online`}
                url={currentShareUrl}
              />

              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                title="Close (Esc)"
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-sm cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          {/* Center Stage: Progressive Instant Preview with Dual-Layer High-Res Load */}
          <div
            className="relative flex-grow flex items-center justify-center my-2 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() =>
                setSelectedIndex(
                  (selectedIndex - 1 + photos.length) % photos.length
                )
              }
              aria-label="Previous"
              className="absolute left-2 sm:left-4 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-primary text-white flex items-center justify-center transition-colors border border-white/20 cursor-pointer shadow-lg"
            >
              <i className="fa-solid fa-chevron-left text-sm rtl:rotate-180"></i>
            </button>

            <button
              type="button"
              onClick={() =>
                setSelectedIndex((selectedIndex + 1) % photos.length)
              }
              aria-label="Next"
              className="absolute right-2 sm:right-4 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-primary text-white flex items-center justify-center transition-colors border border-white/20 cursor-pointer shadow-lg"
            >
              <i className="fa-solid fa-chevron-right text-sm rtl:rotate-180"></i>
            </button>

            <div className="relative w-full h-[65vh] max-w-4xl aspect-square flex items-center justify-center">
              {/* Instant low-res backdrop so there is 0ms blank screen */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getThumbnailUrl(currentPhoto)}
                alt=""
                className="absolute max-w-full max-h-full object-contain filter blur-xs opacity-60 pointer-events-none rounded-lg"
              />
              {/* High-res full quality photo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={currentPhoto.id || selectedIndex}
                src={getActualImageUrl(currentPhoto)}
                alt={currentPhotoTitle}
                className="relative z-10 max-w-full max-h-full object-contain select-none shadow-2xl rounded-lg animate-in fade-in duration-200"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>

          {/* Bottom Thumbnail Tiles Strip with Auto-Scroll */}
          <div
            className="w-full max-w-4xl mx-auto z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white text-xs text-center font-medium mb-2.5 truncate">
              {currentPhotoTitle}
            </p>

            <div
              ref={thumbnailContainerRef}
              className="flex items-center gap-2 overflow-x-auto py-1 px-2 no-scrollbar max-w-2xl mx-auto justify-start sm:justify-center"
            >
              {photos.map((p, idx) => {
                const isActive = idx === selectedIndex
                const thumbUrl = getThumbnailUrl(p)

                return (
                  <button
                    key={p.id || idx}
                    ref={isActive ? activeThumbnailRef : null}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    title={getPhotoTitle(p, idx)}
                    className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all duration-150 cursor-pointer bg-black/40 ${
                      isActive
                        ? 'border-primary scale-110 shadow-lg ring-2 ring-primary/50 opacity-100'
                        : 'border-white/20 opacity-50 hover:opacity-100'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

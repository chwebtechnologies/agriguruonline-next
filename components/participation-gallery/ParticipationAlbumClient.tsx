'use client'

import { useState, useCallback } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'

import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Counter from 'yet-another-react-lightbox/plugins/counter'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'

import 'yet-another-react-lightbox/plugins/counter.css'

import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ShareButton } from '@/components/ui/ShareButton'
import type { ParticipationPhotoItem } from '@/types/participationGallery'
import { getAssetsUrl } from '@/lib/api-utils'
import { resolveImageUrl } from '@/components/ui/ImageWithSkeleton'

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
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(photos.length / PHOTOS_PER_PAGE)
  const startIndex = (currentPage - 1) * PHOTOS_PER_PAGE
  const currentPhotos = photos.slice(startIndex, startIndex + PHOTOS_PER_PAGE)

  const getPhotoTitle = useCallback(
    (photo: ParticipationPhotoItem, idx: number) => {
      if (photo.translations && Array.isArray(photo.translations)) {
        const tr = photo.translations.find((t) => t.lang_code === lang)
        if (tr?.title && tr.title.trim().length > 0) return tr.title
      }
      if (photo.title && photo.title.trim().length > 0) return photo.title
      return `${albumTitle} - Photo ${idx + 1}`
    },
    [lang, albumTitle]
  )

  const resolveUrl = useCallback(
    (photo: ParticipationPhotoItem, prefer: 'image' | 'thumbnail' = 'image') => {
      const path =
        prefer === 'image'
          ? photo.image || photo.thumbnail
          : photo.thumbnail || photo.image
      return resolveImageUrl(path || '')
    },
    []
  )

  // Build slide array for YARL — title shown only in toolbar header
  const slides = photos.map((photo, idx) => ({
    src: resolveUrl(photo, 'image'),
    thumbnail: resolveUrl(photo, 'thumbnail'),
    title: getPhotoTitle(photo, idx),
  }))

  return (
    <div>
      {/* ── Photo Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 mt-2">
        {currentPhotos.map((photo, index) => {
          const globalIndex = startIndex + index
          const photoThumbUrl = resolveUrl(photo, 'thumbnail')
          const title = getPhotoTitle(photo, globalIndex)
          const photoKey = photo.slug || photo.id || String(globalIndex + 1)
          const shareUrl = `/${lang}/participation-gallery/${albumSlug}?photo=${photoKey}`

          return (
            <div
              key={photo.id || globalIndex}
              className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all duration-200 shadow-xs"
            >
              {/* Square Thumbnail – click opens YARL at correct index */}
              <div
                onClick={() => setLightboxIndex(globalIndex)}
                className="relative w-full aspect-square bg-muted overflow-hidden block cursor-pointer"
              >
                <ImageWithSkeleton
                  src={photoThumbUrl}
                  alt={title}
                  title={title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  priority={index < 4}
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Hover expand overlay */}
                <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-background/85 backdrop-blur-sm flex items-center justify-center text-foreground shadow-md">
                    <i className="fa-solid fa-expand text-sm" />
                  </div>
                </div>
              </div>

              {/* Card footer */}
              <div className="px-3 py-2 sm:px-3.5 sm:py-2.5 flex items-center justify-between border-t border-border bg-card">
                <button
                  type="button"
                  onClick={() => setLightboxIndex(globalIndex)}
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

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-1 sm:space-x-2 mt-8">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-border bg-card text-foreground hover:bg-primary hover:text-white hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold cursor-pointer"
            aria-label="Previous page"
          >
            <i className="fa-solid fa-chevron-left text-xs rtl:rotate-180" />
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
            <i className="fa-solid fa-chevron-right text-xs rtl:rotate-180" />
          </button>
        </div>
      )}

      {/* ── YARL Lightbox ── */}
      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex}
        close={() => setLightboxIndex(-1)}
        slides={slides}
        plugins={[Thumbnails, Zoom, Fullscreen, Counter]}
        thumbnails={{
          position: 'bottom',
          width: 80,
          height: 60,
          border: 2,
          borderRadius: 8,
          padding: 3,
          gap: 8,
          imageFit: 'cover',
          showToggle: true,
        }}
        zoom={{
          maxZoomPixelRatio: 4,
          zoomInMultiplier: 2,
          doubleTapDelay: 300,
          doubleClickDelay: 300,
          doubleClickMaxStops: 2,
          keyboardMoveDistance: 50,
          wheelZoomDistanceFactor: 100,
          pinchZoomDistanceFactor: 100,
          scrollToZoom: true,
        }}
        counter={{ container: { style: { top: 16, bottom: 'unset', left: 16 } } }}
        animation={{ fade: 200, swipe: 300 }}
        carousel={{ finite: false, preload: 2 }}
        controller={{ closeOnBackdropClick: true }}
        styles={{
          container: { backgroundColor: 'rgba(0,0,0,0.95)' },
          thumbnail: { border: '2px solid rgba(255,255,255,0.2)' },
          thumbnailsTrack: { padding: '8px 0' },
        }}
      />
    </div>
  )
}

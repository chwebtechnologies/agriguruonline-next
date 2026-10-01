'use client'

import { useState, useCallback } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import { Pagination } from '@/components/ui/Pagination'
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
  currentPage?: number
}

const PHOTOS_PER_PAGE = 50

export default function ParticipationAlbumClient({
  photos,
  albumTitle,
  albumSlug = '',
  lang,
  currentPage = 1,
}: ParticipationAlbumClientProps) {
  const [lightboxIndex, setLightboxIndex] = useState(-1)

  const totalPages = Math.ceil(photos.length / PHOTOS_PER_PAGE)
  const validPage = isNaN(currentPage) || currentPage < 1 ? 1 : currentPage > totalPages && totalPages > 0 ? totalPages : currentPage
  const startIndex = (validPage - 1) * PHOTOS_PER_PAGE
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

  // Build slide array for YARL
  const slides = photos.map((photo, idx) => ({
    src: resolveUrl(photo, 'image'),
    thumbnail: resolveUrl(photo, 'thumbnail'),
    alt: getPhotoTitle(photo, idx),
  }))

  return (
    <div>
      {/* ── Photo Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 mt-2">
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
                  <div className="w-10 h-10 rounded-full bg-background/85 flex items-center justify-center text-foreground shadow-md">
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
      <Pagination 
        currentPage={validPage} 
        totalPages={totalPages} 
        baseUrl={`/${lang}/participation-gallery/${albumSlug}`} 
      />

      {/* ── YARL Lightbox (Mount only when open to prevent blocking grid thumbnails) ── */}
      {lightboxIndex >= 0 && (
        <Lightbox
          open={true}
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
            padding: 2,
            gap: 8,
            vignette: true,
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
          animation={{ fade: 200, swipe: 300 }}
          carousel={{ finite: false, preload: 3 }}
          controller={{ closeOnBackdropClick: true }}
        render={{
          controls: () => (
            <>
              {/* Theme, Layout & Navigation Styling */}
              <style>{`
                .yarl__container {
                  background-color: var(--background) !important;
                  color: var(--foreground) !important;
                }
                .yarl__counter {
                  height: 48px !important;
                  margin: 0 !important;
                  padding: 0 16px !important;
                  display: flex !important;
                  align-items: center !important;
                  top: 0 !important;
                  left: 0 !important;
                  font-size: 15px !important;
                  font-weight: 600 !important;
                  line-height: normal !important;
                  color: var(--foreground) !important;
                  filter: none !important;
                }
                .yarl__toolbar {
                  height: 48px !important;
                  padding: 0 8px !important;
                  display: flex !important;
                  align-items: center !important;
                  top: 0 !important;
                  right: 0 !important;
                }
                .yarl__toolbar .yarl__button {
                  color: var(--foreground) !important;
                  filter: none !important;
                }
                /* Rounded Circular Prev & Next Buttons (Desktop Centered) */
                .yarl__navigation_prev,
                .yarl__navigation_next {
                  position: absolute !important;
                  top: 50% !important;
                  transform: translateY(-50%) !important;
                  border-radius: 9999px !important;
                  width: 44px !important;
                  height: 44px !important;
                  padding: 0 !important;
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  background-color: var(--card) !important;
                  color: var(--foreground) !important;
                  border: 1px solid var(--border) !important;
                  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12) !important;
                  backdrop-filter: blur(8px) !important;
                  margin: 0 !important;
                  filter: none !important;
                  cursor: pointer !important;
                  z-index: 100 !important;
                  transition: background-color 0.15s ease, border-color 0.15s ease !important;
                }
                .yarl__navigation_prev:hover,
                .yarl__navigation_next:hover {
                  background-color: var(--muted) !important;
                  border-color: var(--foreground) !important;
                }
                .yarl__navigation_prev {
                  left: 24px !important;
                }
                .yarl__navigation_next {
                  right: 24px !important;
                }
                .yarl__navigation_prev .yarl__icon,
                .yarl__navigation_next .yarl__icon {
                  width: 22px !important;
                  height: 22px !important;
                }
                /* Thumbnails Theme Styling */
                .yarl__thumbnails_container {
                  background-color: var(--background) !important;
                  border-top: 1px solid var(--border) !important;
                  padding: 8px 0 !important;
                }
                .yarl__thumbnails_vignette {
                  background: linear-gradient(
                    to right,
                    var(--background) 0%,
                    transparent var(--yarl__thumbnails_vignette_size, 10%) calc(100% - var(--yarl__thumbnails_vignette_size, 10%)),
                    var(--background) 100%
                  ) !important;
                }
                .yarl__thumbnails_track {
                  padding: 4px 12px !important;
                  background-color: transparent !important;
                }
                /* Inactive thumbnails: visible border & opacity */
                .yarl__thumbnails_thumbnail {
                  background: var(--card) !important;
                  border: 2px solid rgba(148, 163, 184, 0.45) !important;
                  border-radius: 8px !important;
                  opacity: 0.65 !important;
                  transition: opacity 0.2s ease, transform 0.2s ease, border-color 0.2s ease !important;
                }
                .yarl__thumbnails_thumbnail:hover {
                  opacity: 0.95 !important;
                  border-color: rgba(148, 163, 184, 0.8) !important;
                }
                /* Active thumbnail: prominent Vibrant Blue border & scale */
                .yarl__thumbnails_thumbnail_active {
                  opacity: 1 !important;
                  border: 2.5px solid #2563eb !important;
                  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.4), 0 2px 8px rgba(37, 99, 235, 0.3) !important;
                  transform: scale(1.06) !important;
                  z-index: 2 !important;
                }
                /* Slide & Centered Image */
                .yarl__slide {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                }
                .yarl__slide_image {
                  max-height: 80% !important;
                  max-width: 85% !important;
                  margin: auto !important;
                  object-fit: contain !important;
                  border-radius: 12px;
                }
                @media (min-width: 640px) {
                  .yarl__counter {
                    height: 56px !important;
                    padding: 0 20px !important;
                    font-size: 16px !important;
                  }
                  .yarl__toolbar {
                    height: 56px !important;
                    padding: 0 16px !important;
                  }
                }
                /* Mobile-specific adjustments */
                @media (max-width: 640px) {
                  .yarl__toolbar > button:not(:last-child) {
                    display: none !important;
                  }
                  /* Position Prev/Next buttons below image on mobile aligned to left and right edges */
                  .yarl__navigation_prev {
                    top: auto !important;
                    bottom: 74px !important;
                    left: 16px !important;
                    transform: none !important;
                    width: 38px !important;
                    height: 38px !important;
                  }
                  .yarl__navigation_next {
                    top: auto !important;
                    bottom: 74px !important;
                    right: 16px !important;
                    transform: none !important;
                    width: 38px !important;
                    height: 38px !important;
                  }
                  .yarl__navigation_prev .yarl__icon,
                  .yarl__navigation_next .yarl__icon {
                    width: 18px !important;
                    height: 18px !important;
                  }
                  .yarl__slide_image {
                    max-height: 72% !important;
                    max-width: 90% !important;
                  }
                }
              `}</style>
              {/* Perfectly centered header bar in the same row as Counter and Actions */}
              <div className="absolute top-0 left-0 right-0 h-[48px] sm:h-[56px] flex items-center justify-center pointer-events-none px-14 sm:px-28 z-[1000]">
                <h2
                  className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-center truncate max-w-[65vw] sm:max-w-[50vw] leading-none"
                  
                >
                  {(albumTitle || '').split(' ').map((word, index, arr) => (
                    <span key={index}>
                      <span className="bg-[image:var(--ag-gradient-heading)] bg-clip-text text-transparent drop-shadow-sm">
                        {word}
                      </span>
                      {index < arr.length - 1 && ' '}
                    </span>
                  ))}
                </h2>
              </div>
            </>
          ),
        }}
        styles={{
          container: { backgroundColor: 'var(--background)' },
          thumbnail: { border: '2px solid var(--border)' },
          thumbnailsTrack: { padding: '6px 0' },
          slide: { paddingTop: '56px', paddingBottom: '76px' },
        }}
      />
      )}
    </div>
  )
}

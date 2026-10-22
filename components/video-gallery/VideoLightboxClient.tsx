'use client'

import { useState, useEffect } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'

function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/|live\/)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

function checkIsShort(url: string, videoType?: string): boolean {
  if (videoType && (videoType.toLowerCase() === 'short' || videoType.toLowerCase() === 'shorts')) {
    return true;
  }
  if (!url) return false;
  return /\/shorts\//i.test(url) || /[?&]type=shorts/i.test(url);
}

export function VideoLightboxClient({ slides }: { slides: any[] }) {
  const [lightboxIndex, setLightboxIndex] = useState(-1)

  useEffect(() => {
    const handleOpen = (e: CustomEvent<{ index: number }>) => {
      setLightboxIndex(e.detail.index)
    }
    window.addEventListener('open-video-lightbox', handleOpen as EventListener)
    return () => window.removeEventListener('open-video-lightbox', handleOpen as EventListener)
  }, [])

  if (lightboxIndex < 0) return null

  return (
    <Lightbox
      open={true}
      close={() => setLightboxIndex(-1)}
      slides={[slides[lightboxIndex]]}
      index={0}
      carousel={{ finite: true }}
      controller={{ closeOnBackdropClick: true }}
      render={{
        slide: ({ slide, offset }) => {
          const customSlide = slide as any;
          if (customSlide.type === "custom-video") {
            const video = customSlide.video || {};
            const url = video.video_url || video.url || customSlide.src || '';
            const ytId = getYoutubeId(url);
            const isYoutube = !!ytId;
            const isShort = isYoutube && checkIsShort(`${video.video_url || ''} ${video.url || ''} ${url}`, video.video_type);

            const containerClass = isShort
              ? "w-auto h-[80vh] max-h-[720px] aspect-[9/16] max-w-[92vw] bg-black rounded-2xl overflow-hidden shadow-2xl relative border border-white/10"
              : "w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative";

            if (offset !== 0) {
              return (
                <div className="w-full h-full flex items-center justify-center p-3 sm:p-6">
                  <div className={`${containerClass} flex items-center justify-center`}>
                    <i className="fa-solid fa-spinner fa-spin text-white text-3xl"></i>
                  </div>
                </div>
              )
            }

            const embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1`;

            return (
              <div className="w-full h-full flex items-center justify-center p-3 sm:p-6">
                <div className={containerClass}>
                  {isYoutube ? (
                    <iframe 
                      className="w-full h-full absolute inset-0 border-0" 
                      src={embedUrl} 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      allowFullScreen
                    ></iframe>
                  ) : (
                    <video 
                      className="w-full h-full absolute inset-0 outline-none" 
                      src={url} 
                      controls 
                      autoPlay 
                      playsInline 
                    />
                  )}
                </div>
              </div>
            )
          }
          return null
        },
        controls: () => (
          <>
            <style>{`
              .yarl__container {
                background-color: rgba(0, 0, 0, 0.95) !important;
              }
              .yarl__slide {
                padding: 0 !important;
              }
            `}</style>
            <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none z-[1000] px-16">
              <h3 className="text-white text-lg font-medium truncate drop-shadow-md">
                {slides[lightboxIndex]?.title}
              </h3>
            </div>
          </>
        )
      }}
    />
  )
}

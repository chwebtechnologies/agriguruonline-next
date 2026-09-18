'use client'

import { useState, useEffect } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'

function getYoutubeId(url: string): string | null {
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/|live\/)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regExp);
  return match ? match[1] : null;
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
            if (offset !== 0) {
              return (
                <div className="w-full h-full flex items-center justify-center p-4 sm:p-8">
                  <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative flex items-center justify-center">
                    <i className="fa-solid fa-spinner fa-spin text-white text-3xl"></i>
                  </div>
                </div>
              )
            }

            const url = customSlide.video.video_url || customSlide.video.url
            const ytId = getYoutubeId(url)
            const isYoutube = !!ytId
            
            return (
              <div className="w-full h-full flex items-center justify-center p-4 sm:p-8">
                <div className="w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative">
                  {isYoutube ? (
                    <iframe 
                      className="w-full h-full absolute inset-0" 
                      src={ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0` : url} 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
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

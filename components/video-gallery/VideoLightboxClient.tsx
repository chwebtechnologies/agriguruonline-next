'use client'

import React, { useState, useEffect, useRef } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import YouTubeEmbedPlayer from '@/components/ui/YouTubeEmbedPlayer'

function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const str = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|vi\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (match) return match[1];
  const generalMatch = str.match(/(?:[?&]v=|\/embed\/|\/shorts\/|\/vi\/|\/v\/|youtu\.be\/)([\w-]{11})/i);
  return generalMatch ? generalMatch[1] : null;
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

  // Toggle .video-lightbox-active on <html> and <body> to disable CSS zoom while modal is active.
  // This completely eliminates WebKit cross-origin iframe scaling and cut-off bugs.
  useEffect(() => {
    if (lightboxIndex >= 0) {
      document.documentElement.classList.add('video-lightbox-active')
      document.body.classList.add('video-lightbox-active')
    } else {
      document.documentElement.classList.remove('video-lightbox-active')
      document.body.classList.remove('video-lightbox-active')
    }
    return () => {
      document.documentElement.classList.remove('video-lightbox-active')
      document.body.classList.remove('video-lightbox-active')
    }
  }, [lightboxIndex])

  if (lightboxIndex < 0 || !slides || slides.length === 0) return null

  const activeIndex = Math.max(0, Math.min(lightboxIndex, slides.length - 1))

  return (
    <Lightbox
      open={true}
      close={() => setLightboxIndex(-1)}
      slides={slides}
      index={activeIndex}
      on={{
        view: ({ index }) => {
          setLightboxIndex(index)
        },
      }}
      carousel={{ finite: true, padding: 0 }}
      controller={{ closeOnBackdropClick: true }}
      portal={{ container: { className: "video-lightbox-portal" } }}
      className="video-lightbox-portal"
      styles={{
        container: {
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
        },
        slide: {
          padding: 0,
          backgroundColor: 'transparent',
        },
      }}
      render={{
        buttonPrev: slides.length <= 1 ? () => null : undefined,
        buttonNext: slides.length <= 1 ? () => null : undefined,
        slide: ({ slide, offset }) => {
          const customSlide = slide as any;
          if (customSlide.type === "custom-video") {
            const video = customSlide.video || {};
            const rawUrl = video.video_url || video.url || customSlide.videoUrl || '';
            const ytId = customSlide.ytId || customSlide.videoId || getYoutubeId(rawUrl) || getYoutubeId(customSlide.src);
            const isYoutube = !!ytId;
            const isShort = isYoutube && checkIsShort(`${video.video_url || ''} ${video.url || ''} ${rawUrl}`, video.video_type);
            const mediaUrl = rawUrl || customSlide.src || '';

            if (offset !== 0) {
              return (
                <div className="w-full h-full flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
                  {isShort ? (
                    <div 
                      className="relative rounded-2xl overflow-hidden shadow-2xl bg-black flex items-center justify-center border border-white/10"
                      style={{
                        height: 'min(78vh, 680px)',
                        width: 'calc(min(78vh, 680px) * 9 / 16)',
                        maxWidth: '92vw',
                        aspectRatio: '9/16',
                        backgroundColor: '#000000',
                      }}
                    >
                      <i className="fa-solid fa-spinner fa-spin text-white text-2xl sm:text-3xl"></i>
                    </div>
                  ) : (
                    <div 
                      className="relative w-full max-w-5xl aspect-video max-h-[calc(100vh-100px)] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl bg-black flex items-center justify-center border border-white/10"
                      style={{ backgroundColor: '#000000' }}
                    >
                      <i className="fa-solid fa-spinner fa-spin text-white text-2xl sm:text-3xl"></i>
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div className="w-full h-full flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
                {isShort ? (
                  <div 
                    className="relative rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10"
                    style={{
                      height: 'min(78vh, 680px)',
                      width: 'calc(min(78vh, 680px) * 9 / 16)',
                      maxWidth: '92vw',
                      aspectRatio: '9/16',
                      backgroundColor: '#000000',
                    }}
                  >
                    {isYoutube ? (
                      <YouTubeEmbedPlayer ytId={ytId} title={customSlide.title} isShort={true} />
                    ) : (
                      <video 
                        className="w-full h-full object-contain outline-none bg-black block"
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: '#000000',
                          display: 'block',
                        }}
                        src={mediaUrl} 
                        controls 
                        autoPlay 
                        playsInline 
                        ref={(el) => {
                          if (el) {
                            el.muted = false;
                            el.play().catch(() => {
                              el.muted = true;
                              el.play().catch(() => {});
                            });
                          }
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div 
                    className="relative w-full max-w-5xl aspect-video max-h-[calc(100vh-100px)] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10"
                    style={{ backgroundColor: '#000000' }}
                  >
                    {isYoutube ? (
                      <YouTubeEmbedPlayer ytId={ytId} title={customSlide.title} isShort={false} />
                    ) : (
                      <video 
                        className="w-full h-full absolute inset-0 object-contain outline-none bg-black block"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          backgroundColor: '#000000',
                          display: 'block',
                        }}
                        src={mediaUrl} 
                        controls 
                        autoPlay 
                        playsInline 
                        ref={(el) => {
                          if (el) {
                            el.muted = false;
                            el.play().catch(() => {
                              el.muted = true;
                              el.play().catch(() => {});
                            });
                          }
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          }
          return null
        },
        controls: () => (
          <>
            <style>{`
              .video-lightbox-portal.yarl__portal,
              .video-lightbox-portal .yarl__container {
                background-color: rgba(0, 0, 0, 0.95) !important;
                color-scheme: dark !important;
              }
              .video-lightbox-portal .yarl__slide {
                padding: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                background-color: transparent !important;
              }
              .video-lightbox-portal iframe {
                background-color: #000000 !important;
                color-scheme: dark !important;
              }
              .video-lightbox-portal .yarl__navigation_prev,
              .video-lightbox-portal .yarl__navigation_next {
                background: rgba(255, 255, 255, 0.15) !important;
                backdrop-filter: blur(8px) !important;
                -webkit-backdrop-filter: blur(8px) !important;
                border-radius: 9999px !important;
                width: 44px !important;
                height: 44px !important;
                padding: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: #fff !important;
                border: 1px solid rgba(255, 255, 255, 0.25) !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
              }
              .video-lightbox-portal .yarl__navigation_prev:hover,
              .video-lightbox-portal .yarl__navigation_next:hover {
                background: rgba(255, 255, 255, 0.3) !important;
                transform: translateY(-50%) scale(1.05) !important;
              }
              .video-lightbox-portal .yarl__navigation_prev {
                left: 16px !important;
              }
              .video-lightbox-portal .yarl__navigation_next {
                right: 16px !important;
              }
              .video-lightbox-portal .yarl__button {
                color: #fff !important;
                filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8)) !important;
              }
              /* Hide prev/next navigation arrow buttons on mobile screens to prevent overlapping the full-width video */
              @media (max-width: 768px) {
                .video-lightbox-portal .yarl__navigation_prev,
                .video-lightbox-portal .yarl__navigation_next {
                  display: none !important;
                }
              }
            `}</style>
            <div className="absolute top-2 sm:top-4 left-0 right-0 flex justify-center pointer-events-none z-[1000] pl-4 pr-14 sm:px-16">
              <h3 className="text-white text-xs sm:text-base md:text-lg font-semibold truncate drop-shadow-md max-w-xl text-center px-2">
                {slides[activeIndex]?.title}
              </h3>
            </div>
          </>
        )
      }}
    />
  )
}

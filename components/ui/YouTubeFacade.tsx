'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import YouTubeEmbedPlayer from '@/components/ui/YouTubeEmbedPlayer';

interface YouTubeFacadeProps {
  videoId: string;
  title: string;
  className?: string;
  poster?: string;
}

// Built-in static HD posters for platform tutorial videos (adblocker-proof, 0 latency)
const DEFAULT_POSTERS: Record<string, string> = {
  'vi0fcb-IjLA': '/media/tutorial-thumbnail.jpg',
  'neEQrat8yuU': '/media/seller-tutorial-thumbnail.jpg',
};

export default function YouTubeFacade({ videoId, title, className = '', poster }: YouTubeFacadeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Toggle .video-lightbox-active on <html> and <body> to disable CSS zoom while modal is active.
  // This guarantees 100% full-width and eliminates WebKit iframe scaling/cut-off bugs on mobile.
  useEffect(() => {
    if (isOpen) {
      document.documentElement.classList.add('video-lightbox-active');
      document.body.classList.add('video-lightbox-active');
    } else {
      document.documentElement.classList.remove('video-lightbox-active');
      document.body.classList.remove('video-lightbox-active');
    }
    return () => {
      document.documentElement.classList.remove('video-lightbox-active');
      document.body.classList.remove('video-lightbox-active');
    };
  }, [isOpen]);

  const localPoster = poster || DEFAULT_POSTERS[videoId];

  // Candidate thumbnail URLs in priority order
  const candidates = [
    ...(localPoster ? [localPoster] : []),
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
  ];

  const handleThumbError = () => {
    if (attempt + 1 < candidates.length) {
      setAttempt(prev => prev + 1);
    } else {
      setHasError(true);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Play video: ${title}`}
        onClick={() => {
          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              ctx.resume().catch(() => {});
            }
          } catch {}
          setIsOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            try {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioCtx) {
                const ctx = new AudioCtx();
                ctx.resume().catch(() => {});
              }
            } catch {}
            setIsOpen(true);
          }
        }}
        className={`relative aspect-video rounded-xl overflow-hidden shadow-lg border border-border bg-card group cursor-pointer select-none ${className}`}
      >
        {/* Video Poster Image */}
        {!hasError ? (
          <Image
            key={`thumb-${attempt}-${candidates[attempt]}`}
            src={candidates[attempt]}
            alt={title}
            fill
            unoptimized
            priority
            referrerPolicy="no-referrer"
            onError={handleThumbError}
            className="object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          /* Fallback branded card if external YouTube CDN is blocked or unreachable */
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-2">
              <i className="fa-brands fa-youtube text-2xl text-red-500"></i>
            </div>
            <span className="text-xs sm:text-sm font-semibold text-white/90 line-clamp-2 max-w-[80%]">
              {title}
            </span>
          </div>
        )}

        {/* Subtle Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

        {/* Custom YouTube-style Play Button */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-11 sm:w-18 sm:h-12 bg-red-600 group-hover:bg-red-700 transition-colors duration-200 rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-110 transform transition-transform">
            <svg className="w-6 h-6 text-white translate-x-0.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Full-width Video Lightbox Modal (Identical to Video Gallery) */}
      {isOpen && (
        <Lightbox
          open={true}
          close={() => setIsOpen(false)}
          slides={[{
            type: 'custom-video',
            videoId,
            title,
          }] as any}
          index={0}
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
            buttonPrev: () => null,
            buttonNext: () => null,
            slide: () => (
              <div className="w-full h-full flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
                <div 
                  className="relative w-full max-w-5xl aspect-video max-h-[calc(100vh-100px)] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10"
                  style={{ backgroundColor: '#000000' }}
                >
                  <YouTubeEmbedPlayer videoId={videoId} title={title} />
                </div>
              </div>
            ),
            controls: () => (
              <div className="absolute top-2 sm:top-4 left-0 right-0 flex justify-center pointer-events-none z-[1000] pl-4 pr-14 sm:px-16">
                <h3 className="text-white text-xs sm:text-base md:text-lg font-semibold truncate drop-shadow-md max-w-xl text-center px-2">
                  {title}
                </h3>
              </div>
            )
          }}
        />
      )}
    </>
  );
}

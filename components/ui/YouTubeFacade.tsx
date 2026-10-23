'use client';

import { useState } from 'react';
import Image from 'next/image';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

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

  if (isPlaying) {
    return (
      <div className={`relative aspect-video rounded-xl overflow-hidden shadow-lg border border-border ${className}`}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const handleThumbError = () => {
    if (attempt + 1 < candidates.length) {
      setAttempt(prev => prev + 1);
    } else {
      setHasError(true);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Play video: ${title}`}
      onClick={() => setIsPlaying(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsPlaying(true);
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
  );
}

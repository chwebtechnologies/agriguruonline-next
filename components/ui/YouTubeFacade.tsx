'use client';

import { useState } from 'react';

interface YouTubeFacadeProps {
  videoId: string;
  title: string;
  className?: string;
}

export default function YouTubeFacade({ videoId, title, className = '' }: YouTubeFacadeProps) {
  const [isPlaying, setIsPlaying] = useState(false);

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

  // YouTube HQ thumbnail
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

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
      className={`relative aspect-video rounded-xl overflow-hidden shadow-lg border border-border bg-black group cursor-pointer select-none ${className}`}
    >
      {/* Video Poster Image with aspect ratio matching parent */}
      <img
        src={thumbnailUrl}
        alt={title}
        width={480}
        height={360}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90 group-hover:opacity-100"
      />

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

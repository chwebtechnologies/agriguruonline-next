'use client';

import React, { useEffect, useRef, useState } from 'react';

interface YouTubeEmbedPlayerProps {
  videoId?: string;
  ytId?: string;
  title?: string;
  isShort?: boolean;
}

export default function YouTubeEmbedPlayer({
  videoId,
  ytId,
  title,
  isShort = false,
}: YouTubeEmbedPlayerProps) {
  const resolvedId = videoId || ytId || '';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [origin, setOrigin] = useState('');
  const [isMobileOrSafari, setIsMobileOrSafari] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      setIsMobileOrSafari(isMobileDevice || isSafariBrowser);
    }
  }, []);

  // On Mobile and Safari, web browsers enforce strict autoplay policies that block unmuted autoplay.
  // Setting mute=1 allows the video to autoplay instantly without requiring an extra tap!
  // On desktop Chrome/Firefox, mute=0 allows autoplay with audio.
  const muteParam = isMobileOrSafari ? '1' : '0';
  const embedUrl = resolvedId 
    ? `https://www.youtube.com/embed/${resolvedId}?autoplay=1&mute=${muteParam}&playsinline=1&enablejsapi=1&rel=0&modestbranding=1&controls=1${origin ? `&origin=${encodeURIComponent(origin)}` : ''}`
    : '';

  return (
    <div className="relative w-full h-full bg-black">
      {resolvedId && (
        <iframe
          ref={iframeRef}
          className="w-full h-full absolute inset-0 border-0 block bg-black"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#000000',
            colorScheme: 'dark',
            border: 0,
            display: 'block',
          }}
          src={embedUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          title={title || "Video player"}
        />
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useRef, useCallback } from 'react';

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

  // Send listening handshake to YouTube iframe API
  const sendListening = useCallback(() => {
    try {
      const cw = iframeRef.current?.contentWindow;
      if (!cw) return;
      cw.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
    } catch {}
  }, []);

  // Send command to YouTube iframe API
  const sendCommand = useCallback((func: string, args: any[] = []) => {
    try {
      const cw = iframeRef.current?.contentWindow;
      if (!cw) return;
      cw.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    } catch {}
  }, []);

  // Trigger play and unmute
  const triggerPlayAndUnmute = useCallback(() => {
    sendCommand('unMute');
    sendCommand('setVolume', [100]);
    sendCommand('playVideo');
  }, [sendCommand]);

  useEffect(() => {
    let isMounted = true;

    const handleMessage = (e: MessageEvent) => {
      // Validate origin to ensure it's from YouTube
      if (
        typeof e.origin === 'string' &&
        !e.origin.includes('youtube.com') &&
        !e.origin.includes('youtube-nocookie.com')
      ) {
        return;
      }

      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (!data) return;

        // When YouTube signals readiness or initial delivery, play unmuted
        if (data.event === 'initialDelivery' || data.event === 'onReady') {
          triggerPlayAndUnmute();
        }

        // When YouTube delivers player state updates
        if (data.event === 'infoDelivery' && data.info) {
          if (data.info.muted === true) {
            sendCommand('unMute');
            sendCommand('setVolume', [100]);
          }
          // If paused, resume playback
          if (data.info.playerState === 2) {
            sendCommand('playVideo');
          }
        }
      } catch {
        // Ignore non-JSON or external postMessages safely
      }
    };

    window.addEventListener('message', handleMessage);

    // Initial handshake and play triggers on staggered intervals
    const intervals = [100, 300, 600, 1000, 1500];
    const timers = intervals.map((delay) =>
      setTimeout(() => {
        if (!isMounted) return;
        sendListening();
        triggerPlayAndUnmute();
      }, delay)
    );

    return () => {
      isMounted = false;
      window.removeEventListener('message', handleMessage);
      timers.forEach(clearTimeout);
    };
  }, [resolvedId, sendListening, sendCommand, triggerPlayAndUnmute]);

  // Construct embed URL with autoplay=1 (unmuted by default without mute=1)
  const embedUrl = `https://www.youtube.com/embed/${resolvedId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1&controls=1`;

  return (
    <div className="relative w-full h-full bg-black">
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
        onLoad={() => {
          sendListening();
          triggerPlayAndUnmute();
        }}
      />
    </div>
  );
}

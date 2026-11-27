'use client'

import React from 'react'

export function VideoTriggerClient({ index = 0, slug }: { index?: number; slug?: string }) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctx.resume().catch(() => {});
      }
    } catch {}
    const event = new CustomEvent('open-video-lightbox', { detail: { index, slug } });
    window.dispatchEvent(event);
  }

  return (
    <div 
      className="absolute inset-0 z-10 cursor-pointer" 
      onClick={handleClick}
      aria-label="Play video"
      role="button"
    />
  )
}

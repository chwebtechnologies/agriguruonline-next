'use client'

import { useEffect, useState } from 'react'

export function VideoTriggerClient({ index }: { index: number }) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const event = new CustomEvent('open-video-lightbox', { detail: { index } });
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

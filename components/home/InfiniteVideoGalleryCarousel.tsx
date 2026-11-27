'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import VideoGalleryCard from '@/components/video-gallery/VideoGalleryCard';
import { VideoLightboxClient } from '@/components/video-gallery/VideoLightboxClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setLastHomeSection } from '@/lib/watchlist-utils';
import type { MediaVideoItem } from '@/types/videoGallery';
import { getAssetsUrl } from '@/lib/api-utils';

type AnimationState = 'idle' | 'forward' | 'prep-backward' | 'backward';

function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const str = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|vi\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (match) return match[1];
  const generalMatch = str.match(/(?:[?&]v=|\/embed\/|\/shorts\/|\/vi\/|\/v\/|youtu\.be\/)([\w-]{11})/i);
  return generalMatch ? generalMatch[1] : null;
}

export default function InfiniteVideoGalleryCarousel({ 
  videos = [],
  videoCategories, 
  lang,
  imageBaseUrl,
  dict = {} 
}: { 
  videos?: MediaVideoItem[];
  videoCategories?: any[];
  lang: string;
  imageBaseUrl?: string;
  dict?: any;
}) {
  const rawList = (videos && videos.length > 0 ? videos : videoCategories) || [];
  const [items, setItems] = useState(() => {
    return rawList.map((video: any, i: number) => ({
      ...video,
      _uniqueId: `${video.id || video.slug || 'video'}-${i}`
    }));
  });
  const [animState, setAnimState] = useState<AnimationState>('idle');
  const [isHovered, setIsHovered] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [shiftAmount, setShiftAmount] = useState(0);

  const updateShiftAmount = () => {
    const track = trackRef.current;
    if (track && track.firstElementChild) {
      const card = track.firstElementChild as HTMLElement;
      const gap = parseInt(window.getComputedStyle(track).gap) || 20;
      setShiftAmount(card.offsetWidth + gap);
    }
  };

  const moveNext = useCallback(() => {
    if (animState !== 'idle') return;
    updateShiftAmount();
    setAnimState('forward');
    
    setTimeout(() => {
      setAnimState('idle');
      setItems((prev) => {
        const newArray = [...prev];
        const first = newArray.shift();
        if (first) newArray.push(first);
        return newArray;
      });
    }, 500);
  }, [animState]);

  const movePrev = useCallback(() => {
    if (animState !== 'idle') return;
    updateShiftAmount();

    // 1. Instantly move last item to front
    setItems((prev) => {
      const newArray = [...prev];
      const last = newArray.pop();
      if (last) newArray.unshift(last);
      return newArray;
    });
    
    // 2. Prep backward (instant shift left so it visually stays in place)
    setAnimState('prep-backward');

    // 3. Wait a tick, then animate back to 0
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimState('backward');
        setTimeout(() => {
          setAnimState('idle');
        }, 500);
      });
    });
  }, [animState]);

  // Touch gesture handling for mobile swipe
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaX = touchDeltaX.current;
    
    // Only trigger if horizontal swipe is prominent and larger than vertical scrolling
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX < 0) {
        moveNext();
      } else {
        movePrev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    touchDeltaX.current = 0;
  };

  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView || isHovered) return;
    const interval = setInterval(moveNext, 4500);
    return () => clearInterval(interval);
  }, [isInView, isHovered, moveNext]);

  // Determine styles based on state
  let transform = 'translate3d(0, 0, 0)';
  let transition = 'none';

  if (animState === 'forward') {
    transform = `translate3d(-${shiftAmount}px, 0, 0)`;
    transition = 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)';
  } else if (animState === 'prep-backward') {
    transform = `translate3d(-${shiftAmount}px, 0, 0)`;
    transition = 'none';
  } else if (animState === 'backward') {
    transform = 'translate3d(0, 0, 0)';
    transition = 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)';
  }

  const assetsUrl = imageBaseUrl || getAssetsUrl();
  const defaultBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`;

  const slides = rawList.map((video: any) => {
    const title = video.title || video.category_name || '';
    const rawThumb = video.image || video.video_thumbnail || video.thumbnail;
    const rawVideoUrl = video.url || video.video_url || '';
    const ytId = getYoutubeId(rawVideoUrl);
    const imageUrl = rawThumb
      ? (rawThumb.startsWith('http') ? rawThumb : `${defaultBaseUrl}${rawThumb.replace(/^\/+/, '')}`)
      : (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '/logo.webp');

    return {
      type: 'custom-video',
      video,
      slug: video.slug,
      ytId,
      videoId: ytId,
      videoUrl: rawVideoUrl,
      title,
      src: imageUrl
    };
  });

  const router = useRouter();
  const targetHref = `/${lang}/video-gallery`;

  return (
    <div 
      ref={containerRef}
      className="mt-5 relative w-full group touch-pan-y"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="overflow-hidden pb-1"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          ref={trackRef}
          className="flex gap-4 sm:gap-5 w-full"
          style={{ transform, transition, willChange: 'transform' }}
        >
          {items.map((video: any, index: number) => (
            <div 
              key={video._uniqueId} 
              className="shrink-0 w-full sm:w-[calc(50%-10px)] md:w-[calc(50%-10px)] lg:w-[calc(33.333%-13.33px)] xl:w-[calc(25%-15px)] flex flex-col"
            >
              <VideoGalleryCard 
                video={video} 
                index={index} 
                lang={lang} 
                priority={index < 4} 
                imageBaseUrl={imageBaseUrl} 
                dict={dict} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between mt-2">
        <Link 
          href={targetHref}
          prefetch={true}
          onPointerEnter={() => { try { router.prefetch(targetHref); } catch {} }}
          onTouchStart={() => { try { router.prefetch(targetHref); } catch {} }}
          onClick={() => {
            setLastHomeSection('video-gallery-section');
          }}
          className="inline-flex items-center justify-center px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-card border border-border text-foreground hover:bg-primary hover:border-primary hover:text-white transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:scale-95"
        >
          {dict?.common?.view_video_gallery || 'View Video Gallery'} <i className="fa-solid fa-arrow-right ml-2 text-[10px] sm:text-xs"></i>
        </Link>
        
        {/* Next/Prev Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={movePrev}
            aria-label={dict?.home?.previous_video_category || 'Previous Video'}
            className="w-10 h-10 rounded-full bg-card border border-border text-foreground flex items-center justify-center hover:bg-primary hover:border-primary hover:text-white transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <i className="fa-solid fa-chevron-left text-sm"></i>
          </button>
          <button 
            onClick={moveNext}
            aria-label={dict?.home?.next_video_category || 'Next Video'}
            className="w-10 h-10 rounded-full bg-card border border-border text-foreground flex items-center justify-center hover:bg-primary hover:border-primary hover:text-white transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <i className="fa-solid fa-chevron-right text-sm"></i>
          </button>
        </div>
      </div>

      <VideoLightboxClient slides={slides} />
    </div>
  );
}

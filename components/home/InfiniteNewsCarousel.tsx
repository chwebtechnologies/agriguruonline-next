'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import NewsCard from '@/components/news/NewsCard';
import Link from 'next/link';

type AnimationState = 'idle' | 'forward' | 'prep-backward' | 'backward';

export default function InfiniteNewsCarousel({ articles, lang }: { articles: any[], lang: string }) {
  const [items, setItems] = useState(() => {
    // Generate stable unique IDs for the duplicated items to prevent React from re-rendering/blinking
    return [...articles, ...articles].map((a, i) => ({
      ...a,
      _uniqueId: `${a.id}-${i}`
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

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(moveNext, 3500);
    return () => clearInterval(interval);
  }, [isHovered, moveNext]);

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

  return (
    <div 
      className="mt-5 relative w-full group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="overflow-hidden pb-1">
        <div 
          ref={trackRef}
          className="flex gap-4 sm:gap-5 w-full"
          style={{ transform, transition, willChange: 'transform' }}
        >
          {items.map((article: any, index: number) => (
            <div 
              key={article._uniqueId} 
              className="shrink-0 w-full sm:w-[calc(50%-10px)] md:w-[calc(33.333%-13.33px)] lg:w-[calc(25%-15px)]"
            >
              <NewsCard article={article} lang={lang} priority={index < 4} />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between mt-2">
        {/* SEO friendly View All link formatted as a normal button */}
        <Link 
          href={`/${lang}/news`} 
          className="inline-flex items-center justify-center px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-card border border-border text-foreground hover:bg-primary hover:border-primary hover:text-white transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
        >
          View All News <i className="fa-solid fa-arrow-right ml-2 text-[10px] sm:text-xs"></i>
        </Link>
        
        {/* Next/Prev Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={movePrev}
            aria-label="Previous News"
            className="w-10 h-10 rounded-full bg-card border border-border text-foreground flex items-center justify-center hover:bg-primary hover:border-primary hover:text-white transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <i className="fa-solid fa-chevron-left text-sm"></i>
          </button>
          <button 
            onClick={moveNext}
            aria-label="Next News"
            className="w-10 h-10 rounded-full bg-card border border-border text-foreground flex items-center justify-center hover:bg-primary hover:border-primary hover:text-white transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <i className="fa-solid fa-chevron-right text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

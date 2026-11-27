'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { 
  scrollToHomeSection, 
  WATCHLIST_SCROLL_KEY, 
  WATCHLIST_SCROLL_EVENT,
  getAndClearLastHomeSection
} from '@/lib/watchlist-utils';

export default function HomeSectionScrollHandler() {
  const pathname = usePathname();

  useEffect(() => {
    const checkAndScroll = () => {
      if (typeof window === 'undefined') return;

      let targetSection: string | null = null;

      // 1. Check if watchlist scroll was explicitly requested
      try {
        if (sessionStorage.getItem(WATCHLIST_SCROLL_KEY) === 'true') {
          targetSection = 'market-watchlist';
          sessionStorage.removeItem(WATCHLIST_SCROLL_KEY);
        }
      } catch {}

      // 2. Check if a home section was saved before navigating away
      if (!targetSection) {
        const savedSection = getAndClearLastHomeSection();
        if (savedSection) {
          targetSection = savedSection;
        }
      }

      // 3. Check window.location.hash (e.g. #news-section)
      if (window.location.hash) {
        const hash = window.location.hash.replace(/^#/, '');
        if (hash) {
          targetSection = hash;
        }
      }

      if (targetSection) {
        // Small delay to allow the page DOM and header to settle
        setTimeout(() => {
          scrollToHomeSection(targetSection!, { smooth: true });
        }, 100);
      }
    };

    checkAndScroll();

    window.addEventListener(WATCHLIST_SCROLL_EVENT, checkAndScroll);
    window.addEventListener('hashchange', checkAndScroll);

    return () => {
      window.removeEventListener(WATCHLIST_SCROLL_EVENT, checkAndScroll);
      window.removeEventListener('hashchange', checkAndScroll);
    };
  }, [pathname]);

  return null;
}

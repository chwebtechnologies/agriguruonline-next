'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { 
  scrollToMarketWatchlist, 
  WATCHLIST_SCROLL_KEY, 
  WATCHLIST_SCROLL_EVENT 
} from '@/lib/watchlist-utils';

export default function WatchlistScrollHandler() {
  const pathname = usePathname();

  useEffect(() => {
    const checkAndScroll = () => {
      if (typeof window === 'undefined') return;

      let shouldScroll = false;

      try {
        if (sessionStorage.getItem(WATCHLIST_SCROLL_KEY) === 'true') {
          shouldScroll = true;
          sessionStorage.removeItem(WATCHLIST_SCROLL_KEY);
        }
      } catch {
        // Safe fallback if sessionStorage is restricted
      }

      if (window.location.hash === '#market-watchlist') {
        shouldScroll = true;
      }

      if (shouldScroll) {
        // Small delay to allow the page DOM and header to settle
        setTimeout(() => {
          scrollToMarketWatchlist({ smooth: true });
        }, 120);
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

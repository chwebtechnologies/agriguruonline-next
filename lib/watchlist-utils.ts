/**
 * Watchlist and Homepage Section navigation and scrolling utilities
 */

export const WATCHLIST_SCROLL_KEY = 'agriguru:scroll_to_watchlist';
export const WATCHLIST_REFRESH_EVENT = 'agriguru:refresh-watchlist';
export const WATCHLIST_SCROLL_EVENT = 'agriguru:scroll-watchlist';
export const OPEN_HEADER_SEARCH_EVENT = 'agriguru:open-header-search';
export const LAST_HOME_SECTION_KEY = 'agriguru:last_home_section';

/**
 * Saves the section user is navigating from so back navigation restores position.
 */
export function setLastHomeSection(sectionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LAST_HOME_SECTION_KEY, sectionId);
  } catch {}
}

/**
 * Gets and clears the saved section key.
 */
export function getAndClearLastHomeSection(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = sessionStorage.getItem(LAST_HOME_SECTION_KEY);
    if (val) {
      sessionStorage.removeItem(LAST_HOME_SECTION_KEY);
      return val;
    }
  } catch {}
  return null;
}

/**
 * Programmatically scrolls to any homepage section with dynamic sticky header compensation.
 */
export function scrollToHomeSection(sectionId: string, options?: { smooth?: boolean; offset?: number }): void {
  if (typeof window === 'undefined' || !sectionId) return;

  const smooth = options?.smooth !== false;
  const customOffset = options?.offset ?? 16;
  const cleanId = sectionId.replace(/^#/, '');

  const getHeaderHeight = (): number => {
    const header = document.getElementById('site-header');
    return header ? header.offsetHeight : 70;
  };

  const executeScroll = (): boolean => {
    const el = document.getElementById(cleanId);
    if (!el) return false;

    const headerHeight = getHeaderHeight();
    const rect = el.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const targetY = Math.max(0, rect.top + scrollTop - headerHeight - customOffset);

    window.scrollTo({
      top: targetY,
      behavior: smooth ? 'smooth' : 'auto',
    });
    return true;
  };

  // Try immediate scroll
  const immediateSuccess = executeScroll();

  // If element not yet present or still mounting (e.g. streaming Suspense), retry with intervals
  if (!immediateSuccess) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (executeScroll() || attempts >= 35) {
        clearInterval(interval);
      }
    }, 80);
  } else {
    // Re-verify position after layout stabilizes (e.g. carousels, fonts, images loaded)
    setTimeout(() => {
      const el = document.getElementById(cleanId);
      if (el) {
        const headerHeight = getHeaderHeight();
        const rect = el.getBoundingClientRect();
        // If drift is significant (> 35px)
        if (Math.abs(rect.top - headerHeight - customOffset) > 35) {
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          window.scrollTo({
            top: Math.max(0, rect.top + scrollTop - headerHeight - customOffset),
            behavior: 'smooth',
          });
        }
      }
    }, 400);
  }
}

/**
 * Triggers the header search modal/view across desktop and mobile.
 */
export function openHeaderSearch(initialQuery?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(OPEN_HEADER_SEARCH_EVENT, {
      detail: { query: initialQuery || '' }
    })
  );
}

/**
 * Checks if the current pathname is the homepage for the given language.
 */
export function isHomePagePath(pathname: string | null | undefined, lang: string = 'en'): boolean {
  if (!pathname) return false;
  const cleanPath = pathname.trim().replace(/\/$/, '') || '/';
  const cleanLang = lang.trim().toLowerCase();

  return (
    cleanPath === '/' ||
    cleanPath === `/${cleanLang}`
  );
}

/**
 * Programmatically scrolls to the Market Watchlist section with dynamic sticky header compensation.
 */
export function scrollToMarketWatchlist(options?: { smooth?: boolean; offset?: number }): void {
  scrollToHomeSection('market-watchlist', options);
}

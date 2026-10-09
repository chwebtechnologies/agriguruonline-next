'use client';

import { useEffect, useId } from 'react';

const activeLockIds = new Set<string>();
let originalBodyOverflow = '';
let originalBodyPaddingRight = '';
let originalHtmlOverflow = '';

function applyLock() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (activeLockIds.size === 1) {
    originalBodyOverflow = document.body.style.overflow;
    originalBodyPaddingRight = document.body.style.paddingRight;
    originalHtmlOverflow = document.documentElement.style.overflow;

    // Compensate scrollbar width to prevent horizontal layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Strictly lock BOTH root html and body to eliminate background page scrolling
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
}

function releaseLock() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (activeLockIds.size === 0) {
    document.documentElement.style.overflow = originalHtmlOverflow || '';
    document.body.style.overflow = originalBodyOverflow || '';
    document.body.style.paddingRight = originalBodyPaddingRight || '';
  }
}

export function lockScroll(id: string = 'default') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  activeLockIds.add(id);
  applyLock();
}

export function unlockScroll(id: string = 'default') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  activeLockIds.delete(id);
  releaseLock();
}

export function forceUnlockScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  activeLockIds.clear();
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}

export function useScrollLock(isOpen: boolean) {
  const id = useId();

  useEffect(() => {
    if (!isOpen) {
      unlockScroll(id);
      return;
    }

    lockScroll(id);

    return () => {
      unlockScroll(id);
    };
  }, [isOpen, id]);
}

// Global safeguard: Ensure scrolling is completely restored on browser navigation
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', forceUnlockScroll);
}


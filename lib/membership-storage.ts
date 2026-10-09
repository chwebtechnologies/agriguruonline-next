import type { StoredPlanSelection } from './api/user.service';

export const STORAGE_KEY_PLAN_ID = 'selected-plan';
export const STORAGE_KEY_PLAN_NAME = 'selected-plan-name';
export const STORAGE_KEY_PLAN_DURATION = 'selected-plan-duration';

/**
 * Saves guest or user's selected membership plan to both localStorage and document.cookie
 * so it survives login/register redirects and SSR cookie checks.
 */
export function saveStoredPlanSelection(selection: StoredPlanSelection): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY_PLAN_ID, selection.planId);
    localStorage.setItem(STORAGE_KEY_PLAN_NAME, selection.planName);
    localStorage.setItem(STORAGE_KEY_PLAN_DURATION, selection.duration);

    const maxAge = 7 * 24 * 60 * 60; // 7 days
    const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${STORAGE_KEY_PLAN_ID}=${encodeURIComponent(selection.planId)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure}`;
    document.cookie = `${STORAGE_KEY_PLAN_NAME}=${encodeURIComponent(selection.planName)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure}`;
    document.cookie = `${STORAGE_KEY_PLAN_DURATION}=${encodeURIComponent(selection.duration)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure}`;
  } catch (err) {
    console.warn('[saveStoredPlanSelection] Error writing to storage:', err);
  }
}

/**
 * Retrieves the stored plan selection from localStorage (or fallback cookies).
 */
export function getStoredPlanSelection(): StoredPlanSelection | null {
  if (typeof window === 'undefined') return null;

  try {
    let planId = localStorage.getItem(STORAGE_KEY_PLAN_ID);
    let planName = localStorage.getItem(STORAGE_KEY_PLAN_NAME) || '';
    let duration = localStorage.getItem(STORAGE_KEY_PLAN_DURATION) as 'MONTHLY' | 'YEARLY' | null;

    // Fallback: parse cookies if localStorage was empty or cleared
    if (!planId && typeof document !== 'undefined') {
      const cookies = document.cookie ? document.cookie.split(';') : [];
      for (const cookie of cookies) {
        const [rawKey, rawVal] = cookie.trim().split('=');
        if (rawKey === STORAGE_KEY_PLAN_ID && rawVal) {
          planId = decodeURIComponent(rawVal);
        } else if (rawKey === STORAGE_KEY_PLAN_NAME && rawVal) {
          planName = decodeURIComponent(rawVal);
        } else if (rawKey === STORAGE_KEY_PLAN_DURATION && rawVal) {
          duration = decodeURIComponent(rawVal) as 'MONTHLY' | 'YEARLY';
        }
      }
    }

    if (!planId) return null;

    const safeDuration: 'MONTHLY' | 'YEARLY' = duration === 'YEARLY' ? 'YEARLY' : 'MONTHLY';

    return {
      planId,
      planName: planName || 'Plan',
      duration: safeDuration,
    };
  } catch {
    return null;
  }
}

/**
 * Clears stored plan selection from both localStorage and document.cookie.
 */
export function clearStoredPlanSelection(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY_PLAN_ID);
    localStorage.removeItem(STORAGE_KEY_PLAN_NAME);
    localStorage.removeItem(STORAGE_KEY_PLAN_DURATION);

    document.cookie = `${STORAGE_KEY_PLAN_ID}=; path=/; max-age=0; SameSite=Lax`;
    document.cookie = `${STORAGE_KEY_PLAN_NAME}=; path=/; max-age=0; SameSite=Lax`;
    document.cookie = `${STORAGE_KEY_PLAN_DURATION}=; path=/; max-age=0; SameSite=Lax`;
  } catch (err) {
    console.warn('[clearStoredPlanSelection] Error clearing storage:', err);
  }
}

/**
 * Client-side authentication utilities
 */

export const isUserLoggedIn = (): boolean => {
  if (typeof document === 'undefined') return false;
  try {
    // 1. Check cookies for active authenticated session
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const trimmed = c.trim();
      if (!trimmed) continue;
      const [rawKey, ...valParts] = trimmed.split('=');
      const key = rawKey.trim();
      const val = valParts.join('=').trim();
      if (
        (key === 'user_info' || key === 'auth_token' || key === '__Secure-uid') &&
        val &&
        val !== '""' &&
        val !== "''" &&
        val !== 'null' &&
        val !== 'undefined' &&
        val !== '{}'
      ) {
        return true;
      }
    }

    // 2. Check in-memory / DOM indicators
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('ag_just_logged_in') === '1') {
        return true;
      }
      if (document.querySelector('[data-auth="true"]')) {
        return true;
      }
    }
  } catch (e) {
    // Graceful fallback
  }
  return false;
};

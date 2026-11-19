/**
 * Universal, client-and-server-safe JWT utilities.
 * Free of any Next.js server-only imports (e.g., next/headers, next/cookies).
 */

export function parseJwtPayload(token: string | undefined | null): any | null {
  if (!token || typeof token !== 'string') return null;
  const clean = token.trim().replace(/^Bearer\s+/i, '');
  const parts = clean.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = payloadBase64.length % 4;
    const padded = pad ? payloadBase64 + '='.repeat(4 - pad) : payloadBase64;
    const decoded =
      typeof atob === 'function'
        ? atob(padded)
        : typeof Buffer !== 'undefined'
        ? Buffer.from(padded, 'base64').toString('utf8')
        : null;
    if (!decoded) return null;
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string | undefined | null, bufferSeconds = 5): boolean {
  if (!token || typeof token !== 'string') return true;
  const clean = token.trim().replace(/^Bearer\s+/i, '');
  if (!clean || clean === 'deleted' || clean === 'null' || clean === 'undefined') return true;

  const parts = clean.split('.');
  if (parts.length !== 3) {
    // Non-JWT token string that is treated as valid custom token
    return false;
  }

  const payload = parseJwtPayload(clean);
  if (!payload || typeof payload !== 'object') {
    // Corrupted or invalid 3-part JWT
    return true;
  }

  if (!payload.exp) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec >= payload.exp - bufferSeconds;
}

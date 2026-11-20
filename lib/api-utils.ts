export function getSafeLang(lang: string, fallback: string = "en"): string {
  return /^[a-z]{2}$/.test(lang) ? lang : fallback;
}

export function getUserApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_USER_API_URL || process.env.USER_API_URL || "https://user-api.agriguruonline.cloud";
  return url.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

export function getTradingApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_TRADING_API_URL || process.env.TRADING_API_URL || "https://trading-api.agriguruonline.cloud";
  return url.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

export function getCmsApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_CMS_API_URL || process.env.CMS_API_URL || "https://cms-api.agriguruonline.cloud";
  return url.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

export function getSmartDocsApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_SMART_DOCS_API_URL || process.env.SMART_DOCS_API_URL || "https://smart-docs-api.agriguruonline.cloud";
  return url.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

/**
 * Sanitizes raw backend / Express router errors (e.g. "Cannot POST /api/...", "Cannot GET /api/...")
 * so internal routing errors or missing endpoints are never leaked to users.
 */
export function sanitizeErrorMessage(rawMsg?: any, fallback: string = "Service temporarily unavailable. Please try again."): string {
  if (!rawMsg || typeof rawMsg !== "string") return fallback;
  const s = rawMsg.trim();
  if (/^Cannot (POST|PATCH|GET|PUT|DELETE)\b/i.test(s) || /<(!DOCTYPE|html)/i.test(s) || /^\/api\//i.test(s)) {
    return fallback;
  }
  return s;
}

export function getAssetsUrl(): string {
  let url = process.env.ASSETS_URL || process.env.NEXT_PUBLIC_ASSETS_URL || "https://assets.agriguruonline.com";
  // The assets CDN domain is always assets.agriguruonline.com
  url = url.replace('assets.agriguruonline.cloud', 'assets.agriguruonline.com');
  return url.replace(/\/$/, "");
}



export const getNormalizedUserType = (typeData: any): string => {
  if (!typeData) return '';
  if (typeof typeData === 'string') return typeData.toLowerCase();
  if (typeof typeData === 'object') return String(typeData.name || typeData.title || typeData.type || '').toLowerCase();
  return String(typeData).toLowerCase();
};

/**
 * Universal timeout wrapper to prevent slow external API responses from blocking SSR streaming.
 * Ensures a healthy minimum timeout (at least 8000ms) so slow network connections never cause empty listings.
 */
export const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  const effectiveMs = Math.max(ms, 8000);
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), effectiveMs);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeoutPromise
  ]);
};


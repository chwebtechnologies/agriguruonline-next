const ASSETS_BASE = 'https://assets.agriguruonline.com';
export const FALLBACK_IMAGE = '/logo.webp';

export function resolveImageUrl(src: unknown): string {
  if (!src || typeof src !== 'string') return FALLBACK_IMAGE;
  let url = src.trim().replace(/\\/g, '/');
  if (!url || url === 'undefined' || url === 'null' || url === '[object Object]') return FALLBACK_IMAGE;
  if (url.startsWith('/logo.') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }
  url = url.replace(/assets\.agriguruonline\.cloud/g, 'assets.agriguruonline.com');
  if (!url.startsWith('http') && !url.startsWith('/')) {
    url = `${ASSETS_BASE}/${url.startsWith('/') ? url.slice(1) : url}`;
  }
  return url;
}

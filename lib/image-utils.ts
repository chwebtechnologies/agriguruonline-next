const ASSETS_BASE = 'https://assets.agriguruonline.com';
export const FALLBACK_IMAGE = '/logo.webp';

export function resolveImageUrl(src: unknown): string {
  if (!src || typeof src !== 'string') return FALLBACK_IMAGE;
  let url = src.trim();
  if (!url || url === 'undefined' || url === 'null') return FALLBACK_IMAGE;
  if (url.startsWith('/logo.') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  url = url.replace('assets.agriguruonline.cloud', 'assets.agriguruonline.com');
  if (!url.startsWith('http') && !url.startsWith('/')) {
    url = `${ASSETS_BASE}/${url}`;
  }
  return url;
}

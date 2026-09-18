export function getSafeLang(lang: string, fallback: string = "en"): string {
  return /^[a-z]{2}$/.test(lang) ? lang : fallback;
}

export function getUserApiUrl(): string {
  if (typeof window !== 'undefined') {
    return '/api/proxy-user';
  }
  const url = process.env.USER_API_URL || process.env.NEXT_PUBLIC_USER_API_URL || "https://user-api.agriguruonline.com";
  return url.replace(/\/$/, "");
}

export function getTradingApiUrl(): string {
  if (typeof window !== 'undefined') {
    return '/api/proxy-trading';
  }
  const url = process.env.TRADING_API_URL || process.env.NEXT_PUBLIC_TRADING_API_URL || "https://trading-api.agriguruonline.com";
  return url.replace(/\/$/, "");
}

export function getCmsApiUrl(): string {
  if (typeof window !== 'undefined') {
    return '/api/proxy-cms';
  }
  const url = process.env.CMS_API_URL || process.env.NEXT_PUBLIC_CMS_API_URL || "https://cms-api.agriguruonline.com";
  return url.replace(/\/$/, "");
}

export function getAssetsUrl(): string {
  let url = process.env.ASSETS_URL || process.env.NEXT_PUBLIC_ASSETS_URL || "https://assets.agriguruonline.com";
  // The assets CDN domain is always assets.agriguruonline.com
  url = url.replace('assets.agriguruonline.cloud', 'assets.agriguruonline.com');
  return url.replace(/\/$/, "");
}



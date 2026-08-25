export function getSafeLang(lang: string, fallback: string = "en"): string {
  return /^[a-z]{2}$/.test(lang) ? lang : fallback;
}

export function getUserApiUrl(): string {
  const url = process.env.USER_API_URL || process.env.NEXT_PUBLIC_USER_API_URL || "https://user-api.agriguruonline.cloud";
  return url.replace(/\/$/, "");
}

export function getTradingApiUrl(): string {
  const url = process.env.TRADING_API_URL || process.env.NEXT_PUBLIC_TRADING_API_URL || "https://trading-api.agriguruonline.cloud";
  return url.replace(/\/$/, "");
}

export function getCmsApiUrl(): string {
  const url = process.env.CMS_API_URL || process.env.NEXT_PUBLIC_CMS_API_URL || "https://cms-api.agriguruonline.cloud";
  return url.replace(/\/$/, "");
}

export function getAssetsUrl(): string {
  const url = process.env.ASSETS_URL || process.env.NEXT_PUBLIC_ASSETS_URL || "https://assets.agriguruonline.com";
  return url.replace(/\/$/, "");
}

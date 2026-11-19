/**
 * Determines whether a cookie should be set with the Secure attribute.
 * In production over HTTPS, this must be true.
 * In development or when accessed via HTTP (e.g. localhost, 127.0.0.1, or private LAN IPs like 192.168.x.x),
 * browsers WILL REJECT any cookie marked 'Secure' on non-localhost HTTP origins, causing silent login failure.
 */
export async function getIsSecureCookie(): Promise<boolean> {
  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    const proto = headerList.get("x-forwarded-proto");
    if (proto === "https") return true;
    if (proto === "http") return false;

    const referer = headerList.get("referer");
    if (referer?.startsWith("https://")) return true;
    if (referer?.startsWith("http://")) return false;

    const host = headerList.get("host") || "";
    if (
      host.includes("localhost") ||
      host.includes("127.0.0.1") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.")
    ) {
      return false;
    }
  } catch {
    // headers() might not be available outside request context
  }

  return process.env.NODE_ENV === "production";
}

/**
 * Robust helper to extract refresh token from backend response headers (Set-Cookie) and JSON body.
 * Works seamlessly across Node.js Undici, Fetch standards, and varying backend cookie names.
 */
export function extractRefreshTokenFromResponse(response: Response, data?: any): string | null {
  // 1. Try to get from JSON body first
  const bodyToken = 
    data?.data?.refresh_token ||
    data?.data?.refreshToken ||
    data?.data?.web_refresh_token ||
    data?.refresh_token ||
    data?.refreshToken ||
    data?.web_refresh_token;

  if (bodyToken && typeof bodyToken === 'string' && bodyToken.trim().length > 10) {
    return bodyToken.trim();
  }

  // 2. Collect ALL cookie strings from headers using both getSetCookie() and get('set-cookie')
  const cookieStrings: string[] = [];
  
  if (typeof (response.headers as any).getSetCookie === 'function') {
    try {
      const arr = (response.headers as any).getSetCookie();
      if (Array.isArray(arr)) {
        cookieStrings.push(...arr);
      }
    } catch (e) {}
  }

  const rawHeader = response.headers.get('set-cookie');
  if (rawHeader) {
    cookieStrings.push(rawHeader);
  }

  // 3. Scan all cookie strings for web_refresh_token, refresh_token, or refreshToken
  for (const str of cookieStrings) {
    const match = str.match(/(?:web_refresh_token|refresh_token|refreshToken)=([^;,\s]+)/i);
    if (match && match[1] && match[1] !== 'deleted' && match[1] !== 'null' && match[1].length > 5) {
      return match[1].trim();
    }
  }

  return null;
}

export { parseJwtPayload, isJwtExpired } from './jwt-utils';



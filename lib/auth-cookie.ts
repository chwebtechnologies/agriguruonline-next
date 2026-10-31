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


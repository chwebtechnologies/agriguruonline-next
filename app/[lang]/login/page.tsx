import AuthFlow from "@/components/auth/AuthFlow";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { getStandardMetadata, getSafeLanguage } from "@/lib/seo";
import { getValidAuthToken } from "@/lib/auth-token";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: "login",
    pathname: "login",
    lang,
    noIndex: true,
  });
}

interface LoginPageProps {
  params: Promise<{
    lang: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Validates and sanitizes the redirectUrl to ensure it is a safe internal relative path
 * and strictly prevents redirecting back to login or register (preventing infinite loops).
 */
function sanitizeRedirectUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  // Must be an internal path starting with a single '/'
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return undefined;
  // Strictly prevent infinite self-redirect loops
  if (trimmed.includes("/login") || trimmed.includes("/register")) return undefined;
  return trimmed;
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const [{ lang }, resolvedSearchParams, cookieStore, validToken] = await Promise.all([
    params,
    searchParams,
    cookies(),
    getValidAuthToken(),
  ]);

  const rawRedirectUrl = resolvedSearchParams?.redirectUrl as string | undefined;
  const safeRedirectUrl = sanitizeRedirectUrl(rawRedirectUrl);

  // If the user already has a GUARANTEED VALID (non-expired) session, redirect them away
  if (validToken) {
    const hasStoredPlan = cookieStore.get("selected-plan")?.value;
    if (hasStoredPlan) {
      redirect(`/${lang}/become-member`);
    } else if (safeRedirectUrl) {
      redirect(safeRedirectUrl);
    } else {
      redirect(`/${lang}/dashboard`);
    }
  }

  const dict = await getDictionary(lang);

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <AuthFlow
            lang={lang}
            redirectUrl={safeRedirectUrl}
            dict={dict.auth}
            commonDict={dict.common}
          />
        </div>
      </div>
    </div>
  );
}

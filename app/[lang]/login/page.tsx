import AuthFlow from "@/components/auth/AuthFlow";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'login',
    pathname: 'login',
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

// Since params in Next 15 must be treated as async in some contexts, we use standard page props
export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  // We await params if it's a promise, Next 15 requires awaiting it.
  const lang = (await params).lang;
  
  // Await searchParams and get redirectUrl
  const resolvedSearchParams = await searchParams;
  const redirectUrl = resolvedSearchParams?.redirectUrl as string | undefined;

  // Check if the user is already logged in
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (token) {
    // If they have a token, redirect them to the intended page or profile page
    if (redirectUrl) {
      redirect(redirectUrl);
    } else {
      redirect(`/${lang}/profile`);
    }
  }

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <AuthFlow lang={lang} redirectUrl={redirectUrl} />
        </div>
      </div>
    </div>
  );
}

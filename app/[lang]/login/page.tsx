import AuthFlow from "@/components/auth/AuthFlow";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDictionary } from '@/app/[lang]/dictionaries';

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
import { Suspense } from 'react'

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const lang = (await params).lang;
  
  const resolvedSearchParams = await searchParams;
  const redirectUrl = resolvedSearchParams?.redirectUrl as string | undefined;

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <Suspense fallback={<LoginPageSkeleton />}>
            <LoginPageContent lang={lang} redirectUrl={redirectUrl} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function LoginPageSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto h-[500px] bg-card border border-border rounded-2xl animate-pulse mt-8"></div>
  )
}

async function LoginPageContent({ lang, redirectUrl }: { lang: string, redirectUrl?: string }) {
  const dict = await getDictionary(lang);

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

  return <AuthFlow lang={lang} redirectUrl={redirectUrl} dict={dict.auth} commonDict={dict.common} />
}

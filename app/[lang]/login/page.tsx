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

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const [{ lang }, resolvedSearchParams, cookieStore] = await Promise.all([
    params,
    searchParams,
    cookies()
  ]);
  const redirectUrl = resolvedSearchParams?.redirectUrl as string | undefined;
  const token = cookieStore.get("auth_token")?.value;

  if (token) {
    if (redirectUrl) {
      redirect(redirectUrl);
    } else {
      redirect(`/${lang}/profile`);
    }
  }

  const dict = await getDictionary(lang);

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <AuthFlow lang={lang} redirectUrl={redirectUrl} dict={dict.auth} commonDict={dict.common} />
        </div>
      </div>
    </div>
  );
}

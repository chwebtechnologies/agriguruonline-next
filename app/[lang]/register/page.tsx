import AuthFlow from "@/components/auth/AuthFlow";
import { Metadata } from "next";

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

import { getStandardMetadata, getSafeLanguage } from "@/lib/seo";

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'register',
    pathname: 'register',
    lang,
    noIndex: true,
  });
}

import { getDictionary } from '@/app/[lang]/dictionaries'

interface RegisterPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export default async function RegisterPage(props: RegisterPageProps) {
  const params = await props.params;
  const lang = params.lang || 'en'
  const dict = await getDictionary(lang);

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <AuthFlow lang={lang} dict={dict.auth} commonDict={dict.common} />
        </div>
      </div>
    </div>
  );
}

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

import { Suspense } from 'react'
import { getDictionary } from '@/app/[lang]/dictionaries'

interface RegisterPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export default async function RegisterPage(props: RegisterPageProps) {
  const params = await props.params;
  const lang = params.lang || 'en'

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <Suspense fallback={<RegisterPageSkeleton />}>
            <RegisterPageContent lang={lang} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function RegisterPageSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto h-[500px] bg-card border border-border rounded-2xl animate-pulse mt-8"></div>
  )
}

async function RegisterPageContent({ lang }: { lang: string }) {
  const dict = await getDictionary(lang);
  return <AuthFlow lang={lang} dict={dict.auth} commonDict={dict.common} />
}

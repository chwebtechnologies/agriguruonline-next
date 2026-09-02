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

interface RegisterPageProps {
  params: {
    lang: string;
  };
}

export default async function RegisterPage({ params }: RegisterPageProps) {
  // We await params if it's a promise, Next 15 requires awaiting it.
  const lang = (await params).lang;

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <AuthFlow lang={lang} />
        </div>
      </div>
    </div>
  );
}

import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { ForceLogout } from '@/components/auth/ForceLogout';
import { AIPredictClient } from '@/app/[lang]/ai-predict/AIPredictClient';

import { getUserAiPredicts } from '@/lib/user-data';

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'ai_predicts',
    pathname: 'ai-predict',
    lang,
    noIndex: true,
  });
}

export default async function AIPredictPage(props: { params: Promise<{ lang: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  const params = await props.params;
  const lang = params.lang || 'en';

  if (!token) {
    redirect(`/${lang}/login`);
  }

  const predictsList = await getUserAiPredicts(token, lang);

  return (
    <div className="bg-background text-foreground transition-theme pb-5">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="AI Predict" backText="Back" />

          <AIPredictClient initialPredicts={predictsList} lang={lang} />

        </div>
      </div>
    </div>
  );
}

import React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSafeLanguage, getSiteUrl } from '@/lib/seo';
import { PageHeader } from '@/components/ui/PageHeader';
import { getDictionary } from '@/app/[lang]/dictionaries';
import DocumentDraftWorkspace from '@/components/smart-docs/draft/DocumentDraftWorkspace';
import { smartDocsService, extractStepperList } from '@/lib/api/smart-docs.service';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const activeLang = getSafeLanguage(params?.lang);
  const siteUrl = getSiteUrl();

  return {
    title: 'Draft Confirmation | Smart Docs | AgriGuru Online',
    description: 'Create and configure smart agricultural trade confirmation drafts.',
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: `${siteUrl}/${activeLang}/smart-docs/draft`,
    },
  };
}

export default async function SmartDocsDraftPage(props: {
  params: Promise<{ lang: string }>;
}) {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/smart-docs/draft`);
  }

  // Fetch dictionary & stepper list in parallel
  const [rawDict, stepperRes] = await Promise.all([
    getDictionary(lang).catch(() => ({})),
    smartDocsService
      .getStepperList(
        {
          action: 'confirmation',
          step: 'new-confirmation',
          lang,
          source: 'web',
        },
        token
      )
      .catch((err) => {
        console.error('[SmartDocsDraftPage] Stepper fetch error:', err);
        return null;
      }),
  ]);

  const dict = rawDict as any;
  const initialSteps = extractStepperList(stepperRes);

  const pageTitle =
    dict?.smart_docs?.draft_title ||
    dict?.smart_docs?.add_new_confirmation ||
    dict?.smart_docs?.add_confirmation ||
    'Draft Confirmation';

  return (
    <div className="bg-background text-foreground transition-theme flex-1 flex flex-col min-h-0 lg:h-full overflow-y-auto lg:overflow-hidden">
      <div className="w-full pad-for-badges flex-1 flex flex-col min-h-0 lg:h-full">
        <div className="max-w-7xl w-full mx-auto pt-0 sm:pt-0.5 pb-0.5 sm:pb-1 px-3 sm:px-4 lg:px-0 flex-1 flex flex-col min-h-0 lg:h-full">
          {/* Header Bar */}
          <div className="shrink-0">
            <PageHeader
              title={pageTitle}
              backText={dict?.common?.back || 'Back'}
              backHref={`/${lang}/smart-docs`}
              className="!py-0.5 sm:!py-1 !mb-0.5 sm:!mb-1"
            />
          </div>

          {/* SaaS Single Page Workspace (Fluid on mobile, locked on desktop) */}
          <div className="mt-0.5 flex-1 min-h-0 flex flex-col lg:overflow-hidden">
            <DocumentDraftWorkspace lang={lang} dict={dict} initialSteps={initialSteps} />
          </div>
        </div>
      </div>
    </div>
  );
}


import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSafeLanguage } from '@/lib/seo';
import { PageHeader } from '@/components/ui/PageHeader';
import ConfirmationsDataTable from '@/components/smart-docs/ConfirmationsDataTable';
import {
  smartDocsService,
  extractSmartDocsArray,
  extractSmartDocsTotal,
  normalizeActionParam,
} from '@/lib/api/smart-docs.service';
import { getDictionary } from '@/app/[lang]/dictionaries';

export const dynamic = 'force-dynamic';

export default async function SmartDocsPage(props: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/smart-docs`);
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 10;
  const action = normalizeActionParam((searchParams?.action as string) || 'All');
  const search = (searchParams?.search as string) || '';
  const searchLabel = (searchParams?.search_label as string) || '';

  // Fetch Smart Docs list & dictionary in parallel:
  const [smartDocsRes, rawDict] = await Promise.all([
    smartDocsService.getSmartDocsList(
      {
        page,
        limit,
        action,
        lang,
        source: 'web',
        search: search || undefined,
        search_label: searchLabel || undefined,
      },
      token
    ),
    getDictionary(lang).catch(() => ({})),
  ]);

  const dict = rawDict as any;
  const pageTitle = dict?.smart_docs?.page_title || 'Confirmations/Quotations';
  const pageDescription =
    dict?.smart_docs?.page_description ||
    'Manage, track, and generate smart agricultural trade contracts and confirmations.';

  const confirmationsData = extractSmartDocsArray(smartDocsRes);
  const totalRecords = extractSmartDocsTotal(smartDocsRes, confirmationsData.length);

  return (
    <div className="bg-background text-foreground transition-theme flex-1 flex flex-col min-h-0 h-full overflow-hidden">
      <div className="w-full pad-for-badges flex-1 flex flex-col min-h-0 h-full overflow-hidden">
        <div className="max-w-7xl w-full mx-auto pt-0.5 sm:pt-1 pb-0.5 sm:pb-1 px-3 sm:px-0 flex-1 flex flex-col min-h-0 h-full overflow-hidden">
          <div className="shrink-0">
            <PageHeader
              title={pageTitle}
              backText={dict?.common?.back || 'Back'}
              backHref={`/${lang}`}
            />
          </div>
          <div className="mt-0.5 sm:mt-1 flex-1 min-h-0 flex flex-col overflow-hidden">
            <ConfirmationsDataTable
              data={confirmationsData}
              totalRecords={totalRecords}
              initialPage={page}
              initialPageSize={limit}
              action={action}
              initialSearch={search}
              initialSearchLabel={searchLabel}
              lang={lang}
              dict={dict}
              title={pageTitle}
              description={pageDescription}
              addHref={`/${lang}/smart-docs/draft`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


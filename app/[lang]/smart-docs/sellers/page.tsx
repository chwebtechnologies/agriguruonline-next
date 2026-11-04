import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSafeLanguage } from '@/lib/seo';
import { PageHeader } from '@/components/ui/PageHeader';
import SellersDataTable from '@/components/smart-docs/SellersDataTable';
import {
  smartDocsService,
  extractSmartDocsArray,
  extractSmartDocsTotal,
} from '@/lib/api/smart-docs.service';
import { tradingService } from '@/lib/api/trading.service';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { getValidAuthToken } from '@/lib/auth-token';

export const dynamic = 'force-dynamic';

export default async function SellersPage(props: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  const token = await getValidAuthToken();

  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/smart-docs/sellers`);
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 10;
  const search = (searchParams?.search as string) || '';

  // Fetch sellers list, dictionary, and countries in parallel with auth
  const [sellersRes, rawDict, rawCountries] = await Promise.all([
    smartDocsService.getSellerListing(
      {
        page,
        limit,
        lang,
        source: 'web',
        search: search || undefined,
      },
      token
    ),
    getDictionary(lang).catch(() => ({})),
    tradingService.getCountries(lang).catch(() => []),
  ]);

  const dict = rawDict as any;
  const pageTitle = dict?.smart_docs?.sellers_management || 'Sellers Management';
  const pageDescription =
    dict?.smart_docs?.sellers_description ||
    'View and manage your registered sellers, credentials, and banking details.';

  const sellersData = extractSmartDocsArray(sellersRes);
  const totalRecords = extractSmartDocsTotal(sellersRes, sellersData.length);

  return (
    <div className="bg-background text-foreground transition-theme flex-1 flex flex-col min-h-0 lg:h-full overflow-y-auto lg:overflow-hidden">
      <div className="w-full pad-for-badges flex-1 flex flex-col min-h-0 lg:h-full">
        <div className="max-w-7xl w-full mx-auto pt-0 sm:pt-0 pb-1 sm:pb-1.5 lg:pb-2 flex-1 flex flex-col min-h-0 lg:h-full">
          <div className="shrink-0">
            <PageHeader
              title={pageTitle}
              backText={dict?.common?.back || 'Back'}
              backHref={`/${lang}/smart-docs`}
              size="sm"
              className="!top-0"
            />
          </div>
          <div className="flex-1 min-h-0 flex flex-col justify-start overflow-hidden">
            <SellersDataTable
              data={sellersData}
              totalRecords={totalRecords}
              initialPage={page}
              initialPageSize={limit}
              initialSearch={search}
              lang={lang}
              dict={dict}
              title={pageTitle}
              description={pageDescription}
              countries={rawCountries || []}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


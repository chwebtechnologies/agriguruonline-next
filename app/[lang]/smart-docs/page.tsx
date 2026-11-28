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
  extractIsSmartDocsEnabled,
  normalizeActionParam,
} from '@/lib/api/smart-docs.service';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { getValidAuthToken } from '@/lib/auth-token';
import { userService } from '@/lib/api/user.service';
import { isUserMember } from '@/lib/membership-status';

export const dynamic = 'force-dynamic';

export default async function SmartDocsPage(props: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  const token = await getValidAuthToken();

  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/smart-docs`);
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 10;
  const action = normalizeActionParam((searchParams?.action as string) || 'All');
  const search = (searchParams?.search as string) || '';
  const searchLabel = (searchParams?.search_label as string) || '';

  // Retrieve user session/profile from cookies:
  const cookieStore = await cookies();
  let userProfile: any = null;
  const userInfoStr = cookieStore.get('user_info')?.value;
  if (userInfoStr) {
    try {
      userProfile = JSON.parse(decodeURIComponent(userInfoStr));
    } catch {
      try {
        userProfile = JSON.parse(userInfoStr);
      } catch {}
    }
  }

  // Fetch Smart Docs list & dictionary in parallel (with profile fallback if cookie missing):
  const [smartDocsRes, rawDict, fetchedProfileRes] = await Promise.all([
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
    !userProfile
      ? userService.getUserProfile(token, lang).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!userProfile && fetchedProfileRes?.userProfile) {
    userProfile = fetchedProfileRes.userProfile;
  }

  const dict = rawDict as any;
  const pageTitle = dict?.smart_docs?.page_title || 'Confirmations/Quotations';
  const pageDescription =
    dict?.smart_docs?.page_description ||
    'Manage, track, and generate smart agricultural trade contracts and confirmations.';

  const confirmationsData = extractSmartDocsArray(smartDocsRes);
  const totalRecords = extractSmartDocsTotal(smartDocsRes, confirmationsData.length);

  // Evaluate feature enablement:
  // 1. Direct API flag from backend
  // 2. Fallback to membership plan status from user profile
  let isSmartDocsEnabled = extractIsSmartDocsEnabled(smartDocsRes);
  if (userProfile) {
    const isMember = isUserMember(userProfile);
    if (!isMember) {
      // Free / Regular account without an active member plan
      isSmartDocsEnabled = false;
    } else if (smartDocsRes && smartDocsRes?.unauthorized !== true) {
      if (smartDocsRes?.is_smart_docs_enabled !== false && (smartDocsRes as any)?.data?.is_smart_docs_enabled !== false) {
        isSmartDocsEnabled = true;
      }
    }
  }

  return (
    <div className="bg-background text-foreground transition-theme flex-1 flex flex-col min-h-0 lg:h-full overflow-y-auto lg:overflow-hidden">
      <div className="w-full pad-for-badges flex-1 flex flex-col min-h-0 lg:h-full">
        <div className="max-w-7xl w-full mx-auto pt-0 sm:pt-0 pb-1 sm:pb-1.5 lg:pb-2 flex-1 flex flex-col min-h-0 lg:h-full">
          <div className="shrink-0">
            <PageHeader
              title={pageTitle}
              backText={dict?.common?.back || 'Back'}
              backHref={`/${lang}`}
              size="sm"
              className="!top-0"
            />
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
              isSmartDocsEnabled={isSmartDocsEnabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


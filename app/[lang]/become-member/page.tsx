import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { userService } from '@/lib/api/user.service';
import { withTimeout, getNormalizedUserType } from '@/lib/api-utils';
import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';
import { getOnboardingDropdownsAction } from '@/app/actions/membership';
import BecomeMemberClient from '@/components/membership/BecomeMemberClient';
import { BecomeMemberInnerSkeleton } from './loading';
import type { StoredPlanSelection } from '@/lib/api/user.service';

export const revalidate = 0; // Dynamic route requiring authentication

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }];
}

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'membership',
    pathname: 'become-member',
    lang,
    noIndex: true,
  });
}

export default async function BecomeMemberPage(props: {
  params: Promise<{ lang: string }>;
}) {
  const params = await props.params;
  const lang = params.lang || 'en';
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  // Guard: Must be authenticated
  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/become-member`);
  }

  const dict = await getDictionary(lang as any).catch(() => ({}));
  const common = (dict as any)?.common || {};

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader
            title="Become a Member"
            backText={common.back || 'Back'}
          />
          <Suspense fallback={<BecomeMemberInnerSkeleton />}>
            <BecomeMemberContent lang={lang} token={token} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function BecomeMemberContent({
  lang,
  token,
}: {
  lang: string;
  token: string;
}) {
  const cookieStore = await cookies();
  const rawPlanId = cookieStore.get('selected-plan')?.value;
  const rawPlanName = cookieStore.get('selected-plan-name')?.value;
  const rawDuration = cookieStore.get('selected-plan-duration')?.value as 'MONTHLY' | 'YEARLY' | undefined;

  const initialStoredPlan: StoredPlanSelection | null = rawPlanId
    ? {
        planId: rawPlanId,
        planName: rawPlanName || 'Plan',
        duration: rawDuration === 'YEARLY' ? 'YEARLY' : 'MONTHLY',
      }
    : null;

  const [profileRes, dropdowns, plans] = await Promise.all([
    withTimeout(userService.getUserProfile(token, lang), 3000, {
      userProfile: null,
      shouldLogout: false,
    }),
    getOnboardingDropdownsAction(lang),
    withTimeout(userService.getMembershipPlans(lang, token), 3000, []),
  ]);

  const userProfile = profileRes?.userProfile;

  // Guard: If user is already an active Buyer or Seller, redirect to membership page
  const userTypeName = getNormalizedUserType(userProfile?.user_type);
  if (userTypeName === 'buyer' || userTypeName === 'seller') {
    redirect(`/${lang}/membership`);
  }

  return (
    <BecomeMemberClient
      userTypes={dropdowns?.userTypes || []}
      categories={dropdowns?.categories || []}
      countries={dropdowns?.countries || []}
      userProfile={userProfile}
      plans={plans || []}
      initialStoredPlan={initialStoredPlan}
      lang={lang}
    />
  );
}

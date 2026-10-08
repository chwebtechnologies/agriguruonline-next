import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { userService } from '@/lib/api/user.service';
import { withTimeout } from '@/lib/api-utils';
import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';
import MembershipPlansClient from '@/components/membership/MembershipPlansClient';
import MembershipLoading, { MembershipInnerSkeleton } from './loading';

export const revalidate = 3600;

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
    pathname: 'membership',
    lang,
  });
}

export default async function MembershipPage(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params;
  const lang = params.lang || 'en';
  const dict = await getDictionary(lang as any).catch(() => ({}));
  const common = (dict as any)?.common || {};
  const membershipDict = (dict as any)?.membership || {};

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader
            title={membershipDict.page_title || 'Membership Plans'}
            backText={common.back || 'Back'}
          />
          <Suspense fallback={<MembershipInnerSkeleton />}>
            <MembershipContent lang={lang} token={token} dict={dict} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function MembershipContent({
  lang,
  token,
  dict,
}: {
  lang: string;
  token?: string;
  dict: any;
}) {
  const [plans, profileRes] = await Promise.all([
    withTimeout(userService.getMembershipPlans(lang), 3000, []),
    token
      ? withTimeout(userService.getUserProfile(token, lang), 2000, {
          userProfile: null,
          shouldLogout: false,
        })
      : Promise.resolve({ userProfile: null, shouldLogout: false }),
  ]);

  return (
    <MembershipPlansClient
      plans={plans}
      lang={lang}
      userProfile={profileRes?.userProfile}
      dict={dict}
    />
  );
}

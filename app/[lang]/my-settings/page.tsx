import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { PageHeader } from '@/components/ui/PageHeader';
import { SettingsClient, NotificationSettingsData } from '@/components/settings/SettingsClient';
import SettingsLoading from './loading';
import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';
import { userService } from '@/lib/api/user.service';
import { getUserProfile } from '@/lib/user-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'settings',
    pathname: 'my-settings',
    lang,
    noIndex: true,
  });
}

export default async function SettingsPage(props: { params: Promise<{ lang: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  const params = await props.params;
  const lang = params.lang || 'en';

  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/my-settings`);
  }

  // Fetch dictionary, notification settings, and user profile in parallel
  const [dict, notifSettingsRes, userProfileRes] = await Promise.all([
    getDictionary(lang).catch(() => ({})),
    userService.getNotificationSettings(token, lang).catch((err) => {
      console.error('[SettingsPage] getNotificationSettings error:', err);
      return null;
    }),
    getUserProfile(token, lang).catch((err) => {
      console.error('[SettingsPage] getUserProfile error:', err);
      return { userProfile: null, shouldLogout: false };
    }),
  ]);

  if (userProfileRes?.shouldLogout) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/my-settings`);
  }

  const headerDict = (dict as Record<string, any>)?.header || {};

  const initialNotificationSettings: NotificationSettingsData | null = notifSettingsRes?.data
    ? {
        all_notifications: notifSettingsRes.data.all_notifications ?? true,
        alerts_notifications: notifSettingsRes.data.alerts_notifications ?? true,
        event_notifications: notifSettingsRes.data.event_notifications ?? true,
        news_notifications: notifSettingsRes.data.news_notifications ?? true,
        promotional_notifications: notifSettingsRes.data.promotional_notifications ?? true,
        ...notifSettingsRes.data,
      }
    : null;

  return (
    <div className="bg-background text-foreground transition-theme">
      {/* Strict container layout compliance matching category pages */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader
            title={headerDict.my_settings || 'My Settings'}
            backText={headerDict.dashboard || 'Dashboard'}
            backHref={`/${lang}/dashboard`}
          />

          <Suspense fallback={<SettingsLoading />}>
            <div className="mt-2 sm:mt-3">
              <SettingsClient
                lang={lang}
                initialNotificationSettings={initialNotificationSettings}
                userProfile={userProfileRes?.userProfile}
              />
            </div>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

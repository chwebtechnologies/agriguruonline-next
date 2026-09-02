import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { ForceLogout } from '@/components/auth/ForceLogout';
import { AlertsClient } from './AlertsClient';

import { getTradingApiUrl } from '@/lib/api-utils';

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'alerts_setups',
    pathname: 'alerts-setups',
    lang,
    noIndex: true,
  });
}

export default async function AlertsSetupsPage(props: { params: Promise<{ lang: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  const params = await props.params;
  const lang = params.lang || 'en';

  if (!token) {
    redirect(`/${lang}/login`);
  }

  let alertsData = null;
  let shouldLogout = false;

  try {
    const tradingApiUrl = getTradingApiUrl();
    const res = await fetch(`${tradingApiUrl}/price-alert?lang_code=${lang}&source=web`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      next: { revalidate: 0 } // no cache for dynamic personal data
    });
    
    if (res.ok) {
      const json = await res.json();
      if (json.message?.toLowerCase().includes('unauthorized') || json.message?.toLowerCase().includes('token')) {
        shouldLogout = true;
      } else {
        alertsData = json.data || [];
      }
    } else {
      if (res.status === 401 || res.status === 403) {
        shouldLogout = true;
      } else {
        alertsData = [];
      }
    }
  } catch (error) {
    console.error('Failed to fetch alerts', error);
    alertsData = [];
  }

  if (shouldLogout || alertsData === null) {
    return <ForceLogout lang={lang} />;
  }

  // Ensure it's an array
  const alertsList = Array.isArray(alertsData) ? alertsData : (Array.isArray(alertsData?.alerts) ? alertsData.alerts : []);

  return (
    <div className="bg-background text-foreground transition-theme pb-5">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Alerts Setups" backText="Back" />

          <AlertsClient initialAlerts={alertsList} lang={lang} />

        </div>
      </div>
    </div>
  );
}

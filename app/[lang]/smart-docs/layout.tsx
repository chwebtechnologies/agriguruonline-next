import React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSafeLanguage, getSiteUrl } from '@/lib/seo';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { getClientAuthData } from '@/app/actions/authData';
import { SmartDocsHeader } from '@/components/smart-docs/SmartDocsHeader';
import { SmartDocsFooter } from '@/components/smart-docs/SmartDocsFooter';

export async function generateMetadata(props: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const activeLang = getSafeLanguage(params?.lang);
  const siteUrl = getSiteUrl();

  return {
    title: 'Smart Docs | AgriGuru Online',
    description: 'SaaS Agricultural Trade Documentation, Contracts, and Verified Counterparty Directory.',
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: `${siteUrl}/${activeLang}/smart-docs`,
    },
  };
}

export default async function SmartDocsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const resolvedParams = await params;
  const activeLang = getSafeLanguage(resolvedParams?.lang);

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  if (!token) {
    redirect(`/${activeLang}/login?redirectUrl=/${activeLang}/smart-docs`);
  }

  const [rawDict, authState] = await Promise.all([
    getDictionary(activeLang).catch(() => ({})),
    getClientAuthData(activeLang).catch(() => ({ isAuthenticated: false })),
  ]);

  const defaultNav = {
    login: 'Login',
    register: 'Register',
    logout: 'Log Out',
    dashboard: 'Dashboard',
    profile: 'Profile',
  };

  const defaultHeader = {
    upgrade_plan: 'Upgrade Plan',
    free_trial: 'Free Trial',
    notifications: 'Notifications',
    alerts: 'Alerts',
    ai_predicts: 'AI Predicts',
    my_profile: 'My Profile',
    dashboard: 'Dashboard',
    my_settings: 'Settings',
  };

  const dict = {
    navigation: {
      ...defaultNav,
      ...(rawDict as any)?.navigation,
    },
    header: {
      ...defaultHeader,
      ...(rawDict as any)?.header,
    },
    footer: (rawDict as any)?.footer || {},
    common: (rawDict as any)?.common || {},
  };

  const clientAuth = authState as any;

  return (
    <div className="fixed inset-0 flex flex-col w-full h-full bg-background text-foreground overflow-hidden z-20">
      {/* Sticky Top Header */}
      <SmartDocsHeader
        activeLang={activeLang}
        dict={dict}
        profile={clientAuth?.userProfile}
        token={token}
        initialNotifications={clientAuth?.notificationsData}
        initialAlerts={clientAuth?.alertsData}
        initialAiPredicts={clientAuth?.aiPredictsData}
      />

      {/* Center SaaS Workspace (with bottom padding for fixed footer) */}
      <main className="flex-1 w-full flex flex-col min-h-0 overflow-hidden pb-[52px] sm:pb-[56px]">
        {children}
      </main>

      {/* Locked Screen Bottom Footer */}
      <SmartDocsFooter activeLang={activeLang} dict={dict} />
    </div>
  );
}

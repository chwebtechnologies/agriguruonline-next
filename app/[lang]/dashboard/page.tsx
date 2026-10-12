import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { PageHeader } from '@/components/ui/PageHeader'
import DashboardClient from '@/components/dashboard/DashboardClient'
import { getSafeLanguage, getStandardMetadata } from '@/lib/seo'
import { userService } from '@/lib/api/user.service'
import { tradingService } from '@/lib/api/trading.service'
import { getUserProfile } from '@/lib/user-data'
import { getNormalizedUserType } from '@/lib/api-utils'

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params
  const lang = getSafeLanguage(params?.lang)

  return getStandardMetadata({
    pageKey: 'dashboard',
    pathname: 'dashboard',
    lang,
  })
}

export const dynamic = 'force-dynamic';

export default async function DashboardPage(props: { params: Promise<{ lang: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;

  const params = await props.params
  const lang = params.lang || 'en'

  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/dashboard`);
  }

  const [dict, transactions, userProfile, stats] = await Promise.all([
    getDictionary(lang as any),
    userService.getPaymentHistory(token, lang, 1, 25),
    getUserProfile(token, lang),
    tradingService.getDashboardStats(token, lang),
  ]);

  const userType = getNormalizedUserType(userProfile?.userProfile?.user_type) || 'buyer';

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5 px-3 sm:px-0">
          <PageHeader title="Dashboard Overview" backText="Back" />
          
          <div className="mt-4">
            <DashboardClient 
              lang={lang} 
              common={dict?.common} 
              transactions={transactions} 
              stats={stats}
              userType={userType}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

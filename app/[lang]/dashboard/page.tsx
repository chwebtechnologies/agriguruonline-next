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

  // Fetch dashboard data safely with fallbacks so network hiccups never throw unhandled exceptions
  const [dict, transactions, userProfile, stats] = await Promise.all([
    getDictionary(lang as any).catch(() => ({} as any)),
    userService.getPaymentHistory(token, lang, 1, 25).catch((err) => {
      console.error('[DashboardPage] getPaymentHistory error:', err);
      return [];
    }),
    getUserProfile(token, lang).catch((err) => {
      console.error('[DashboardPage] getUserProfile error:', err);
      return { userProfile: null, shouldLogout: false };
    }),
    tradingService.getDashboardStats(token, lang).catch((err) => {
      console.error('[DashboardPage] getDashboardStats error:', err);
      return null;
    }),
  ]);

  if (userProfile?.shouldLogout) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/dashboard`);
  }

  const userType = getNormalizedUserType(userProfile?.userProfile?.user_type) || 'buyer';

  // Merge feature count limits from membership plan if available
  const membershipFeatures = userProfile?.userProfile?.membership?.features || [];
  let productLimit = stats?.favourite_product_count_limit;
  let portLimit = stats?.favourite_port_count_limit;

  if (Array.isArray(membershipFeatures)) {
    for (const feat of membershipFeatures) {
      const featName = String(feat?.name || '').toLowerCase();
      if (featName.includes('product') && feat?.count_limit) {
        productLimit = Number(feat.count_limit) || productLimit;
      }
      if ((featName.includes('port') || featName.includes('corridor')) && feat?.count_limit) {
        portLimit = Number(feat.count_limit) || portLimit;
      }
    }
  }

  // If stats is missing or has all zero counts, fetch actual inquiries/watchlist/alerts directly
  let effectiveStats = stats;
  const hasValidCounts = stats && Object.entries(stats).some(([k, v]) => !k.includes('limit') && typeof v === 'number' && v > 0);

  if (!hasValidCounts) {
    const [buyerInq, sellerInq, freightInq, favProducts, favPorts, alerts] = await Promise.all([
      tradingService.getInquiryList('/trading-inquiry/for-user?type=BUYER', token, lang).catch(() => []),
      tradingService.getInquiryList('/trading-inquiry/for-user?type=SELLER', token, lang).catch(() => []),
      tradingService.getInquiryList('/freight-inquiry/for-user', token, lang).catch(() => []),
      tradingService.getFavoriteProducts(token, lang).catch(() => []),
      tradingService.getFavoritePorts(token, lang).catch(() => []),
      userService.getUserAlerts(token, lang).catch(() => []),
    ]);

    const productInquiriesCount = (buyerInq?.length || 0) + (sellerInq?.length || 0);
    const freightInquiriesCount = freightInq?.length || 0;
    const favProductsCount = favProducts?.length || 0;
    const favPortsCount = favPorts?.length || 0;
    const alertsCount = alerts?.length || 0;

    effectiveStats = {
      ...(stats || {}),
      trading_inquiries_count: stats?.trading_inquiries_count || productInquiriesCount,
      freight_inquiries_count: stats?.freight_inquiries_count || freightInquiriesCount,
      favourite_product_count: stats?.favourite_product_count || favProductsCount,
      favourite_product_count_limit: productLimit || stats?.favourite_product_count_limit || 10,
      favourite_port_count: stats?.favourite_port_count || favPortsCount,
      favourite_port_count_limit: portLimit || stats?.favourite_port_count_limit || 10,
      alert_count: stats?.alert_count || alertsCount,
      ai_analysis_count: stats?.ai_analysis_count || 0,
      markter_report_count: stats?.markter_report_count || 0,
      instruction_count: stats?.instruction_count || 0,
      smart_doc_count: stats?.smart_doc_count || 0,
    };
  } else if (effectiveStats) {
    effectiveStats = {
      ...effectiveStats,
      favourite_product_count_limit: productLimit || effectiveStats.favourite_product_count_limit || 10,
      favourite_port_count_limit: portLimit || effectiveStats.favourite_port_count_limit || 10,
    };
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5 px-3 sm:px-0">
          <PageHeader title="Dashboard Overview" backText="Back" />
          
          <div className="mt-1 sm:mt-1.5">
            <DashboardClient 
              lang={lang} 
              common={dict?.common} 
              transactions={transactions} 
              stats={effectiveStats}
              userType={userType}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

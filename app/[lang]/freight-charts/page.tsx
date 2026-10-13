import type { Metadata } from 'next'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { PageHeader } from '@/components/ui/PageHeader'
import FreightChartClient from '@/components/freight-chart/FreightChartClient'
import { cookies } from 'next/headers'
import { getSafeLang, withTimeout } from '@/lib/api-utils'
import { tradingService } from '@/lib/api/trading.service'
import { getUserProfile } from '@/lib/user-data'
import { Suspense } from 'react'

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'freight_charts',
    pathname: 'freight-charts',
    lang,
  });
}

async function getFreightInitialData(lang: string = 'en') {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value || ''
  const safeLang = getSafeLang(lang)

  let shippingContainers: any[] = []
  let userType: string | null = null
  let favoritePorts: any[] = []

  // Execute all independent API fetches concurrently in parallel using centralized services
  const [containersSettled, profileSettled, favsSettled] = await Promise.allSettled([
    withTimeout(tradingService.getShippingContainers(safeLang), 3000, []),
    token ? withTimeout(getUserProfile(token, safeLang).then(r => r.userProfile ? { data: r.userProfile } : null), 2500, null) : Promise.resolve(null),
    withTimeout(tradingService.getFavoritePorts(token || '', safeLang), 3000, [])
  ])

  // 1. Process shipping containers
  if (containersSettled.status === 'fulfilled' && containersSettled.value) {
    const rawContainers = Array.isArray(containersSettled.value) ? containersSettled.value : ((containersSettled.value as any)?.data?.shipping_container || []);
    if (Array.isArray(rawContainers)) {
      shippingContainers = rawContainers.map((c: any) => ({
        id: c.id || '',
        title: c.title || c.name || '',
        default_load_capacity: c.default_load_capacity || 0,
        default_unit: c.default_unit?.title || 'MT'
      }))
    }
  }

  // 2. Process profile
  if (profileSettled.status === 'fulfilled' && profileSettled.value) {
    const uJson = profileSettled.value
    if (uJson.data?.user_type) {
      userType = typeof uJson.data.user_type === 'string'
        ? uJson.data.user_type.toLowerCase()
        : String(uJson.data.user_type.name || '').toLowerCase()
    }
  }

  // 3. Process favorite freight ports
  if (favsSettled.status === 'fulfilled' && favsSettled.value) {
    const rawFavs = Array.isArray(favsSettled.value) ? favsSettled.value : [];

    if (Array.isArray(rawFavs)) {
      const getTitle = (obj: any, fallback = 'N/A') => {
        if (!obj) return fallback;
        if (typeof obj === 'string') return obj;
        return obj.title || obj.name || obj.label || fallback;
      };

      const getFlag = (obj: any) => {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;
        return obj.flag || obj.country?.flag || '';
      };

      favoritePorts = rawFavs.map((item: any) => {
        const shipBy = getTitle(item.shipping_container) !== 'N/A' 
          ? getTitle(item.shipping_container) 
          : (getTitle(item.shippingContainer) !== 'N/A' ? getTitle(item.shippingContainer) : (item.ship_by || item.shipBy || 'N/A'));
        
        const pol = getTitle(item.loading_port) !== 'N/A' 
          ? getTitle(item.loading_port) 
          : (getTitle(item.loadingPort) !== 'N/A' ? getTitle(item.loadingPort) : (item.pol || 'N/A'));
        const polFlag = getFlag(item.loading_port) || getFlag(item.loadingPort) || item.loading_port?.country?.flag || item.pol_flag || '';
        
        const pod = getTitle(item.destination_port) !== 'N/A' 
          ? getTitle(item.destination_port) 
          : (getTitle(item.destinationPort) !== 'N/A' ? getTitle(item.destinationPort) : (item.pod || 'N/A'));
        const podFlag = getFlag(item.destination_port) || getFlag(item.destinationPort) || item.destination_port?.country?.flag || item.pod_flag || '';
        
        const freight = (item.freight != null ? Math.round(Number(item.freight)) : (item.current_freight != null ? Math.round(Number(item.current_freight)) : 0)).toString();
        const freightPmt = (item.freightPMT != null ? Math.round(Number(item.freightPMT)) : (item.freight_pmt != null ? Math.round(Number(item.freight_pmt)) : (item.price != null ? Math.round(Number(item.price)) : 0))).toString();
        const change = (item.change != null ? Math.round(Number(item.change)) : (item.price_change != null ? Math.round(Number(item.price_change)) : (item.change_percentage != null ? Math.round(Number(item.change_percentage)) : 0))).toString();

        const isExplicitlyDisabled = (val: any) => {
          return val === false || val === 'false' || val === 'off' || val === 'disable' || val === 'disabled';
        };
        const chartStatus = !(isExplicitlyDisabled(item.chart_status) || isExplicitlyDisabled(item.chartStatus) || isExplicitlyDisabled(item.is_chart));

        const loadCapacity = item.shipping_container?.default_load_capacity || item.load_capacity || 26;
        const loadUnit = item.shipping_container?.default_unit?.title || item.load_unit || 'MT';

        return {
          id: item.id || item.favourite_freight_id || item.favourite_port_id || item.favorite_port_id || item._id || Date.now().toString(),
          shipBy,
          pol,
          polFlag,
          pod,
          podFlag,
          freight,
          freightPmt,
          change,
          chartStatus,
          loadCapacity,
          loadUnit,
          originalItem: item
        };
      })
    }
  }

  return {
    shippingContainers,
    userType,
    favoritePorts,
  }
}

import { FreightChartGridSkeleton } from '@/components/freight-chart/FreightChartGridSkeleton';

/* ---------- Async component that fetches charts data ---------- */
async function FreightChartContent({ lang, common }: { lang: string, common: any }) {
  const initialData = await getFreightInitialData(lang)

  return (
    <FreightChartClient
      initialShippingContainers={initialData.shippingContainers}
      initialFavorites={initialData.favoritePorts}
      initialUserType={initialData.userType}
      lang={lang}
      common={common}
    />
  )
}

export default async function FreightChartsPage(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params
  const lang = params.lang || 'en'
  const dict = await getDictionary(lang as any)

  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Freight Charts" backText="Back" />

          <div className="mt-4">
            <Suspense fallback={<FreightChartGridSkeleton />}>
              <FreightChartContent lang={lang} common={dict?.common} />
            </Suspense>
          </div>
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}`
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Freight Charts",
                "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/freight-charts`
              }
            ]
          }).replace(/</g, '\\u003c')
        }}
      />
    </div>
  )
}

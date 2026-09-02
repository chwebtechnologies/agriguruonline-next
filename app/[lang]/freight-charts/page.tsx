import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import FreightChartClient from '@/components/freight-chart/FreightChartClient'
import { cookies } from 'next/headers'
import { getTradingApiUrl, getUserApiUrl, getSafeLang } from '@/lib/api-utils'
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

  const tradingApiUrl = getTradingApiUrl()
  const userApiUrl = getUserApiUrl()

  const cUrl = `${tradingApiUrl}/shipping-container?is_active=true&lang_code=${safeLang}&source=web`
  const uUrl = `${userApiUrl}/user/my-profile?lang_code=${safeLang}&source=web`
  const fUrl = `${tradingApiUrl}/favourite-port?lang_code=${safeLang}&source=web`

  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`
  }

  // Execute all independent API fetches concurrently in parallel
  const [containersSettled, profileSettled, favsSettled] = await Promise.allSettled([
    fetch(cUrl, { next: { revalidate: 60 } }).then(r => r.ok ? r.json() : null),
    token ? fetch(uUrl, { headers: authHeaders, next: { revalidate: 60 } }).then(r => r.ok ? r.json() : null) : Promise.resolve(null),
    fetch(fUrl, { headers: authHeaders, next: { revalidate: 60 } }).then(r => r.ok ? r.json() : null)
  ])

  // 1. Process shipping containers
  if (containersSettled.status === 'fulfilled' && containersSettled.value) {
    const json = containersSettled.value
    const rawContainers = json.data?.shipping_container || json.data?.shipping_containers || (Array.isArray(json.data) ? json.data : [])
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
    const fJson = favsSettled.value
    const rawFavs =
      fJson?.data?.favourite_ports ||
      fJson?.data?.favourite_port ||
      fJson?.data?.favorites ||
      fJson?.data?.ports ||
      fJson?.data?.data ||
      (Array.isArray(fJson?.data) ? fJson.data : []) ||
      (Array.isArray(fJson) ? fJson : [])

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

        const isChart = (val: any) => {
          if (val === false || val === 0 || val === '0' || val === 'off' || val === 'false' || val === 'disable' || val === 'disabled') return false;
          return true;
        };

        const chartStatus = isChart(item.chart_status) && isChart(item.chartStatus);

        const loadCapacity = item.shipping_container?.default_load_capacity || item.load_capacity || 26;
        const loadUnit = item.shipping_container?.default_unit?.title || item.load_unit || 'MT';

        return {
          id: item.id || Date.now().toString(),
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
          loadUnit
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

/* ---------- Skeleton shown during Suspense ---------- */
function FreightChartGridSkeleton() {
  const gridCols = 'grid-cols-[1.2fr_1.4fr_1.4fr_0.9fr_1fr_0.9fr_0.7fr_1.3fr]'

  return (
    <div className="w-full overflow-visible">
      {/* Desktop Filter Row Skeleton */}
      <div className={`hidden lg:grid ${gridCols} gap-1.5 mb-1.5 items-end pt-1 pb-1 px-0 animate-pulse`}>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg bg-muted"></div>
      </div>

      {/* Mobile/Tablet List Skeleton (lg:hidden) */}
      <div className="flex flex-col gap-[7px] lg:hidden">
        {[...Array(4)].map((_, i) => (
          <div
            key={`mob-${i}`}
            className="flex flex-col p-3 bg-card rounded-2xl border border-border shadow-xs animate-pulse"
          >
            <div className="flex justify-between items-center">
              <div className="h-3.5 w-24 bg-muted rounded"></div>
              <div className="h-3.5 w-28 bg-muted rounded"></div>
            </div>
            <div className="flex justify-between items-center gap-3 mt-2.5">
              <div className="h-4 w-36 bg-muted rounded"></div>
              <div className="h-4 w-28 bg-muted rounded"></div>
            </div>
            <div className="flex justify-between items-center mt-2.5">
              <div className="h-3.5 w-20 bg-muted rounded"></div>
              <div className="h-3.5 w-16 bg-muted rounded"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Rows Skeleton (hidden lg:flex) */}
      <div className="hidden lg:flex flex-col gap-[7px] lg:gap-2 mt-0.5 lg:mt-1">
        {[...Array(4)].map((_, i) => (
          <div
            key={`desk-${i}`}
            className={`grid ${gridCols} gap-1.5 items-center px-3.5 py-3.5 rounded-lg bg-card dark:bg-[#18181b] shadow-xs border border-border text-sm animate-pulse`}
          >
            <div className="h-4 w-24 bg-muted rounded min-w-0"></div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border"></div>
              <div className="h-4 w-20 bg-muted rounded"></div>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border"></div>
              <div className="h-4 w-20 bg-muted rounded"></div>
            </div>
            <div className="h-4 w-14 mx-auto bg-muted rounded min-w-0"></div>
            <div className="h-4 w-14 mx-auto bg-muted rounded min-w-0"></div>
            <div className="h-4 w-12 mx-auto bg-muted rounded min-w-0"></div>
            <div className="w-5 h-5 mx-auto bg-muted rounded min-w-0"></div>
            <div className="flex items-center justify-end gap-2.5 min-w-0">
              <div className="h-7 w-16 bg-muted rounded-full min-w-0"></div>
              <div className="w-6 h-6 bg-muted rounded min-w-0"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Async component that fetches charts data ---------- */
async function FreightChartContent({ lang }: { lang: string }) {
  const initialData = await getFreightInitialData(lang)

  return (
    <FreightChartClient
      initialShippingContainers={initialData.shippingContainers}
      initialFavorites={initialData.favoritePorts}
      initialUserType={initialData.userType}
      lang={lang}
    />
  )
}

export default async function FreightChartsPage(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params
  const lang = params.lang || 'en'

  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Freight Charts" backText="Back" />

          <div className="mt-4">
              <FreightChartContent lang={lang} />
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

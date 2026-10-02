import { getDictionary } from '@/app/[lang]/dictionaries';
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import ProductChartsClient from '@/components/product-charts/ProductChartsClient'
import { cookies } from 'next/headers'
import { getSafeLang, getNormalizedUserType, withTimeout } from '@/lib/api-utils'
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
    pageKey: 'product_charts',
    pathname: 'product-charts',
    lang,
  });
}

async function getChartsInitialData(lang: string = 'en') {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value || ''
  const safeLang = getSafeLang(lang)

  let products: any[] = []
  let shippingTerms: any[] = []
  let userType: string | null = null
  let favoriteProducts: any[] = []
  let marketedProducts: any[] = []

  // Execute all independent API fetches concurrently in parallel using centralized services
  const [productsSettled, termsSettled, profileSettled, favsSettled] = await Promise.allSettled([
    withTimeout(tradingService.getAllProducts(safeLang), 3000, []),
    withTimeout(tradingService.getShippingTerms(safeLang), 3000, []),
    token ? withTimeout(getUserProfile(token, safeLang).then(r => r.userProfile ? { data: r.userProfile } : null), 2500, null) : Promise.resolve(null),
    withTimeout(tradingService.getFavoriteProducts(token || '', safeLang), 3000, [])
  ])

  // 1. Process products
  if (productsSettled.status === 'fulfilled' && Array.isArray(productsSettled.value)) {
    const rawProducts = productsSettled.value
    if (Array.isArray(rawProducts)) {
      products = rawProducts.map((p: any) => ({
        id: p.id || '',
        name: p.name || '',
        category: p.category ? { id: p.category.id || '', name: p.category.name || '' } : { id: '', name: '' },
        country: p.country ? { id: p.country.id || '', name: p.country.name || '', flag: p.country.flag || '', iso2: p.country.iso2 || '' } : { id: '', name: '', flag: '', iso2: '' },
        chart_status: p.chart_status
      }))

      marketedProducts = rawProducts.filter(p => p.is_marketed).map((p: any) => {
        const priceStr = p.loading_ports?.[0]?.price || 0;
        const changeStr = p.change != null ? p.change : (p.price_change != null ? p.price_change : (p.change_percentage != null ? p.change_percentage : 0));
        return {
          id: p.id,
          name: p.name || 'Unknown',
          price: Number(priceStr),
          change: Number(changeStr),
          port: p.loading_ports?.[0]?.port?.name || '',
          countryFlag: p.country?.flag || ''
        };
      }).filter((p: any) => p.price > 0)
    }
  }

  // 2. Process shipping terms
  if (termsSettled.status === 'fulfilled' && termsSettled.value) {
    const rawTerms = Array.isArray(termsSettled.value) ? termsSettled.value : ((termsSettled.value as any)?.data?.shipping_term || []);
    if (Array.isArray(rawTerms)) {
      shippingTerms = rawTerms.map((t: any) => ({
        id: t.id || '',
        title: t.title || t.name || ''
      }))
    }
  }

  if (profileSettled.status === 'fulfilled' && profileSettled.value) {
    const uJson = profileSettled.value
    if (uJson.data?.user_type) {
      userType = getNormalizedUserType(uJson.data.user_type);
    }
  }

  // 4. Process favorite products
  if (favsSettled.status === 'fulfilled' && favsSettled.value) {
    const rawFavs = Array.isArray(favsSettled.value) ? favsSettled.value : [];

    if (Array.isArray(rawFavs)) {
      const getTitle = (obj: any, fallback = 'N/A') => {
        if (!obj) return fallback;
        if (typeof obj === 'string') return obj;
        return obj.name || obj.title || obj.label || fallback;
      };

      const getFlag = (obj: any) => {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;
        return obj.flag || obj.country?.flag || '';
      };

      favoriteProducts = rawFavs.map((item: any) => {
        const prodName = getTitle(item.product) !== 'N/A' ? getTitle(item.product) : (item.product_name || item.name || 'N/A');
        const catName = getTitle(item.category) !== 'N/A' ? getTitle(item.category) : (item.category_name || 'N/A');
        const countryName = getTitle(item.country) !== 'N/A' ? getTitle(item.country) : (item.country_name || 'N/A');
        const countryFlag = getFlag(item.country) || item.country_flag || item.flag || '';
        const shipBy = getTitle(item.shipping_container) !== 'N/A' ? getTitle(item.shipping_container) : (getTitle(item.shippingContainer) !== 'N/A' ? getTitle(item.shippingContainer) : (item.ship_by || item.shipBy || 'N/A'));
        const term = getTitle(item.shipping_term) !== 'N/A' ? getTitle(item.shipping_term) : (getTitle(item.shippingTerm) !== 'N/A' ? getTitle(item.shippingTerm) : (item.term || 'N/A'));
        const pol = getTitle(item.loading_port) !== 'N/A' ? getTitle(item.loading_port) : (getTitle(item.loadingPort) !== 'N/A' ? getTitle(item.loadingPort) : (item.pol || 'N/A'));
        const polFlag = getFlag(item.loading_port) || getFlag(item.loadingPort) || item.pol_flag || '';
        const pod = getTitle(item.destination_port) !== 'N/A' ? getTitle(item.destination_port) : (getTitle(item.destinationPort) !== 'N/A' ? getTitle(item.destinationPort) : (item.pod || 'N/A'));
        const podFlag = getFlag(item.destination_port) || getFlag(item.destinationPort) || item.pod_flag || '';
        const price = (item.price != null ? Math.round(Number(item.price)) : (item.current_price != null ? Math.round(Number(item.current_price)) : 0)).toString();
        const change = (item.change != null ? Math.round(Number(item.change)) : (item.price_change != null ? Math.round(Number(item.price_change)) : (item.change_percentage != null ? Math.round(Number(item.change_percentage)) : 0))).toString();

        const isChart = (val: any) => {
          if (val === false || val === 0 || val === '0' || val === 'off' || val === 'false' || val === 'disable' || val === 'disabled') return false;
          return true;
        };

        const chartStatus = isChart(item.chart_status) && isChart(item.chartStatus) && isChart(item.product?.chart_status);

        return {
          id: item.id || Date.now(),
          category: catName,
          country: countryName,
          countryFlag,
          product: prodName,
          shipBy,
          term,
          pol,
          polFlag,
          pod,
          podFlag,
          price,
          change,
          chartStatus,
        };
      })
    }
  }

  return {
    products,
    shippingTerms,
    userType,
    favoriteProducts,
    marketedProducts,
  }
}

/* ---------- Skeleton shown during Suspense ---------- */
function ProductChartsGridSkeleton() {
  return (
    <div className="w-full overflow-visible">
      {/* Top Marketed Products Ticker Skeleton */}
      <div className="w-full bg-card rounded-md border border-border mb-4 h-10 flex items-center shadow-sm px-4 animate-pulse">
        <div className="h-4 w-64 bg-muted rounded"></div>
      </div>

      {/* Desktop Filter Row Skeleton (Visible on Desktop) */}
      <div className="hidden xl:grid grid-cols-[0.92fr_0.98fr_1.85fr_1.0fr_0.78fr_1.22fr_1.27fr_0.68fr_0.72fr_0.5fr_1.08fr] gap-1.5 mb-1.5 items-end pt-1 pb-1 px-0 animate-pulse">
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg border border-border bg-card"></div>
        <div className="w-full h-[45px] rounded-lg bg-muted"></div>
      </div>

      {/* Mobile/Tablet List Skeleton (xl:hidden) */}
      <div className="flex flex-col gap-[7px] xl:hidden">
        {[...Array(4)].map((_, i) => (
          <div
            key={`mob-${i}`}
            className="flex flex-col p-2 bg-card rounded-xl border border-border shadow-xs animate-pulse"
          >
            {/* Row 1: Origins and POD */}
            <div className="flex justify-between items-center text-[12px]">
              <div className="h-3 w-20 bg-muted rounded"></div>
              <div className="h-3 w-24 bg-muted rounded"></div>
            </div>

            {/* Row 2: Product Name & Price */}
            <div className="flex justify-between items-center gap-3 mt-1.5">
              <div className="h-4 w-32 bg-muted rounded"></div>
              <div className="h-4 w-16 bg-muted rounded"></div>
            </div>

            {/* Row 3: POL, ShipBy, Change */}
            <div className="flex justify-between items-center text-[12px] mt-1">
              <div className="h-3 w-20 bg-muted rounded"></div>
              <div className="h-3 w-24 bg-muted rounded"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Rows Skeleton (hidden xl:flex) */}
      <div className="hidden xl:flex flex-col gap-[7px] xl:gap-2 mt-0.5 xl:mt-1">
        {[...Array(4)].map((_, i) => (
          <div
            key={`desk-${i}`}
            className="grid grid-cols-[0.92fr_0.98fr_1.85fr_1.0fr_0.78fr_1.22fr_1.27fr_0.68fr_0.72fr_0.5fr_1.08fr] gap-1.5 items-center px-3.5 py-3.5 rounded-lg bg-card shadow-xs border border-border text-sm animate-pulse"
          >
            <div className="h-4 w-3/4 bg-muted rounded min-w-0"></div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border"></div>
              <div className="h-4 w-16 bg-muted rounded"></div>
            </div>
            <div className="h-4 w-full bg-muted rounded min-w-0"></div>
            <div className="h-4 w-12 mx-auto bg-muted rounded min-w-0"></div>
            <div className="h-4 w-10 mx-auto bg-muted rounded min-w-0"></div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border"></div>
              <div className="h-4 w-12 bg-muted rounded"></div>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-3.5 bg-muted rounded-[2px] shrink-0 border border-border"></div>
              <div className="h-4 w-12 bg-muted rounded"></div>
            </div>
            <div className="h-4 w-12 mx-auto bg-muted rounded min-w-0"></div>
            <div className="h-4 w-12 mx-auto bg-muted rounded min-w-0"></div>
            <div className="w-5 h-5 mx-auto bg-muted rounded min-w-0"></div>
            <div className="h-7 w-16 ml-auto bg-muted rounded-full min-w-0"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Async component that fetches charts data ---------- */
async function ChartsContent({ lang, common }: { lang: string, common: any }) {
  const initialData = await getChartsInitialData(lang)

  return (
    <ProductChartsClient common={common}
      initialProducts={initialData.products}
      initialShippingTerms={initialData.shippingTerms}
      initialFavorites={initialData.favoriteProducts}
      initialUserType={initialData.userType}
      initialMarketedProducts={initialData.marketedProducts}
      lang={lang}
    />
  )
}

export default async function ChartsPage(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params
  const lang = params.lang || 'en'
  const dict = await getDictionary(lang as any)

  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Product Charts" backText="Back" />

          <div className="mt-4">
            <Suspense fallback={<ProductChartsGridSkeleton />}>
              <ChartsContent lang={lang} common={dict?.common} />
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
                "name": "Product Charts",
                "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/product-charts`
              }
            ]
          }).replace(/</g, '\\u003c')
        }}
      />
    </div>
  )
}

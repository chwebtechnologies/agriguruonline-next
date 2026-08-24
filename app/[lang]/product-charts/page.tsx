import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import ProductChartsClient from '@/components/product-charts/ProductChartsClient'
import { cookies } from 'next/headers'

export const metadata: Metadata = {
  title: 'Product Charts - AgriGuru Online',
  description: 'View and manage product charts on AgriGuru Online.',
}

const TRADING_API_URL =
  process.env.TRADING_API_URL ||
  process.env.NEXT_PUBLIC_TRADING_API_URL ||
  'https://trading-api.agriguruonline.cloud'

const USER_API_URL =
  process.env.USER_API_URL ||
  process.env.NEXT_PUBLIC_USER_API_URL ||
  'https://user-api.agriguruonline.cloud'

async function getChartsInitialData(lang: string = 'en') {
  let token = ''
  try {
    const cookieStore = await cookies()
    token =
      cookieStore.get('auth_token')?.value ||
      cookieStore.get('__Secure-uid')?.value ||
      ''
  } catch (e) {
    console.error('Error reading cookies:', e)
  }

  const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en'

  let products: any[] = []
  let shippingTerms: any[] = []
  let userType: string | null = null
  let favoriteProducts: any[] = []
  let marketedProducts: any[] = []

  // 1. Fetch products safely
  try {
    const pUrl = `${TRADING_API_URL.replace(/\/$/, '')}/product?is_active=true&lang_code=${safeLang}&source=web`
    const res = await fetch(pUrl, { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      const rawProducts = json.data?.products || (Array.isArray(json.data) ? json.data : [])
      if (Array.isArray(rawProducts)) {
        products = rawProducts.map((p: any) => ({
          id: p.id || '',
          name: p.name || '',
          category: p.category ? { id: p.category.id || '', name: p.category.name || '' } : { id: '', name: '' },
          country: p.country ? { id: p.country.id || '', name: p.country.name || '', flag: p.country.flag || '', iso2: p.country.iso2 || '' } : { id: '', name: '', flag: '', iso2: '' },
          chart_status: p.chart_status,
          loading_ports: Array.isArray(p.loading_ports)
            ? p.loading_ports.map((lp: any) => ({
                id: lp.port?.id || lp.id || '',
                name: lp.port?.name || lp.name || 'Port',
                price: lp.price,
                destination_ports: Array.isArray(lp.destination_ports)
                  ? lp.destination_ports.map((dp: any) => ({
                      id: dp.port?.id || dp.id || '',
                      name: dp.port?.name || dp.name || 'Destination Port'
                    }))
                  : []
              }))
            : []
        }))

        // Extract marketed products directly without extra API call
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
  } catch (err) {
    console.error('Failed to fetch products for charts:', err)
  }

  // 2. Fetch shipping terms safely
  try {
    const tUrl = `${TRADING_API_URL.replace(/\/$/, '')}/shipping-term?is_active=true&lang_code=${safeLang}&source=web`
    const res = await fetch(tUrl, { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      const rawTerms = json.data?.shipping_term || json.data?.shipping_terms || (Array.isArray(json.data) ? json.data : [])
      if (Array.isArray(rawTerms)) {
        shippingTerms = rawTerms.map((t: any) => ({
          id: t.id || '',
          title: t.title || t.name || ''
        }))
      }
    }
  } catch (err) {
    console.error('Failed to fetch shipping terms for charts:', err)
  }

  // 3. Fetch profile if authenticated
  if (token) {
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }

    try {
      const uUrl = `${USER_API_URL.replace(/\/$/, '')}/user/my-profile?lang_code=${safeLang}&source=web`
      const uRes = await fetch(uUrl, { headers: authHeaders, cache: 'no-store' })
      if (uRes.ok) {
        const uJson = await uRes.json()
        if (uJson.data?.user_type) {
          userType = typeof uJson.data.user_type === 'string'
            ? uJson.data.user_type.toLowerCase()
            : String(uJson.data.user_type.name || '').toLowerCase()
        }
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
    }
  }

  // Fetch favorite products unconditionally (with token if logged in, without token if guest)
  try {
    const fHeaders: any = { 'Content-Type': 'application/json' }
    if (token) {
      fHeaders['Authorization'] = `Bearer ${token}`
    }
    
    const fUrl = `${TRADING_API_URL.replace(/\/$/, '')}/favorite-product?lang_code=${safeLang}&source=web`
    const fRes = await fetch(fUrl, { headers: fHeaders, cache: 'no-store' })
    if (fRes.ok) {
      const fJson = await fRes.json()
      const rawFavs = fJson.data?.favorite_products || fJson.data?.favorite_product || (Array.isArray(fJson.data) ? fJson.data : [])
      if (Array.isArray(rawFavs)) {
        favoriteProducts = rawFavs.map((item: any) => ({
          id: item.id || Date.now(),
          category: item.category?.name || 'N/A',
          country: item.country?.name || 'N/A',
          countryFlag: item.country?.flag || '',
          product: item.product?.name || 'N/A',
          shipBy: item.shipping_container?.title || 'N/A',
          term: item.shipping_term?.title || 'N/A',
          pol: item.loading_port?.name || 'N/A',
          polFlag: item.loading_port?.flag || item.loading_port?.country?.flag || '',
          pod: item.destination_port?.name || 'N/A',
          podFlag: item.destination_port?.flag || item.destination_port?.country?.flag || '',
          price: (item.price != null ? Math.round(Number(item.price)) : (item.current_price != null ? Math.round(Number(item.current_price)) : 0)).toString(),
          change: (item.change != null ? Math.round(Number(item.change)) : (item.price_change != null ? Math.round(Number(item.price_change)) : (item.change_percentage != null ? Math.round(Number(item.change_percentage)) : 0))).toString(),
          chartStatus: item.chart_status === true || item.chart_status === 'on' || item.product?.chart_status === true || item.product?.chart_status === 'on',
        }))
      }
    }
  } catch (err) {
    console.error('Failed to fetch favorite products:', err)
  }

  // Removed redundant marketed products API call for better performance

  return {
    products,
    shippingTerms,
    userType,
    favoriteProducts,
    marketedProducts,
  }
}

export default async function ChartsPage(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params
  const lang = params.lang || 'en'
  const initialData = await getChartsInitialData(lang)

  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Product Charts" backText="Back" />

          <div className="mt-4 px-2 sm:px-0">
            <ProductChartsClient
              initialProducts={initialData.products}
              initialShippingTerms={initialData.shippingTerms}
              initialFavorites={initialData.favoriteProducts}
              initialUserType={initialData.userType}
              initialMarketedProducts={initialData.marketedProducts}
              lang={lang}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

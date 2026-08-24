import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import DedicatedChartClient from './DedicatedChartClient';
import { cookies } from 'next/headers';

const TRADING_API_URL =
  process.env.TRADING_API_URL ||
  process.env.NEXT_PUBLIC_TRADING_API_URL ||
  'https://trading-api.agriguruonline.cloud';

const USER_API_URL =
  process.env.USER_API_URL ||
  process.env.NEXT_PUBLIC_USER_API_URL ||
  'https://user-api.agriguruonline.cloud';

async function getChartProductData(id: string, lang: string = 'en') {
  let token = '';
  try {
    const cookieStore = await cookies();
    token =
      cookieStore.get('auth_token')?.value ||
      cookieStore.get('__Secure-uid')?.value ||
      '';
  } catch (e) {
    console.error('Error reading cookies:', e);
  }

  const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en';
  let userType: string | null = null;
  let itemData: any = null;

  // 1. Fetch user profile for userType
  if (token) {
    try {
      const uRes = await fetch(`${USER_API_URL.replace(/\/$/, '')}/user/my-profile?lang_code=${safeLang}&source=web`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (uRes.ok) {
        const uJson = await uRes.json();
        if (uJson.data?.user_type) {
          userType = typeof uJson.data.user_type === 'string'
            ? uJson.data.user_type.toLowerCase()
            : String(uJson.data.user_type.name || '').toLowerCase();
        }
      }
    } catch (e) {
      console.error('Failed to fetch profile:', e);
    }
  }

  // 2. Fetch favorite products to find matching item
  try {
    const fHeaders: any = { 'Content-Type': 'application/json' };
    if (token) fHeaders['Authorization'] = `Bearer ${token}`;

    const fRes = await fetch(`${TRADING_API_URL.replace(/\/$/, '')}/favorite-product?lang_code=${safeLang}&source=web`, {
      headers: fHeaders,
      cache: 'no-store'
    });
    if (fRes.ok) {
      const fJson = await fRes.json();
      const rawFavs = fJson.data?.favorite_products || fJson.data?.favorite_product || (Array.isArray(fJson.data) ? fJson.data : []);
      if (Array.isArray(rawFavs)) {
        const match = rawFavs.find((f: any) => String(f.id) === String(id) || String(f.product?.id) === String(id) || String(f.product_id) === String(id));
        if (match) {
          itemData = {
            id: match.id,
            category: match.category?.name || 'N/A',
            country: match.country?.name || 'N/A',
            countryFlag: match.country?.flag || '',
            product: match.product?.name || 'N/A',
            shipBy: match.shipping_container?.title || 'N/A',
            term: match.shipping_term?.title || 'N/A',
            pol: match.loading_port?.name || 'N/A',
            polFlag: match.loading_port?.flag || match.loading_port?.country?.flag || '',
            pod: match.destination_port?.name || 'N/A',
            podFlag: match.destination_port?.flag || match.destination_port?.country?.flag || '',
            price: (match.price != null ? Math.round(Number(match.price)) : (match.current_price != null ? Math.round(Number(match.current_price)) : 0)).toString(),
            change: (match.change != null ? Math.round(Number(match.change)) : (match.price_change != null ? Math.round(Number(match.price_change)) : (match.change_percentage != null ? Math.round(Number(match.change_percentage)) : 0))).toString(),
            chartStatus: match.chart_status === true || match.chart_status === 'on' || match.product?.chart_status === true || match.product?.chart_status === 'on',
          };
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch favorite product:', e);
  }

  // 3. Fallback to product details if not in favorites
  if (!itemData) {
    try {
      const pRes = await fetch(`${TRADING_API_URL.replace(/\/$/, '')}/product/${encodeURIComponent(id)}?lang_code=${safeLang}&source=web`, {
        cache: 'no-store'
      });
      if (pRes.ok) {
        const pJson = await pRes.json();
        const pData = pJson.data;
        if (pData) {
          itemData = {
            id: pData.id || id,
            category: pData.category?.name || 'N/A',
            country: pData.country?.name || 'N/A',
            countryFlag: pData.country?.flag || '',
            product: pData.name || 'Product Chart',
            shipBy: pData.shipping_containers?.[0]?.title || '20 FT',
            term: 'FOB',
            pol: pData.loading_ports?.[0]?.port?.name || 'Port',
            polFlag: pData.country?.flag || '',
            pod: 'N/A',
            podFlag: '',
            price: (pData.loading_ports?.[0]?.price != null ? Math.round(Number(pData.loading_ports[0].price)) : 0).toString(),
            change: (pData.change != null ? Math.round(Number(pData.change)) : 0).toString(),
            chartStatus: true,
          };
        }
      }
    } catch (e) {
      console.error('Failed to fetch product details fallback:', e);
    }
  }

  return { itemData, userType };
}

export default async function DedicatedChartPage(props: { params: Promise<{ lang: string, id: string }> }) {
  const params = await props.params;
  const lang = params.lang || 'en';
  const { itemData, userType } = await getChartProductData(params.id, lang);
  
  return (
    <main className="bg-white dark:bg-[#121214] text-foreground min-h-[100dvh] w-full flex flex-col items-center">
      <div className="w-full max-w-lg min-h-[100dvh] flex flex-col bg-white dark:bg-[#121214] border-x border-zinc-100 dark:border-zinc-800 shadow-sm">
        <DedicatedChartClient 
          productId={params.id} 
          lang={lang} 
          initialItemData={itemData} 
          initialUserType={userType} 
        />
      </div>
    </main>
  );
}

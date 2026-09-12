import React from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import DedicatedChartClient from './DedicatedChartClient';
import { cookies } from 'next/headers';
import { getSafeLang, getAssetsUrl } from '@/lib/api-utils';
import { tradingService } from '@/lib/api/trading.service';
import { getUserProfile } from '@/lib/user-data';

import { getAlternates, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string; id: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params.lang);
  const id = decodeURIComponent(params.id);
  const { itemData } = await getChartProductData(id, lang);

  const fallbackProductNames: Record<string, string> = {
    en: 'Commodity Price Chart',
    ar: 'الرسم البياني للسلعة',
    zh: '农产品大宗价格图表',
    fr: 'Graphique des Prix des Matières Premières',
  };

  const productName = itemData?.product || fallbackProductNames[lang] || fallbackProductNames.en;

  const titles: Record<string, string> = {
    en: `${productName} Price Chart & Historical Trends`,
    ar: `الرسم البياني لأسعار ${productName} والاتجاهات التاريخية`,
    zh: `${productName} 价格走势图表与历史行情`,
    fr: `Graphique des Prix et Tendances Historiques de ${productName}`,
  };

  const descriptions: Record<string, string> = {
    en: `Live historical and current price charts, trends, and FOB price data for ${productName}. Track market intelligence on AgriGuru Online.`,
    ar: `الرسوم البيانية اللحظية والتاريخية لأسعار ${productName}، اتجاهات الأسعار، وبيانات FOB. تابع تحليلات السوق على AgriGuru Online.`,
    zh: `实时追踪 ${productName} 的历史与即时价格走势图表、FOB离岸价数据及全球大宗行情动态。`,
    fr: `Graphiques des prix en direct et historiques, tendances et cours FOB pour ${productName}. Suivez la veille de marché sur AgriGuru Online.`,
  };

  const title = titles[lang] || titles.en;
  const fullTitle = `${title} | AgriGuru Online`;
  const description = descriptions[lang] || descriptions.en;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com';
  const assetsUrl = getAssetsUrl();
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`;
  const productImg = itemData?.image || itemData?.thumbnail;
  const imagePath = productImg?.startsWith('/') ? productImg.slice(1) : productImg;
  const imageUrl = productImg?.startsWith('http')
    ? productImg
    : (productImg ? `${imageBaseUrl}${imagePath}` : `${siteUrl}/logo.png`);

  const alternates = getAlternates(`product-charts/${params.id}`, lang);

  return {
    title,
    description,
    keywords: [
      `${productName} Price Chart`,
      `${productName} Historical Price`,
      `${productName} Market Trends`,
      'Commodity Price Tracking',
      'AgriGuru Online'
    ],
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: alternates.canonical,
      siteName: 'AgriGuru Online',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${productName} Price Chart`,
        },
      ],
      locale: lang,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates,
  };
}

async function getChartProductData(id: string, lang: string = 'en') {
  let token = '';
  try {
    const cookieStore = await cookies();
    token = cookieStore.get('auth_token')?.value || '';
  } catch (e) {
    console.error('Error reading cookies:', e);
  }

  const safeLang = getSafeLang(lang);
  let userType: string | null = null;
  let itemData: any = null;

  // 1. Fetch user profile for userType — deduplicated via React cache()
  if (token) {
    try {
      const { userProfile } = await getUserProfile(token, safeLang);
      if (userProfile?.user_type) {
        userType = typeof userProfile.user_type === 'string'
          ? userProfile.user_type.toLowerCase()
          : String(userProfile.user_type.name || '').toLowerCase();
      }
    } catch (e) {
      console.error('Failed to fetch profile:', e);
    }
  }

  // 2. Fetch favorite products to find matching item
  if (token) {
    try {
      const rawFavs = await tradingService.getFavoriteProducts(token, safeLang);
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
            chartStatus: (
              match.chartStatus === true || match.chartStatus === 1 || match.chartStatus === '1' || match.chartStatus === 'on' || match.chartStatus === 'true' ||
              match.chart_status === true || match.chart_status === 1 || match.chart_status === '1' || match.chart_status === 'on' || match.chart_status === 'true' || match.chart_status === 'active' || match.chart_status === 'enable' || match.chart_status === 'enabled' ||
              match.product?.chart_status === true || match.product?.chart_status === 1 || match.product?.chart_status === '1' || match.product?.chart_status === 'on' || match.product?.chart_status === 'true' || match.product?.chart_status === 'active'
            ),
          };
        }
      }
    } catch (e) {
      console.error('Failed to fetch favorite product:', e);
    }
  }

  // 3. Fallback to product details if not in favorites
  if (!itemData) {
    try {
      const pData = await tradingService.getProduct(id, safeLang);
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
    <main className="bg-background text-foreground min-h-[100dvh] w-full flex flex-col items-center">
      <div className="w-full max-w-lg min-h-[100dvh] flex flex-col bg-background border-x border-border shadow-sm">
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

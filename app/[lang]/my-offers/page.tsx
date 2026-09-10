import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { PageHeader } from '@/components/ui/PageHeader';
import { getTradingApiUrl } from '@/lib/api-utils';
import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';
import MyInquiriesClient from '@/components/my-inquiries/MyInquiriesClient';
import { getUserProfile } from '@/lib/user-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'myOffers',
    pathname: 'my-offers',
    lang,
    noIndex: true,
  });
}

// Comprehensive extractor to find array data in any response shape
function extractArray(resValue: any): any[] {
  if (!resValue) return [];
  if (Array.isArray(resValue)) return resValue;

  if (resValue.data) {
    if (Array.isArray(resValue.data)) return resValue.data;
    if (Array.isArray(resValue.data.inquiries)) return resValue.data.inquiries;
    if (Array.isArray(resValue.data.trading_inquiries)) return resValue.data.trading_inquiries;
    if (Array.isArray(resValue.data.freight_inquiries)) return resValue.data.freight_inquiries;
    if (Array.isArray(resValue.data.items)) return resValue.data.items;
    if (Array.isArray(resValue.data.data)) return resValue.data.data;
    if (Array.isArray(resValue.data.rows)) return resValue.data.rows;
    if (Array.isArray(resValue.data.list)) return resValue.data.list;
    if (Array.isArray(resValue.data.results)) return resValue.data.results;
    if (Array.isArray(resValue.data.records)) return resValue.data.records;

    // Check if resValue.data is an object containing arrays
    for (const key of Object.keys(resValue.data)) {
      if (Array.isArray(resValue.data[key])) {
        return resValue.data[key];
      }
    }

    // Check if resValue.data is a dictionary of inquiry objects (e.g. { "id1": { ... }, "id2": { ... } })
    if (typeof resValue.data === 'object' && !Array.isArray(resValue.data)) {
      const vals = Object.values(resValue.data);
      if (vals.length > 0 && typeof vals[0] === 'object' && vals[0] !== null) {
        return vals;
      }
    }
  }

  if (Array.isArray(resValue.inquiries)) return resValue.inquiries;
  if (Array.isArray(resValue.items)) return resValue.items;
  if (Array.isArray(resValue.rows)) return resValue.rows;
  if (Array.isArray(resValue.list)) return resValue.list;
  if (Array.isArray(resValue.results)) return resValue.results;
  if (Array.isArray(resValue.records)) return resValue.records;

  for (const key of Object.keys(resValue)) {
    if (Array.isArray(resValue[key])) {
      return resValue[key];
    }
  }

  return [];
}

async function fetchInquiryList(endpoint: string, token: string, lang: string): Promise<any[]> {
  const tradingApiUrl = getTradingApiUrl();
  const separator = endpoint.includes('?') ? '&' : '?';
  const primaryUrl = `${tradingApiUrl}${endpoint}${separator}lang_code=${lang}&source=web`;
  
  // Secondary fallback domain (.cloud vs .com)
  const alternateHost = primaryUrl.includes('.com')
    ? 'https://trading-api.agriguruonline.cloud'
    : 'https://trading-api.agriguruonline.com';
  const fallbackUrl = `${alternateHost}${endpoint}${separator}lang_code=${lang}&source=web`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };

  try {
    const res = await fetch(primaryUrl, {
      headers,
      cache: 'no-store',
    });

    if (res.ok) {
      const json = await res.json().catch(() => null);
      const list = extractArray(json);
      if (list.length > 0) return list;
    }
  } catch (err: any) {
    console.error(`[fetchInquiryList] Error fetching primary ${primaryUrl}:`, err);
  }

  // Fallback to alternate host
  try {
    const fallbackRes = await fetch(fallbackUrl, {
      headers,
      cache: 'no-store',
    });

    if (fallbackRes.ok) {
      const fallbackJson = await fallbackRes.json().catch(() => null);
      const fallbackList = extractArray(fallbackJson);
      if (fallbackList.length > 0) return fallbackList;
    }
  } catch (err: any) {
    console.error(`[fetchInquiryList] Error fetching fallback ${fallbackUrl}:`, err);
  }

  return [];
}

export default async function MyOffersPage(props: { params: Promise<{ lang: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;
  
  const params = await props.params;
  const lang = params.lang || 'en';

  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/my-offers`);
  }

  const { userProfile: profileData, shouldLogout } = await getUserProfile(token, lang);
  
  if (shouldLogout || !profileData) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/my-offers`);
  }

  const getNormalizedType = (typeData: any) => {
    if (!typeData) return '';
    if (typeof typeData === 'string') return typeData.toLowerCase();
    if (typeof typeData === 'object') return String(typeData.name || typeData.title || '').toLowerCase();
    return String(typeData).toLowerCase();
  };

  const isSeller = getNormalizedType(profileData.user_type) === 'seller' || getNormalizedType(profileData.role) === 'seller';
  if (!isSeller) {
    redirect(`/${lang}/my-inquiries`);
  }

  const dict = await getDictionary(lang);
  const common = dict.common || { back: 'Back' };
  
  const pageTitle = (dict as any).my_offers || 'My Offers & Inquiries';

  // Fetch product (both BUYER and SELLER types) and freight listings in parallel
  const [buyerProductRes, sellerProductRes, freightInquiries] = await Promise.all([
    fetchInquiryList('/trading-inquiry/for-user?type=BUYER', token, lang),
    fetchInquiryList('/trading-inquiry/for-user?type=SELLER', token, lang),
    fetchInquiryList('/freight-inquiry/for-user', token, lang),
  ]);

  // Combine product inquiries, deduplicate by ID, and sort by date descending
  const seenIds = new Set<string>();
  const productInquiries: any[] = [];
  for (const item of [...buyerProductRes, ...sellerProductRes]) {
    const id = item?.id || item?._id;
    if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }
    productInquiries.push(item);
  }
  productInquiries.sort((a, b) => {
    const dateA = new Date(a?.created_at || a?.createdAt || 0).getTime();
    const dateB = new Date(b?.created_at || b?.createdAt || 0).getTime();
    return dateB - dateA;
  });

  return (
    <div className="bg-background text-foreground transition-theme">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={pageTitle} backText={common.back} />

          <div>
            <MyInquiriesClient 
              lang={lang} 
              productInquiries={productInquiries} 
              freightInquiries={freightInquiries}
              dict={dict}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

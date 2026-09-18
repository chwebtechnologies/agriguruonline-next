import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { PageHeader } from '@/components/ui/PageHeader';
import { tradingService } from '@/lib/api/trading.service';
import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';
import MyInquiriesClient from '@/components/my-inquiries/MyInquiriesClient';
import { getUserProfile } from '@/lib/user-data';
import { ForceLogout } from '@/components/auth/ForceLogout';

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

import { Suspense } from 'react';

export default async function MyOffersPage(props: { params: Promise<{ lang: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value || cookieStore.get('__Secure-uid')?.value;
  
  const params = await props.params;
  const lang = params.lang || 'en';

  if (!token) {
    redirect(`/${lang}/login?redirectUrl=/${lang}/my-offers`);
  }

  return (
    <div className="bg-background text-foreground transition-theme">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <Suspense fallback={<MyOffersSkeleton />}>
            <MyOffersContent lang={lang} token={token} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function MyOffersSkeleton() {
  return (
    <>
      <PageHeader title="My Offers & Inquiries" backText="Back" />
      <div className="w-full mt-4 bg-card border border-border rounded-2xl h-[600px] animate-pulse"></div>
    </>
  )
}

async function MyOffersContent({ lang, token }: { lang: string, token: string }) {
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

  const [buyerProductRes, sellerProductRes, freightInquiries] = await Promise.all([
    tradingService.getInquiryList('/trading-inquiry/for-user?type=BUYER', token, lang),
    tradingService.getInquiryList('/trading-inquiry/for-user?type=SELLER', token, lang),
    tradingService.getInquiryList('/freight-inquiry/for-user', token, lang),
  ]);

  // Combine product inquiries, deduplicate by ID, and sort by date descending
  const seenIds = new Set<string>();
  const rawProductInquiries: any[] = [];
  for (const item of [...buyerProductRes, ...sellerProductRes]) {
    const id = item?.id || item?._id;
    if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }
    rawProductInquiries.push(item);
  }
  rawProductInquiries.sort((a, b) => {
    const dateA = new Date(a?.created_at || a?.createdAt || 0).getTime();
    const dateB = new Date(b?.created_at || b?.createdAt || 0).getTime();
    return dateB - dateA;
  });

  // Extract only needed fields for list and initial details
  const sanitizeInquiry = (item: any) => {
    if (!item) return null;
    return {
      id: item.id || item._id,
      _id: item.id || item._id,
      product: item.product ? { name: item.product.name, country: item.product.country ? { name: item.product.country.name } : undefined } : undefined,
      product_name: item.product_name,
      commodity: item.commodity ? { name: item.commodity.name } : undefined,
      commodity_name: item.commodity_name,
      crop_name: item.crop_name,
      variety: item.variety,
      title: item.title,
      name: item.name,
      inquiry_title: item.inquiry_title,
      status: item.status,
      status_text: item.status_text,
      inquiry_status: item.inquiry_status,
      state: item.state,
      type: item.type,
      inquiry_type: item.inquiry_type,
      loading_port: item.loading_port,
      pol: item.pol,
      port_of_loading: item.port_of_loading,
      discharge_port: item.discharge_port,
      pod: item.pod,
      destination_port: item.destination_port,
      created_at: item.created_at,
      createdAt: item.createdAt,
      date: item.date,
      created_on: item.created_on,
      updated_at: item.updated_at,
      shipment_start_date: item.shipment_start_date,
      shipment_end_date: item.shipment_end_date,
      message_indication: item.message_indication,
      has_unread_messages: item.has_unread_messages,
      unread: item.unread,
      is_unread: item.is_unread,
      quantity: item.quantity,
      qty: item.qty,
      quantity_unit: item.quantity_unit,
      unit: item.unit,
      quantity_type: item.quantity_type,
      country: item.country ? (typeof item.country === 'string' ? item.country : { name: item.country.name }) : undefined,
      origin: item.origin,
      shipment_term: item.shipment_term,
      incoterm: item.incoterm,
      shipping_term: item.shipping_term,
      delivery_term: item.delivery_term,
      packaging: item.packaging,
      packing: item.packing,
      packaging_type: item.packaging_type,
      packing_type: item.packing_type,
      target_price: item.target_price,
      price: item.price,
      market_range: item.market_range,
      container_type: item.container_type,
      shipping_container: item.shipping_container ? (typeof item.shipping_container === 'string' ? item.shipping_container : { name: item.shipping_container.name }) : undefined,
      ship_by: item.ship_by,
      shipment_period: item.shipment_period,
      delivery_period: item.delivery_period,
      fcl: item.fcl,
      container_count: item.container_count,
      container_fcl: item.container_fcl,
      payment_term: item.payment_term,
      payment_terms: item.payment_terms,
      payment_type: item.payment_type,
      description: item.description,
      desc: item.desc,
      note: item.note,
    };
  };

  const productInquiries = rawProductInquiries.map(sanitizeInquiry).filter(Boolean);
  const sanitizedFreightInquiries = Array.isArray(freightInquiries) ? freightInquiries.map(sanitizeInquiry).filter(Boolean) : [];

  return (
    <>
      <PageHeader title={pageTitle} backText={common.back} />
      <div>
        <MyInquiriesClient 
          lang={lang} 
          productInquiries={productInquiries} 
          freightInquiries={sanitizedFreightInquiries}
          dict={dict}
          token={token}
          userProfile={profileData ? {
            name: profileData.name,
            profile_image: profileData.profile_image || profileData.profile_picture || profileData.avatar,
          } : undefined}
        />
      </div>
    </>
  );
}

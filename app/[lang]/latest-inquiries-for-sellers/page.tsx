import type { Metadata } from 'next'
import { OffersPageTemplate } from '@/components/shared/OffersPageTemplate'
import { getDictionary } from '@/app/[lang]/dictionaries';

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'latest_inquiries',
    pathname: 'latest-inquiries-for-sellers',
    lang,
  });
}

export const revalidate = 30;

export default async function LatestInquiriesForSellersPage(props: { 
  params: Promise<{ lang: string }>,
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const lang = params.lang || 'en'
  
  const searchStr = typeof searchParams.search === 'string' ? searchParams.search : undefined;
  const categoryStr = typeof searchParams.category === 'string' ? searchParams.category : undefined;

  const dict = await getDictionary(lang);

  return (
    <OffersPageTemplate 
      lang={lang} 
      searchParams={{ search: searchStr, category: categoryStr }}
      offerType="SELLER"
      pageTitle={dict.common?.latest_inquiries_for_seller || "Latest Inquiries for Seller"}
    />
  )
}

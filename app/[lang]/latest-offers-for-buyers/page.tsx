import type { Metadata } from 'next'
import { OffersPageTemplate } from '@/components/shared/OffersPageTemplate'

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'latest_offers',
    pathname: 'latest-offers-for-buyers',
    lang,
  });
}

export default async function LatestOffersPage(props: { 
  params: Promise<{ lang: string }>,
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const lang = params.lang || 'en'
  
  const searchStr = typeof searchParams.search === 'string' ? searchParams.search : undefined;
  const categoryStr = typeof searchParams.category === 'string' ? searchParams.category : undefined;

  return (
    <OffersPageTemplate 
      lang={lang} 
      searchParams={{ search: searchStr, category: categoryStr }}
      offerType="BUYER"
      pageTitle="Latest Offers for Buyer"
    />
  )
}

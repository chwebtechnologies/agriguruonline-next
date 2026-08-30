import type { Metadata } from 'next'
import { OffersPageTemplate } from '@/components/shared/OffersPageTemplate'

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = params?.lang || 'en'

  const title = `Latest Offers for Buyers`
  const fullTitle = `${title} | AgriGuru Online`
  const description = `Explore the latest selling offers from global suppliers on AgriGuru Online.`

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const pageUrl = `${siteUrl}/${lang}/latest-offers-for-buyers`

  return {
    title,
    description,
    openGraph: {
      title: fullTitle,
      description,
      url: pageUrl,
      siteName: 'AgriGuru Online',
      locale: lang,
      type: 'website',
    },
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${siteUrl}/en/latest-offers-for-buyers`,
        ar: `${siteUrl}/ar/latest-offers-for-buyers`,
        fr: `${siteUrl}/fr/latest-offers-for-buyers`,
        zh: `${siteUrl}/zh/latest-offers-for-buyers`,
        'x-default': `${siteUrl}/en/latest-offers-for-buyers`,
      }
    }
  }
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

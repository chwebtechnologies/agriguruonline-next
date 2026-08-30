import type { Metadata } from 'next'
import { OffersPageTemplate } from '@/components/shared/OffersPageTemplate'

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = params?.lang || 'en'

  const title = `Latest Inquiries for Sellers`
  const fullTitle = `${title} | AgriGuru Online`
  const description = `Explore the latest buying inquiries from global buyers on AgriGuru Online.`

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const pageUrl = `${siteUrl}/${lang}/latest-inquiries-for-sellers`

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
        en: `${siteUrl}/en/latest-inquiries-for-sellers`,
        ar: `${siteUrl}/ar/latest-inquiries-for-sellers`,
        fr: `${siteUrl}/fr/latest-inquiries-for-sellers`,
        zh: `${siteUrl}/zh/latest-inquiries-for-sellers`,
        'x-default': `${siteUrl}/en/latest-inquiries-for-sellers`,
      }
    }
  }
}

export default async function LatestInquiriesForSellersPage(props: { 
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
      offerType="SELLER"
      pageTitle="Latest Inquiries for Seller"
    />
  )
}

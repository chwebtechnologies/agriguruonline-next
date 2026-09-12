import { PageHeader } from '@/components/ui/PageHeader'
import MarketUpdateCard from '@/components/marketUpdates/MarketUpdateCard'
import { Pagination } from '@/components/ui/Pagination'
import ListingFilters from '@/components/shared/ListingFilters'
import type { Metadata } from 'next'
import type { MarketUpdatesResponse } from '@/types/marketUpdates'
import { cache, Suspense } from 'react'
import { getAssetsUrl } from '@/lib/api-utils';
import { cmsService } from '@/lib/api/cms.service';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

export const revalidate = 60;

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'market_updates',
    pathname: 'market-updates',
    lang,
  });
}

/* ---------- Main page component ---------- */
export default async function MarketUpdatesPage(props: {
  params: Promise<{ lang: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const lang = params.lang || 'en'
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1
  const currentPage = !isNaN(page) && page > 0 ? page : 1
  const limit = 18 // Used 18 as per API limit in requirement
  const searchQuery = typeof searchParams.search === 'string' ? searchParams.search : undefined

  const updatesData = await cmsService.getMarketUpdates(lang, currentPage, limit, searchQuery)
  const flyers = updatesData?.data?.flyers || []
  const totalItems = updatesData?.data?.total || 0
  const totalPages = Math.ceil(totalItems / limit)
  const assetsUrl = getAssetsUrl()

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Market Updates" backText="Back" />
          <ListingFilters categories={[]} />

          {flyers.length === 0 ? (
            <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
                <i className="fa-solid fa-chart-line text-2xl"></i>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">No Market Updates Found</h2>
              <p className="text-foreground/80 max-w-md mx-auto">
                We couldn&apos;t find any market updates at the moment. Please check back later.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
                {flyers.map((flyer, index) => (
                  <MarketUpdateCard priority={index < 4} key={flyer.id} update={flyer} lang={lang} />
                ))}
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={`/${lang}/market-updates`} />

              {/* JSON-LD Schema */}
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "ItemList",
                    "itemListElement": flyers.map((flyer, index) => ({
                      "@type": "ListItem",
                      "position": index + 1,
                      "item": {
                        "@type": "Article",
                        "headline": flyer.translations?.find((t: any) => t.lang_code === lang)?.title || flyer.title || flyer.slug,
                        "image": [
                          flyer.thumbnail?.startsWith('http')
                            ? flyer.thumbnail
                            : flyer.thumbnail
                              ? `${assetsUrl}/${flyer.thumbnail}`
                              : 'https://agriguruonline.com/logo.png'
                        ],
                        "url": `https://agriguruonline.com/${lang}/market-updates/${flyer.slug}`
                      }
                    }))
                  }).replace(/</g, '\\u003c')
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

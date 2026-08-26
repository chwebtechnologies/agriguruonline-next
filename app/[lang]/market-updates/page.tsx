import { PageHeader } from '@/components/ui/PageHeader'
import MarketUpdateCard from '@/components/marketUpdates/MarketUpdateCard'
import { Pagination } from '@/components/ui/Pagination'
import ListingFilters from '@/components/shared/ListingFilters'
import type { Metadata } from 'next'
import type { MarketUpdatesResponse } from '@/types/marketUpdates'
import { cache, Suspense } from 'react'
import { getCmsApiUrl, getAssetsUrl } from '@/lib/api-utils';

export const metadata: Metadata = {
  title: 'Market Updates - AgriGuru Online',
  description: 'Stay updated with the latest market flyers and updates in the agricultural industry.',
  openGraph: {
    title: 'Market Updates - AgriGuru Online',
    description: 'Stay updated with the latest market flyers and updates in the agricultural industry.',
    type: 'website',
    images: ['https://agriguruonline.com/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Updates - AgriGuru Online',
    description: 'Stay updated with the latest market flyers and updates in the agricultural industry.',
    images: ['https://agriguruonline.com/logo.png'],
  }
}



const getMarketUpdates = cache(async (lang: string, page: number, limit: number, search?: string): Promise<MarketUpdatesResponse | null> => {
  const cmsApiUrl = getCmsApiUrl(); const url = `${cmsApiUrl}/flyer?is_active=true&lang_code=${lang}&source=web&page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }
    })

    if (!res.ok) {
      return null
    }

    const json = await res.json()
    return json
  } catch (error) {
    console.error('Failed to fetch market updates:', error)
    return null
  }
})

/* ---------- Skeleton shown during Suspense ---------- */
function MarketUpdatesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs animate-pulse"
        >
          {/* Changed aspect ratio to 794/1120 for Market Updates */}
          <div className="w-full aspect-[794/1120] bg-muted border-b border-border"></div>
          <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
            <div className="w-full h-5 rounded bg-muted mb-2"></div>
            <div className="w-3/4 h-5 rounded bg-muted mb-4"></div>
            <div className="w-full h-3 rounded bg-muted mb-1.5"></div>
            <div className="w-full h-3 rounded bg-muted mb-1.5"></div>
            <div className="w-4/5 h-3 rounded bg-muted mb-4"></div>
            <div className="flex-grow"></div>
            <div className="flex items-center justify-between mt-auto border-t border-border pt-3">
              <div className="w-20 h-4 rounded bg-muted"></div>
              <div className="w-6 h-6 rounded-full bg-muted"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Async component that fetches and renders market updates grid ---------- */
async function MarketUpdatesGrid({ lang, page, limit, search }: {
  lang: string
  page: number
  limit: number
  search?: string
}) {
  const updatesData = await getMarketUpdates(lang, page, limit, search)
  const flyers = updatesData?.data?.flyers || []
  const totalItems = updatesData?.data?.total || 0
  const totalPages = Math.ceil(totalItems / limit)

  if (flyers.length === 0) {
    return (
      <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/60">
          <i className="fa-solid fa-chart-line text-2xl"></i>
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No Market Updates Found</h3>
        <p className="text-foreground/70 max-w-md mx-auto">
          We couldn&apos;t find any market updates at the moment. Please check back later.
        </p>
      </div>
    )
  }

  const assetsUrl = getAssetsUrl(); return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
        {flyers.map((flyer, index) => (
          <MarketUpdateCard priority={index < 4} key={flyer.id} update={flyer} lang={lang} />
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} baseUrl={`/${lang}/market-updates`} />

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
                "headline": flyer.translations?.[0]?.title || flyer.title || flyer.slug,
                "image": [
                  flyer.thumbnail.startsWith('http')
                    ? flyer.thumbnail
                    : `${assetsUrl}/${flyer.thumbnail}`
                ],
                "url": `https://agriguruonline.com/${lang}/market-updates/${flyer.slug}`
              }
            }))
          }).replace(/</g, '\\u003c')
        }}
      />
    </>
  )
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

  // Unique key forces Suspense to re-mount and show skeleton when filters change
  const suspenseKey = `market-updates-${currentPage}-${searchQuery || ''}`

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Market Updates" backText="Back" />
          <ListingFilters categories={[]} />

          <Suspense key={suspenseKey} fallback={<MarketUpdatesGridSkeleton />}>
            <MarketUpdatesGrid lang={lang} page={currentPage} limit={limit} search={searchQuery} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

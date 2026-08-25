import { PageHeader } from '@/components/ui/PageHeader'
import EventCard from '@/components/events/EventCard'
import { Pagination } from '@/components/ui/Pagination'
import ListingFilters from '@/components/ui/ListingFilters'
import type { Metadata } from 'next'
import type { EventsResponse } from '@/types/events'
import { getCategories } from '@/lib/category'
import { cache, Suspense } from 'react'
import { getTradingApiUrl, getCmsApiUrl } from '@/lib/api-utils';

export const metadata: Metadata = {
  title: 'Latest Events - AgriGuru Online',
  description: 'Discover the latest agricultural events, exhibitions, and conferences.',
  openGraph: {
    title: 'Latest Events - AgriGuru Online',
    description: 'Discover the latest agricultural events, exhibitions, and conferences.',
    type: 'website',
    images: ['https://agriguru.online/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Latest Events - AgriGuru Online',
    description: 'Discover the latest agricultural events, exhibitions, and conferences.',
    images: ['https://agriguru.online/logo.png'],
  }
}



const getLatestEvents = cache(async (lang: string, page: number, limit: number, search?: string, categoryId?: string): Promise<EventsResponse | null> => {
  const cmsApiUrl = getCmsApiUrl();const url = `${cmsApiUrl}/latestevents?is_active=true&lang_code=${lang}&source=web&page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}${categoryId ? `&category_id=${categoryId}` : ''}`

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
    console.error('Failed to fetch latest events:', error)
    return null
  }
})

/* ---------- Skeleton shown during Suspense ---------- */
function EventsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
      {[...Array(12)].map((_, i) => (
        <div 
          key={i} 
          className="flex flex-col rounded-xl bg-background border border-ag-header-border overflow-hidden h-full shadow-sm animate-pulse"
        >
          <div className="w-full aspect-[3/2] bg-ag-header-border/50 border-b border-ag-header-border"></div>
          <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded bg-ag-header-border/50 mr-2"></div>
                <div className="w-32 h-3 rounded bg-ag-header-border/50"></div>
              </div>
              <div className="w-16 h-4 rounded-full bg-ag-header-border/50"></div>
            </div>
            <div className="w-full h-5 rounded bg-ag-header-border/50 mb-2"></div>
            <div className="w-3/4 h-5 rounded bg-ag-header-border/50 mb-4"></div>
            <div className="flex-grow"></div>
            <div className="flex items-center justify-between mt-auto border-t border-ag-header-border pt-3">
              <div className="w-20 h-4 rounded bg-ag-header-border/50"></div>
              <div className="w-6 h-6 rounded-full bg-ag-header-border/50"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Async component that fetches and renders events grid ---------- */
async function EventsGrid({ lang, page, limit, search, categoryId }: {
  lang: string
  page: number
  limit: number
  search?: string
  categoryId?: string
}) {
  const eventsData = await getLatestEvents(lang, page, limit, search, categoryId)
  const eventsList = eventsData?.data?.events || []
  const totalItems = eventsData?.data?.total || 0
  const totalPages = Math.ceil(totalItems / limit)

  if (eventsList.length === 0) {
    return (
      <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-ag-header-border mt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-ag-header-border mb-4 text-foreground/60">
          <i className="fa-regular fa-calendar-days text-2xl"></i>
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No Events Found</h3>
        <p className="text-foreground/70 max-w-md mx-auto">
          We couldn&apos;t find any events at the moment. Please check back later.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
        {eventsList.map((eventItem, index) => (
          <EventCard priority={index < 4} key={eventItem.id} event={eventItem} lang={lang} />
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} baseUrl={`/${lang}/events`} />

      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": eventsList.map((eventItem, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "item": {
                "@type": "Event",
                "name": eventItem.title,
                "startDate": eventItem.start_date,
                "endDate": eventItem.end_date,
                "eventStatus": `https://schema.org/Event${eventItem.status === 'UPCOMING' ? 'Scheduled' : eventItem.status === 'PAST' ? 'MovedOnline' : 'Scheduled'}`,
                "image": [
                  eventItem.thumbnail.startsWith('http') 
                    ? eventItem.thumbnail 
                    : `https://assets.agriguruonline.cloud/${eventItem.thumbnail}`
                ],
                "url": `https://agriguru.online/${lang}/events/${eventItem.slug}`
              }
            }))
          }).replace(/</g, '\\u003c')
        }}
      />
    </>
  )
}

/* ---------- Main page component ---------- */
export default async function LatestEventsPage(props: { 
  params: Promise<{ lang: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  
  const lang = params.lang || 'en'
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1
  const currentPage = !isNaN(page) && page > 0 ? page : 1
  const limit = 12
  const searchQuery = typeof searchParams.search === 'string' ? searchParams.search : undefined
  const categorySlug = typeof searchParams.category === 'string' ? searchParams.category : undefined
  
  const tradingApiUrl = getTradingApiUrl();const apiCategories = await getCategories(lang, {
    apiUrl: `${tradingApiUrl.replace(/\/$/, '')}/category`,
    stale: 300,
    revalidate: 3600,
    expire: 86400
  })

  // Resolve slug to ID server-side so ID never leaks to the client
  const matchedCategory = categorySlug
    ? apiCategories.find(cat => cat.slug === categorySlug)
    : undefined
  const categoryId = matchedCategory?.id

  const categoryOptions = apiCategories
    .filter(cat => cat.is_active !== false)
    .map(cat => {
      const translation = cat.translations?.find(t => t.lang_code === lang)
      return { slug: cat.slug, name: translation ? translation.name : cat.name }
    })

  // Unique key forces Suspense to re-mount and show skeleton when filters change
  const suspenseKey = `events-${currentPage}-${searchQuery || ''}-${categorySlug || ''}`

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Latest Events" backText="Back" />
          <ListingFilters categories={categoryOptions} />
          
          <Suspense key={suspenseKey} fallback={<EventsGridSkeleton />}>
            <EventsGrid lang={lang} page={currentPage} limit={limit} search={searchQuery} categoryId={categoryId} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

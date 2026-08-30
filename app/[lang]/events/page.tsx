import { PageHeader } from '@/components/ui/PageHeader'
import EventCard from '@/components/events/EventCard'
import { Pagination } from '@/components/ui/Pagination'
import ListingFilters from '@/components/shared/ListingFilters'
import type { Metadata } from 'next'
import type { EventsResponse } from '@/types/events'
import { getCategories } from '@/lib/category'
import { cache, Suspense } from 'react'
import { getTradingApiUrl, getCmsApiUrl } from '@/lib/api-utils';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = params.lang || 'en';
  const title = 'Global Agriculture Events, Expos & Conferences';
  const fullTitle = 'Global Agriculture Events, Expos & Conferences | AgriGuru Online';
  const description = 'Discover upcoming international agricultural exhibitions, commodity trade fairs, expos, and networking conferences worldwide on AgriGuru Online.';

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com';
  const pageUrl = `${siteUrl}/${lang}/events`;

  return {
    title,
    description,
    keywords: [
      'Agriculture Events',
      'Commodity Trade Expos',
      'Agri Trade Shows',
      'Global Farming Conferences',
      'AgriGuru Online',
      'International Agri Expos'
    ],
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: pageUrl,
      siteName: 'AgriGuru Online',
      images: [
        {
          url: `${siteUrl}/logo.png`,
          width: 1200,
          height: 630,
          alt: 'Global Agriculture Events',
        },
      ],
      locale: lang,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [`${siteUrl}/logo.png`],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${siteUrl}/en/events`,
        ar: `${siteUrl}/ar/events`,
        fr: `${siteUrl}/fr/events`,
        zh: `${siteUrl}/zh/events`,
        'x-default': `${siteUrl}/en/events`,
      }
    }
  };
}



const getLatestEvents = cache(async (lang: string, page: number, limit: number, search?: string, categoryId?: string): Promise<EventsResponse | null> => {
  const cmsApiUrl = getCmsApiUrl(); const url = `${cmsApiUrl}/latestevents?is_active=true&lang_code=${lang}&source=web&page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}${categoryId ? `&category_id=${categoryId}` : ''}`

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }
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

  const tradingApiUrl = getTradingApiUrl();
  const apiCategories = await getCategories(lang, {
    apiUrl: `${tradingApiUrl.replace(/\/$/, '')}/category`,
    stale: 300,
    revalidate: 0,
    expire: 86400
  })

  // Resolve slug to ID server-side so ID never leaks to the client
  const matchedCategory = categorySlug
    ? apiCategories.find(cat => cat.slug === categorySlug)
    : undefined
  const categoryId = matchedCategory?.id

  const eventsData = await getLatestEvents(lang, currentPage, limit, searchQuery, categoryId)
  const eventsList = eventsData?.data?.events || []
  const totalItems = eventsData?.data?.total || 0
  const totalPages = Math.ceil(totalItems / limit)

  const categoryOptions = apiCategories
    .filter(cat => cat.is_active !== false)
    .map(cat => {
      const translation = cat.translations?.find(t => t.lang_code === lang)
      return { slug: cat.slug, name: translation ? translation.name : cat.name }
    })

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Latest Events" backText="Back" />
          <ListingFilters categories={categoryOptions} />

          {eventsList.length === 0 ? (
            <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
                <i className="fa-regular fa-calendar-days text-2xl"></i>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">No Events Found</h2>
              <p className="text-foreground/80 max-w-md mx-auto">
                We couldn&apos;t find any events at the moment. Please check back later.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
                {eventsList.map((eventItem, index) => (
                  <EventCard priority={index < 4} key={eventItem.id} event={eventItem} lang={lang} />
                ))}
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={`/${lang}/events`} />

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
                          eventItem.thumbnail?.startsWith('http')
                            ? eventItem.thumbnail
                            : eventItem.thumbnail
                              ? `https://assets.agriguruonline.com/${eventItem.thumbnail}`
                              : 'https://agriguruonline.com/logo.png'
                        ],
                        "url": `https://agriguruonline.com/${lang}/events/${eventItem.slug}`
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

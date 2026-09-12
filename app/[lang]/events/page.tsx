import { PageHeader } from '@/components/ui/PageHeader'
import EventCard from '@/components/events/EventCard'
import { Pagination } from '@/components/ui/Pagination'
import ListingFilters from '@/components/shared/ListingFilters'
import type { Metadata } from 'next'
import type { EventsResponse } from '@/types/events'
import { getCategories } from '@/lib/category'
import { cache, Suspense } from 'react'
import { getDictionary } from '@/app/[lang]/dictionaries'
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
    pageKey: 'events',
    pathname: 'events',
    lang,
  });
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
  const dict = await getDictionary(lang);

  const apiCategories = await getCategories(lang);

  // Resolve slug to ID server-side so ID never leaks to the client
  const matchedCategory = categorySlug
    ? apiCategories.find(cat => cat.slug === categorySlug)
    : undefined
  const categoryId = matchedCategory?.id

  const eventsData = await cmsService.getLatestEvents({ lang, page: currentPage, limit, search: searchQuery, categoryId })
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
          <PageHeader title={dict.header?.events || "Latest Events"} backText={dict.common?.back || "Back"} />
          <ListingFilters categories={categoryOptions} />

          {eventsList.length === 0 ? (
            <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
                <i className="fa-regular fa-calendar-days text-2xl"></i>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{dict.common?.no_search_results_found_for ? dict.common.no_search_results_found_for.replace('for', '').trim() : "No Events Found"}</h2>
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
                  __html: JSON.stringify([
                    {
                      "@context": "https://schema.org",
                      "@type": "BreadcrumbList",
                      "itemListElement": [
                        {
                          "@type": "ListItem",
                          "position": 1,
                          "name": dict.navigation?.home || "Home",
                          "item": `https://agriguruonline.com/${lang}`
                        },
                        {
                          "@type": "ListItem",
                          "position": 2,
                          "name": dict.header?.events || "Events",
                          "item": `https://agriguruonline.com/${lang}/events`
                        },
                        ...(matchedCategory ? [{
                          "@type": "ListItem",
                          "position": 3,
                          "name": matchedCategory.translations?.find((t: any) => t.lang_code === lang)?.name || matchedCategory.name,
                          "item": `https://agriguruonline.com/${lang}/events?category=${matchedCategory.slug}`
                        }] : [])
                      ]
                    },
                    {
                    "@context": "https://schema.org",
                    "@type": "ItemList",
                    "itemListElement": eventsList.map((eventItem, index) => ({
                      "@type": "ListItem",
                      "position": index + 1,
                      "item": {
                        "@type": "Event",
                        "name": eventItem.translations?.find((t: any) => t.lang_code === lang)?.title || eventItem.title,
                        "description": eventItem.translations?.find((t: any) => t.lang_code === lang)?.description || "",
                        "startDate": eventItem.start_date,
                        "endDate": eventItem.end_date,
                        "eventStatus": `https://schema.org/Event${eventItem.status === 'UPCOMING' ? 'Scheduled' : eventItem.status === 'PAST' ? 'MovedOnline' : 'Scheduled'}`,
                        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
                        "location": {
                          "@type": "Place",
                          "name": (eventItem.translations?.find((t: any) => t.lang_code === lang)?.location || eventItem.location) || "Venue to be announced",
                          "address": {
                            "@type": "PostalAddress",
                            "addressLocality": (eventItem.translations?.find((t: any) => t.lang_code === lang)?.location || eventItem.location) || "TBA"
                          }
                        },
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
                  }]).replace(/</g, '\\u003c')
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { ShareButton } from '@/components/ui/ShareButton'
import { getCmsApiUrl, getAssetsUrl } from '@/lib/api-utils'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import type { EventDetail, EventItem, EventsResponse, EventDetailResponse } from '@/types/events'
import { cache } from 'react'

const getEventDetail = cache(async (slug: string, lang: string): Promise<EventDetail | null> => {
  const cmsApiUrl = getCmsApiUrl()
  const url = `${cmsApiUrl}/latestevents/${slug}?lang_code=${lang}&source=web`

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }
    })

    if (!res.ok) {
      return null
    }

    const json: EventDetailResponse = await res.json()
    if (json.success && json.data) {
      return json.data
    }
    return null
  } catch (error) {
    console.error('Failed to fetch event detail:', error)
    return null
  }
})

const getOtherEvents = cache(async (lang: string, limit = 6): Promise<EventItem[]> => {
  const cmsApiUrl = getCmsApiUrl()
  const url = `${cmsApiUrl}/latestevents?is_active=true&lang_code=${lang}&source=web&page=1&limit=${limit}`

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }
    })

    if (!res.ok) {
      return []
    }

    const json: EventsResponse = await res.json()
    return json?.data?.events || []
  } catch (error) {
    console.error('Failed to fetch other events:', error)
    return []
  }
})

export async function generateStaticParams() {
  const languages = ['en', 'ar', 'zh', 'fr']
  const params: Array<{ lang: string; slug: string }> = []

  try {
    const cmsApiUrl = getCmsApiUrl()
    const res = await fetch(`${cmsApiUrl}/latestevents?is_active=true&source=web&page=1&limit=50`, {
      next: { revalidate: 60 }
    })
    if (res.ok) {
      const json: EventsResponse = await res.json()
      const eventsList = json?.data?.events || []
      for (const lang of languages) {
        for (const event of eventsList) {
          if (event.slug) {
            params.push({ lang, slug: event.slug })
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to generate static params for events detail:', error)
  }

  return params
}

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params
  const { lang, slug } = params

  const decodedSlug = decodeURIComponent(slug)
  const event = await getEventDetail(decodedSlug, lang)

  if (!event) {
    return {
      title: 'Event Not Found',
      description: 'The requested event could not be found on AgriGuru Online.',
    }
  }

  const translation = event.translations?.find(t => t.lang_code === lang)
  const title = translation?.title || event.title || 'AgriGuru Online Event'

  const rawDescription = translation?.description || event.description || ''
  const cleanDescription = event.meta_description
    || rawDescription.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160)

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`

  const sourceImage = event.image || event.thumbnail
  const imagePath = sourceImage?.startsWith('/') ? sourceImage.slice(1) : sourceImage
  const imageUrl = sourceImage?.startsWith('http')
    ? sourceImage
    : (sourceImage ? `${imageBaseUrl}${imagePath}` : 'https://agriguruonline.com/logo.png')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const eventUrl = `${siteUrl}/${lang}/events/${slug}`

  const fullTitle = `${title} | AgriGuru Online`

  return {
    title,
    description: cleanDescription,
    keywords: event.meta_keywords
      ? event.meta_keywords.split(',').map(k => k.trim())
      : [
          title,
          'Agriculture Events',
          'Commodity Conferences',
          'Agri Expos',
          event.location || 'Global Trade Event',
          'AgriGuru Online'
        ],
    authors: [{ name: event.source || 'AgriGuru Online', url: event.source_url || siteUrl }],
    creator: 'AgriGuru Online',
    publisher: 'AgriGuru Online',
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: fullTitle,
      description: cleanDescription,
      url: eventUrl,
      siteName: 'AgriGuru Online',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: lang,
      type: 'article',
      publishedTime: event.posting_date || event.created_at,
      modifiedTime: event.created_at || event.posting_date,
      authors: [event.source || 'AgriGuru Online'],
      section: event.categories?.[0]?.name || 'Agriculture Events',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: cleanDescription,
      images: [imageUrl],
      creator: '@AgriGuruOnline',
      site: '@AgriGuruOnline',
    },
    alternates: {
      canonical: eventUrl,
      languages: {
        en: `${siteUrl}/en/events/${slug}`,
        ar: `${siteUrl}/ar/events/${slug}`,
        fr: `${siteUrl}/fr/events/${slug}`,
        zh: `${siteUrl}/zh/events/${slug}`,
        'x-default': `${siteUrl}/en/events/${slug}`,
      }
    }
  }
}

// Editorial content formatter for rich styling
function formatEditorialContent(htmlContent: string): string {
  if (!htmlContent) return ''

  let formatted = htmlContent
    .replace(/<p>\s*(<br\s*\/?>|&nbsp;|\s)*\s*<\/p>/gi, '')
    .replace(/(<br\s*\/?>\s*){2,}/gi, '<br />')

  // Format "Event Highlights:"
  formatted = formatted.replace(
    /<p>(\s*<strong>)?(\s*Event Highlights:)(\s*<\/strong>)?([\s\S]*?)<\/p>/gi,
    `<div class="editorial-callout callout-highlights">
      <div class="callout-label"><i class="fa-solid fa-star"></i> Event Highlights</div>
      <p class="callout-text">$4</p>
    </div>`
  )

  // Format "Who Should Attend:"
  formatted = formatted.replace(
    /<p>(\s*<strong>)?(\s*Who Should Attend:)(\s*<\/strong>)?([\s\S]*?)<\/p>/gi,
    `<div class="editorial-callout callout-attendees">
      <div class="callout-label"><i class="fa-solid fa-users"></i> Who Should Attend</div>
      <p class="callout-text">$4</p>
    </div>`
  )

  // Format "Key Focus:"
  formatted = formatted.replace(
    /<p>(\s*<strong>)?(\s*Key Focus:)(\s*<\/strong>)?([\s\S]*?)<\/p>/gi,
    `<div class="editorial-callout callout-focus">
      <div class="callout-label"><i class="fa-solid fa-bullseye"></i> Key Focus</div>
      <p class="callout-text">$4</p>
    </div>`
  )

  return formatted.trim()
}

export default async function EventDetailPage(props: { params: Promise<{ lang: string; slug: string }> }) {
  const params = await props.params
  const { lang, slug } = params

  const [event, allLatestEvents] = await Promise.all([
    getEventDetail(slug, lang),
    getOtherEvents(lang, 6)
  ])

  if (!event) {
    return (
      <div className="bg-background text-foreground min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-8 max-w-md bg-card rounded-2xl border border-border shadow-xs">
          <div className="w-16 h-16 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center mx-auto mb-4 text-2xl">
            <i className="fa-regular fa-calendar-xmark"></i>
          </div>
          <h1 className="text-2xl font-bold mb-2">Event Not Found</h1>
          <p className="text-foreground/80 mb-6 text-sm">
            The event you are looking for might have been moved or concluded.
          </p>
          <Link
            href={`/${lang}/events`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 text-white font-bold text-sm hover:bg-blue-800 transition-colors"
          >
            <i className="fa-solid fa-arrow-left text-xs"></i>
            Back to All Events
          </Link>
        </div>
      </div>
    )
  }

  const translation = event.translations?.find(t => t.lang_code === lang)
  const title = translation?.title || event.title
  const rawContent = translation?.description || event.description || ''
  const formattedContent = formatEditorialContent(rawContent)
  const location = translation?.location || event.location || 'A-1107, Mondeal Heights'
  const sourceName = translation?.source || event.source || 'AgriGuru Online'

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  const sourceImage = event.image || event.thumbnail
  const imagePath = sourceImage?.startsWith('/') ? sourceImage.slice(1) : sourceImage
  const imageUrl = sourceImage?.startsWith('http')
    ? sourceImage
    : (sourceImage ? `${imageBaseUrl}${imagePath}` : 'https://agriguruonline.com/logo.png')

  // Date formatting
  const startDateObj = new Date(event.start_date)
  const endDateObj = new Date(event.end_date)
  const isSingleDay = startDateObj.toDateString() === endDateObj.toDateString()

  const dateLocale = lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-CN' : 'en-US'

  const startDateFormatted = startDateObj.toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  const endDateFormatted = endDateObj.toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  const dateRangeDisplay = isSingleDay ? startDateFormatted : `${startDateFormatted} – ${endDateFormatted}`

  // Status badge styling
  const statusUpper = (event.status || 'UPCOMING').toUpperCase()
  const statusColorClass =
    statusUpper === 'UPCOMING'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : statusUpper === 'ONGOING'
        ? 'bg-brand-blue/15 text-brand-blue border-brand-blue/30'
        : 'bg-muted text-foreground/80 border-border'

  // Filter other events to exclude current event
  const otherEventsList = allLatestEvents.filter(item => item.slug !== slug).slice(0, 5)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const eventUrl = `${siteUrl}/${lang}/events/${slug}`
  const plainText = rawContent.replace(/<[^>]+>/g, '').trim()

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-8">
          {/* Header */}
          <PageHeader title="Events" backText="Back" backHref={`/${lang}/events`} />

          {/* 50-50 Split Layout using CSS Grid Areas */}
          <div className="mt-3 w-full max-w-full overflow-hidden">
            {/* Screen Reader Only H1 to enforce descending heading hierarchy for Accessibility & SEO */}
            <h1 className="sr-only">{title}</h1>
            <div className="responsive-layout-grid gap-y-0 md:gap-y-6 md:gap-x-6 lg:gap-x-8 items-start w-full max-w-full">
              
              {/* FEATURED IMAGE & METADATA BAR */}
              <div className="grid-area-image w-full max-w-full min-w-0 space-y-4">
                <div className="bg-card rounded-t-2xl rounded-b-none md:rounded-2xl border border-border border-b-0 md:border-b p-2 sm:p-2.5 shadow-xs overflow-hidden">
                  <div className="relative w-full aspect-[3/2] rounded-t-xl rounded-b-none overflow-hidden bg-muted/40">
                    <ImageWithSkeleton
                      src={imageUrl}
                      alt={title}
                      title={title}
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                    />

                    {/* Status Badge Top-Left */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border backdrop-blur-md shadow-xs flex items-center gap-1.5 ${statusColorClass}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                        {statusUpper}
                      </span>
                    </div>

                    {/* Location Badge Top-Right (if available) */}
                    {location && (
                      <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 max-w-[55%] truncate pointer-events-none">
                        <i className="fa-solid fa-location-dot text-[10px] text-brand-blue shrink-0"></i>
                        <span className="truncate">{location}</span>
                      </div>
                    )}
                  </div>

                  {/* Below Image: Event Date, Location & Share Button */}
                  <div className="flex items-center justify-between gap-1 sm:gap-3 px-0.5 sm:px-1 pt-2.5 pb-0.5 w-full max-w-full overflow-hidden">
                    <div className="flex items-center gap-1.5 sm:gap-2.5 text-foreground min-w-0 flex-1">
                      <div className="inline-flex items-center gap-1 min-[380px]:gap-1.5 text-[12px] min-[360px]:text-[13px] sm:text-[14px] leading-none shrink-0">
                        <i className="fa-regular fa-calendar-days text-[12.5px] min-[360px]:text-[14px] sm:text-[15px] text-foreground/70 shrink-0"></i>
                        <span className="font-bold text-foreground shrink-0">Event Dates:</span>
                        <time dateTime={event.start_date} className="font-medium text-foreground whitespace-nowrap">
                          {dateRangeDisplay}
                        </time>
                      </div>

                      {location && (
                        <>
                          <span className="text-border hidden md:inline">•</span>
                          <div className="hidden md:inline-flex items-center gap-1.5 text-[13px] sm:text-[14px] font-medium px-2 py-0.5 rounded-md bg-muted text-foreground/80 whitespace-nowrap shrink-0 border border-border/60 leading-none truncate max-w-[200px]">
                            <i className="fa-solid fa-map-pin text-xs text-foreground/75 shrink-0"></i>
                            <span className="truncate">{location}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Share Button */}
                    <ShareButton
                      title={title}
                      url={`/${lang}/events/${slug}`}
                      label="Share"
                      className="inline-flex items-center gap-1 min-[380px]:gap-1.5 text-[12px] min-[360px]:text-[13px] sm:text-[14px] font-bold text-foreground hover:text-brand-blue transition-colors shrink-0 leading-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* OTHER EVENTS SECTION (Mobile: Bottom, Desktop: Under Image) */}
              {otherEventsList.length > 0 && (
                <div className="grid-area-other w-full max-w-full min-w-0 mt-6 md:mt-0 md:h-full md:min-h-[340px]">
                  <div className="bg-card text-card-foreground rounded-2xl border border-border p-3 sm:p-4 md:p-5 shadow-xs space-y-3 sm:space-y-3.5 overflow-hidden flex flex-col md:h-full md:min-h-[340px] md:max-h-[720px]">
                    <div className="flex items-center justify-between pb-2 border-b border-border shrink-0">
                      <h2
                        className="text-[15px] sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
                        style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}
                      >
                        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-muted text-foreground/80 text-xs border border-border/60">
                          <i className="fa-regular fa-calendar-days"></i>
                        </span>
                        Other Events
                      </h2>
                      <Link
                        href={`/${lang}/events`}
                        className="text-xs font-bold text-foreground/80 hover:text-brand-blue hover:underline flex items-center gap-1 transition-colors"
                      >
                        View All
                        <i className="fa-solid fa-chevron-right text-[10px]"></i>
                      </Link>
                    </div>

                    {/* Scrollable list on desktop */}
                    <div className="space-y-2.5 sm:space-y-3 md:flex-1 md:overflow-y-auto md:pr-1 custom-scrollbar min-h-0">
                      {otherEventsList.map((item) => {
                        const itemTranslation = item.translations?.find(t => t.lang_code === lang) || item.translations?.[0]
                        const itemTitle = itemTranslation?.title || item.title || item.slug
                        const itemLocation = itemTranslation?.location || item.location || 'A-1107, Mondeal Heights'
                        const itemImg = item.thumbnail?.startsWith('http')
                          ? item.thumbnail
                          : `${imageBaseUrl}${item.thumbnail}`

                        const itemStartDate = new Date(item.start_date)
                        const itemEndDate = new Date(item.end_date)
                        const isSameDay = itemStartDate.toDateString() === itemEndDate.toDateString()
                        const itemDateFormatted = isSameDay
                          ? itemStartDate.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })
                          : `${itemStartDate.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })} – ${itemEndDate.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}`

                        const itemStatusUpper = (item.status || 'UPCOMING').toUpperCase()

                        return (
                          <Link
                            key={item.id}
                            href={`/${lang}/events/${item.slug}`}
                            className="group flex flex-row gap-2.5 sm:gap-3.5 p-2.5 sm:p-3 rounded-xl bg-background hover:bg-muted transition-all border border-border hover:border-brand-blue/50 overflow-hidden items-start"
                          >
                            {/* 3:2 Thumbnail on Left */}
                            <div className="relative w-[95px] min-[360px]:w-[110px] sm:w-[125px] min-w-[95px] min-[360px]:min-w-[110px] sm:min-w-[125px] aspect-[3/2] rounded-lg overflow-hidden shrink-0 border border-border bg-muted/40">
                              <ImageWithSkeleton
                                src={itemImg}
                                alt={itemTitle}
                                title={itemTitle}
                                fill
                                sizes="(max-width: 640px) 110px, 125px"
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>

                            {/* Details on Right */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                  itemStatusUpper === 'UPCOMING'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                    : itemStatusUpper === 'ONGOING'
                                      ? 'bg-brand-blue/15 text-brand-blue'
                                      : 'bg-muted text-foreground/75'
                                }`}>
                                  {itemStatusUpper}
                                </span>
                              </div>
                              <h3 className="text-[13px] min-[360px]:text-[14px] font-bold text-foreground line-clamp-2 leading-snug group-hover:text-brand-blue transition-colors">
                                {itemTitle}
                              </h3>
                              <p className="text-[11px] min-[360px]:text-[11.5px] text-foreground/80 font-medium truncate flex items-center gap-1">
                                <i className="fa-solid fa-location-dot text-[9px] text-brand-blue shrink-0"></i>
                                <span className="truncate">{itemLocation}</span>
                              </p>

                              {/* Date and View Details placed directly below location */}
                              <div className="flex items-center justify-between gap-1.5 pt-1 text-[11px] sm:text-xs">
                                <div className="flex items-center gap-1 font-medium text-foreground/85 truncate">
                                  <i className="fa-regular fa-calendar text-[10.5px] text-foreground/70 shrink-0"></i>
                                  <time dateTime={item.start_date} className="truncate">{itemDateFormatted}</time>
                                </div>

                                <div className="flex items-center gap-1 font-bold text-sky-700 dark:text-sky-400 shrink-0 group-hover:underline">
                                  <span>View Details<span className="sr-only">: {itemTitle}</span></span>
                                  <i className="fa-solid fa-arrow-right text-[8px] sm:text-[9px] group-hover:translate-x-1 transition-transform" aria-hidden="true"></i>
                                </div>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* EVENT CONTENT (Mobile: Middle, Desktop: Right Column) */}
              <div className="grid-area-content w-full max-w-full min-w-0 bg-card rounded-b-2xl rounded-t-none md:rounded-2xl border border-border p-4 sm:p-7 md:p-8 shadow-xs flex flex-col overflow-hidden self-start md:h-auto">
                
                {/* Title */}
                <h2 
                  className="article-title text-xl sm:text-2xl md:text-[25px] font-bold text-foreground mb-3.5 pb-2.5 border-b border-border leading-[1.3] tracking-tight"
                >
                  {title}
                </h2>

                {/* Event Highlights Grid (Clean single-layer cards, no double-nested wrapper) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-5">
                  {/* Dates Box */}
                  <div className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-muted/50 border border-border">
                    <div className="w-9 h-9 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center text-sm sm:text-base shrink-0">
                      <i className="fa-regular fa-calendar-check"></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-foreground/75">Event Dates</div>
                      <div className="text-[13px] sm:text-[13.5px] font-semibold text-foreground leading-snug truncate">
                        {dateRangeDisplay}
                      </div>
                    </div>
                  </div>

                  {/* Location / Venue Box */}
                  <div className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-muted/50 border border-border">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm sm:text-base shrink-0">
                      <i className="fa-solid fa-location-dot"></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-foreground/75">Location / Venue</div>
                      <div className="text-[13px] sm:text-[13.5px] font-semibold text-foreground leading-snug truncate">
                        {location}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Event Editorial Content */}
                {formattedContent ? (
                  <div
                    className="editorial-body text-foreground flex-1 w-full max-w-full overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: formattedContent }}
                  />
                ) : (
                  <p className="text-foreground/80 text-sm leading-relaxed flex-1">
                    Stay tuned for more updates and scheduling details about this event.
                  </p>
                )}

                {/* Scoped CSS for Fluid Typography & Responsive Grid */}
                <style dangerouslySetInnerHTML={{ __html: `
                  .responsive-layout-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                    grid-template-areas: 
                      "image"
                      "content"
                      "other";
                    width: 100%;
                    max-width: 100%;
                  }
                  @media (min-width: 768px) {
                    .responsive-layout-grid {
                      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                      grid-template-rows: auto 1fr;
                      grid-template-areas: 
                        "image content"
                        "other content";
                    }
                  }
                  .grid-area-image { grid-area: image; min-width: 0; max-width: 100%; }
                  .grid-area-content { grid-area: content; min-width: 0; max-width: 100%; }
                  .grid-area-other { grid-area: other; min-width: 0; max-width: 100%; }

                  .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: 9999px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: var(--foreground);
                    opacity: 0.3;
                  }

                  .article-title {
                    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, sans-serif;
                    text-align: justify !important;
                    text-justify: inter-word !important;
                    text-align-last: left !important;
                    word-break: break-word;
                    overflow-wrap: break-word;
                  }

                  .editorial-body {
                    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, sans-serif;
                    font-size: 16px;
                    font-weight: 500;
                    line-height: 1.85;
                    color: var(--foreground);
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    word-break: break-word;
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    max-width: 100%;
                  }

                  .editorial-body p {
                    text-align: justify !important;
                    text-justify: inter-word !important;
                    text-align-last: left !important;
                    margin-bottom: 1.25rem;
                    line-height: 1.85;
                    font-weight: 500;
                    color: var(--foreground);
                    hyphens: auto;
                    -webkit-hyphens: auto;
                    word-break: break-word;
                    overflow-wrap: break-word;
                  }

                  .editorial-body p:last-child {
                    margin-bottom: 0 !important;
                  }

                  .editorial-callout {
                    margin: 1.3rem 0;
                    padding: 0.9rem 1.15rem;
                    border-radius: 0.875rem;
                    background: var(--muted);
                    border: 1px solid var(--border);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
                    word-break: break-word;
                    overflow-wrap: break-word;
                    max-width: 100%;
                  }

                  .editorial-callout .callout-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                    font-weight: 700;
                    margin-bottom: 0.35rem;
                  }

                  .editorial-callout .callout-text {
                    font-size: 0.925rem !important;
                    line-height: 1.7 !important;
                    margin: 0 !important;
                    text-align: justify !important;
                    text-justify: inter-word !important;
                    text-align-last: left !important;
                    word-break: break-word;
                    overflow-wrap: break-word;
                  }

                  .callout-highlights {
                    border-left: 3.5px solid var(--brand-blue) !important;
                  }
                  .callout-highlights .callout-label {
                    color: var(--brand-blue);
                  }

                  .callout-attendees {
                    border-left: 3.5px solid var(--brand-green) !important;
                  }
                  .callout-attendees .callout-label {
                    color: var(--brand-green);
                  }

                  .callout-focus {
                    border-left: 3.5px solid #f59e0b !important;
                  }
                  .callout-focus .callout-label {
                    color: #f59e0b;
                  }
                `}} />

                {/* Tags at Bottom (without icons) */}
                {event.categories && event.categories.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground/80 mr-1">Event For Commodities:</span>
                    {event.categories.map((cat) => (
                      <span
                        key={cat.id}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-muted text-foreground/80 border border-border/70"
                      >
                        {cat.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bottom of Content: Source / Official Website Link */}
                <div className="mt-3 pt-3 border-t border-border flex flex-wrap justify-between items-center gap-2 text-sm text-foreground/80">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-foreground/80 font-semibold">Organizer / Source:</span>
                    {event.source_url ? (
                      <a
                        href={event.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-700 dark:text-sky-400 hover:underline font-semibold flex items-center gap-1.5"
                      >
                        {sourceName}
                        <i className="fa-solid fa-arrow-up-right-from-square text-[11px]"></i>
                      </a>
                    ) : (
                      <span className="font-semibold text-foreground">{sourceName}</span>
                    )}
                  </div>

                  {event.source_url && (
                    <a
                      href={event.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 text-white font-bold text-xs hover:bg-blue-800 transition-colors shadow-xs"
                    >
                      <span>Official Event Website</span>
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </a>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* JSON-LD Schema */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Event",
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": eventUrl
                },
                "name": title,
                "description": event.meta_description || plainText.substring(0, 160),
                "image": [imageUrl],
                "startDate": event.start_date,
                "endDate": event.end_date,
                "eventStatus": `https://schema.org/Event${statusUpper === 'UPCOMING' ? 'Scheduled' : statusUpper === 'PAST' ? 'MovedOnline' : 'Scheduled'}`,
                "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
                "location": {
                  "@type": "Place",
                  "name": location || "Event Venue",
                  "address": {
                    "@type": "PostalAddress",
                    "streetAddress": location || "Worldwide",
                    "addressLocality": location || "Global"
                  }
                },
                "organizer": {
                  "@type": "Organization",
                  "name": sourceName,
                  "url": event.source_url || siteUrl
                },
                "publisher": {
                  "@type": "Organization",
                  "name": "AgriGuru Online",
                  "logo": {
                    "@type": "ImageObject",
                    "url": `${siteUrl}/logo.png`
                  }
                },
                "url": eventUrl
              }).replace(/</g, '\\u003c')
            }}
          />
        </div>
      </div>
    </div>
  )
}

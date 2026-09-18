import FastLink from '@/components/ui/FastLink'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ShareButton } from '@/components/ui/ShareButton'
import type { EventItem } from '@/types/events'
import { getAssetsUrl } from '@/lib/api-utils';

interface EventCardProps {
  event: EventItem
  lang: string
  priority?: boolean;
}

export default function EventCard({ event, lang, priority = false }: EventCardProps) {
  const assetsUrl = getAssetsUrl();const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  const imageUrl = event.thumbnail.startsWith('http') ? event.thumbnail : `${imageBaseUrl}${event.thumbnail}`
  
  const translation = event.translations?.find(t => t.lang_code === lang)
  const title = translation?.title || event.title
  const location = translation?.location || event.location

  const startDate = new Intl.DateTimeFormat(lang, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(event.start_date))
  
  const endDate = new Intl.DateTimeFormat(lang, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(event.end_date))

  const dateDisplay = startDate === endDate ? startDate : `${startDate} - ${endDate}`

  return (
    <article className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs h-full">
      <FastLink href={`/${lang}/events/${event.slug}`} aria-label={title} className="relative w-full aspect-[3/2] bg-card/30 overflow-hidden border-b border-border block">
        <ImageWithSkeleton
          src={imageUrl}
          alt={title}
          title={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          priority={priority}
        />
      </FastLink>
      
      <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center text-xs text-foreground/80 font-medium">
            <i className="fa-regular fa-calendar mr-1.5 text-foreground/70"></i>
            <time dateTime={event.start_date}>{dateDisplay}</time>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${
            event.status === 'UPCOMING' 
              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300/40 dark:border-emerald-700/40' 
              : event.status === 'PAST' 
                ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-200 border border-red-300/40 dark:border-red-700/40' 
                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border border-blue-300/40 dark:border-blue-700/40'
          }`}>
            <span className="sr-only">Event Status: </span>
            {event.status}
          </span>
        </div>
        
        <h2 className="text-[16px] sm:text-[18px] font-semibold text-foreground mb-2 line-clamp-2 flex-grow" >
          <FastLink href={`/${lang}/events/${event.slug}`} className="hover:text-brand-blue transition-colors">
            {title}
          </FastLink>
        </h2>

        <div className="flex items-center text-xs text-foreground/80 mb-2 truncate">
          <i className="fa-solid fa-location-dot mr-1.5 text-brand-blue shrink-0 text-[11px]"></i>
          <span className="truncate">{location || 'A-1107, Mondeal Heights'}</span>
        </div>
        
        <div className="flex items-center justify-between mt-auto border-t border-border pt-3">
          <FastLink 
            href={`/${lang}/events/${event.slug}`}
            aria-label={`View details: ${title}`}
            className="text-[12px] uppercase tracking-wide font-bold text-sky-700 dark:text-sky-400 hover:opacity-80 transition-opacity flex items-center gap-1.5 group/link"
          >
            <span>View Details<span className="sr-only">: {title}</span></span>
            <i className="fa-solid fa-arrow-right text-[10px] group-hover/link:translate-x-1 transition-transform" aria-hidden="true"></i>
          </FastLink>
          
          <ShareButton 
            title={title} 
            url={`/${lang}/events/${event.slug}`} 
          />
        </div>
      </div>
    </article>
  )
}

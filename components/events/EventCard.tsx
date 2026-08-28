import Link from 'next/link'
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
      <Link href={`/${lang}/events/${event.slug}`} prefetch={true} aria-label={event.title} className="relative w-full aspect-[3/2] bg-card/30 overflow-hidden border-b border-border block">
        <ImageWithSkeleton
          src={imageUrl}
          alt={event.title}
          title={event.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          priority={priority}
        />
      </Link>
      
      <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center text-xs text-foreground/60">
            <i className="fa-regular fa-calendar mr-1.5"></i>
            <time dateTime={event.start_date}>{dateDisplay}</time>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
            event.status === 'UPCOMING' 
              ? 'bg-brand-green/15 text-brand-green' 
              : event.status === 'PAST' 
                ? 'bg-brand-red/15 text-brand-red' 
                : 'bg-brand-blue/15 text-brand-blue'
          }`}>
            <span className="sr-only">Event Status: </span>
            {event.status}
          </span>
        </div>
        
        <h3 className="text-[16px] sm:text-[18px] font-semibold text-foreground mb-2 line-clamp-2 flex-grow" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}>
          <Link href={`/${lang}/events/${event.slug}`} prefetch={true} className="hover:text-brand-blue transition-colors">
            {event.title}
          </Link>
        </h3>

        <div className="flex items-center text-xs text-foreground/70 mb-2 truncate">
          <i className="fa-solid fa-location-dot mr-1.5 text-brand-blue shrink-0 text-[11px]"></i>
          <span className="truncate">{event.location || 'A-1107, Mondeal Heights'}</span>
        </div>
        
        <div className="flex items-center justify-between mt-auto border-t border-border pt-3">
          <Link 
            href={`/${lang}/events/${event.slug}`}
            prefetch={true}
            aria-label={`View details: ${event.title}`}
            className="text-[12px] uppercase tracking-wide font-bold text-brand-blue hover:text-brand-blue-hover transition-colors flex items-center gap-1.5 group/link"
          >
            <span>View Details<span className="sr-only">: {event.title}</span></span>
            <i className="fa-solid fa-arrow-right text-[10px] group-hover/link:translate-x-1 transition-transform" aria-hidden="true"></i>
          </Link>
          
          <ShareButton 
            title={event.title} 
            url={`/${lang}/events/${event.slug}`} 
          />
        </div>
      </div>
    </article>
  )
}

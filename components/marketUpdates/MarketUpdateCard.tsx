import FastLink from '@/components/ui/FastLink'
import Image from 'next/image'
import type { MarketUpdateItem } from '@/types/marketUpdates'
import { getAssetsUrl } from '@/lib/api-utils';

interface MarketUpdateCardProps {
  update: MarketUpdateItem
  lang: string
  priority?: boolean;
}

export default function MarketUpdateCard({ update, lang, priority = false }: MarketUpdateCardProps) {
  const assetsUrl = getAssetsUrl();const imageUrl = update.thumbnail?.startsWith('http') 
    ? update.thumbnail 
    : update.thumbnail 
      ? `${assetsUrl}/${update.thumbnail}`
      : '/logo.webp'

  // Use title directly since translations object is removed from API
  const title = update.title

  // Strip HTML from description for the summary
  const rawDesc = update.description || ''
  const cleanDesc = rawDesc.replace(/<[^>]*>?/gm, '')
  const description = cleanDesc.length > 100 ? `${cleanDesc.substring(0, 100)}...` : cleanDesc

  return (
    <FastLink 
      href={`/${lang}/market-updates/${update.slug}`}
      aria-label={title}
      className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs hover:shadow-lg hover:border-primary/40 transition-all duration-300"
    >
      <div className="relative w-full aspect-[794/1120] bg-muted/60 overflow-hidden border-b border-border">
        <Image
          src={imageUrl}
          alt={title}
          title={title}
          fill
          className="object-contain transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      </div>
      
      <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
        <h2 className="text-sm sm:text-base font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {title}
        </h2>
        
        <p className="text-xs sm:text-sm text-foreground/80 line-clamp-2 mb-4 flex-grow">
          {description}
        </p>
        
        <div className="flex items-center justify-between mt-auto border-t border-border pt-3">
          <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">Read More</span>
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sky-700 dark:text-sky-400 group-hover:bg-primary group-hover:text-white transition-colors">
            <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </div>
        </div>
      </div>
    </FastLink>
  )
}

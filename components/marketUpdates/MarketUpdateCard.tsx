import Link from 'next/link'
import Image from 'next/image'
import type { MarketUpdateItem } from '@/types/marketUpdates'

interface MarketUpdateCardProps {
  update: MarketUpdateItem
  lang: string
}

export default function MarketUpdateCard({ update, lang }: MarketUpdateCardProps) {
  const assetsUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.cloud'
  const imageUrl = update.thumbnail?.startsWith('http') 
    ? update.thumbnail 
    : update.thumbnail 
      ? `${assetsUrl}/${update.thumbnail}`
      : '/placeholder-image.jpg' // You might want to provide a default placeholder

  // Use translated title if available, otherwise fallback to default
  const title = update.translations?.find(t => t.lang_code === lang)?.title || update.title

  // Strip HTML from description for the summary
  const rawDesc = update.translations?.find(t => t.lang_code === lang)?.description || update.description || ''
  const cleanDesc = rawDesc.replace(/<[^>]*>?/gm, '')
  const description = cleanDesc.length > 100 ? `${cleanDesc.substring(0, 100)}...` : cleanDesc

  return (
    <Link 
      href={`/${lang}/market-updates/${update.slug}`}
      className="group flex flex-col rounded-xl bg-background border border-ag-header-border overflow-hidden h-full shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200"
    >
      <div className="relative w-full aspect-[794/1120] bg-ag-header-border/30 overflow-hidden border-b border-ag-header-border">
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-contain transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      </div>
      
      <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
        <h3 className="text-sm sm:text-base font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        
        <p className="text-xs sm:text-sm text-foreground/70 line-clamp-2 mb-4 flex-grow">
          {description}
        </p>
        
        <div className="flex items-center justify-between mt-auto border-t border-ag-header-border pt-3">
          <span className="text-xs font-medium text-primary">Read More</span>
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
            <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </div>
        </div>
      </div>
    </Link>
  )
}

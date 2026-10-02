import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import Link from 'next/link'
import { ShareButton } from '@/components/ui/ShareButton'
import type { ParticipationCategory } from '@/types/participationGallery'
import { getAssetsUrl } from '@/lib/api-utils'

interface ParticipationGalleryCardProps {
  category: ParticipationCategory
  lang: string
  dict?: any
  priority?: boolean
  style?: React.CSSProperties
}

export default function ParticipationGalleryCard({
  category,
  lang, dict = {},
  priority = false,
  style,
}: ParticipationGalleryCardProps) {
  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '/logo.webp'
    if (imagePath.startsWith('http')) return imagePath
    const assetsUrl = getAssetsUrl()
    const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
    return `${imageBaseUrl}${imagePath}`
  }

  const imageUrl = getImageUrl(category.thumbnail || category.image)
  const albumUrl = `/${lang}/participation-gallery/${category.slug}`

  return (
    <article
      title={category.category_name}
      style={style}
      className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs h-full"
    >
      {/* 1:1 Square Image Container with Theme bg-muted Skeleton */}
      <Link
        href={albumUrl}
        prefetch={true}
        title={category.category_name}
        aria-label={category.category_name}
        className="relative w-full aspect-square bg-card overflow-hidden border-b border-border block"
      >
        <ImageWithSkeleton
          src={imageUrl}
          alt={category.category_name}
          title={category.category_name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Video Gallery Style Count Badge */}
        {category.count > 0 && (
          <div className="absolute bottom-2.5 right-2.5 bg-white/95 text-zinc-900 text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.5)] z-20 border border-white/20">
            <i className="fa-solid fa-list-ul"></i>
            {category.count} {category.count === 1 ? 'Photo' : 'Photos'}
          </div>
        )}
      </Link>

      <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col justify-between flex-grow">
        <div>
          <h2
            className="text-[16px] sm:text-[19px] font-bold text-foreground mb-1 line-clamp-1 tracking-tight"
            
          >
            <Link href={albumUrl} prefetch={true} title={category.category_name} className="hover:text-brand-blue transition-colors">
              {category.category_name}
            </Link>
          </h2>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <Link
            href={albumUrl}
            prefetch={true}
            aria-label={`View album: ${category.category_name}`}
            className="text-[11px] sm:text-[13px] uppercase tracking-wider font-bold text-sky-700 dark:text-sky-400 hover:opacity-80 transition-opacity flex items-center gap-1 sm:gap-1.5 group/link p-2 -ml-2"
          >
            <span>{dict?.common?.view_album || 'View Album'}</span>
            <i className="fa-solid fa-arrow-right text-[9px] sm:text-[10px] rtl:rotate-180 group-hover/link:translate-x-1 rtl:group-hover/link:-translate-x-1 transition-transform"></i>
          </Link>

          <ShareButton
            title={`${category.category_name} - AgriGuru Online`}
            url={albumUrl}
          />
        </div>
      </div>
    </article>
  )
}

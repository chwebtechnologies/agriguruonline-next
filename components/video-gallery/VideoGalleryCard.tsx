import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import Link from 'next/link'
import { ShareButton } from '@/components/ui/ShareButton'
import type { VideoCategory } from '@/types/videoGallery'
import { getAssetsUrl } from '@/lib/api-utils';

interface VideoGalleryCardProps {
  category: VideoCategory;
  lang: string;
  priority?: boolean;
}

export default function VideoGalleryCard({ category, lang, priority = false }: VideoGalleryCardProps) {
  // Determine full image URL
  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '/placeholder-image.jpg'; // Fallback
    if (imagePath.startsWith('http')) return imagePath;
    const assetsUrl = getAssetsUrl();
    const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`;
    return `${imageBaseUrl}${imagePath}`;
  };

  const imageUrl = getImageUrl(category.image);

  return (
    <article className="group flex flex-col rounded-2xl bg-card border border-ag-header-border overflow-hidden h-full shadow-xs hover:shadow-lg transition-all duration-300 hover:border-primary/50 relative">
      <Link 
        href={`/${lang}/video-gallery/${category.slug}`}
        className="w-full aspect-video relative overflow-hidden bg-ag-subheader-bg/30 block"
      >
        <ImageWithSkeleton src={imageUrl}
          alt={category.category_name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw" priority={priority} />
        
        {/* Play Icon Overlay */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform duration-300 border border-white/30 shadow-lg">
            <i className="fa-solid fa-play text-white text-lg ml-1"></i>
          </div>
        </div>
        
        {/* Count Badge */}
        {category.count > 0 && (
          <div className="absolute bottom-3 right-3 bg-white/95 text-zinc-900 text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.5)] z-20 border border-white/20">
            <i className="fa-solid fa-list-ul"></i>
            {category.count} {category.count === 1 ? 'Video' : 'Videos'}
          </div>
        )}
      </Link>

      <div className="px-4 py-4 flex flex-col flex-grow relative">
        <h3 className="text-base font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors duration-200 leading-snug">
          <Link href={`/${lang}/video-gallery/${category.slug}`}>
            {category.category_name}
          </Link>
        </h3>
        
        <div className="flex-grow"></div>
        
        <div className="mt-4 flex items-center justify-between border-t border-ag-header-border pt-3">
          <Link 
            href={`/${lang}/video-gallery/${category.slug}`}
            className="flex items-center text-sm font-medium text-primary hover:text-brand-blue transition-colors group/link"
          >
            View Collection
            <i className="fa-solid fa-arrow-right ml-2 text-xs group-hover/link:translate-x-1 transition-transform"></i>
          </Link>

          <ShareButton 
            title={category.category_name} 
            url={`/${lang}/video-gallery/${category.slug}`} 
          />
        </div>
      </div>
    </article>
  )
}

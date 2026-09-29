import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import Link from 'next/link'
import { ShareButton } from '@/components/ui/ShareButton'
import type { VideoCategory } from '@/types/videoGallery'
import { getAssetsUrl } from '@/lib/api-utils';

interface VideoGalleryCardProps {
  category: VideoCategory;
  lang: string;
  priority?: boolean;
  imageBaseUrl?: string;
}

export default function VideoGalleryCard({ category, lang, priority = false, imageBaseUrl }: VideoGalleryCardProps) {
  // Determine full image URL
  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '/logo.webp';
    if (imagePath.startsWith('http')) return imagePath;
    if (imageBaseUrl) return `${imageBaseUrl}${imagePath}`;
    const assetsUrl = getAssetsUrl();
    const defaultBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`;
    return `${defaultBaseUrl}${imagePath}`;
  };

  const imageUrl = getImageUrl(((category as unknown) as Record<string, string>).thumbnail || category.image);

  return (
    <article className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 hover:border-primary/50 relative">
      <Link 
        href={`/${lang}/video-gallery/${category.slug}`}
        prefetch={true}
        aria-label={category.category_name}
        className="w-full aspect-video relative overflow-hidden bg-card/30 block border-b border-border"
      >
        <ImageWithSkeleton
          src={imageUrl}
          alt={category.category_name}
          title={category.category_name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
        />
        
        {/* Play Icon Overlay */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transform-gpu transition-colors duration-300 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center transform scale-90 group-hover:scale-100 transition-all duration-300 border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.3)] group-hover:bg-white/30 group-hover:border-white/60">
            <i className="fa-solid fa-play text-white text-lg ml-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"></i>
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

      <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col">
        <h2 className="text-[16px] sm:text-[19px] font-bold text-foreground mb-1 line-clamp-2 tracking-tight min-h-[44px] sm:min-h-[52px]" >
          <Link href={`/${lang}/video-gallery/${category.slug}`} prefetch={true} className="hover:text-brand-blue transition-colors">
            {category.category_name}
          </Link>
        </h2>
        
        <div className="flex items-center justify-between mt-1">
          <Link 
            href={`/${lang}/video-gallery/${category.slug}`}
            prefetch={true}
            aria-label={`View collection: ${category.category_name}`}
            className="text-[11px] sm:text-[13px] uppercase tracking-wider font-bold text-sky-700 dark:text-sky-400 hover:opacity-80 transition-opacity flex items-center gap-1 sm:gap-1.5 group/link"
          >
            <span>View Collection</span>
            <i className="fa-solid fa-arrow-right text-[9px] sm:text-[10px] group-hover/link:translate-x-1 transition-transform"></i>
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

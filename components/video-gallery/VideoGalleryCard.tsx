import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ShareButton } from '@/components/ui/ShareButton'
import type { VideoCategory, MediaVideoItem } from '@/types/videoGallery'
import { getAssetsUrl } from '@/lib/api-utils'
import { VideoTriggerClient } from './VideoTriggerClient'

interface VideoGalleryCardProps {
  video?: MediaVideoItem;
  category?: VideoCategory;
  lang: string;
  dict?: any;
  priority?: boolean;
  imageBaseUrl?: string;
  index?: number;
}

function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const str = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|vi\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (match) return match[1];
  const generalMatch = str.match(/(?:[?&]v=|\/embed\/|\/shorts\/|\/vi\/|\/v\/|youtu\.be\/)([\w-]{11})/i);
  return generalMatch ? generalMatch[1] : null;
}

export default function VideoGalleryCard({ 
  video, 
  category, 
  lang, 
  dict = {}, 
  priority = false, 
  imageBaseUrl,
  index = 0
}: VideoGalleryCardProps) {
  const item = video || (category as unknown as MediaVideoItem);
  if (!item) return null;

  const rawTitle = item.title || (category?.category_name) || '';
  const title = item.translations?.find((t) => t.lang_code === lang)?.title || rawTitle;
  const rawVideoUrl = item.url || item.video_url || '';
  const ytId = getYoutubeId(rawVideoUrl);
  const isYoutube = !!ytId;

  const getImageUrl = (imagePath?: string) => {
    if (!imagePath) {
      return ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '/logo.webp';
    }
    if (imagePath.startsWith('http')) return imagePath;
    const assetsUrl = imageBaseUrl || getAssetsUrl();
    const defaultBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`;
    return `${defaultBaseUrl}${imagePath.replace(/^\/+/, '')}`;
  };

  const rawImage = item.image || item.video_thumbnail || (item as any).thumbnail;
  const imageUrl = getImageUrl(rawImage);

  // Always share the site's dedicated video page URL so social preview displays the video's thumbnail image
  const shareUrl = `/${lang}/video-gallery/${item.slug}`;

  return (
    <article className="group flex flex-col h-full rounded-2xl bg-card border border-border overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 hover:border-primary/50 relative">
      {/* Trigger overlay to handle clicks and open video in lightbox */}
      <VideoTriggerClient index={index} slug={item.slug} />

      <div className="w-full aspect-video relative overflow-hidden bg-card/30 block border-b border-border pointer-events-none">
        <ImageWithSkeleton
          src={imageUrl}
          alt={title}
          title={title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
          unoptimized={true}
        />
        
        {/* Play Icon Overlay */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transform-gpu transition-colors duration-300 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center transform scale-90 group-hover:scale-100 transition-all duration-300 border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.3)] group-hover:bg-white/30 group-hover:border-white/60">
            {isYoutube ? (
              <i className="fa-brands fa-youtube text-white text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"></i>
            ) : (
              <i className="fa-solid fa-play text-white text-lg ml-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"></i>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col flex-1 justify-between pointer-events-none">
        <div>
          <h2 className="text-[16px] sm:text-[19px] font-bold text-foreground mb-1 leading-snug min-h-[44px] sm:min-h-[52px] h-auto flex items-center tracking-tight">
            <span className="hover:text-brand-blue transition-colors line-clamp-2 break-words text-left w-full">
              {title}
            </span>
          </h2>
        </div>
        
        <div className="flex items-center justify-between mt-1 pt-2 border-t border-border">
          <span className="text-[11px] sm:text-[13px] uppercase tracking-wider font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1 sm:gap-1.5 group/link cursor-pointer">
            <span>{dict?.common?.watch_now || dict?.watch_now || 'Watch Now'}</span>
            <i className="fa-solid fa-arrow-right text-[9px] sm:text-[10px] group-hover/link:translate-x-1 transition-transform"></i>
          </span>

          <div className="pointer-events-auto relative z-30">
            <ShareButton 
              title={title} 
              url={shareUrl} 
            />
          </div>
        </div>
      </div>
    </article>
  );
}

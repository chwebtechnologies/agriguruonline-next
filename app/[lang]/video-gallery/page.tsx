import { PageHeader } from '@/components/ui/PageHeader'
import VideoGalleryCard from '@/components/video-gallery/VideoGalleryCard'
import { VideoLightboxClient } from '@/components/video-gallery/VideoLightboxClient'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cmsService } from '@/lib/api/cms.service'
import { getDictionary } from '../dictionaries'
import { Pagination } from '@/components/ui/Pagination'
import { ServerTimeoutRetry } from '@/components/ui/ServerTimeoutRetry'
import { getStandardMetadata, getSafeLanguage, getSiteUrl, serializeJsonLd } from '@/lib/seo'
import { withTimeout, getAssetsUrl } from '@/lib/api-utils'

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

export const revalidate = 60;

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'video_gallery',
    pathname: 'video-gallery',
    lang,
  });
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

/* ---------- Async component that fetches and renders video grid ---------- */
async function VideoGalleryGrid({ lang, currentPage, dict }: { lang: string; currentPage: number; dict: any }) {
  const ITEMS_PER_PAGE = 12;
  const validPage = isNaN(currentPage) || currentPage < 1 ? 1 : currentPage;

  const data = await withTimeout(
    cmsService.getMediaVideos({ lang, page: validPage, limit: ITEMS_PER_PAGE }).catch(() => null),
    3500,
    null
  );
  
  if (!data) {
    return (
      <ServerTimeoutRetry
        lang={lang}
        className="my-4"
      />
    );
  }

  const videos = data?.data?.media_videos || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  if (videos.length === 0) {
    return (
      <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
          <i className="fa-solid fa-video-slash text-2xl"></i>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No Videos Found</h2>
        <p className="text-foreground/80 max-w-md mx-auto">
          We couldn&apos;t find any videos at the moment. Please check back later.
        </p>
      </div>
    );
  }

  const assetsUrl = getAssetsUrl();
  const defaultBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`;

  const slides = videos.map((video) => {
    const rawThumb = video.image || video.video_thumbnail || video.thumbnail;
    const rawVideoUrl = video.url || video.video_url || '';
    const ytId = getYoutubeId(rawVideoUrl);
    const imageUrl = rawThumb
      ? (rawThumb.startsWith('http') ? rawThumb : `${defaultBaseUrl}${rawThumb.replace(/^\/+/, '')}`)
      : (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '/logo.webp');

    return {
      type: 'custom-video',
      video,
      slug: video.slug,
      ytId,
      videoId: ytId,
      videoUrl: rawVideoUrl,
      title: video.title,
      src: imageUrl,
    };
  });

  const siteUrl = getSiteUrl();

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 mt-2">
        {videos.map((video, index) => (
          <div key={video.slug || index} className="h-full flex flex-col">
            <VideoGalleryCard 
              video={video} 
              index={index} 
              priority={index < 4} 
              lang={lang} 
              dict={dict} 
            />
          </div>
        ))}
      </div>
      
      {totalPages > 1 && (
        <Pagination 
          currentPage={validPage} 
          totalPages={totalPages} 
          baseUrl={`/${lang}/video-gallery`} 
        />
      )}

      <VideoLightboxClient slides={slides} />

      {(() => {
        const schema = [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": dict?.navigation?.home || "Home",
                "item": `${siteUrl}/${lang}`
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": dict?.header?.video_gallery || "Video Gallery",
                "item": `${siteUrl}/${lang}/video-gallery`
              }
            ]
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": videos.map((video, index) => {
              const ytId = getYoutubeId(video.url || video.video_url || '');
              const rawThumb = video.image || video.video_thumbnail;
              const videoImg = rawThumb 
                ? (rawThumb.startsWith('http') ? rawThumb : `${defaultBaseUrl}${rawThumb.replace(/^\/+/, '')}`)
                : (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : `${siteUrl}/logo.png`);
              const uploadIso = video.created_at 
                ? (!isNaN(new Date(video.created_at).getTime()) ? new Date(video.created_at).toISOString() : new Date().toISOString())
                : new Date().toISOString();

              return {
                "@type": "ListItem",
                "position": (validPage - 1) * ITEMS_PER_PAGE + index + 1,
                "item": {
                  "@type": "VideoObject",
                  "name": video.title,
                  "description": video.description || video.title,
                  "thumbnailUrl": [videoImg],
                  "uploadDate": uploadIso,
                  "contentUrl": video.url || `${siteUrl}/${lang}/video-gallery`
                }
              };
            })
          }
        ];

        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
          />
        );
      })()}
    </>
  );
}

/* ---------- Main page component ---------- */
export default async function VideoGalleryPage(props: { 
  params: Promise<{ lang: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const lang = params.lang || 'en'
  const pageStr = searchParams.page as string | undefined;
  const currentPage = pageStr ? parseInt(pageStr, 10) : 1;
  const dict = await getDictionary(lang)
  
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={dict.header?.video_gallery || "Video Gallery"} backText={dict.common?.back || "Back"} backHref={`/${lang}#video-gallery-section`} />
                    
          <Suspense key={`${lang}-${currentPage}`} fallback={<VideoGalleryGridSkeleton />}>
            <VideoGalleryGrid lang={lang} currentPage={currentPage} dict={dict} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

/* ---------- Skeleton shown during Suspense ---------- */
function VideoGalleryGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 mt-2">
      {[...Array(12)].map((_, i) => (
        <div 
          key={i} 
          className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs animate-pulse"
        >
          <div className="w-full aspect-video bg-muted border-b border-border"></div>
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col justify-between flex-1">
            <div className="w-3/4 h-5 rounded bg-muted mb-2"></div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
              <div className="w-20 h-4 rounded bg-muted"></div>
              <div className="w-6 h-6 rounded-full bg-muted"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

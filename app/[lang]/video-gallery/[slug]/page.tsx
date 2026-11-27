import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { ShareButton } from '@/components/ui/ShareButton'
import { getAssetsUrl, withTimeout } from '@/lib/api-utils'
import { cmsService } from '@/lib/api/cms.service'
import { Suspense } from 'react'
import { getDictionary } from '../../dictionaries'
import { getAlternates, getSafeLanguage, getSiteUrl, serializeJsonLd } from '@/lib/seo'
import YouTubeEmbedPlayer from '@/components/ui/YouTubeEmbedPlayer'
import VideoGalleryCard from '@/components/video-gallery/VideoGalleryCard'
import { VideoLightboxClient } from '@/components/video-gallery/VideoLightboxClient'
import Link from 'next/link'

export const revalidate = 60;

function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const str = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const match = str.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|vi\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (match) return match[1];
  const generalMatch = str.match(/(?:[?&]v=|\/embed\/|\/shorts\/|\/vi\/|\/v\/|youtu\.be\/)([\w-]{11})/i);
  return generalMatch ? generalMatch[1] : null;
}

function checkIsShort(url: string, videoType?: string): boolean {
  if (videoType && (videoType.toLowerCase() === 'short' || videoType.toLowerCase() === 'shorts')) {
    return true;
  }
  if (!url) return false;
  return /\/shorts\//i.test(url) || /[?&]type=shorts/i.test(url);
}

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params
  const lang = getSafeLanguage(params.lang)
  const slug = params.slug

  const video = await withTimeout(cmsService.getMediaVideoDetail(slug).catch(() => null), 2500, null)
  const title = video?.title || 'Agri Video'
  const fullTitle = `${title} | AgriGuru Online`
  const description = video?.description || `Watch expert agricultural video insights and market updates on AgriGuru Online.`
  const alternates = getAlternates(`video-gallery/${slug}`, lang)
  const siteUrl = getSiteUrl()
  const assetsUrl = getAssetsUrl()
  const defaultBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`

  const rawVideoUrl = video?.url || video?.video_url || ''
  const ytId = getYoutubeId(rawVideoUrl)
  const rawThumb = video?.video_thumbnail || video?.image || (video as any)?.thumbnail

  let imageUrl = `${siteUrl}/social-preview/video-gallery.png`
  if (rawThumb) {
    imageUrl = rawThumb.startsWith('http') ? rawThumb : `${defaultBaseUrl}${rawThumb.replace(/^\/+/, '')}`
  } else if (ytId) {
    imageUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
  }

  return {
    title,
    description,
    openGraph: {
      title: fullTitle,
      description,
      url: alternates.canonical,
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
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates,
  }
}

async function VideoDetailContent({ slug, lang }: { slug: string; lang: string }) {
  const [video, moreVideosRes, dict] = await Promise.all([
    withTimeout(cmsService.getMediaVideoDetail(slug).catch(() => null), 3000, null),
    withTimeout(cmsService.getMediaVideos({ lang, page: 1, limit: 5 }).catch(() => null), 2500, null),
    getDictionary(lang).catch(() => ({} as any))
  ]);

  const siteUrl = getSiteUrl();
  const assetsUrl = getAssetsUrl();
  const defaultBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`;

  if (!video) {
    return (
      <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
          <i className="fa-solid fa-video-slash text-2xl"></i>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Video Not Found</h2>
        <p className="text-foreground/80 max-w-md mx-auto mb-6">
          The requested video could not be found or has been removed.
        </p>
        <Link
          href={`/${lang}/video-gallery`}
          className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-bold rounded-xl bg-primary text-white hover:opacity-90 transition-all shadow-sm"
        >
          {dict?.common?.back || "Back to Video Gallery"}
        </Link>
      </div>
    );
  }

  const rawVideoUrl = video.url || video.video_url || '';
  const ytId = getYoutubeId(rawVideoUrl);
  const isYoutube = !!ytId;
  const isShort = isYoutube && checkIsShort(`${rawVideoUrl} ${video.video_type || ''}`, video.video_type);
  const shareUrl = `/${lang}/video-gallery/${video.slug}`;
  const otherVideos = (moreVideosRes?.data?.media_videos || []).filter((v) => v.slug !== slug).slice(0, 4);

  const slides = otherVideos.map((item) => {
    const rawThumb = item.image || item.video_thumbnail || item.thumbnail;
    const vUrl = item.url || item.video_url || '';
    const itemYtId = getYoutubeId(vUrl);
    const itemImg = rawThumb
      ? (rawThumb.startsWith('http') ? rawThumb : `${defaultBaseUrl}${rawThumb.replace(/^\/+/, '')}`)
      : (itemYtId ? `https://img.youtube.com/vi/${itemYtId}/hqdefault.jpg` : '/logo.webp');

    return {
      type: 'custom-video',
      video: item,
      slug: item.slug,
      ytId: itemYtId,
      videoId: itemYtId,
      videoUrl: vUrl,
      title: item.title,
      src: itemImg,
    };
  });

  const uploadIso = video.created_at
    ? (!isNaN(new Date(video.created_at).getTime()) ? new Date(video.created_at).toISOString() : new Date().toISOString())
    : new Date().toISOString();

  const thumbUrl = video.image
    ? (video.image.startsWith('http') ? video.image : `${defaultBaseUrl}${video.image.replace(/^\/+/, '')}`)
    : (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : `${siteUrl}/logo.png`);

  return (
    <>
      <PageHeader 
        title={video.title} 
        backText={dict?.header?.video_gallery || "Video Gallery"} 
        backHref={`/${lang}/video-gallery`}
      />

      <div className="mt-4 flex flex-col items-center">
        {/* Video Player Display */}
        <div className={`w-full overflow-hidden rounded-2xl bg-black border border-border shadow-lg ${isShort ? 'max-w-sm aspect-[9/16]' : 'max-w-4xl aspect-video'}`}>
          {isYoutube ? (
            <YouTubeEmbedPlayer ytId={ytId} title={video.title} isShort={isShort} />
          ) : (
            <video
              className="w-full h-full object-contain"
              src={rawVideoUrl}
              controls
              autoPlay
              muted
              playsInline
            />
          )}
        </div>

        {/* Video Details Bar */}
        <div className="w-full max-w-4xl mt-5 bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {video.title}
            </h1>
            <div className="shrink-0">
              <ShareButton title={video.title} url={shareUrl} />
            </div>
          </div>

          {video.description && (
            <div className="mt-4 text-sm sm:text-base text-foreground/80 leading-relaxed whitespace-pre-line">
              {video.description}
            </div>
          )}
        </div>

        {/* More Videos Section */}
        {otherVideos.length > 0 && (
          <div className="w-full max-w-7xl mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                {dict?.common?.more_videos || "More Videos"}
              </h2>
              <Link
                href={`/${lang}/video-gallery`}
                className="text-xs sm:text-sm font-semibold text-primary hover:underline"
              >
                {dict?.common?.view_all || "View All"}
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {otherVideos.map((item, idx) => (
                <div key={item.slug || idx} className="h-full flex flex-col">
                  <VideoGalleryCard 
                    video={item} 
                    index={idx} 
                    lang={lang} 
                    dict={dict} 
                  />
                </div>
              ))}
            </div>

            <VideoLightboxClient slides={slides} />
          </div>
        )}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": dict?.navigation?.home || "Home",
                  "item": `${siteUrl}/${lang}`,
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": dict?.header?.video_gallery || "Video Gallery",
                  "item": `${siteUrl}/${lang}/video-gallery`,
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": video.title,
                  "item": `${siteUrl}/${lang}/video-gallery/${slug}`,
                },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "VideoObject",
              "name": video.title,
              "description": video.description || video.title,
              "thumbnailUrl": [thumbUrl],
              "uploadDate": uploadIso,
              "contentUrl": rawVideoUrl || `${siteUrl}/${lang}/video-gallery/${slug}`,
            },
          ]),
        }}
      />
    </>
  );
}

function VideoDetailSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="py-1 sm:py-1.5 flex items-center justify-between w-full mb-1 sm:mb-1.5 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-muted" />
          <div className="w-48 h-6 bg-muted rounded-md" />
        </div>
        <div className="w-20 h-8 bg-muted rounded-full" />
      </div>

      <div className="flex flex-col items-center mt-4">
        <div className="w-full max-w-4xl aspect-video bg-muted rounded-2xl" />
        <div className="w-full max-w-4xl mt-5 bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="w-3/4 h-7 bg-muted rounded" />
          <div className="w-full h-16 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

export default async function VideoDetailPage(props: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const params = await props.params;
  const lang = params.lang || 'en';
  const slug = params.slug;

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <Suspense fallback={<VideoDetailSkeleton />}>
            <VideoDetailContent slug={slug} lang={lang} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

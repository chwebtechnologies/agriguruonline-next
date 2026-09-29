import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ShareButton } from '@/components/ui/ShareButton'
import { getAssetsUrl } from '@/lib/api-utils'
import { cmsService } from '@/lib/api/cms.service'
import { cache, Suspense } from 'react'
import { getDictionary } from '../../dictionaries'

export const revalidate = 60;

interface VideoItem {
  id: string
  title: string
  url: string
  video_type: string
  image: string
  video_url: string
  video_thumbnail: string
  translations: Array<{
    lang_code: string
    title: string
  }>
}

interface CollectionData {
  category: {
    id: string
    category_name: string
    translations: Array<{
      lang_code: string
      category_name: string
    }>
  }
  videos: VideoItem[]
  total: number
}


import { getAlternates, getSafeLanguage, getSiteUrl } from '@/lib/seo'

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params
  const lang = getSafeLanguage(params.lang)
  const slug = params.slug

  const data = await cmsService.getCollectionVideos(slug, lang)
  const categoryName = data?.category?.category_name || 'Video Collection'

  const descriptions: Record<string, string> = {
    en: `Watch expert videos and market analysis from ${categoryName} on AgriGuru Online.`,
    ar: `شاهد مقاطع الفيديو وتحليلات السوق المتخصصة لـ ${categoryName} على AgriGuru Online.`,
    zh: `在 AgriGuru Online 观看 ${categoryName} 的精选专家分析视频与深度行情。`,
    fr: `Regardez les vidéos et analyses d'experts de ${categoryName} sur AgriGuru Online.`,
  }

  const title = `${categoryName} | AgriGuru Online`
  const description = descriptions[lang] || descriptions.en
  const alternates = getAlternates(`video-gallery/${slug}`, lang)
  const siteUrl = getSiteUrl()
  const imageUrl = `${siteUrl}/logo.png`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      siteName: 'AgriGuru Online',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: categoryName }],
      locale: lang,
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates,
  }
}

import VideoCollection from '@/components/video-gallery/VideoCollection'
import { Pagination } from '@/components/ui/Pagination'

/* ---------- Skeleton shown during Suspense ---------- */
function VideoGridSkeleton() {
  return (
    <>
      <PageHeader title="Video Collection" backText="Back" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs animate-pulse">
            <div className="w-full aspect-video bg-muted border-b border-border"></div>
            <div className="p-4 space-y-2">
              <div className="h-4 bg-muted w-3/4 rounded"></div>
              <div className="h-4 bg-muted w-1/2 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

async function VideoGrid({ slug, lang, currentPage }: { slug: string; lang: string; currentPage: number }) {
  const data = await cmsService.getCollectionVideos(slug, lang).catch(() => null)
  const dict = await getDictionary(lang)
  
  const categoryName = data?.category?.translations?.find((t: any) => t.lang_code === lang)?.category_name 
    || data?.category?.category_name 
    || 'Video Collection'
  
  if (!data || !data.videos || data.videos.length === 0) {
    return (
      <>
        <PageHeader title={categoryName} backText={dict.common?.back || "Back"} />
        <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
            <i className="fa-solid fa-video-slash text-2xl"></i>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No Videos Found</h2>
          <p className="text-foreground/80 max-w-md mx-auto">
            We couldn&apos;t find any videos for this collection at the moment.
          </p>
        </div>
      </>
    )
  }

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`

  const ITEMS_PER_PAGE = 12;
  const videosList = data.videos;
  const totalPages = Math.ceil(videosList.length / ITEMS_PER_PAGE);
  const validPage = isNaN(currentPage) || currentPage < 1 ? 1 : currentPage > totalPages && totalPages > 0 ? totalPages : currentPage;
  const startIndex = (validPage - 1) * ITEMS_PER_PAGE;
  const currentVideos = videosList.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const sanitizedVideos = currentVideos.map((v: any) => ({
    id: v.id,
    title: v.title,
    url: v.url,
    video_type: v.video_type,
    image: v.image,
    video_url: v.video_url,
    video_thumbnail: v.video_thumbnail,
    translations: v.translations ? v.translations.map((t: any) => ({
      lang_code: t.lang_code,
      title: t.title
    })) : []
  }))

  return (
    <>
      <PageHeader title={categoryName} backText={dict.common?.back || "Back"} />
      <VideoCollection videos={sanitizedVideos as any} imageBaseUrl={imageBaseUrl} dict={dict.common} />
      {totalPages > 1 && (
        <Pagination 
          currentPage={validPage} 
          totalPages={totalPages} 
          baseUrl={`/${lang}/video-gallery/${slug}`} 
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": dict.navigation?.home || "Home",
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}`
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": dict.header?.video_gallery || "Video Gallery",
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/video-gallery`
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": categoryName,
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/video-gallery/${slug}`
                }
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              "itemListElement": data?.videos?.map((video: any, index: number) => {
                const title = video.translations?.find((t: any) => t.lang_code === lang)?.title || video.title
                return {
                  "@type": "ListItem",
                  "position": index + 1,
                  "item": {
                    "@type": "VideoObject",
                    "name": title,
                    "description": title,
                    "thumbnailUrl": video.image?.startsWith('http') ? video.image : `https://agriguruonline.com${video.image}`,
                    "uploadDate": video.created_at,
                    "contentUrl": video.video_url
                  }
                }
              }) || []
            }
          ]).replace(/</g, '\\u003c')
        }}
      />
    </>
  )
}

export default async function VideoCollectionPage(props: { 
  params: Promise<{ lang: string; slug: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const lang = params.lang || 'en'
  const slug = params.slug
  const pageStr = searchParams.page as string | undefined;
  const currentPage = pageStr ? parseInt(pageStr, 10) : 1;
  
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <Suspense fallback={<VideoGridSkeleton />}>
            <VideoGrid slug={slug} lang={lang} currentPage={currentPage} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

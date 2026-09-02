import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ShareButton } from '@/components/ui/ShareButton'
import { getCmsApiUrl, getAssetsUrl } from '@/lib/api-utils'
import { cache, Suspense } from 'react'
import { getDictionary } from '../../dictionaries'

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

const getCollectionVideos = cache(async (slug: string, lang: string): Promise<CollectionData | null> => {
  const cmsApiUrl = getCmsApiUrl()
  const url = `${cmsApiUrl}/dashboard/videos/${slug}?lang_code=${lang}&source=web&page=1&limit=100`

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }
    })
    
    if (!res.ok) return null
    
    const json = await res.json()
    if (json.success && json.data) {
      return json.data
    }
    return null
  } catch (error) {
    console.error('Failed to fetch collection videos:', error)
    return null
  }
})

import { getAlternates, getSafeLanguage, getSiteUrl } from '@/lib/seo'

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params
  const lang = getSafeLanguage(params.lang)
  const slug = params.slug

  const data = await getCollectionVideos(slug, lang)
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

import VideoCollectionClient from '@/components/video-gallery/VideoCollectionClient'

async function VideoGrid({ slug, lang, dict }: { slug: string; lang: string; dict: any }) {
  const data = await getCollectionVideos(slug, lang)
  
  if (!data || !data.videos || data.videos.length === 0) {
    return (
      <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
          <i className="fa-solid fa-video-slash text-2xl"></i>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No Videos Found</h2>
        <p className="text-foreground/80 max-w-md mx-auto">
          We couldn&apos;t find any videos for this collection at the moment.
        </p>
      </div>
    )
  }

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`

  return <VideoCollectionClient videos={data.videos} lang={lang} imageBaseUrl={imageBaseUrl} dict={dict} />
}

export default async function VideoCollectionPage(props: { 
  params: Promise<{ lang: string; slug: string }>
}) {
  const params = await props.params
  const lang = params.lang || 'en'
  const slug = params.slug
  
  const data = await getCollectionVideos(slug, lang)
  const categoryName = data?.category?.translations?.find(t => t.lang_code === lang)?.category_name 
    || data?.category?.category_name 
    || 'Video Collection'
  const dict = await getDictionary(lang)
  
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={categoryName} backText={dict.common?.back || "Back"} />
          
            <VideoGrid slug={slug} lang={lang} dict={dict.common} />
        </div>
      </div>
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
    </div>
  )
}

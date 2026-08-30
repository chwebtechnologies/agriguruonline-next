import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ShareButton } from '@/components/ui/ShareButton'
import { getCmsApiUrl, getAssetsUrl } from '@/lib/api-utils'
import { cache, Suspense } from 'react'

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

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params
  const lang = params.lang || 'en'
  const slug = params.slug

  const data = await getCollectionVideos(slug, lang)
  const categoryName = data?.category?.category_name || 'Video Collection'

  return {
    title: `${categoryName} | AgriGuru Online`,
    description: `Watch videos from ${categoryName} on AgriGuru Online.`
  }
}

async function VideoGrid({ slug, lang }: { slug: string; lang: string }) {
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
      {data.videos.map((video, index) => {
        const title = video.translations?.find(t => t.lang_code === lang)?.title || video.title
        const thumbnailPath = video.video_thumbnail || video.image
        const imageUrl = thumbnailPath?.startsWith('http') ? thumbnailPath : `${imageBaseUrl}${thumbnailPath}`
        
        return (
          <article key={video.id} className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs">
            <a 
              href={video.video_url || video.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={title}
              className="w-full aspect-video relative overflow-hidden bg-card/30 block border-b border-border"
            >
              <ImageWithSkeleton
                src={imageUrl}
                alt={title}
                title={title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                priority={index < 2}
              />
              
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center z-20">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform duration-300 border border-white/30 shadow-lg">
                  <i className="fa-brands fa-youtube text-white text-xl"></i>
                </div>
              </div>
            </a>

            <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col">
              <h2 className="text-[16px] sm:text-[19px] font-bold text-foreground mb-1 line-clamp-1 tracking-tight" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}>
                <a href={video.video_url || video.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-blue transition-colors">
                  {title}
                </a>
              </h2>
              
              <div className="flex items-center justify-between mt-1">
                <a 
                  href={video.video_url || video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] sm:text-[13px] uppercase tracking-wider font-bold text-sky-700 dark:text-sky-400 hover:opacity-80 transition-opacity flex items-center gap-1 sm:gap-1.5 group/link"
                >
                  <span aria-hidden="true">Watch Now</span>
                  <span className="sr-only">Watch {title}</span>
                  <i className="fa-solid fa-arrow-right text-[9px] sm:text-[10px] group-hover/link:translate-x-1 transition-transform" aria-hidden="true"></i>
                </a>

                <ShareButton 
                  title={title} 
                  url={video.video_url || video.url} 
                />
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
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
  
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={categoryName} backText="Back" />
          
          <Suspense fallback={null}>
            <VideoGrid slug={slug} lang={lang} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

import { PageHeader } from '@/components/ui/PageHeader'
import VideoGalleryCard from '@/components/video-gallery/VideoGalleryCard'
import type { Metadata } from 'next'
import type { VideoGalleryResponse } from '@/types/videoGallery'
import { cache, Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Video Gallery - AgriGuru Online',
  description: 'Explore our collection of agricultural videos, market updates, and tutorials.',
  openGraph: {
    title: 'Video Gallery - AgriGuru Online',
    description: 'Explore our collection of agricultural videos, market updates, and tutorials.',
    type: 'website',
  },
}

export const instant = false

const getVideoCategories = cache(async (): Promise<VideoGalleryResponse | null> => {
  const cmsApiUrl = process.env.NEXT_PUBLIC_CMS_API_URL || 'https://cms-api.agriguruonline.cloud'
  const url = `${cmsApiUrl}/dashboard/categories/video?source=web`

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }
    })
    
    if (!res.ok) {
      return null
    }

    return await res.json()
  } catch (error) {
    console.error('Failed to fetch video categories:', error)
    return null
  }
})

/* ---------- Async component that fetches and renders video grid ---------- */
async function VideoGalleryGrid({ lang }: { lang: string }) {
  const data = await getVideoCategories()
  const categories = data?.data?.categories || []

  if (categories.length === 0) {
    return (
      <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-ag-header-border mt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-ag-header-border mb-4 text-foreground/60">
          <i className="fa-solid fa-video-slash text-2xl"></i>
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No Videos Found</h3>
        <p className="text-foreground/70 max-w-md mx-auto">
          We couldn&apos;t find any video categories at the moment. Please check back later.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 px-2 sm:px-0 mt-2">
        {categories.map((category) => (
          <VideoGalleryCard key={category.category_id} category={category} lang={lang} />
        ))}
      </div>
    </>
  )
}

/* ---------- Main page component ---------- */
export default async function VideoGalleryPage(props: { 
  params: Promise<{ lang: string }>
}) {
  const params = await props.params
  const lang = params.lang || 'en'
  
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Video Gallery" backText="Back" />
                    
          
          <Suspense fallback={<VideoGalleryGridSkeleton />}>
            <VideoGalleryGrid lang={lang} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

/* ---------- Skeleton shown during Suspense ---------- */
function VideoGalleryGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 px-2 sm:px-0 mt-2">
      {[...Array(8)].map((_, i) => (
        <div 
          key={i} 
          className="flex flex-col rounded-xl bg-background border border-ag-header-border overflow-hidden h-full shadow-sm animate-pulse"
        >
          <div className="w-full aspect-video bg-ag-header-border/50 border-b border-ag-header-border"></div>
          <div className="px-4 py-4 flex flex-col flex-grow">
            <div className="w-full h-5 rounded bg-ag-header-border/50 mb-2"></div>
            <div className="w-3/4 h-5 rounded bg-ag-header-border/50 mb-4"></div>
            <div className="flex-grow"></div>
            <div className="w-24 h-4 rounded bg-ag-header-border/50 mt-4"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

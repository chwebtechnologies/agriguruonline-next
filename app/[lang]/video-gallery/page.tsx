import { PageHeader } from '@/components/ui/PageHeader'
import VideoGalleryCard from '@/components/video-gallery/VideoGalleryCard'
import type { Metadata } from 'next'
import type { VideoGalleryResponse } from '@/types/videoGallery'
import { cache, Suspense } from 'react'
import { getCmsApiUrl } from '@/lib/api-utils';
import { getDictionary } from '../dictionaries'

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

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



const getVideoCategories = cache(async (): Promise<VideoGalleryResponse | null> => {
  const cmsApiUrl = getCmsApiUrl();const url = `${cmsApiUrl}/dashboard/categories/video?source=web`

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }
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
      <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
          <i className="fa-solid fa-video-slash text-2xl"></i>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No Videos Found</h2>
        <p className="text-foreground/80 max-w-md mx-auto">
          We couldn&apos;t find any video categories at the moment. Please check back later.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
        {categories.map((category, index) => (
          <VideoGalleryCard priority={index < 2} key={category.category_id} category={category} lang={lang} />
        ))}
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
                  "name": "Home",
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}`
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Video Gallery",
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/video-gallery`
                }
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              "itemListElement": categories.map((category, index) => {
                const title = (category as any).translations?.find((t: any) => t.lang_code === lang)?.category_name || category.category_name
                return {
                  "@type": "ListItem",
                  "position": index + 1,
                  "item": {
                    "@type": "CollectionPage",
                    "name": title,
                    "url": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/video-gallery/${category.slug}`
                  }
                }
              })
            }
          ]).replace(/</g, '\\u003c')
        }}
      />
    </>
  )
}

/* ---------- Main page component ---------- */
export default async function VideoGalleryPage(props: { 
  params: Promise<{ lang: string }>
}) {
  const params = await props.params
  const lang = params.lang || 'en'
  const dict = await getDictionary(lang)
  
  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={dict.header?.video_gallery || "Video Gallery"} backText={dict.common?.back || "Back"} />
                    
          
            <VideoGalleryGrid lang={lang} />
        </div>
      </div>
    </div>
  )
}

/* ---------- Skeleton shown during Suspense ---------- */
function VideoGalleryGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
      {[...Array(8)].map((_, i) => (
        <div 
          key={i} 
          className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs animate-pulse"
        >
          <div className="w-full aspect-video bg-muted border-b border-border"></div>
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col">
                  <div className="w-3/4 h-4 sm:h-5 rounded bg-muted mb-1"></div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="w-20 h-3 sm:h-4 rounded bg-muted"></div>
                    <div className="w-6 h-6 rounded-full bg-muted"></div>
                  </div>
                </div>
        </div>
      ))}
    </div>
  )
}

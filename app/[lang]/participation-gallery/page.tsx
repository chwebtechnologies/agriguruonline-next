import { PageHeader } from '@/components/ui/PageHeader'
import ParticipationGalleryCard from '@/components/participation-gallery/ParticipationGalleryCard'
import { Pagination } from '@/components/ui/Pagination'
import type { Metadata } from 'next'
import type { ParticipationCategoriesResponse } from '@/types/participationGallery'
import { cache, Suspense } from 'react'
import { getCmsApiUrl } from '@/lib/api-utils'

const PAGE_LIMIT = 12

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params
  const lang = params.lang || 'en'
  const title = 'Participation Gallery'
  const fullTitle = 'Participation Gallery | AgriGuru Online'
  const description =
    'Explore AgriGuru Online\'s participation across premier international agriculture conferences, global trade expos, and summits worldwide.'

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const pageUrl = `${siteUrl}/${lang}/participation-gallery`

  return {
    title,
    description,
    keywords: [
      'AgriGuru Participation Gallery',
      'Agriculture Conferences Exhibitor',
      'Gulfood Exhibitor AgriGuru',
      'World Rice Summit Photos',
      'AgriFundx Conference Album',
      'Agro Food Iraq Expo',
      'Global Agricultural Trade Events',
      'AgriGuru Online Exhibitions'
    ],
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: pageUrl,
      siteName: 'AgriGuru Online',
      images: [
        {
          url: `${siteUrl}/logo.png`,
          width: 1200,
          height: 630,
          alt: 'AgriGuru Participation Gallery',
        },
      ],
      locale: lang,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [`${siteUrl}/logo.png`],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${siteUrl}/en/participation-gallery`,
        ar: `${siteUrl}/ar/participation-gallery`,
        fr: `${siteUrl}/fr/participation-gallery`,
        zh: `${siteUrl}/zh/participation-gallery`,
        'x-default': `${siteUrl}/en/participation-gallery`,
      },
    },
  }
}

const getParticipationCategories = cache(
  async (lang: string, page: number = 1, limit: number = PAGE_LIMIT): Promise<ParticipationCategoriesResponse | null> => {
    const cmsApiUrl = getCmsApiUrl()
    const url = `${cmsApiUrl}/dashboard/categories/gallery?lang_code=${lang}&source=web&page=${page}&limit=${limit}`

    try {
      const res = await fetch(url, {
        next: { revalidate: 3600 },
      })

      if (!res.ok) {
        return null
      }

      return await res.json()
    } catch (error) {
      console.error('Failed to fetch participation categories:', error)
      return null
    }
  }
)

/* ---------- Async component that fetches and renders participation category grid ---------- */
async function ParticipationGalleryGrid({
  lang,
  page,
}: {
  lang: string
  page: number
}) {
  const data = await getParticipationCategories(lang, page, PAGE_LIMIT)
  const categories = data?.data?.categories || []
  const totalCategories = data?.data?.total_categories || 0
  const totalPages = Math.ceil(totalCategories / PAGE_LIMIT)

  if (categories.length === 0) {
    return (
      <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border mt-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/60">
          <i className="fa-solid fa-images text-2xl"></i>
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">No Albums Found</h3>
        <p className="text-foreground/70 max-w-md mx-auto text-sm">
          We couldn&apos;t find any participation albums on this page. Please check back later.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Grid of Square Participation Albums */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 mt-2">
        {categories.map((category, index) => (
          <ParticipationGalleryCard
            key={category.category_id || category.slug}
            category={category}
            lang={lang}
            priority={index < 12}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          baseUrl={`/${lang}/participation-gallery`}
        />
      )}
    </>
  )
}

/* ---------- Main page component ---------- */
export default async function ParticipationGalleryPage(props: {
  params: Promise<{ lang: string }>
  searchParams?: Promise<{ page?: string }>
}) {
  const params = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const lang = params.lang || 'en'
  const page = parseInt(searchParams?.page || '1', 10) || 1
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Participation Gallery - AgriGuru Online',
    description:
      'Photo albums and exhibition memories from AgriGuru Online\'s participation in global agricultural trade conferences and events.',
    url: `${siteUrl}/${lang}/participation-gallery`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'AgriGuru Online',
      url: siteUrl,
    },
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Participation Gallery" backText="Back" />

          <Suspense key={page} fallback={<ParticipationGalleryGridSkeleton />}>
            <ParticipationGalleryGrid lang={lang} page={page} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

/* ---------- Skeleton shown during Suspense ---------- */
export function ParticipationGalleryGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 mt-2">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs animate-pulse"
        >
          <div className="relative w-full aspect-square bg-muted border-b border-border"></div>

          <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col justify-between flex-grow">
            <div className="h-5 w-3/4 bg-muted rounded mb-2"></div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
              <div className="h-4 w-1/3 bg-muted rounded"></div>
              <div className="w-6 h-6 rounded-full bg-muted"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

import { PageHeader } from '@/components/ui/PageHeader'
import ParticipationGalleryCard from '@/components/participation-gallery/ParticipationGalleryCard'
import { Pagination } from '@/components/ui/Pagination'
import type { Metadata } from 'next'
import { getDictionary } from '@/app/[lang]/dictionaries'
import type { ParticipationCategoriesResponse } from '@/types/participationGallery'
import { cache, Suspense } from 'react'
import { cmsService } from '@/lib/api/cms.service'

const PAGE_LIMIT = 12

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

export const revalidate = 60;

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'participation_gallery',
    pathname: 'participation-gallery',
    lang,
  });
}

/* ---------- Async component that fetches and renders participation category grid ---------- */
async function ParticipationGalleryGrid({
  lang,
  page,
}: {
  lang: string
  page: number
}) {
  const data = await cmsService.getParticipationCategories(lang, page, PAGE_LIMIT)
  const categories = data?.data?.categories || []
  const totalCategories = data?.data?.total_categories || 0
  const totalPages = Math.ceil(totalCategories / PAGE_LIMIT)

  if (categories.length === 0) {
    return (
      <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border mt-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
          <i className="fa-solid fa-images text-2xl"></i>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">No Albums Found</h2>
        <p className="text-foreground/80 max-w-md mx-auto text-sm">
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
            priority={index < 4}
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

  const dict = await getDictionary(lang as any)
  
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${dict.header?.participation_gallery || 'Participation Gallery'} - AgriGuru Online`,
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
    <div className="bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Participation Gallery" backText="Back" />

            <ParticipationGalleryGrid lang={lang} page={page} />
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

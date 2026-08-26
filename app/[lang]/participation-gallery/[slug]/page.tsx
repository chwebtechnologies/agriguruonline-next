import { PageHeader } from '@/components/ui/PageHeader'
import ParticipationAlbumClient from '@/components/participation-gallery/ParticipationAlbumClient'
import type { Metadata } from 'next'
import type { ParticipationAlbumResponse } from '@/types/participationGallery'
import { cache, Suspense } from 'react'
import { getCmsApiUrl, getAssetsUrl } from '@/lib/api-utils'
import Link from 'next/link'

const getAlbumDetails = cache(
  async (slug: string, lang: string): Promise<ParticipationAlbumResponse | null> => {
    const cmsApiUrl = getCmsApiUrl()
    const url = `${cmsApiUrl}/dashboard/gallery/${slug}?lang_code=${lang}&source=web`

    try {
      const res = await fetch(url, {
        next: { revalidate: 3600 },
      })

      if (!res.ok) {
        return null
      }

      return await res.json()
    } catch (error) {
      console.error('Failed to fetch album details:', error)
      return null
    }
  }
)

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params
  const lang = params.lang || 'en'
  const slug = params.slug

  const data = await getAlbumDetails(slug, lang)
  const category = data?.data?.category
  const photos = data?.data?.images || data?.data?.galleries || []

  let albumTitle = category?.category_name || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  if (category?.translations && Array.isArray(category.translations)) {
    const tr = category.translations.find((t) => t.lang_code === lang)
    if (tr?.category_name) albumTitle = tr.category_name
  }

  const title = `${albumTitle} - Participation Gallery`
  const fullTitle = `${albumTitle} | Participation Gallery | AgriGuru Online`
  const description = `View photos and exhibition moments from AgriGuru Online's participation at ${albumTitle}. Featuring ${photos.length} square format exhibition photos.`

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const pageUrl = `${siteUrl}/${lang}/participation-gallery/${slug}`

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  const firstImage = photos[0]?.image ? `${imageBaseUrl}${photos[0].image}` : `${siteUrl}/logo.png`

  return {
    title,
    description,
    keywords: [
      albumTitle,
      'Participation Gallery',
      'AgriGuru Online Exhibitions',
      'Agriculture Conferences',
      'Trade Summit Photos',
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
          url: firstImage,
          width: 1200,
          height: 630,
          alt: albumTitle,
        },
      ],
      locale: lang,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [firstImage],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${siteUrl}/en/participation-gallery/${slug}`,
        ar: `${siteUrl}/ar/participation-gallery/${slug}`,
        fr: `${siteUrl}/fr/participation-gallery/${slug}`,
        zh: `${siteUrl}/zh/participation-gallery/${slug}`,
        'x-default': `${siteUrl}/en/participation-gallery/${slug}`,
      },
    },
  }
}

/* ---------- Async content renderer for album ---------- */
async function ParticipationAlbumContent({
  slug,
  lang,
  albumTitle,
}: {
  slug: string
  lang: string
  albumTitle: string
}) {
  const data = await getAlbumDetails(slug, lang)
  const photos = data?.data?.images || data?.data?.galleries || []

  if (!data?.data?.category && photos.length === 0) {
    return (
      <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border mt-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/60">
          <i className="fa-solid fa-folder-open text-2xl"></i>
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Album Not Found</h3>
        <p className="text-foreground/70 max-w-md mx-auto text-sm mb-6">
          The requested participation album could not be found or has no available photos.
        </p>
        <Link
          href={`/${lang}/participation-gallery`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <i className="fa-solid fa-arrow-left text-xs rtl:rotate-180"></i>
          <span>Back to All Albums</span>
        </Link>
      </div>
    )
  }

  return (
    <ParticipationAlbumClient
      photos={photos}
      albumTitle={albumTitle}
      albumSlug={slug}
      lang={lang}
    />
  )
}

/* ---------- Main Album Page ---------- */
export default async function ParticipationAlbumPage(props: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const params = await props.params
  const lang = params.lang || 'en'
  const slug = params.slug

  const data = await getAlbumDetails(slug, lang)
  const category = data?.data?.category

  let albumTitle = category?.category_name || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  if (category?.translations && Array.isArray(category.translations)) {
    const tr = category.translations.find((t) => t.lang_code === lang)
    if (tr?.category_name) albumTitle = tr.category_name
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={albumTitle} backText="Back" />

          <Suspense fallback={<ParticipationAlbumSkeleton />}>
            <ParticipationAlbumContent slug={slug} lang={lang} albumTitle={albumTitle} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

/* ---------- Album Loading Skeleton ---------- */
export function ParticipationAlbumSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 mt-2 animate-pulse">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-2xl bg-card border border-border overflow-hidden shadow-xs"
        >
          <div className="w-full h-full bg-muted" />
        </div>
      ))}
    </div>
  )
}

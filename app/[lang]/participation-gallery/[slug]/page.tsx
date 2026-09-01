import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import ParticipationAlbumClient from '@/components/participation-gallery/ParticipationAlbumClient'
import type { Metadata } from 'next'
import type {
  ParticipationAlbumResponse,
  ParticipationCategoriesResponse,
  ParticipationPhotoItem,
} from '@/types/participationGallery'
import { cache } from 'react'
import { getCmsApiUrl, getAssetsUrl } from '@/lib/api-utils'
import Link from 'next/link'

export async function generateStaticParams() {
  const languages = ['en', 'ar', 'zh', 'fr']
  const params: Array<{ lang: string; slug: string }> = []

  try {
    const cmsApiUrl = getCmsApiUrl()
    const res = await fetch(`${cmsApiUrl}/dashboard/categories/gallery?source=web&page=1&limit=50`, {
      next: { revalidate: 60 }
    })
    if (res.ok) {
      const data: ParticipationCategoriesResponse = await res.json()
      const categories = data?.data?.categories || []
      for (const lang of languages) {
        for (const cat of categories) {
          if (cat.slug) {
            params.push({ lang, slug: cat.slug })
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to generate static params for participation gallery:', error)
  }

  return params
}

const getAlbumDetails = cache(
  async (slug: string, lang: string): Promise<ParticipationAlbumResponse | null> => {
    const cmsApiUrl = getCmsApiUrl()
    const url = `${cmsApiUrl}/dashboard/gallery/${slug}?lang_code=${lang}&source=web`

    try {
      const res = await fetch(url, {
        next: { revalidate: 60 },
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
  props: {
    params: Promise<{ lang: string; slug: string }>
    searchParams?: Promise<{ photo?: string }>
  }
): Promise<Metadata> {
  const params = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const lang = params.lang || 'en'
  const slug = params.slug
  const photoParam = searchParams.photo

  const data = await getAlbumDetails(slug, lang)
  const category = data?.data?.category
  const photos = data?.data?.images || data?.data?.galleries || []

  let albumTitle = category?.category_name || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  if (category?.translations && Array.isArray(category.translations)) {
    const tr = category.translations.find((t) => t.lang_code === lang)
    if (tr?.category_name) albumTitle = tr.category_name
  }

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'

  let targetPhoto: ParticipationPhotoItem | undefined
  if (photoParam) {
    targetPhoto = photos.find(
      (p, idx) =>
        p.id === photoParam ||
        p.slug === photoParam ||
        String(idx + 1) === photoParam
    )
  }

  let photoTitle = albumTitle
  if (targetPhoto) {
    if (targetPhoto.translations && Array.isArray(targetPhoto.translations)) {
      const tr = targetPhoto.translations.find((t: { lang_code: string; title?: string }) => t.lang_code === lang)
      if (tr?.title && tr.title.trim().length > 0) photoTitle = tr.title
    } else if (targetPhoto.title && targetPhoto.title.trim().length > 0) {
      photoTitle = targetPhoto.title
    }
  }

  const rawImageUrl = targetPhoto?.image || targetPhoto?.thumbnail || photos[0]?.image || photos[0]?.thumbnail
  const specificImage = rawImageUrl
    ? (rawImageUrl.startsWith('http') ? rawImageUrl : `${imageBaseUrl}${rawImageUrl}`)
    : `${siteUrl}/logo.png`

  const title = targetPhoto
    ? `${albumTitle} Memories | AgriGuru Online`
    : `${albumTitle} - Participation Gallery`
  const fullTitle = targetPhoto
    ? `${albumTitle} - Exhibition Memories with AgriGuru Online`
    : `${albumTitle} | Participation Gallery | AgriGuru Online`
  const description = targetPhoto
    ? `Cherishing memorable moments & valuable connections at ${albumTitle}. Click to view this high-resolution exhibition photo and explore our global trade participation on AgriGuru Online.`
    : `View photos and exhibition moments from AgriGuru Online's participation at ${albumTitle}. Featuring ${photos.length} exhibition photos.`

  const pageUrl = photoParam
    ? `${siteUrl}/${lang}/participation-gallery/${slug}?photo=${encodeURIComponent(photoParam)}`
    : `${siteUrl}/${lang}/participation-gallery/${slug}`

  return {
    title,
    description,
    keywords: [
      photoTitle,
      albumTitle,
      'Exhibition Memories',
      'Client Moments',
      'AgriGuru Participation Gallery',
      'Agriculture Conferences',
      'Global Trade Summit',
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
          url: specificImage,
          width: 1200,
          height: 1200,
          alt: `${albumTitle} Memories`,
        },
      ],
      locale: lang,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [specificImage],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${siteUrl}/en/participation-gallery/${slug}${photoParam ? `?photo=${photoParam}` : ''}`,
        ar: `${siteUrl}/ar/participation-gallery/${slug}${photoParam ? `?photo=${photoParam}` : ''}`,
        fr: `${siteUrl}/fr/participation-gallery/${slug}${photoParam ? `?photo=${photoParam}` : ''}`,
        zh: `${siteUrl}/zh/participation-gallery/${slug}${photoParam ? `?photo=${photoParam}` : ''}`,
        'x-default': `${siteUrl}/en/participation-gallery/${slug}${photoParam ? `?photo=${photoParam}` : ''}`,
      },
    },
  }
}

/* ---------- Main Album Page ---------- */
export default async function ParticipationAlbumPage(props: {
  params: Promise<{ lang: string; slug: string }>
  searchParams?: Promise<{ photo?: string; page?: string }>
}) {
  const params = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const pageStr = searchParams.page
  const currentPage = pageStr ? parseInt(pageStr, 10) : 1

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

  const isNotFound = !category && photos.length === 0
  if (isNotFound) {
    notFound()
  }

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={albumTitle} backText="Back" backHref={`/${lang}/participation-gallery`} />

          <ParticipationAlbumClient
            photos={photos}
            albumTitle={albumTitle}
            albumSlug={slug}
            lang={lang}
            currentPage={currentPage}
          />
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
                  "name": "Home",
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}`
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Participation Gallery",
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/participation-gallery`
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": albumTitle,
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/participation-gallery/${slug}`
                }
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "ImageGallery",
              "name": albumTitle,
              "url": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/participation-gallery/${slug}`,
              "image": photos.map((photo: any) => photo.image?.startsWith('http') ? photo.image : `https://agriguruonline.com${photo.image}`)
            }
          ]).replace(/</g, '\\u003c')
        }}
      />
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

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
import { getAssetsUrl } from '@/lib/api-utils'
import { cmsService } from '@/lib/api/cms.service'
import Link from 'next/link'

export const revalidate = 60;

export async function generateStaticParams() {
  const languages = ['en', 'ar', 'zh', 'fr']
  const params: Array<{ lang: string; slug: string }> = []

  try {
    const categories = await cmsService.getAllParticipationCategoriesStaticParams(50)
    for (const lang of languages) {
      for (const cat of categories) {
        if (cat.slug) {
          params.push({ lang, slug: cat.slug })
        }
      }
    }
  } catch (error) {
    console.error('Failed to generate static params for participation gallery:', error)
  }

  return params
}

import { getAlternates, getSafeLanguage } from '@/lib/seo'

export async function generateMetadata(
  props: {
    params: Promise<{ lang: string; slug: string }>
    searchParams?: Promise<{ photo?: string }>
  }
): Promise<Metadata> {
  const params = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const lang = getSafeLanguage(params.lang)
  const slug = params.slug
  const photoParam = searchParams.photo

  const data = await cmsService.getParticipationAlbumDetails(slug, lang)
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

  const albumDescriptions: Record<string, string> = {
    en: `View photos and exhibition moments from AgriGuru Online's participation at ${albumTitle}. Featuring ${photos.length} exhibition photos.`,
    ar: `شاهد صور ولحظات مشاركة AgriGuru Online في معرض ومؤتمر ${albumTitle}. يضم المعرض ${photos.length} صورة حصرية.`,
    zh: `查阅 AgriGuru Online 在 ${albumTitle} 展会上的精彩现场图集与商务合作瞬间，共计收录 ${photos.length} 张高清照片。`,
    fr: `Découvrez les photos et moments forts de la participation d'AgriGuru Online à ${albumTitle}. Présentant ${photos.length} photos d'exposition.`,
  }

  const title = `${albumTitle} | AgriGuru Online`
  const fullTitle = `${albumTitle} - Exhibition Memories | AgriGuru Online`
  const description = albumDescriptions[lang] || albumDescriptions.en

  const pathWithParam = photoParam ? `participation-gallery/${slug}?photo=${encodeURIComponent(photoParam)}` : `participation-gallery/${slug}`
  const alternates = getAlternates(pathWithParam, lang)

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
      url: alternates.canonical,
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
    alternates,
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

  const data = await cmsService.getParticipationAlbumDetails(slug, lang)
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
            photos={photos.map((p: any) => ({
              id: p.id,
              slug: p.slug,
              image: p.image,
              thumbnail: p.thumbnail,
              title: p.title,
              translations: p.translations ? p.translations.map((t: any) => ({
                lang_code: t.lang_code,
                title: t.title
              })) : []
            }))}
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


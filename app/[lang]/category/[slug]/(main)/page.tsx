import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import ProductLink from '@/components/marketed-products/ProductLink'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { ShareButton } from '@/components/ui/ShareButton'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { getCategories } from '@/lib/category'
import { cache } from 'react'
import { getTradingApiUrl, getAssetsUrl } from '@/lib/api-utils';

interface SubCategory {
  id: string
  name: string
  slug: string
  image: string
  translations: Array<{
    name: string
    lang_code: string
  }>
}

interface CategoryData {
  sub_categories: SubCategory[]
  category: {
    id: string
    name: string
    slug: string
    translations: Array<{
      name: string
      lang_code: string
    }>
  }
}

const getSubCategories = cache(async (slug: string, lang: string): Promise<CategoryData | null> => {
  const tradingApiUrl = getTradingApiUrl(); const url = `${tradingApiUrl}/sub-category/for-category/web/${slug}?lang_code=${lang}&source=web`

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }
    })

    if (!res.ok) {
      return null
    }

    const json = await res.json()
    if (json.success && json.data) {
      return json.data
    }
    return null
  } catch (error) {
    console.error('Failed to fetch sub-categories:', error)
    return null
  }
})

export async function generateStaticParams() {
  const languages = ['en', 'ar', 'zh', 'fr']
  const tradingApiUrl = getTradingApiUrl()
  const categoriesApiUrl = `${tradingApiUrl.replace(/\/$/, '')}/category`

  try {
    const categories = await getCategories('en', {
      apiUrl: categoriesApiUrl,
      stale: 300,
      revalidate: 0,
      expire: 86400
    })

    return languages.flatMap(lang =>
      categories.filter(cat => cat.slug).map(cat => ({
        lang,
        slug: cat.slug
      }))
    )
  } catch {
    return []
  }
}

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = params?.lang || 'en'
  const slug = decodeURIComponent(params?.slug || '')

  const data = await getSubCategories(slug, lang)
  const matchedCategory = data?.category

  // Use translation if available, otherwise format slug
  const categoryName = matchedCategory
    ? (matchedCategory.translations?.find(t => t.lang_code === lang)?.name || matchedCategory.name)
    : slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  const title = `${categoryName} Prices & Global Trade Data`
  const fullTitle = `${categoryName} Prices & Global Trade Data | AgriGuru Online`
  const description = `Ready to trade ${categoryName}? Check live market prices and explore all available products. Discover global B2B trade opportunities on AgriGuru Online.`

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const imageUrl = `${siteUrl}/logo.png`
  const pageUrl = `${siteUrl}/${lang}/category/${slug}`

  return {
    title,
    description,
    keywords: [
      `${categoryName} Trading`,
      `${categoryName} Prices`,
      `${categoryName} Export Import`,
      'Agricultural Commodities',
      'AgriGuru Online',
      'B2B Agriculture'
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
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: categoryName,
        },
      ],
      locale: lang,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${siteUrl}/en/category/${slug}`,
        ar: `${siteUrl}/ar/category/${slug}`,
        fr: `${siteUrl}/fr/category/${slug}`,
        zh: `${siteUrl}/zh/category/${slug}`,
        'x-default': `${siteUrl}/en/category/${slug}`,
      }
    }
  }
}



export default async function CategoryPage(props: { params: Promise<{ lang: string; slug: string }> }) {
  const params = await props.params;
  const lang = params.lang || 'en'
  const slug = params.slug

  const [data, dict] = await Promise.all([
    getSubCategories(slug, lang),
    getDictionary(lang)
  ])
  const commonDict = (dict as Record<string, any>).common || {}
  const common = {
    back: commonDict.back || "Back",
    all_country_origins: commonDict.all_country_origins || "All Country Origins",
    explore: commonDict.explore || "Explore"
  }

  if (!data) {
    notFound()
  }

  // Helper to get translated name
  const getTranslatedName = (translations: Array<{ name: string; lang_code: string }> | undefined, defaultName: string) => {
    if (!translations || !Array.isArray(translations)) return defaultName
    const translation = translations.find(t => t.lang_code === lang)
    return translation ? translation.name : defaultName
  }

  const categoryName = getTranslatedName(data.category?.translations, data.category?.name || 'Category')

  // Use the assets URL from ENV, fallback to the default domain, and ensure it ends with a slash
  const assetsUrl = getAssetsUrl(); const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`

  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={`${categoryName} (${common.all_country_origins})`} backText={common.back} />

          {data.sub_categories && data.sub_categories.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {data.sub_categories.map((subCat, index) => {
                const subCatName = getTranslatedName(subCat.translations, subCat.name) || subCat.slug || 'Category'
                const imageUrl = subCat.image.startsWith('http') ? subCat.image : `${imageBaseUrl}${subCat.image}`

                return (
                  <div
                    key={subCat.id}
                    title={subCatName}
                    className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs"
                  >
                    <ProductLink href={`/${lang}/category/${slug}/${subCat.slug}`} title={subCatName} className="relative w-full aspect-[16/10] bg-card/20 overflow-hidden border-b border-border block">
                      <ImageWithSkeleton
                        src={imageUrl}
                        alt={subCatName}
                        title={subCatName}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                        priority={index < 2}
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </ProductLink>

                    <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col">
                      <h2 className="text-[16px] sm:text-[19px] font-bold text-foreground mb-1 line-clamp-1 tracking-tight" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}>
                        <ProductLink href={`/${lang}/category/${slug}/${subCat.slug}`} title={subCatName} className="hover:text-brand-blue transition-colors">
                          {subCatName}
                        </ProductLink>
                      </h2>

                      <div className="flex items-center justify-between mt-1">
                        <ProductLink
                          href={`/${lang}/category/${slug}/${subCat.slug}`}
                          aria-label={`${common.explore} ${subCatName}`}
                          className="text-[11px] sm:text-[13px] uppercase tracking-wider font-bold text-sky-700 dark:text-sky-400 hover:opacity-80 transition-opacity flex items-center gap-1 sm:gap-1.5 group/link"
                        >
                          <span aria-hidden="true">{common.explore}</span>
                          <span className="sr-only">{common.explore} {subCatName}</span>
                          <i className="fa-solid fa-arrow-right text-[9px] sm:text-[10px] group-hover/link:translate-x-1 transition-transform" aria-hidden="true"></i>
                        </ProductLink>

                        <ShareButton
                          title={subCatName}
                          url={`/${lang}/category/${slug}/${subCat.slug}`}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
                <i className="fa-solid fa-box-open text-2xl"></i>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">No Sub Categories Found</h2>
              <p className="text-foreground/80 max-w-md mx-auto">
                We couldn&apos;t find any sub categories for this category at the moment. Please check back later.
              </p>
            </div>
          )}
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
                  "name": (dict as Record<string, any>)?.navigation?.home || "Home",
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}`
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": categoryName,
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/category/${slug}`
                }
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              "itemListElement": data.sub_categories?.map((subCat, index) => {
                const subCatName = getTranslatedName(subCat.translations, subCat.name) || subCat.slug || 'Category'
                return {
                  "@type": "ListItem",
                  "position": index + 1,
                  "item": {
                    "@type": "Thing",
                    "name": subCatName,
                    "url": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/category/${slug}/${subCat.slug}`
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

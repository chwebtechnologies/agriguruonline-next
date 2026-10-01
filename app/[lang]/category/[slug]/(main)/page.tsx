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
import { getAssetsUrl } from '@/lib/api-utils';
import { tradingService } from '@/lib/api/trading.service';

export const revalidate = 60;

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

export async function generateStaticParams() {
  const languages = ['en', 'ar', 'zh', 'fr']

  try {
    const categories = await getCategories('en')

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

import { getAlternates, getSafeLanguage } from '@/lib/seo'

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang)
  const slug = decodeURIComponent(params?.slug || '')

  const data = await tradingService.getSubCategories(slug, lang)
  const matchedCategory = data?.category

  // Use translation if available, otherwise format slug
  const categoryName = matchedCategory
    ? (matchedCategory.translations?.find(t => t.lang_code === lang)?.name || matchedCategory.name)
    : slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  const titles: Record<string, string> = {
    en: `${categoryName} Prices & Global Trade Data`,
    ar: `أسعار ${categoryName} وبيانات التجارة العالمية`,
    zh: `${categoryName} 价格行情与全球外贸数据`,
    fr: `Cours de ${categoryName} & Données du Commerce Mondial`,
  }

  const descriptions: Record<string, string> = {
    en: `Ready to trade ${categoryName}? Check live market prices and explore all available products. Discover global B2B trade opportunities on AgriGuru Online.`,
    ar: `هل أنت جاهز لتداول ${categoryName}؟ تحقق من أسعار السوق اللحظية وتصفح جميع المنتجات المتاحة. اكتشف فرص التجارة العالمية على AgriGuru Online.`,
    zh: `寻找优质 ${categoryName} 贸易货源？实时查看即时市场行情与在售品类，对接 AgriGuru Online 全球B2B外贸商机。`,
    fr: `Prêt à négocier ${categoryName} ? Consultez les cours en direct et parcourez les produits disponibles sur AgriGuru Online.`,
  }

  const title = titles[lang] || titles.en
  const fullTitle = `${title} | AgriGuru Online`
  const description = descriptions[lang] || descriptions.en

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const imageUrl = `${siteUrl}/logo.png`
  const alternates = getAlternates(`category/${params.slug}`, lang)

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
      url: alternates.canonical,
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
    alternates,
  }
}



import { Suspense } from 'react'

export default async function CategoryPage(props: { params: Promise<{ lang: string; slug: string }> }) {
  const params = await props.params;
  const lang = params.lang || 'en'
  const slug = params.slug
  const dict = await getDictionary(lang as any).catch(() => ({}))
  const common = (dict as any)?.common || {}

  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <Suspense fallback={<CategorySkeleton slug={slug} dict={common} />}>
            <CategoryContent lang={lang} slug={slug} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function CategorySkeleton({ slug, dict }: { slug: string, dict?: any }) {
  // Format slug for a temporary title before data loads
  const categoryName = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  const title = `${categoryName} (${dict?.all_country_origins || 'All Country Origins'})`;
  return (
    <>
      <PageHeader title={title} backText={dict?.back || "Back"} />
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
            <div className="relative w-full aspect-[16/10] bg-muted animate-pulse border-b border-border"></div>
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col gap-2">
              <div className="h-4 sm:h-5 bg-muted animate-pulse rounded w-3/4"></div>
              <div className="flex items-center justify-between mt-1">
                <div className="h-3 sm:h-4 bg-muted animate-pulse rounded w-1/3"></div>
                <div className="w-6 h-6 rounded-full bg-muted animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

async function CategoryContent({ lang, slug }: { lang: string; slug: string }) {
  const [data, dict] = await Promise.all([
    tradingService.getSubCategories(slug, lang).catch(() => null),
    getDictionary(lang).catch(() => ({}))
  ])
  const commonDict = (dict as Record<string, any>).common || {}
  const common = {
    coming_soon: commonDict.coming_soon || "Coming Soon!",
    exciting_updates: commonDict.exciting_updates || "Exciting updates are on the way.",
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
    <>
      <PageHeader title={`${categoryName} (${common.all_country_origins})`} backText={common.back} />

      {data.sub_categories && data.sub_categories.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
          {data.sub_categories.map((subCat, index) => {
            const subCatName = getTranslatedName(subCat.translations, subCat.name) || subCat.slug || 'Category'
            const imageUrl = subCat.image ? (subCat.image.startsWith('http') ? subCat.image : `${imageBaseUrl}${subCat.image}`) : '/placeholder.png'

            return (
              <div
                key={subCat.id}
                title={subCatName}
                className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs"
              >
                {index === 0 ? (
                  <Link href={`/${lang}/category/${slug}/${subCat.slug}`} title={subCatName} className="relative w-full aspect-[16/10] bg-card/20 overflow-hidden border-b border-border block">
                    <Image
                      src={imageUrl}
                      alt={subCatName}
                      title={subCatName}
                      fill
                      sizes="100vw"
                      priority={true}
                      loading="eager"
                      fetchPriority="high"
                      className="object-cover"
                    />
                  </Link>
                ) : (
                  <ProductLink href={`/${lang}/category/${slug}/${subCat.slug}`} title={subCatName} className="relative w-full aspect-[16/10] bg-card/20 overflow-hidden border-b border-border block">
                    <ImageWithSkeleton
                      src={imageUrl}
                      alt={subCatName}
                      title={subCatName}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      priority={false}
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </ProductLink>
                )}

                <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex flex-col">
                  <h2 className="text-[16px] sm:text-[19px] font-bold text-foreground mb-1 line-clamp-1 tracking-tight" >
                    {index === 0 ? (
                      <Link href={`/${lang}/category/${slug}/${subCat.slug}`} title={subCatName} className="hover:text-brand-blue transition-colors">
                        {subCatName}
                      </Link>
                    ) : (
                      <ProductLink href={`/${lang}/category/${slug}/${subCat.slug}`} title={subCatName} className="hover:text-brand-blue transition-colors">
                        {subCatName}
                      </ProductLink>
                    )}
                  </h2>

                  <div className="flex items-center justify-between mt-1">
                    {index === 0 ? (
                      <Link
                        href={`/${lang}/category/${slug}/${subCat.slug}`}
                        aria-label={`${common.explore} ${subCatName}`}
                        className="text-[11px] sm:text-[13px] uppercase tracking-wider font-bold text-sky-700 dark:text-sky-400 hover:opacity-80 transition-opacity flex items-center gap-1 sm:gap-1.5 group/link"
                      >
                        <span aria-hidden="true">{common.explore}</span>
                        <span className="sr-only">{common.explore} {subCatName}</span>
                        <i className="fa-solid fa-arrow-right text-[9px] sm:text-[10px] group-hover/link:translate-x-1 transition-transform" aria-hidden="true"></i>
                      </Link>
                    ) : (
                      <ProductLink
                        href={`/${lang}/category/${slug}/${subCat.slug}`}
                        aria-label={`${common.explore} ${subCatName}`}
                        className="text-[11px] sm:text-[13px] uppercase tracking-wider font-bold text-sky-700 dark:text-sky-400 hover:opacity-80 transition-opacity flex items-center gap-1 sm:gap-1.5 group/link"
                      >
                        <span aria-hidden="true">{common.explore}</span>
                        <span className="sr-only">{common.explore} {subCatName}</span>
                        <i className="fa-solid fa-arrow-right text-[9px] sm:text-[10px] group-hover/link:translate-x-1 transition-transform" aria-hidden="true"></i>
                      </ProductLink>
                    )}

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
        <div className="flex items-center justify-center py-12 px-4 bg-card/30 rounded-2xl border border-dashed border-border/50 my-6">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-blue/10 mb-1">
              <i className="fa-solid fa-hourglass-half text-2xl text-brand-blue animate-pulse"></i>
            </div>
            <h2 className="text-xl font-bold text-foreground">{common.coming_soon}</h2>
            <p className="text-sm text-foreground/60">{common.exciting_updates}</p>
          </div>
        </div>
      )}
      
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
    </>
  )
}


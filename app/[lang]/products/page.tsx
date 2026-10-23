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
import { getAssetsUrl } from '@/lib/api-utils'
import { getAlternates, getSafeLanguage, getSiteUrl, serializeJsonLd } from '@/lib/seo'
import { Suspense } from 'react'

export const revalidate = 60;

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang)

  const titles: Record<string, string> = {
    en: 'Products',
    ar: 'المنتجات',
    zh: '产品',
    fr: 'Produits',
  }

  const descriptions: Record<string, string> = {
    en: `Explore all products and categories available on AgriGuru Online.`,
    ar: `استكشف جميع المنتجات والفئات المتاحة على AgriGuru Online.`,
    zh: `探索 AgriGuru Online 提供的所有产品和类别。`,
    fr: `Explorez tous les produits et catégories disponibles sur AgriGuru Online.`,
  }

  const title = titles[lang] || titles.en
  const description = descriptions[lang] || descriptions.en
  const fullTitle = `${title} | AgriGuru Online`

  const siteUrl = getSiteUrl()
  const imageUrl = `${siteUrl}/logo.png`
  const alternates = getAlternates(`products`, lang)

  return {
    title,
    description,
    keywords: [
      'Products',
      'Categories',
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
          alt: 'Products',
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

export default async function ProductsPage(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params;
  const lang = params.lang || 'en'
  const dict = await getDictionary(lang as any).catch(() => ({}))
  const common = (dict as any)?.common || {}
  const navigation = (dict as any)?.navigation || {}

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <Suspense fallback={<ProductsSkeleton dict={common} navigationDict={navigation} />}>
            <ProductsContent lang={lang} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function ProductsSkeleton({ dict, navigationDict }: { dict?: any, navigationDict?: any }) {
  const title = navigationDict?.products || 'Products';
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

async function ProductsContent({ lang }: { lang: string }) {
  const [categories, dict] = await Promise.all([
    getCategories(lang).catch(() => []),
    getDictionary(lang).catch(() => ({}))
  ])
  const commonDict = (dict as Record<string, any>).common || {}
  const navigationDict = (dict as Record<string, any>).navigation || {}
  
  const common = {
    coming_soon: commonDict.coming_soon || "Coming Soon!",
    exciting_updates: commonDict.exciting_updates || "Exciting updates are on the way.",
    back: commonDict.back || "Back",
    explore: commonDict.explore || "Explore"
  }
  
  const title = navigationDict?.products || 'Products';

  // Helper to get translated name
  const getTranslatedName = (translations: Array<{ name: string; lang_code: string }> | undefined, defaultName: string) => {
    if (!translations || !Array.isArray(translations)) return defaultName
    const translation = translations.find(t => t.lang_code === lang)
    return translation ? translation.name : defaultName
  }

  const assetsUrl = getAssetsUrl(); 
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  
  const activeCategories = categories.filter((c: any) => c.is_active !== false)

  return (
    <>
      <PageHeader title={title} backText={common.back} />

      {activeCategories.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
          {activeCategories.map((cat: any, index: number) => {
            const catName = getTranslatedName(cat.translations, cat.name) || cat.slug || 'Category'
            const imageUrl = cat.image ? (cat.image.startsWith('http') ? cat.image : `${imageBaseUrl}${cat.image}`) : '/placeholder.png'

            return (
              <div
                key={cat.id || index}
                title={catName}
                className="group flex flex-col h-full rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs"
              >
                <Link href={`/${lang}/category/${cat.slug}`} title={catName} className="relative w-full aspect-[16/10] bg-card/20 overflow-hidden border-b border-border block">
                  <ImageWithSkeleton
                    src={imageUrl}
                    alt={catName}
                    title={catName}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    priority={index < 6}
                    className="object-cover"
                  />
                </Link>

                <div className="px-3 py-2 sm:px-4 sm:py-2 flex flex-col flex-1 justify-between">
                  <h2 className="text-[16px] sm:text-[19px] font-bold text-foreground mb-1 leading-snug tracking-tight">
                    {index === 0 ? (
                      <Link href={`/${lang}/category/${cat.slug}`} title={catName} className="hover:text-brand-blue transition-colors truncate block">
                        {catName}
                      </Link>
                    ) : (
                      <ProductLink href={`/${lang}/category/${cat.slug}`} title={catName} className="hover:text-brand-blue transition-colors truncate block">
                        {catName}
                      </ProductLink>
                    )}
                  </h2>

                  <div className="flex items-center justify-between mt-auto">
                    {index === 0 ? (
                      <Link
                         href={`/${lang}/category/${cat.slug}`}
                        aria-label={`${common.explore} ${catName}`}
                        className="text-[11px] sm:text-[13px] uppercase tracking-wider font-bold text-sky-700 dark:text-sky-400 hover:opacity-80 transition-opacity flex items-center gap-1 sm:gap-1.5 group/link"
                      >
                        <span aria-hidden="true">{common.explore}</span>
                        <span className="sr-only">{common.explore} {catName}</span>
                        <i className="fa-solid fa-arrow-right text-[9px] sm:text-[10px] group-hover/link:translate-x-1 transition-transform" aria-hidden="true"></i>
                      </Link>
                    ) : (
                      <ProductLink
                         href={`/${lang}/category/${cat.slug}`}
                        aria-label={`${common.explore} ${catName}`}
                        className="text-[11px] sm:text-[13px] uppercase tracking-wider font-bold text-sky-700 dark:text-sky-400 hover:opacity-80 transition-opacity flex items-center gap-1 sm:gap-1.5 group/link"
                      >
                        <span aria-hidden="true">{common.explore}</span>
                        <span className="sr-only">{common.explore} {catName}</span>
                        <i className="fa-solid fa-arrow-right text-[9px] sm:text-[10px] group-hover/link:translate-x-1 transition-transform" aria-hidden="true"></i>
                      </ProductLink>
                    )}

                    <ShareButton
                      title={catName}
                      url={`/${lang}/category/${cat.slug}`}
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
          __html: serializeJsonLd([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": navigationDict?.home || "Home",
                  "item": `${getSiteUrl()}/${lang}`
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": title,
                  "item": `${getSiteUrl()}/${lang}/products`
                }
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              "itemListElement": activeCategories.map((cat: any, index: number) => {
                const catName = getTranslatedName(cat.translations, cat.name) || cat.slug || 'Category'
                return {
                  "@type": "ListItem",
                  "position": index + 1,
                  "item": {
                    "@type": "Thing",
                    "name": catName,
                    "url": `${getSiteUrl()}/${lang}/category/${cat.slug}`
                  }
                }
              }) || []
            }
          ])
        }}
      />
    </>
  )
}

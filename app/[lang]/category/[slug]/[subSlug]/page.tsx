import { cache } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { getDictionary } from '@/app/[lang]/dictionaries'
import type { Metadata } from 'next'
import { getAssetsUrl } from '@/lib/api-utils';
import { tradingService } from '@/lib/api/trading.service';

export const revalidate = 60;

interface Product {
  id: string
  name: string
  product_code: string
  slug: string
  image: string
  thumbnail: string
  category: {
    id: string
    name: string
  }
}

interface ProductData {
  products: Product[]
  total: number
  sub_category: {
    name: string
    category_id: string
    country_id: string
  }
}

export async function generateStaticParams() {
  const languages = ['en', 'ar', 'zh', 'fr']
  const params: Array<{ lang: string; slug: string; subSlug: string }> = []

  try {
    const categories = await tradingService.getCategories('en', 15)
    for (const cat of categories.slice(0, 10)) {
      if (!cat.slug) continue
      try {
        const subData = await tradingService.getSubCategories(cat.slug, 'en')
        const subCats = subData?.sub_categories || []
        for (const sub of subCats) {
          if (sub.slug) {
            for (const lang of languages) {
              params.push({ lang, slug: cat.slug, subSlug: sub.slug })
            }
          }
        }
      } catch {}
    }
  } catch (error) {
    console.error('Failed to generate static params for subcategories:', error)
  }

  return params
}

import { getAlternates, getSafeLanguage } from '@/lib/seo'

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string; subSlug: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);
  const slug = params?.slug ? decodeURIComponent(params.slug) : '';
  const subSlug = params?.subSlug ? decodeURIComponent(params.subSlug) : '';

  const data = await tradingService.getProductsForSubcategory(slug, subSlug, lang);

  const formattedName = data?.sub_category?.name || subSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const categoryName = slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const titles: Record<string, string> = {
    en: `${formattedName} Prices & Trade Listings`,
    ar: `أسعار وقوائم تداول ${formattedName}`,
    zh: `${formattedName} 价格行情与供求现货信息`,
    fr: `Cours et Annonces Commerciales de ${formattedName}`,
  };

  const descriptions: Record<string, string> = {
    en: `Looking to trade ${formattedName}? View active ${categoryName} listings and check live market prices. Explore global B2B trade opportunities on AgriGuru Online.`,
    ar: `هل تبحث عن تداول ${formattedName}؟ تصفح عروض ${categoryName} النشطة وتحقق من أسعار السوق اللحظية على AgriGuru Online.`,
    zh: `想要采购或供应 ${formattedName}？浏览当前 ${categoryName} 活跃外贸现货信息，掌握实时国际报价，在 AgriGuru Online 拓展商机。`,
    fr: `Vous cherchez à négocier ${formattedName} ? Consultez les offres actives de ${categoryName} et les cours en direct sur AgriGuru Online.`,
  };

  const title = titles[lang] || titles.en;
  const fullTitle = `${title} | AgriGuru Online`;
  const description = descriptions[lang] || descriptions.en;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com';
  const imageUrl = `${siteUrl}/logo.png`;
  const alternates = getAlternates(`category/${params.slug}/${params.subSlug}`, lang);

  return {
    title,
    description,
    keywords: [
      `${formattedName} Trading`,
      `${formattedName} Prices`,
      `${formattedName} ${categoryName}`,
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
          alt: formattedName,
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
  };
}

import { Suspense } from 'react'

export default async function SubCategoryProductsPage(
  props: { params: Promise<{ lang: string; slug: string; subSlug: string }> }
) {
  const params = await props.params;
  const lang = params?.lang || 'en'
  const slug = params?.slug || ''
  const subSlug = params?.subSlug || ''

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <Suspense fallback={<SubCategoryProductsSkeleton subSlug={subSlug} slug={slug} lang={lang} />}>
            <SubCategoryProductsContent lang={lang} slug={slug} subSlug={subSlug} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function SubCategoryProductsSkeleton({ subSlug, slug, lang }: { subSlug: string, slug: string, lang: string }) {
  const pageTitle = subSlug ? subSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') + ' Product List' : 'Product List';

  return (
    <>
      <PageHeader title={pageTitle} backText="Back" backHref={`/${lang}/category/${slug}`} />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mt-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
            <div className="relative w-full aspect-square bg-muted animate-pulse border-b border-border"></div>
            <div className="p-2 sm:p-3 flex flex-col flex-1 gap-2">
              <div className="h-4 bg-muted animate-pulse rounded w-3/4 mx-auto mb-2"></div>
              <div className="mt-auto space-y-1.5">
                <div className="h-8 bg-muted animate-pulse rounded-lg w-full"></div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="h-8 bg-muted animate-pulse rounded-lg"></div>
                  <div className="h-8 bg-muted animate-pulse rounded-lg"></div>
                </div>
                <div className="h-8 bg-muted animate-pulse rounded-lg w-full mt-0.5"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

async function SubCategoryProductsContent({ lang, slug, subSlug }: { lang: string; slug: string; subSlug: string }) {
  const [data, dict] = await Promise.all([
    tradingService.getProductsForSubcategory(slug, subSlug, lang).catch(() => null),
    getDictionary(lang).catch(() => ({}))
  ])
  const commonDict = (dict as Record<string, any>)?.common || {}
  const common = {
    back: commonDict.back || "Back",
    addProduct: commonDict.add_product || "Add Product",
    buy: commonDict.buy || "Buy",
    sell: commonDict.sell || "Sell",
    viewDetails: commonDict.view_details || "View Details",
    productList: commonDict.product_list || "Product List",
  }

  const assetsUrl = getAssetsUrl(); const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`

  if (!data || !data.products || data.products.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No products found</h1>
          <Link href={`/${lang}/category/${slug}`} className="text-sky-700 dark:text-sky-400 hover:underline">
            Return to Category
          </Link>
        </div>
      </div>
    )
  }

  const pageTitle = data.sub_category?.name ? `${data.sub_category.name} ${common.productList}` : common.productList;

  return (
    <>
      <PageHeader title={pageTitle} backText={common.back} backHref={`/${lang}/category/${slug}`} />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mt-4">
        {data.products.map((product: any, index: number) => {
          const productName = product.name || product.slug || 'Agricultural Commodity';
          const rawImg = product.thumbnail || product.image;
          const imageUrl = rawImg
            ? (rawImg.startsWith('http') ? rawImg : `${imageBaseUrl}${rawImg}`)
            : 'https://agriguruonline.com/logo.png'

          return (
            <div
              key={product.id}
              title={productName}
              className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs"
            >
              <Link href={`/${lang}/product/${product.slug}`} prefetch={true} className="relative w-full aspect-square bg-muted overflow-hidden border-b border-border block" title={productName} tabIndex={-1} aria-hidden="true">
                {index === 0 ? (
                  <Image
                    src={imageUrl}
                    alt={productName}
                    title={productName}
                    fill
                    sizes="100vw"
                    className="object-cover"
                    priority={true}
                    loading="eager"
                    fetchPriority="high"
                  />
                ) : (
                  <ImageWithSkeleton
                    src={imageUrl}
                    alt={productName}
                    title={productName}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    priority={false}
                  />
                )}
              </Link>

              <div className="p-2 sm:p-3 flex flex-col flex-1">
                <h2 className="text-[14px] sm:text-[16px] font-bold text-center text-foreground mb-2 line-clamp-2 leading-tight min-h-[34px]" >
                  <Link href={`/${lang}/product/${product.slug}`} prefetch={true} className="hover:text-brand-blue transition-colors">
                    {product.name}
                  </Link>
                </h2>

                <div className="mt-auto space-y-1.5">
                  <button className="w-full bg-brand-blue hover:opacity-90 text-white py-1.5 px-2 rounded-lg text-[13px] sm:text-[15px] transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] cursor-pointer" title={`${common.addProduct} - ${product.name}`}>
                    <i className="fa-solid fa-plus text-xs"></i>
                    {common.addProduct}
                  </button>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button className="bg-brand-green hover:opacity-90 text-white py-1.5 px-1 rounded-lg text-[13px] sm:text-[15px] transition-all flex items-center justify-center gap-1 shadow-xs active:scale-[0.98] cursor-pointer" title={`${common.buy} - ${product.name}`}>
                      <i className="fa-solid fa-cart-shopping text-[10px]"></i>
                      {common.buy}
                    </button>
                    <button className="bg-brand-red hover:opacity-90 text-white py-1.5 px-1 rounded-lg text-[13px] sm:text-[15px] transition-all flex items-center justify-center gap-1 shadow-xs active:scale-[0.98] cursor-pointer" title={`${common.sell} - ${product.name}`}>
                      <i className="fa-solid fa-tag text-[10px]"></i>
                      {common.sell}
                    </button>
                  </div>

                  <Link
                    href={`/${lang}/product/${product.slug}`}
                    prefetch={true}
                    title={`${common.viewDetails} - ${product.name}`}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="w-full block text-center border border-border bg-background hover:bg-muted text-foreground font-semibold py-1.5 px-2 rounded-lg text-[13px] sm:text-[15px] transition-colors mt-0.5"
                  >
                    <span aria-hidden="true">{common.viewDetails}</span>
                    <span className="sr-only">{common.viewDetails} {product.name}</span>
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
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
                  "name": (dict as Record<string, any>)?.navigation?.products || "Products",
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/category/${slug}`
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": data.sub_category?.name || subSlug,
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/category/${slug}/${subSlug}`
                }
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              "itemListElement": data.products?.map((product: any, index: number) => {
                const p = product as any;
                const productName = p.translations?.find((t: any) => t.lang_code === lang)?.name || p.name || p.slug || 'Product'
                return {
                  "@type": "ListItem",
                  "position": index + 1,
                  "item": {
                    "@type": "Product",
                    "name": productName,
                    "url": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/product/${p.slug}`
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

import { cache } from 'react'
import Link from 'next/link'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { Pagination } from '@/components/ui/Pagination'
import { MarketedProductCard } from '@/components/marketed-products/MarketedProductCard'
import type { Metadata } from 'next'

export const revalidate = 60;

interface Product {
  id: string
  name: string
  product_code: string
  slug: string
  image: string
  thumbnail: string
  quality_specification?: string
  category?: {
    id: string
    name: string
  }
  country?: {
    id: string
    name: string
    flag: string
    iso2: string
  }
  loading_ports?: Array<{
    price: number
    port?: {
      name: string
    }
  }>
}

interface ProductData {
  products: Product[]
  total: number
}

import { getAssetsUrl } from '@/lib/api-utils'
import { tradingService } from '@/lib/api/trading.service'

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
    pageKey: 'marketed_products',
    pathname: 'marketed-products',
    lang,
  });
}

import { Suspense } from 'react'

export default async function MarketedProductsPage(
  props: { params: Promise<{ lang: string }>, searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }
) {
  const params = await props.params;
  const lang = params.lang || 'en'
  const searchParams = await props.searchParams;

  const pageStr = searchParams?.page
  const page = typeof pageStr === 'string' ? parseInt(pageStr, 10) : 1

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <Suspense fallback={<MarketedProductsSkeleton />}>
            <MarketedProductsContent lang={lang} page={page} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function MarketedProductsSkeleton() {
  return (
    <>
      <PageHeader title="Marketed Products" backText="Back" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mt-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-xs">
            <div className="relative w-full aspect-[16/10] bg-muted animate-pulse border-b border-border"></div>
            <div className="p-3 flex flex-col gap-2">
               <div className="h-4 bg-muted animate-pulse rounded w-3/4 mx-auto mb-2"></div>
               <div className="flex gap-2">
                 <div className="h-5 bg-muted animate-pulse rounded-full w-1/3"></div>
                 <div className="h-5 bg-muted animate-pulse rounded-full w-1/3"></div>
               </div>
               <div className="mt-2 h-8 bg-muted animate-pulse rounded-lg w-full"></div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

async function MarketedProductsContent({ lang, page }: { lang: string; page: number }) {
  const limit = 20

  const [data, dict] = await Promise.all([
    (tradingService.getMarketedProducts(lang, page, limit).catch(() => null)) as Promise<ProductData | null>,
    getDictionary(lang).catch(() => ({}))
  ])

  const commonDict = (dict as Record<string, any>).common || {}
  const common = {
    back: commonDict.back || "Back",
    addProduct: commonDict.add_product || "Add Product",
    buy: commonDict.buy || "Buy",
    sell: commonDict.sell || "Sell",
    viewDetails: commonDict.view_details || "View Details",
    marketedProducts: "Marketed Products",
  }

  const assetsUrl = getAssetsUrl(); const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`

  if (!data || data.products.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No products found</h1>
          <Link href={`/${lang}`} className="text-brand-blue hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(data.total / limit)

  return (
    <>
      <PageHeader title={common.marketedProducts} backText={common.back} />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mt-4">
        {data.products.map((product, index) => {
          const mappedProduct = {
            id: product.id,
            name: product.name,
            product_code: product.product_code,
            slug: product.slug,
            image: product.image,
            thumbnail: product.thumbnail,
            quality_specification: product.quality_specification,
            category: product.category ? {
              id: product.category.id,
              name: product.category.name
            } : undefined,
            country: product.country ? {
              id: product.country.id,
              name: product.country.name,
              flag: product.country.flag,
              iso2: product.country.iso2
            } : undefined,
            loading_ports: product.loading_ports?.map(lp => ({
              price: lp.price,
              port: lp.port ? { name: lp.port.name } : undefined
            }))
          };
          
          return (
            <MarketedProductCard
              key={product.id}
              product={mappedProduct as any}
              lang={lang}
              common={common}
              imageBaseUrl={imageBaseUrl}
              isLCP={index === 0}
            />
          );
        })}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        baseUrl={`/${lang}/marketed-products`}
      />
      
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
                  "name": common.marketedProducts,
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/marketed-products`
                }
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              "itemListElement": data.products.map((product, index) => {
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
              })
            }
          ]).replace(/</g, '\\u003c')
        }}
      />
    </>
  )
}

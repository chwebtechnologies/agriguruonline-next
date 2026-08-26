import { cache } from 'react'
import Link from 'next/link'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { getDictionary } from '@/app/[lang]/dictionaries'
import type { Metadata } from 'next'
import { getTradingApiUrl, getAssetsUrl } from '@/lib/api-utils';

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

const getProducts = cache(async (slug: string, subSlug: string, lang: string): Promise<ProductData | null> => {
  const tradingApiUrl = getTradingApiUrl(); const url = `${tradingApiUrl}/product/for-subcategory/web/${slug}/${subSlug}?lang_code=${lang}&is_active=true&source=web`

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }
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
    console.error('Failed to fetch products:', error)
    return null
  }
})

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string; subSlug: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = params?.lang || 'en';
  const slug = params?.slug ? decodeURIComponent(params.slug) : '';
  const subSlug = params?.subSlug ? decodeURIComponent(params.subSlug) : '';

  const data = await getProducts(slug, subSlug, lang);

  let formattedName = data?.sub_category?.name || subSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const categoryName = slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const title = `${formattedName} Prices & Trade Listings`;
  const fullTitle = `${formattedName} Prices & Trade Listings | AgriGuru Online`;
  const description = `Looking to trade ${formattedName}? View active ${categoryName} listings and check live market prices. Explore global B2B trade opportunities on AgriGuru Online.`

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const imageUrl = `${siteUrl}/logo.png`
  const pageUrl = `${siteUrl}/${lang}/category/${slug}/${subSlug}`

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
      url: pageUrl,
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
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${siteUrl}/en/category/${slug}/${subSlug}`,
        ar: `${siteUrl}/ar/category/${slug}/${subSlug}`,
        fr: `${siteUrl}/fr/category/${slug}/${subSlug}`,
        zh: `${siteUrl}/zh/category/${slug}/${subSlug}`,
        'x-default': `${siteUrl}/en/category/${slug}/${subSlug}`,
      }
    }
  }
}

export default async function SubCategoryProductsPage(
  props: { params: Promise<{ lang: string; slug: string; subSlug: string }> }
) {
  const params = await props.params;
  const lang = params?.lang || 'en'
  const slug = params?.slug || ''
  const subSlug = params?.subSlug || ''

  const [data, dict] = await Promise.all([
    getProducts(slug, subSlug, lang),
    getDictionary(lang)
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
          <Link href={`/${lang}/category/${slug}`} className="text-brand-blue hover:underline">
            Return to Category
          </Link>
        </div>
      </div>
    )
  }

  const pageTitle = data.sub_category?.name ? `${data.sub_category.name} ${common.productList}` : common.productList;

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={pageTitle} backText={common.back} />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mt-4">
            {data.products.map((product, index) => {
              const productName = product.name || product.slug || 'Agricultural Commodity';
              const imageUrl = product.image
                ? (product.image.startsWith('http') ? product.image : `${imageBaseUrl}${product.image}`)
                : 'https://agriguruonline.com/logo.png'

              return (
                <div
                  key={product.id}
                  title={productName}
                  className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs"
                >
                  <div className="relative w-full aspect-square bg-card/30 overflow-hidden border-b border-border" title={productName}>
                    <ImageWithSkeleton
                      src={imageUrl}
                      alt={productName}
                      title={productName}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      priority={index < 10}
                    />
                  </div>

                  <div className="p-2 sm:p-3 flex flex-col flex-1">
                    <h2 className="text-[14px] sm:text-[16px] font-bold text-center text-foreground mb-2 line-clamp-2 leading-tight min-h-[34px]" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}>
                      {product.name}
                    </h2>

                    <div className="mt-auto space-y-1.5">
                      <button className="w-full bg-brand-blue hover:opacity-90 text-white font-bold py-1.5 px-2 rounded-lg text-[13px] sm:text-[15px] transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] cursor-pointer" title={`${common.addProduct} - ${product.name}`}>
                        <i className="fa-solid fa-plus text-xs"></i>
                        {common.addProduct}
                      </button>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button className="bg-brand-green hover:opacity-90 text-white font-bold py-1.5 px-1 rounded-lg text-[13px] sm:text-[15px] transition-all flex items-center justify-center gap-1 shadow-xs active:scale-[0.98] cursor-pointer" title={`${common.buy} - ${product.name}`}>
                          <i className="fa-solid fa-cart-shopping text-[10px]"></i>
                          {common.buy}
                        </button>
                        <button className="bg-brand-red hover:opacity-90 text-white font-bold py-1.5 px-1 rounded-lg text-[13px] sm:text-[15px] transition-all flex items-center justify-center gap-1 shadow-xs active:scale-[0.98] cursor-pointer" title={`${common.sell} - ${product.name}`}>
                          <i className="fa-solid fa-tag text-[10px]"></i>
                          {common.sell}
                        </button>
                      </div>

                      <Link
                        href={`/${lang}/product/${product.slug}`}
                        title={`${common.viewDetails} - ${product.name}`}
                        className="w-full block text-center border border-border bg-background hover:bg-muted text-foreground font-semibold py-1.5 px-2 rounded-lg text-[13px] sm:text-[15px] transition-colors mt-0.5"
                      >
                        {common.viewDetails}
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

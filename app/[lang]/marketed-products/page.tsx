import { cache } from 'react'
import Link from 'next/link'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { Pagination } from '@/components/ui/Pagination'
import { MarketedProductCard } from '@/components/marketed-products/MarketedProductCard'
import type { Metadata } from 'next'

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

const getMarketedProducts = cache(async (lang: string, page: number, limit: number): Promise<ProductData | null> => {
  const tradingApiUrl = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://trading-api.agriguruonline.cloud'
  const url = `${tradingApiUrl}/product?is_active=true&is_marketed=true&lang_code=${lang}&source=web&page=${page}&limit=${limit}`

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
    console.error('Failed to fetch marketed products:', error)
    return null
  }
})

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = params.lang || 'en'
  const title = "Marketed Products"
  
  return {
    title: `${title} | AgriGuru Online`,
    description: `Browse ${title} on AgriGuru Online`,
  }
}

export default async function MarketedProductsPage(
  props: { params: Promise<{ lang: string }>, searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }
) {
  const params = await props.params;
  const lang = params.lang || 'en'
  const searchParams = await props.searchParams;
  
  const pageStr = searchParams?.page
  const page = typeof pageStr === 'string' ? parseInt(pageStr, 10) : 1
  const limit = 20

  const [data, dict] = await Promise.all([
    getMarketedProducts(lang, page, limit),
    getDictionary(lang)
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

  const assetsUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.cloud'
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`

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
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5 px-2 sm:px-0">
          <PageHeader title={common.marketedProducts} backText={common.back} />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mt-4">
          {data.products.map((product, index) => (
            <MarketedProductCard 
              key={product.id}
              product={product}
              lang={lang}
              common={common}
              imageBaseUrl={imageBaseUrl}
              priority={index < 10}
            />
          ))}
          </div>
          
          <Pagination 
            currentPage={page} 
            totalPages={totalPages} 
            baseUrl={`/${lang}/marketed-products`}
          />
        </div>
      </div>
    </div>
  )
}

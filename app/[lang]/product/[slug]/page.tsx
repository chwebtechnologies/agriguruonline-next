import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { getDictionary } from '@/app/[lang]/dictionaries'
import type { Metadata } from 'next'
import { getTradingApiUrl, getAssetsUrl } from '@/lib/api-utils'

interface ProductDetail {
  id: string
  name: string
  product_code: string
  slug?: string
  image: string
  thumbnail: string
  description: string
  quality_specification: string
  category: {
    id: string
    name: string
  }
  country?: {
    name: string
    flag: string
    iso2?: string
  }
  tags?: string
  hsn_sac_code?: string
  containers?: {
    id: string
    loading_capacity: string
    shipping_container: { title: string }
    unit: { title: string }
  }[]
  packing_types?: {
    id: string
    title: string
    quantity: number
    packing_charge: number
  }[]
  loading_ports?: {
    id: string
    name: string
    price: number
    destination_ports: { name: string }[]
  }[]
}

interface SimilarProduct {
  id: string
  name: string
  product_code: string
  slug: string
  image: string
  thumbnail: string
  category?: {
    id: string
    name: string
  }
}

const getProduct = cache(async (slug: string, lang: string): Promise<ProductDetail | null> => {
  const tradingApiUrl = getTradingApiUrl()
  const url = `${tradingApiUrl}/product/${slug}?lang_code=${lang}&source=web`

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
    console.error('Failed to fetch product detail:', error)
    return null
  }
})

const getSimilarProducts = cache(async (categoryId: string, lang: string, currentSlug: string): Promise<SimilarProduct[]> => {
  const tradingApiUrl = getTradingApiUrl()
  const url = `${tradingApiUrl}/product?lang_code=${lang}&source=web&limit=10&category=${categoryId}`

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }
    })

    if (!res.ok) return []

    const json = await res.json()
    if (json.success && json.data && json.data.products) {
      return json.data.products.filter((p: SimilarProduct) => p.slug !== currentSlug).slice(0, 5)
    }
    return []
  } catch (error) {
    console.error('Failed to fetch similar products:', error)
    return []
  }
})

import { getAlternates, getSafeLanguage } from '@/lib/seo'

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);
  const slug = params?.slug ? decodeURIComponent(params.slug) : '';

  const data = await getProduct(slug, lang);

  const productName = data?.name || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const title = `${productName} | AgriGuru Online`
  
  const fallbackDescriptions: Record<string, string> = {
    en: `Buy and sell ${productName} on AgriGuru Online. Check live market prices, specifications, and verified global suppliers.`,
    ar: `بيع وشراء ${productName} على AgriGuru Online. تحقق من أسعار السوق اللحظية، المواصفات الفنية، والموردين المعتمدين عالمياً.`,
    zh: `在 AgriGuru Online 上买卖 ${productName}。实时查看全球市场价格行情、规格参数与认证供应商。`,
    fr: `Achetez et vendez ${productName} sur AgriGuru Online. Consultez les cours en direct, spécifications et fournisseurs vérifiés.`,
  }

  const rawDescription = data?.description?.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim()
  const description = (rawDescription && rawDescription.length > 10 ? rawDescription.substring(0, 160) : fallbackDescriptions[lang]) || fallbackDescriptions.en

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const imageUrl = data?.image ? `${getAssetsUrl()}/${data.image}` : `${siteUrl}/logo.png`
  const alternates = getAlternates(`product/${params.slug}`, lang)

  return {
    title,
    description,
    keywords: [
      productName,
      `${productName} Price`,
      `${productName} Export Import`,
      'AgriGuru Online',
      'Agricultural Commodities'
    ],
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      siteName: 'AgriGuru Online',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: productName }],
      locale: lang,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates,
  }
}

function parseSpecifications(html?: string) {
  if (!html) return { tableData: [], otherData: [] }
  let decoded = html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  const textWithNewlines = decoded
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
  const items = textWithNewlines.split('\n').map((s) => s.trim()).filter(Boolean)
  const tableData: { key: string; value: string }[] = []
  const otherData: string[] = []

  items.forEach((item) => {
    const cleanItem = item.replace(/,$/, '').trim()
    const colonIndex = cleanItem.indexOf(':')
    if (colonIndex > 0) {
      const key = cleanItem.substring(0, colonIndex).trim()
      const value = cleanItem.substring(colonIndex + 1).trim()
      if (key.length < 50 && value) {
        tableData.push({ key, value })
      } else {
        otherData.push(cleanItem)
      }
    } else {
      otherData.push(cleanItem)
    }
  })
  return { tableData, otherData }
}

export default async function ProductDetailPage(
  props: { params: Promise<{ lang: string; slug: string }> }
) {
  const params = await props.params;
  const lang = params?.lang || 'en'
  const slug = params?.slug || ''

  const [product, dict] = await Promise.all([
    getProduct(slug, lang),
    getDictionary(lang)
  ])
  
  const commonDict = (dict as Record<string, any>)?.common || {}
  const common = {
    back: commonDict.back || "Back",
    addProduct: commonDict.add_product || "Add Product",
    buy: commonDict.buy || "Buy",
    sell: commonDict.sell || "Sell",
    specifications: commonDict.specifications || "Specifications",
    description: commonDict.description || "Description",
    category: commonDict.category || "Category",
    origin: commonDict.origin || "Origin",
    relatedProducts: commonDict.related_products || "Similar Products",
    viewDetails: commonDict.view_details || "View Details",
  }

  const assetsUrl = getAssetsUrl(); 
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`

  if (!product) {
    notFound()
  }

  const similarProducts = product.category?.id ? await getSimilarProducts(product.category.id, lang, slug) : []

  const productName = product.name || 'Product Detail'
  const rawImg = product.image || product.thumbnail;
  const imageUrl = rawImg
    ? (rawImg.startsWith('http') ? rawImg : `${imageBaseUrl}${rawImg}`)
    : 'https://agriguruonline.com/logo.png'

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={productName} backText={common.back} />

          <div className="mt-4 sm:mt-5 bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 p-4 sm:p-5 md:p-6">
              
              {/* Product Image Section (Side-by-side with title on mobile) */}
              <div className="flex flex-row md:flex-col gap-4 md:gap-0 md:space-y-4 md:col-span-5 lg:col-span-4">
                <div className="relative w-2/5 md:w-full aspect-square bg-muted rounded-xl overflow-hidden border border-border flex-shrink-0">
                  <Image
                    src={imageUrl}
                    alt={productName}
                    title={productName}
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 768px) 40vw, 33vw"
                  />
                </div>
                
                {/* Mobile Title & Tags */}
                <div className="flex flex-col md:hidden justify-start pt-1 flex-1 space-y-2.5">
                  <h1 className="text-lg sm:text-xl font-bold text-foreground leading-tight">{productName}</h1>
                  <p className="text-muted-foreground text-sm font-semibold">Product Code: {product.product_code}</p>
                  
                  <div className="flex flex-col gap-1.5 pt-1">
                    {product.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-sm font-medium w-max">
                        {product.category.name}
                      </span>
                    )}
                    {product.country && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-foreground text-sm font-medium border border-border w-max">
                        {product.country.flag && (
                          <img 
                            src={product.country.flag.startsWith('http') ? product.country.flag : `${imageBaseUrl}${product.country.flag}`} 
                            alt={product.country.name}
                            title={product.country.name}
                            className="w-4 h-4 object-cover rounded-full shadow-sm"
                          />
                        )}
                        {product.country.name}
                      </span>
                    )}
                    {product.hsn_sac_code && (
                       <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-foreground text-sm font-medium border border-border w-max">
                       HSN: {product.hsn_sac_code}
                     </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons (Desktop) */}
                <div className="hidden md:flex flex-col gap-2 mt-2">
                  <button className="w-full bg-brand-blue hover:opacity-90 text-white font-bold py-2.5 sm:py-3 px-4 rounded-xl text-sm md:text-base transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]">
                    <i className="fa-solid fa-plus"></i>
                    <span>{common.addProduct}</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="bg-brand-green hover:opacity-90 text-white font-bold py-2.5 sm:py-3 px-4 rounded-xl text-sm md:text-base transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]">
                      <i className="fa-solid fa-cart-shopping"></i>
                      <span>{common.buy}</span>
                    </button>
                    <button className="bg-brand-red hover:opacity-90 text-white font-bold py-2.5 sm:py-3 px-4 rounded-xl text-sm md:text-base transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]">
                      <i className="fa-solid fa-tag"></i>
                      <span>{common.sell}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Product Info Section */}
              <div className="flex flex-col space-y-6 md:col-span-7 lg:col-span-8">
                {/* Desktop Title & Tags */}
                <div className="hidden md:block">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{productName}</h1>
                  <p className="text-muted-foreground text-sm mb-4 font-semibold">Product Code: {product.product_code}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {product.category && (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-brand-blue/10 text-brand-blue text-sm font-medium">
                        {product.category.name}
                      </span>
                    )}
                    {product.country && (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-foreground text-sm font-medium border border-border">
                        {product.country.flag && (
                          <img 
                            src={product.country.flag.startsWith('http') ? product.country.flag : `${imageBaseUrl}${product.country.flag}`} 
                            alt={product.country.name}
                            title={product.country.name}
                            className="w-5 h-5 object-cover rounded-full shadow-sm"
                          />
                        )}
                        {product.country.name}
                      </span>
                    )}
                    {product.hsn_sac_code && (
                       <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-muted text-foreground text-sm font-medium border border-border">
                       HSN: {product.hsn_sac_code}
                     </span>
                    )}
                  </div>
                </div>

                <hr className="border-border" />

                {/* Specifications & Description */}
                <div className="space-y-6">
                  {product.quality_specification && (() => {
                    const parsedSpecs = parseSpecifications(product.quality_specification);
                    if (parsedSpecs.tableData.length === 0 && parsedSpecs.otherData.length === 0) return null;
                    return (
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                          <i className="fa-solid fa-list-check text-brand-green"></i>
                          <span>{common.specifications}</span>
                        </h3>
                        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                          {parsedSpecs.tableData.length > 0 && (
                            <table className="w-full text-sm text-left">
                              <tbody className="divide-y divide-border/60">
                                {parsedSpecs.tableData.map((row, i) => (
                                  <tr key={i} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-3.5 py-2.5 font-bold text-foreground/80 bg-background/40 w-[40%] sm:w-1/3 border-r border-border align-top">
                                      {row.key}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-foreground font-semibold align-top">
                                      {row.value}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {parsedSpecs.otherData.length > 0 && (
                            <div className="p-3.5 bg-background/50 text-sm text-foreground/80 leading-relaxed border-t border-border">
                              {parsedSpecs.otherData.map((text, i) => (
                                <p key={i} className="mb-1.5 last:mb-0 flex items-start gap-2">
                                  <span className="text-brand-blue/60 mt-0.5">•</span>
                                  <span>{text}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {product.description && (
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-align-left text-brand-blue"></i>
                        <span>{common.description}</span>
                      </h3>
                      <div className="p-4 bg-background/50 rounded-xl border border-border">
                        <div 
                          className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: product.description }} 
                        />
                      </div>
                    </div>
                  )}
                </div>

                <hr className="border-border" />

                {/* Additional Information Grids */}
                {(product.packing_types?.length || product.containers?.length || product.loading_ports?.length) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {product.packing_types && product.packing_types.length > 0 && (
                      <div className="bg-muted/40 p-4 rounded-xl border border-border">
                         <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                          <i className="fa-solid fa-box text-brand-blue"></i> Packing Types
                         </h4>
                         <ul className="space-y-2">
                           {product.packing_types.map(pt => (
                             <li key={pt.id} className="text-sm text-muted-foreground flex justify-between">
                               <span>{pt.title}</span>
                               <span className="font-medium text-foreground">{pt.quantity} qty</span>
                             </li>
                           ))}
                         </ul>
                      </div>
                    )}
                    {product.containers && product.containers.length > 0 && (
                      <div className="bg-muted/40 p-4 rounded-xl border border-border">
                         <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                          <i className="fa-solid fa-truck-fast text-brand-blue"></i> Containers
                         </h4>
                         <ul className="space-y-2">
                           {product.containers.map(c => (
                             <li key={c.id} className="text-sm text-muted-foreground flex justify-between">
                               <span className="line-clamp-1">{c.shipping_container?.title}</span>
                               <span className="font-medium text-foreground ml-2">{c.loading_capacity} {c.unit?.title}</span>
                             </li>
                           ))}
                         </ul>
                      </div>
                    )}
                    {product.loading_ports && product.loading_ports.length > 0 && (
                      <div className="bg-muted/40 p-4 rounded-xl border border-border sm:col-span-2 xl:col-span-1">
                         <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                          <i className="fa-solid fa-ship text-brand-blue"></i> Loading Ports
                         </h4>
                         <ul className="space-y-2">
                           {product.loading_ports.slice(0, 3).map(lp => (
                             <li key={lp.id} className="text-sm text-muted-foreground flex justify-between">
                               <span>{lp.name}</span>
                               <span className="font-medium text-foreground">${lp.price}</span>
                             </li>
                           ))}
                           {product.loading_ports.length > 3 && (
                             <li className="text-xs text-brand-blue italic">+ {product.loading_ports.length - 3} more</li>
                           )}
                         </ul>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Action Buttons (Mobile) */}
                <div className="flex md:hidden flex-col gap-2 mt-6">
                  <button className="w-full bg-brand-blue hover:opacity-90 text-white font-bold py-2.5 sm:py-3 px-4 rounded-xl text-sm md:text-base transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]">
                    <i className="fa-solid fa-plus"></i>
                    <span>{common.addProduct}</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="bg-brand-green hover:opacity-90 text-white font-bold py-2.5 sm:py-3 px-4 rounded-xl text-sm md:text-base transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]">
                      <i className="fa-solid fa-cart-shopping"></i>
                      <span>{common.buy}</span>
                    </button>
                    <button className="bg-brand-red hover:opacity-90 text-white font-bold py-2.5 sm:py-3 px-4 rounded-xl text-sm md:text-base transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]">
                      <i className="fa-solid fa-tag"></i>
                      <span>{common.sell}</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Similar Products Section */}
          {similarProducts.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-foreground mb-4">{common.relatedProducts}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
                {similarProducts.map((simProduct, index) => {
                  const simProductName = simProduct.name || simProduct.slug || 'Agricultural Commodity';
                  const simRawImg = simProduct.thumbnail || simProduct.image;
                  const simImageUrl = simRawImg
                    ? (simRawImg.startsWith('http') ? simRawImg : `${imageBaseUrl}${simRawImg}`)
                    : 'https://agriguruonline.com/logo.png'

                  return (
                    <div
                      key={simProduct.id}
                      title={simProductName}
                      className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs"
                    >
                      <Link href={`/${lang}/product/${simProduct.slug}`} prefetch={true} className="relative w-full aspect-square bg-muted overflow-hidden border-b border-border block" title={simProductName} tabIndex={-1} aria-hidden="true">
                        <ImageWithSkeleton
                          src={simImageUrl}
                          alt={simProductName}
                          title={simProductName}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </Link>

                      <div className="p-2 sm:p-3 flex flex-col flex-1">
                        <h2 className="text-[14px] sm:text-[16px] font-bold text-center text-foreground mb-2 line-clamp-2 leading-tight min-h-[34px]" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}>
                          <Link href={`/${lang}/product/${simProduct.slug}`} prefetch={true} className="hover:text-brand-blue transition-colors">
                            {simProduct.name}
                          </Link>
                        </h2>

                        <div className="mt-auto space-y-1.5">
                          <button className="w-full bg-brand-blue hover:opacity-90 text-white font-bold py-1.5 px-2 rounded-lg text-[13px] sm:text-[15px] transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] cursor-pointer" title={`${common.addProduct} - ${simProduct.name}`}>
                            <i className="fa-solid fa-plus text-xs"></i>
                            {common.addProduct}
                          </button>

                          <div className="grid grid-cols-2 gap-1.5">
                            <button className="bg-brand-green hover:opacity-90 text-white font-bold py-1.5 px-1 rounded-lg text-[13px] sm:text-[15px] transition-all flex items-center justify-center gap-1 shadow-xs active:scale-[0.98] cursor-pointer" title={`${common.buy} - ${simProduct.name}`}>
                              <i className="fa-solid fa-cart-shopping text-[10px]"></i>
                              {common.buy}
                            </button>
                            <button className="bg-brand-red hover:opacity-90 text-white font-bold py-1.5 px-1 rounded-lg text-[13px] sm:text-[15px] transition-all flex items-center justify-center gap-1 shadow-xs active:scale-[0.98] cursor-pointer" title={`${common.sell} - ${simProduct.name}`}>
                              <i className="fa-solid fa-tag text-[10px]"></i>
                              {common.sell}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
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
                  "name": (dict as Record<string, any>)?.navigation?.products || "Products",
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/category`
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": product.category?.name || "Category",
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/category/${(product.category as any)?.slug || ''}`
                },
                {
                  "@type": "ListItem",
                  "position": 4,
                  "name": productName,
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/product/${slug}`
                }
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": productName,
              "image": imageUrl,
              "description": product.description?.replace(/<[^>]+>/g, '').substring(0, 160) || productName,
              "sku": product.product_code || slug,
              "brand": {
                "@type": "Brand",
                "name": "AgriGuru Online"
              }
            }
          ]).replace(/</g, '\\u003c')
        }}
      />
    </div>
  )
}

import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import DOMPurify from 'isomorphic-dompurify'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { getDictionary } from '@/app/[lang]/dictionaries'
import type { Metadata } from 'next'
import { getAssetsUrl, getNormalizedUserType } from '@/lib/api-utils'
import { tradingService } from '@/lib/api/trading.service'
import { getClientAuthData } from '@/app/actions/authData'
import { ProductActionButtons } from '@/components/marketed-products/ProductActionButtons'

export const revalidate = 60;

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


import { getAlternates, getSafeLanguage } from '@/lib/seo'

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);
  const slug = params?.slug ? decodeURIComponent(params.slug) : '';

  const data = await tradingService.getProduct(slug, lang);

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
  const decoded = html
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

import { Suspense } from 'react'

export default async function ProductDetailPage(props: { params: Promise<{ lang: string; slug: string }> }) {
  const params = await props.params;
  const lang = params?.lang || 'en'
  const slug = params?.slug || ''

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <Suspense fallback={<ProductDetailSkeleton slug={slug} />}>
            <ProductDetailContent lang={lang} slug={slug} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function ProductDetailSkeleton({ slug }: { slug: string }) {
  const productName = slug ? slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Loading...';
  
  return (
    <>
      <PageHeader title={productName} backText="Back" />
      <div className="mt-4 sm:mt-5 bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 p-4 sm:p-5 md:p-6">
          <div className="flex flex-row md:flex-col gap-4 md:gap-0 md:space-y-4 md:col-span-5 lg:col-span-4">
            <div className="relative w-2/5 md:w-full aspect-square bg-muted animate-pulse rounded-xl border border-border flex-shrink-0"></div>
            <div className="flex flex-col md:hidden justify-start pt-1 flex-1 space-y-2.5">
               <div className="h-6 bg-muted animate-pulse rounded w-3/4"></div>
               <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
            </div>
            <div className="hidden md:flex flex-col gap-2 mt-2">
               <div className="h-12 w-full bg-muted animate-pulse rounded-xl"></div>
               <div className="grid grid-cols-2 gap-2">
                 <div className="h-12 bg-muted animate-pulse rounded-xl"></div>
                 <div className="h-12 bg-muted animate-pulse rounded-xl"></div>
               </div>
            </div>
          </div>
          <div className="flex flex-col space-y-6 md:col-span-7 lg:col-span-8">
            <div className="hidden md:block">
              <div className="h-8 bg-muted animate-pulse rounded w-2/3 mb-4"></div>
              <div className="h-5 bg-muted animate-pulse rounded w-1/3 mb-4"></div>
              <div className="flex gap-2">
                <div className="h-8 w-24 bg-muted animate-pulse rounded-full"></div>
                <div className="h-8 w-32 bg-muted animate-pulse rounded-full"></div>
              </div>
            </div>
            <hr className="border-border" />
            <div className="space-y-4">
              <div className="h-6 w-48 bg-muted animate-pulse rounded mb-4"></div>
              <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
              <div className="h-4 w-5/6 bg-muted animate-pulse rounded"></div>
              <div className="h-4 w-4/6 bg-muted animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

async function ProductDetailContent({ lang, slug }: { lang: string; slug: string }) {
  const [product, dict, authData] = await Promise.all([
    tradingService.getProduct(slug, lang).catch(() => null),
    getDictionary(lang).catch(() => ({})),
    getClientAuthData(lang).catch(() => ({ userProfile: null }))
  ])
  
  const userType = getNormalizedUserType(authData.userProfile?.user_type);
  
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

  const similarProducts = product.category?.id ? await tradingService.getSimilarProducts(product.category.id, lang, slug) : []

  const productName = product.name || 'Product Detail'
  const rawImg = product.image || product.thumbnail;
  const imageUrl = rawImg
    ? (rawImg.startsWith('http') ? rawImg : `${imageBaseUrl}${rawImg}`)
    : 'https://agriguruonline.com/logo.png'

  return (
    <>
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
                priority={true}
                loading="eager"
                fetchPriority="high"
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
            <ProductActionButtons 
              productSlugOrId={slug}
              lang={lang}
              common={common}
              userType={userType}
              layout="stacked"
              className="hidden md:flex mt-2"
              size="md"
              productName={productName}
              countryName={product.country?.name || 'Unknown'}
              price={product.loading_ports && product.loading_ports.length > 0 && product.loading_ports[0].price > 0 ? product.loading_ports[0].price : '0.00'}
            />
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
                      className="prose prose-sm dark:prose-invert max-w-none text-foreground/80 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} 
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
            <ProductActionButtons 
              productSlugOrId={slug}
              lang={lang}
              common={common}
              userType={userType}
              layout="stacked"
              className="flex md:hidden mt-6"
              size="md"
              productName={productName}
              countryName={product.country?.name || 'Unknown'}
              price={product.loading_ports && product.loading_ports.length > 0 && product.loading_ports[0].price > 0 ? product.loading_ports[0].price : '0.00'}
            />

          </div>
        </div>
      </div>

      {/* Similar Products Section */}
      {similarProducts.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-foreground mb-4">{common.relatedProducts}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
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
                    <h2 className="text-[14px] sm:text-[16px] font-bold text-center text-foreground mb-2 line-clamp-2 leading-tight min-h-[34px]" >
                      <Link href={`/${lang}/product/${simProduct.slug}`} prefetch={true} className="hover:text-brand-blue transition-colors">
                        {simProduct.name}
                      </Link>
                    </h2>

                    <div className="mt-auto space-y-1.5">
                      <ProductActionButtons 
                        productSlugOrId={simProduct.slug || simProduct.id}
                        lang={lang}
                        common={common}
                        userType={userType}
                        layout="stacked"
                        className="gap-1.5"
                        size="sm"
                        productName={simProductName}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
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
    </>
  )
}

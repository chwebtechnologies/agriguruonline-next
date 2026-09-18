import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ActionButton } from '@/components/ui/ActionButton'
import { MarketedProductCardClient } from './MarketedProductCardClient'

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

interface MarketedProductCardProps {
  product: Product
  lang: string
  common: any
  imageBaseUrl: string
  isLCP?: boolean
}

export function MarketedProductCard({ product, lang, common, imageBaseUrl, isLCP = false }: MarketedProductCardProps) {
  const imageUrl = product.thumbnail || product.image
    ? ((product.thumbnail || product.image).startsWith('http') ? (product.thumbnail || product.image) : `${imageBaseUrl}${product.thumbnail || product.image}`)
    : 'https://agriguruonline.com/logo.png'

  const flagUrl = product.country?.flag ? (product.country.flag.startsWith('http') ? product.country.flag : `${imageBaseUrl}${product.country.flag}`) : null

  // --- Helper to parse specifications ---
  const parseSpecifications = (html?: string) => {
    if (!html) return { tableData: [], otherData: [] };

    const decoded = html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');

    const textWithNewlines = decoded
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '');

    const items = textWithNewlines.split('\n').map(s => s.trim()).filter(Boolean);

    const tableData: { key: string, value: string }[] = [];
    const otherData: string[] = [];

    items.forEach(item => {
      const cleanItem = item.replace(/,$/, '').trim();
      const colonIndex = cleanItem.indexOf(':');

      if (colonIndex > 0) {
        const key = cleanItem.substring(0, colonIndex).trim();
        const value = cleanItem.substring(colonIndex + 1).trim();

        if (key.length < 50 && value) {
          tableData.push({ key, value });
        } else {
          otherData.push(cleanItem);
        }
      } else {
        otherData.push(cleanItem);
      }
    });

    return { tableData, otherData };
  }

  const { tableData, otherData } = parseSpecifications(product.quality_specification);
  // -----------------------------------------

  return (
    <div className="group flex flex-col rounded-md bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs relative">
      <div className="relative w-full aspect-square bg-card/20 overflow-hidden border-b border-border">
        <Link prefetch={false} href={`/${lang}/product/${product.slug}`} aria-label={product.name} className="block w-full h-full">
          {isLCP ? (
            <Image
              src={imageUrl}
              alt={product.name}
              title={product.name}
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
              alt={product.name}
              title={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              priority={false}
            />
          )}
        </Link>

        {/* Flag on top-left with solid background */}
        {flagUrl && (
          <div className="absolute top-2 left-2 flex items-center justify-center p-0.5 sm:p-1 bg-white/90 shadow-sm rounded border border-black/10 z-10 pointer-events-none">
            <div className="relative w-5 h-3.5 sm:w-6 sm:h-4 overflow-hidden rounded-[1px]">
              <ImageWithSkeleton
                src={flagUrl}
                alt={product.country?.name || 'Country Flag'}
                title={product.country?.name || 'Country Flag'}
                fill
                sizes="32px"
                className="object-cover"
              />
            </div>
          </div>
        )}

        <MarketedProductCardClient
          product={product}
          lang={lang}
          common={common}
          imageUrl={imageUrl}
          flagUrl={flagUrl}
          tableData={tableData}
          otherData={otherData}
        />
      </div>

      <div className="p-2 flex flex-col flex-1">
        <div className="flex justify-center mb-1">
          <span className="text-[10px] sm:text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider line-clamp-1 text-center">
            {product.category?.name || 'Product'} {product.country?.name ? `• ${product.country.name}` : ''}
          </span>
        </div>
        <h2 className="text-[14px] sm:text-[16px] font-bold text-center text-foreground mb-1.5 line-clamp-2 leading-tight min-h-[34px]" >
          <Link prefetch={false} href={`/${lang}/product/${product.slug}`} className="hover:text-brand-blue transition-colors">
            {product.name}
          </Link>
        </h2>

        <div className="mt-auto">
          {product.loading_ports && product.loading_ports.length > 0 && product.loading_ports[0].price > 0 && (
            <div className="flex items-baseline justify-center gap-1 mt-0.5 mb-2.5">
              <span className="text-[16px] sm:text-[18px] font-extrabold text-foreground/85 mr-0.5 leading-none tracking-tight">
                FOB
              </span>
              <span className="text-[16px] sm:text-[18px] font-extrabold text-emerald-700 dark:text-brand-green leading-none tracking-tight">
                ${product.loading_ports[0].price}
              </span>
              <span className="text-[10px] sm:text-[11px] text-foreground/80 font-semibold uppercase">
                / MT
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Link href={`/${lang}/product/${encodeURIComponent(product.slug || product.id)}`} className="w-full py-1 sm:py-1.5 px-2 rounded text-[13px] sm:text-[15px] font-medium shadow-none bg-brand-blue text-white hover:opacity-90 transition-opacity flex justify-center items-center">
              {common.addProduct}
            </Link>

            <div className="grid grid-cols-2 gap-1.5">
              <Link href={`/${lang}/product/${encodeURIComponent(product.slug || product.id)}?action=buy`} className="py-1 sm:py-1.5 px-1 rounded text-[13px] sm:text-[15px] font-medium shadow-none bg-brand-green text-white hover:opacity-90 transition-opacity flex justify-center items-center">
                {common.buy}
              </Link>
              <Link href={`/${lang}/product/${encodeURIComponent(product.slug || product.id)}?action=sell`} className="py-1 sm:py-1.5 px-1 rounded text-[13px] sm:text-[15px] font-medium shadow-none bg-brand-red text-white hover:opacity-90 transition-opacity flex justify-center items-center">
                {common.sell}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

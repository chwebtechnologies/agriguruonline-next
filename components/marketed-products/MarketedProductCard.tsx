'use client'

import { useState } from 'react'
import Link from 'next/link'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'

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
  priority?: boolean
}

export function MarketedProductCard({ product, lang, common, imageBaseUrl, priority = false }: MarketedProductCardProps) {
  const [showSpecs, setShowSpecs] = useState(false)

  const imageUrl = product.thumbnail || product.image
    ? ((product.thumbnail || product.image).startsWith('http') ? (product.thumbnail || product.image) : `${imageBaseUrl}${product.thumbnail || product.image}`)
    : 'https://agriguruonline.com/logo.png'

  const flagUrl = product.country?.flag ? (product.country.flag.startsWith('http') ? product.country.flag : `${imageBaseUrl}${product.country.flag}`) : null

  // --- Helper to parse specifications ---
  const parseSpecifications = (html?: string) => {
    if (!html) return { tableData: [], otherData: [] };

    let decoded = html
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
    <>
      <div className="group flex flex-col rounded-2xl bg-card border border-ag-header-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs">
        <div className="relative w-full aspect-square bg-ag-subheader-bg/20 overflow-hidden border-b border-ag-header-border">
          <ImageWithSkeleton
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            priority={priority}
          />

          {/* Flag on top-left with solid background */}
          {flagUrl && (
            <div className="absolute top-2 left-2 flex items-center justify-center p-0.5 sm:p-1 bg-white/90 shadow-sm rounded border border-black/10 z-10">
              <div className="relative w-5 h-3.5 sm:w-6 sm:h-4 overflow-hidden rounded-[1px]">
                <ImageWithSkeleton
                  src={flagUrl}
                  alt={product.country?.name || 'Country Flag'}
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              </div>
            </div>
          )}


          {/* Info Icon on top-right to trigger specs modal */}
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowSpecs(true);
            }}
            className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/90 shadow-sm border border-black/10 text-brand-blue hover:scale-110 hover:bg-white transition-all z-10 focus:outline-none"
            aria-label="View Specifications"
          >
            <i className="fa-solid fa-info text-[10px] sm:text-xs"></i>
          </button>
        </div>

        <div className="p-2 flex flex-col flex-1">
          <div className="flex justify-center mb-1">
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#156cb3] uppercase tracking-wider line-clamp-1 text-center">
              {product.category?.name || 'Product'} {product.country?.name ? `• ${product.country.name}` : ''}
            </span>
          </div>
          <h2 className="text-[14px] sm:text-[16px] font-bold text-center text-foreground mb-1.5 line-clamp-2 leading-tight min-h-[34px]" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}>
            {product.name}
          </h2>

          <div className="mt-auto">
            {product.loading_ports && product.loading_ports.length > 0 && product.loading_ports[0].price > 0 && (
              <div className="flex items-baseline justify-center gap-1 mt-0.5 mb-2.5">
                <span className="text-[16px] sm:text-[18px] font-extrabold text-foreground/70 mr-0.5 leading-none tracking-tight">
                  FOB
                </span>
                <span className="text-[16px] sm:text-[18px] font-extrabold text-brand-green leading-none tracking-tight">
                  ${product.loading_ports[0].price}
                </span>
                <span className="text-[10px] sm:text-[11px] text-foreground/60 font-semibold uppercase">
                  / MT
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <button className="w-full bg-brand-blue hover:bg-brand-blue-hover text-white py-1 sm:py-1.5 px-2 rounded text-[13px] sm:text-[15px] font-medium transition-colors flex items-center justify-center gap-1.5">
                <i className="fa-solid fa-plus text-xs"></i>
                {common.addProduct}
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button className="bg-brand-green hover:bg-brand-green-hover text-white py-1 sm:py-1.5 px-1 rounded text-[13px] sm:text-[15px] font-medium transition-colors flex items-center justify-center gap-1">
                  <i className="fa-solid fa-cart-shopping text-[10px]"></i>
                  {common.buy}
                </button>
                <button className="bg-brand-red hover:bg-brand-red-hover text-white py-1 sm:py-1.5 px-1 rounded text-[13px] sm:text-[15px] font-medium transition-colors flex items-center justify-center gap-1">
                  <i className="fa-solid fa-tag text-[10px]"></i>
                  {common.sell}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Specifications Modal */}
      {showSpecs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="bg-background text-foreground rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-ag-header-border flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-ag-header-border flex items-center justify-between bg-ag-subheader-bg">
              <h2 className="font-bold text-lg text-brand-blue flex items-center gap-2">
                <i className="fa-solid fa-file-lines"></i>
                Specifications
              </h2>
              <button
                onClick={() => setShowSpecs(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-foreground focus:outline-none"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-5 py-5 overflow-y-auto bg-[#fdfdfd] dark:bg-background">
              <div className="mb-6 flex flex-row items-center gap-4">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-brand-blue/20 shadow-sm relative flex-shrink-0">
                  <ImageWithSkeleton
                    src={imageUrl}
                    alt={product.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col flex-1 text-left justify-center min-w-0 py-0.5">
                  {/* Top Row: Title + FOB word */}
                  <div className="flex items-end justify-between gap-3 mb-1.5">
                    <h3 className="font-bold text-lg sm:text-xl leading-tight text-foreground/90 truncate">
                      {product.name}
                    </h3>
                    {product.loading_ports && product.loading_ports.length > 0 && product.loading_ports[0].price > 0 && (
                      <span className="font-bold text-lg sm:text-xl text-foreground/50 uppercase whitespace-nowrap leading-tight">
                        FOB
                      </span>
                    )}
                  </div>

                  {/* Bottom Row: Tags + Price */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20 whitespace-nowrap">
                        {flagUrl && (
                          <div className="w-5 h-3.5 rounded-[2px] overflow-hidden flex-shrink-0 border border-black/10 flex items-center justify-center bg-ag-subheader-bg">
                            <img src={flagUrl} alt={product.country?.name || 'Country'} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <span>{product.category?.name} {product.country?.name ? `• ${product.country.name}` : ''}</span>
                      </div>
                      {product.loading_ports && product.loading_ports.length > 0 && product.loading_ports[0].port?.name && (
                        <span className="text-[11px] font-bold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20 whitespace-nowrap">
                          POL: {product.loading_ports[0].port.name}
                        </span>
                      )}
                    </div>

                    {product.loading_ports && product.loading_ports.length > 0 && product.loading_ports[0].price > 0 && (
                      <div className="flex items-baseline gap-1 whitespace-nowrap pl-2 flex-shrink-0">
                        <span className="text-[16px] sm:text-[18px] font-black text-brand-green leading-none">
                          ${product.loading_ports[0].price}
                        </span>
                        <span className="text-[9px] font-bold text-foreground/40 uppercase leading-none">/ MT</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full">
                {tableData.length === 0 && otherData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-foreground/50 gap-3 bg-ag-subheader-bg/30 rounded-xl border border-dashed border-ag-header-border">
                    <i className="fa-solid fa-box-open text-4xl mb-2 text-foreground/30"></i>
                    <p className="font-medium">No specifications available.</p>
                  </div>
                ) : (
                  <>
                    {tableData.length > 0 && (
                      <div className="overflow-hidden rounded-xl border border-ag-header-border bg-background shadow-sm mb-5">
                        <table className="w-full text-sm text-left">
                          <tbody className="divide-y divide-ag-header-border">
                            {tableData.map((row, i) => (
                              <tr key={i} className="hover:bg-ag-subheader-bg/40 transition-colors">
                                <td className="px-4 py-3 font-bold text-foreground/90 bg-ag-subheader-bg/40 w-1/2 border-r border-ag-header-border align-top">
                                  {row.key}
                                </td>
                                <td className="px-4 py-3 text-foreground font-normal align-top">
                                  {row.value}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {otherData.length > 0 && (
                      <div className="bg-ag-subheader-bg/30 rounded-xl p-4 border border-ag-header-border">
                        {tableData.length > 0 && (
                          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/50 mb-3 border-b border-ag-header-border pb-2">
                            Additional Details
                          </h4>
                        )}
                        <div className="space-y-2 text-[14px] text-foreground/80">
                          {otherData.map((text, i) => (
                            <p key={i} className="flex items-start gap-2.5 leading-relaxed">
                              <span className="text-brand-blue mt-[5px] text-[8px]"><i className="fa-solid fa-circle"></i></span>
                              <span>{text}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-4 border-t border-ag-header-border bg-ag-subheader-bg/50 grid grid-cols-3 gap-2.5">
              <button className="bg-brand-green hover:bg-brand-green-hover text-white py-2 sm:py-2.5 px-2 rounded-lg text-[13px] sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                <i className="fa-solid fa-cart-shopping text-xs"></i>
                {common.buy}
              </button>

              <button className="bg-brand-blue hover:bg-brand-blue-hover text-white py-2 sm:py-2.5 px-2 rounded-lg text-[13px] sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                <i className="fa-solid fa-plus text-xs"></i>
                {common.addProduct}
              </button>

              <button className="bg-brand-red hover:bg-brand-red-hover text-white py-2 sm:py-2.5 px-2 rounded-lg text-[13px] sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                <i className="fa-solid fa-tag text-xs"></i>
                {common.sell}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

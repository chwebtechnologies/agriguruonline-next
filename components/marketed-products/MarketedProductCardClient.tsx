'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ActionButton } from '@/components/ui/ActionButton'

interface MarketedProductCardClientProps {
  product: any
  lang: string
  common: any
  imageUrl: string
  flagUrl: string | null
  tableData: { key: string, value: string }[]
  otherData: string[]
}

export function MarketedProductCardClient({ 
  product, 
  lang, 
  common, 
  imageUrl, 
  flagUrl, 
  tableData, 
  otherData 
}: MarketedProductCardClientProps) {
  const router = useRouter()
  const [showSpecs, setShowSpecs] = useState(false)

  const handleActionClick = (e: React.MouseEvent, action: 'buy' | 'sell' | 'add') => {
    e.preventDefault();
    e.stopPropagation();
    const productSlug = product.slug || product.id;
    if (action === 'buy' || action === 'sell') {
      router.push(`/${lang}/product/${encodeURIComponent(productSlug)}?action=${action}`)
    } else {
      router.push(`/${lang}/product/${encodeURIComponent(productSlug)}`)
    }
  }

  return (
    <>
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

      {/* Specifications Modal */}
      {showSpecs && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowSpecs(false)}
        >
          <div
            className="bg-background text-foreground rounded-md w-full max-w-lg shadow-2xl overflow-hidden border border-border flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-card">
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
                    title={product.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col flex-1 text-left justify-center min-w-0 py-0.5">
                  {/* Top Row: Title + FOB word */}
                  <div className="flex items-end justify-between gap-3 mb-1.5">
                    <h2 className="font-bold text-lg sm:text-xl leading-tight text-foreground/90 truncate">
                      {product.name}
                    </h2>
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
                          <div className="w-5 h-3.5 rounded-[2px] overflow-hidden flex-shrink-0 border border-black/10 flex items-center justify-center bg-card relative">
                            <Image src={flagUrl} alt={product.country?.name || 'Country'} title={product.country?.name || 'Country'} fill sizes="20px" className="object-cover" />
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
                        <span className="text-[16px] sm:text-[18px] font-black text-emerald-700 dark:text-brand-green leading-none">
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
                  <div className="flex flex-col items-center justify-center py-10 text-foreground/50 gap-3 bg-card/30 rounded-xl border border-dashed border-border">
                    <i className="fa-solid fa-box-open text-4xl mb-2 text-foreground/30"></i>
                    <p className="font-medium">No specifications available.</p>
                  </div>
                ) : (
                  <>
                    {tableData.length > 0 && (
                      <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm mb-5">
                        <table className="w-full text-sm text-left">
                          <tbody className="divide-y divide-border">
                            {tableData.map((row, i) => (
                              <tr key={i} className="hover:bg-card/40 transition-colors">
                                <td className="px-4 py-3 font-bold text-foreground/90 bg-card/40 w-1/2 border-r border-border align-top">
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
                      <div className="bg-card/30 rounded-xl p-4 border border-border">
                        {tableData.length > 0 && (
                          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/50 mb-3 border-b border-border pb-2">
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
            <div className="px-4 py-4 border-t border-border bg-card/50 grid grid-cols-3 gap-2.5">
              <ActionButton variant="buy" onClick={(e) => handleActionClick(e, 'buy')} className="py-2 sm:py-2.5 px-2 rounded-lg text-[13px] sm:text-sm shadow-sm">
                {common.buy}
              </ActionButton>

              <ActionButton variant="add" onClick={(e) => handleActionClick(e, 'add')} className="py-2 sm:py-2.5 px-2 rounded-lg text-[13px] sm:text-sm shadow-sm">
                {common.addProduct}
              </ActionButton>

              <ActionButton variant="sell" onClick={(e) => handleActionClick(e, 'sell')} className="py-2 sm:py-2.5 px-2 rounded-lg text-[13px] sm:text-sm shadow-sm">
                {common.sell}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

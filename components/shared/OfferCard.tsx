import Link from 'next/link'
import Image from 'next/image'

interface Inquiry {
  id: string
  type: string
  created_at: string
  product: {
    name: string
    country: {
      name: string
      flag: string
      iso2: string
    }
  }
  market_range: string
}

interface OfferCardProps {
  inquiry: Inquiry
  lang: string
  imageBaseUrl: string
  offerType: 'BUYER' | 'SELLER'
}

export function OfferCard({ inquiry, lang, imageBaseUrl, offerType }: OfferCardProps) {
  const flagUrl = inquiry.product.country.flag.startsWith('http') 
    ? inquiry.product.country.flag 
    : `${imageBaseUrl}${inquiry.product.country.flag}`

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  }

  // If this page is "Latest Offers for BUYER", the button should be "Buy"
  // If this page is "Latest Offers for SELLER", the button should be "Sell"
  const isForBuyer = offerType === 'BUYER'
  const buttonText = isForBuyer ? 'Buy' : 'Sell'
  const buttonColorClass = isForBuyer 
    ? 'bg-[var(--brand-green)] hover:bg-[var(--brand-green-hover)] text-white'
    : 'bg-[var(--brand-red)] hover:bg-[var(--brand-red-hover)] text-white'

  // Adjust href based on mode if needed, for now we keep it generic or point to the inquiry details
  const href = isForBuyer ? `/${lang}/latest-offers-for-buyers` : `/${lang}/latest-inquiries-for-sellers`

  return (
    <div className="group flex flex-col rounded-xl bg-muted/40 border border-border/50 overflow-hidden hover:shadow-sm transition-shadow duration-300">
      <div className="px-4 py-3 sm:py-4">
        <div className="grid grid-cols-[65px_1fr] sm:grid-cols-[75px_1fr] gap-x-2 gap-y-3">
          {/* Row 1: Country */}
          <div className="text-muted-foreground font-medium text-[12px] sm:text-[13px] self-center">Country:</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-foreground font-bold text-[14px] sm:text-[15px]">{inquiry.product.country.name}</span>
              {inquiry.product.country.flag && (
                <div className="relative w-[16px] h-[11px] flex-shrink-0 border border-border/50 rounded-sm overflow-hidden shadow-xs">
                  <Image
                    src={flagUrl}
                    alt={inquiry.product.country.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-[12px] sm:text-[13px] font-medium">Date:</span>
              <span className="text-foreground font-bold text-[14px] sm:text-[15px]">{formatDate(inquiry.created_at)}</span>
            </div>
          </div>
          
          {/* Row 2: Product */}
          <div className="text-muted-foreground font-medium text-[12px] sm:text-[13px] self-center">Product:</div>
          <h2 className="text-foreground font-bold text-[14px] sm:text-[15px] line-clamp-1">
            {inquiry.product.name}
          </h2>
          
          {/* Row 3: Price & Action */}
          <div className="text-muted-foreground font-medium text-[12px] sm:text-[13px] self-center">Price:</div>
          <div className="flex items-center justify-between">
            <span className="text-foreground font-bold text-[14px] sm:text-[15px]">{inquiry.market_range}</span>
            <Link 
              href={href} 
              className={`${buttonColorClass} px-5 sm:px-6 py-1 sm:py-1.5 rounded text-[13px] sm:text-sm font-bold shadow-sm transition-colors`}
            >
              {buttonText}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

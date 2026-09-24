import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import ListingFilters from '@/components/shared/ListingFilters'
import { OfferCard } from '@/components/shared/OfferCard'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { tradingService } from '@/lib/api'
import { getAssetsUrl } from '@/lib/api-utils'
import { getClientAuthData } from '@/app/actions/authData'

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

interface InquiriesResponse {
  success: number
  message: string
  data: {
    inquiries: Inquiry[]
    total: number
  }
}

async function getLatestOffers(lang: string, offerType: 'BUYER' | 'SELLER', searchParams?: { search?: string, categoryId?: string }): Promise<InquiriesResponse | null> {
  const apiType = offerType === 'BUYER' ? 'SELLER' : 'BUYER'
  return await tradingService.getLatestTradingInquiries({
    type: apiType,
    page: 1,
    limit: 12,
    search: searchParams?.search,
    categoryId: searchParams?.categoryId,
    lang,
  });
}

interface OffersPageTemplateProps {
  lang: string
  searchParams: { search?: string, category?: string }
  offerType: 'BUYER' | 'SELLER'
  pageTitle: string
}

import { Suspense } from 'react'

export function OffersPageTemplate({ lang, searchParams, offerType, pageTitle }: OffersPageTemplateProps) {
  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <Suspense fallback={<OffersPageSkeleton pageTitle={pageTitle} />}>
            <OffersPageContent lang={lang} searchParams={searchParams} offerType={offerType} pageTitle={pageTitle} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function OffersPageSkeleton({ pageTitle }: { pageTitle: string }) {
  return (
    <>
      <PageHeader title={pageTitle} backText="Back" />
      
      <div className="mt-2 mb-4">
        <div className="h-10 bg-muted animate-pulse rounded-lg max-w-sm"></div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-3 sm:p-5 lg:p-6 mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border border-border rounded-2xl animate-pulse bg-muted/50">
              <div className="w-20 h-20 bg-muted rounded-full shrink-0"></div>
              <div className="flex-1 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

async function OffersPageContent({ lang, searchParams, offerType, pageTitle }: OffersPageTemplateProps) {
  const searchStr = searchParams.search;
  const categoryStr = searchParams.category;

  const apiCategories = await tradingService.getCategories(lang);

  // Resolve slug to ID server-side so ID never leaks to the client
  const matchedCategory = categoryStr ? apiCategories.find(cat => cat.slug === categoryStr) : undefined
  const categoryId = matchedCategory?.id

  const [data, dict, authData] = await Promise.all([
    getLatestOffers(lang, offerType, { search: searchStr, categoryId: categoryId }),
    getDictionary(lang),
    getClientAuthData(lang).catch(() => ({ userProfile: null }))
  ])
  
  const userType = authData.userProfile?.user_type ? (typeof authData.userProfile.user_type === 'string' ? authData.userProfile.user_type.toLowerCase() : String(authData.userProfile.user_type.name || '').toLowerCase()) : null;

  const categoryOptions = apiCategories
    .filter(cat => cat.is_active !== false)
    .map(cat => {
      const translation = cat.translations?.find(t => t.lang_code === lang)
      return { slug: cat.slug, name: translation ? translation.name : cat.name }
    })
  
  const commonDict = (dict as Record<string, any>).common || {}
  const common = {
    back: commonDict.back || "Back"
  }

  const inquiries = data?.data?.inquiries || []

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`

  return (
    <>
      <PageHeader title={pageTitle} backText={common.back} />
      
      <div className="mt-2 mb-4">
        <ListingFilters categories={categoryOptions} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-3 sm:p-5 lg:p-6 mt-4">
        {inquiries.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {inquiries.map((inquiry) => (
              <OfferCard 
                key={inquiry.id} 
                inquiry={inquiry} 
                lang={lang} 
                imageBaseUrl={imageBaseUrl} 
                offerType={offerType}
                userType={userType}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
              <i className="fa-solid fa-box-open text-2xl"></i>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {offerType === 'SELLER' ? 'No Inquiries Found' : 'No Offers Found'}
            </h2>
            <p className="text-foreground/80 max-w-md mx-auto">
              We couldn&apos;t find any active {offerType === 'SELLER' ? 'inquiries' : 'offers'} for {offerType.toLowerCase()}s at the moment. Please check back later.
            </p>
          </div>
        )}
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
                  "name": pageTitle,
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/${offerType === 'SELLER' ? 'latest-inquiries-for-sellers' : 'latest-offers-for-buyers'}`
                }
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              "itemListElement": inquiries.map((inquiry, index) => {
                return {
                  "@type": "ListItem",
                  "position": index + 1,
                  "item": {
                    "@type": "Offer",
                    "name": `${inquiry.product.name} - ${inquiry.product.country.name}`,
                    "url": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/${offerType === 'SELLER' ? 'latest-inquiries-for-sellers' : 'latest-offers-for-buyers'}`,
                    "priceCurrency": "USD",
                    "availability": "https://schema.org/InStock",
                    "seller": {
                      "@type": "Organization",
                      "name": "AgriGuru Online"
                    }
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

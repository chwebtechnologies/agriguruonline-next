import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import ListingFilters from '@/components/shared/ListingFilters'
import { OfferCard } from '@/components/shared/OfferCard'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { getCategories } from '@/lib/category'
import { getTradingApiUrl, getAssetsUrl } from '@/lib/api-utils'

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
  const tradingApiUrl = getTradingApiUrl()
  // If we want latest offers FOR buyers, we fetch SELLER offers.
  // If we want latest offers FOR sellers, we fetch BUYER offers.
  const apiType = offerType === 'BUYER' ? 'SELLER' : 'BUYER'
  
  let url = `${tradingApiUrl}/trading-inquiry/latest/for-web?type=${apiType}&page=1&limit=12&is_active=true&lang_code=${lang}&source=web`
  
  if (searchParams?.search) {
    url += `&search=${encodeURIComponent(searchParams.search)}`
  }
  if (searchParams?.categoryId) {
    url += `&category_id=${encodeURIComponent(searchParams.categoryId)}`
  }

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }
    })

    if (!res.ok) {
      return null
    }

    const json = await res.json()
    return json
  } catch (error) {
    console.error('Failed to fetch latest offers:', error)
    return null
  }
}

interface OffersPageTemplateProps {
  lang: string
  searchParams: { search?: string, category?: string }
  offerType: 'BUYER' | 'SELLER'
  pageTitle: string
}

export async function OffersPageTemplate({ lang, searchParams, offerType, pageTitle }: OffersPageTemplateProps) {
  const searchStr = searchParams.search;
  const categoryStr = searchParams.category;

  const tradingApiUrl = getTradingApiUrl();
  const apiCategories = await getCategories(lang, {
    apiUrl: `${tradingApiUrl.replace(/\/$/, '')}/category`,
    stale: 300,
    revalidate: 0,
    expire: 86400
  })

  // Resolve slug to ID server-side so ID never leaks to the client
  const matchedCategory = categoryStr ? apiCategories.find(cat => cat.slug === categoryStr) : undefined
  const categoryId = matchedCategory?.id

  const [data, dict] = await Promise.all([
    getLatestOffers(lang, offerType, { search: searchStr, categoryId: categoryId }),
    getDictionary(lang)
  ])

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
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
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
    </div>
  )
}

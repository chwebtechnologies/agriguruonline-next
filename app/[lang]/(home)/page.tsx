import { getDictionary } from '../dictionaries'
import { lang } from 'next/root-params'
import HeroCarousel from '@/components/home/HeroCarousel'
import { cmsService } from '@/lib/api/cms.service'
import { tradingService } from '@/lib/api/trading.service'
import InfiniteNewsCarousel from '@/components/home/InfiniteNewsCarousel'
import InfiniteEventsCarousel from '@/components/home/InfiniteEventsCarousel'
import InfiniteMarketedProductsCarousel from '@/components/home/InfiniteMarketedProductsCarousel'
import InfiniteVideoGalleryCarousel from '@/components/home/InfiniteVideoGalleryCarousel'
import InfiniteMarketUpdatesCarousel from '@/components/home/InfiniteMarketUpdatesCarousel'
import InfiniteParticipationCarousel from '@/components/home/InfiniteParticipationCarousel'
import AssociatePartnersCarousel from '@/components/home/AssociatePartnersCarousel'
import LatestOffersForBuyerSection from '@/components/home/LatestOffersForBuyerSection'
import LatestInquiriesForSellerSection from '@/components/home/LatestInquiriesForSellerSection'
import { getClientAuthData } from '@/app/actions/authData'
import { getAssetsUrl } from '@/lib/api-utils'
import type { Metadata } from 'next'

// SEO Organization & WebSite schema component helper
function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://agriguruonline.com/#organization',
        'name': 'AgriGuru Online',
        'url': 'https://agriguruonline.com',
        'logo': {
          '@type': 'ImageObject',
          'url': 'https://agriguruonline.com/logo.png'
        },
        'description': 'The premium B2B SaaS platform for global agricultural trade.'
      },
      {
        '@type': 'WebSite',
        '@id': 'https://agriguruonline.com/#website',
        'url': 'https://agriguruonline.com',
        'name': 'AgriGuru Online',
        'publisher': {
          '@id': 'https://agriguruonline.com/#organization'
        },
        'potentialAction': {
          '@type': 'SearchAction',
          'target': 'https://agriguruonline.com/en/search?q={search_term_string}',
          'query-input': 'required name=search_term_string'
        }
      }
    ]
  }

  return (
    <script
      id="schema-org"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
    />
  )
}

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo'

export async function generateMetadata(
  props: { params?: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = props.params ? await props.params : undefined;
  const activeLang = getSafeLanguage(params?.lang)

  return getStandardMetadata({
    pageKey: 'home',
    pathname: '',
    lang: activeLang,
  })
}

export const revalidate = 60;

import { Suspense } from 'react'

export default async function LocalizedHomePage() {
  const rawLang = await lang()
  const activeLang = getSafeLanguage(rawLang)
  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  return (
    <>
      <OrganizationSchema />
      <div className="bg-background text-foreground transition-theme" dir={dir}>
        <div className="w-full pad-for-badges">
          <div className="max-w-7xl mx-auto pt-3 pb-5 px-2 sm:px-0">
            <HeroCarousel lang={activeLang} />
            
            <Suspense fallback={<HomePageSkeleton />}>
              <LocalizedHomePageContent activeLang={activeLang} />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  )
}

function HomePageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="h-12 sm:h-16 w-3/4 sm:w-1/2 bg-muted animate-pulse rounded-2xl"></div>
    </div>
  )
}

async function LocalizedHomePageContent({ activeLang }: { activeLang: string }) {
  let articles: any[] = [];
  let events: any[] = [];
  let products: any[] = [];
  let videoCategories: any[] = [];
  let marketUpdates: any[] = [];
  let participationCategories: any[] = [];
  let associatePartners: any[] = [];
  let buyerOffers: any[] = [];
  let sellerInquiries: any[] = [];
  
  let userType: string | null = null;
  let commonDict: any = {};
  let pageDict: any = {};
  
  try {
    const [newsData, eventsData, productsData, videoData, marketUpdatesData, participationData, associatePartnersData, fetchedDict, authData, buyerOffersData, sellerInquiriesData] = await Promise.all([
      cmsService.getLatestNews({ lang: activeLang, page: 1, limit: 12 }).catch(() => null),
      cmsService.getLatestEvents({ lang: activeLang, page: 1, limit: 12 }).catch(() => null),
      tradingService.getMarketedProducts(activeLang, 1, 12).catch(() => null),
      cmsService.getVideoCategories().catch(() => null),
      cmsService.getMarketUpdates(activeLang, 1, 12).catch(() => null),
      cmsService.getParticipationCategories(activeLang, 1, 12).catch(() => null),
      cmsService.getAssociatePartners(1, 25).catch(() => null),
      getDictionary(activeLang as any).catch(() => ({})),
      getClientAuthData(activeLang).catch(() => ({ userProfile: null })),
      tradingService.getLatestTradingInquiries({ type: 'SELLER', page: 1, limit: 12, lang: activeLang }).catch(() => null),
      tradingService.getLatestTradingInquiries({ type: 'BUYER', page: 1, limit: 12, lang: activeLang }).catch(() => null)
    ]);
    
    articles = newsData?.data?.news || [];
    events = eventsData?.data?.events || [];
    products = productsData?.products || [];
    videoCategories = (videoData?.data?.categories || []).slice(0, 12);
    marketUpdates = marketUpdatesData?.data?.flyers || [];
    participationCategories = participationData?.data?.categories || [];
    associatePartners = associatePartnersData?.data?.logo || [];
    buyerOffers = buyerOffersData?.data?.inquiries || [];
    sellerInquiries = sellerInquiriesData?.data?.inquiries || [];
    
    pageDict = fetchedDict || {};
    commonDict = (fetchedDict as any).common || {};
    userType = authData?.userProfile?.user_type ? 
      (typeof authData.userProfile.user_type === 'string' 
        ? authData.userProfile.user_type.toLowerCase() 
        : String(authData.userProfile.user_type.name || '').toLowerCase()) 
      : null;
      
  } catch (error) {
    console.error("Failed to fetch data for homepage:", error);
  }

  const common = {
    back: commonDict.back || "Back",
    addProduct: commonDict.add_product || "Add Product",
    buy: commonDict.buy || "Buy",
    sell: commonDict.sell || "Sell",
    inquiry: commonDict.inquiry || "Inquiry",
    loadingPorts: commonDict.loading_ports || "Loading Ports",
    countryOfOrigin: commonDict.country_of_origin || "Country of Origin",
    qualitySpecification: commonDict.quality_specification || "Quality Specification",
    category: commonDict.category || "Category",
    viewDetails: commonDict.view_details || "View Details",
    fobPrice: commonDict.fob_price || "FOB Price",
    inquireNow: commonDict.inquire_now || "Inquire Now",
    perMT: commonDict.per_mt || "/ MT"
  };

  const assetsUrl = getAssetsUrl();
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`;

  return (
    <>
      <section className="w-full pt-4 pb-2">
        <div className="max-w-3xl mx-auto text-center px-4">
          
          {/* Premium Section Title Feel */}
          <div className="inline-block mb-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
              {pageDict?.home?.news_title || 'Global Agri Commodity Trading News'}
              {/* Decorative beautiful underline */}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
            </h2>
          </div>
          
          {/* SEO Description for News only */}
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
            {pageDict?.home?.news_desc || 'Explore daily breaking headlines, international trade policies, and crucial market updates shaping the global agricultural commodity sector for B2B traders.'}
          </p>
          
        </div>
        
        {/* The News Carousel */}
        {articles.length > 0 && (
          <InfiniteNewsCarousel articles={articles} lang={activeLang} dict={pageDict} />
        )}
      </section>

      {/* Events Section */}
      <section className="w-full pt-6 pb-2">
        <div className="max-w-3xl mx-auto text-center px-4">
          
          {/* Premium Section Title Feel */}
          <div className="inline-block mb-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
              {pageDict?.home?.events_title || 'Global Agri Events & Conferences'}
              {/* Decorative beautiful underline */}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
            </h2>
          </div>
          
          {/* SEO Description for Events */}
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
            {pageDict?.home?.events_desc || 'Discover upcoming international agricultural exhibitions, trade shows, and B2B conferences tailored for commodity traders and industry leaders.'}
          </p>
          
        </div>
        
        {/* The Events Carousel */}
        {events.length > 0 && (
          <InfiniteEventsCarousel events={events} lang={activeLang} dict={pageDict} />
        )}
      </section>

      {/* Marketed Products Section */}
      <section className="w-full pt-6 pb-8">
        <div className="max-w-3xl mx-auto text-center px-4">
          {/* Premium Section Title Feel */}
          <div className="inline-block mb-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
              {pageDict?.home?.products_title || 'Premium Marketed Products'}
              {/* Decorative beautiful underline */}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
            </h2>
          </div>
          
          {/* SEO Description for Products */}
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
            {pageDict?.home?.products_desc || 'Source premium agricultural commodities for global trade. Explore top-tier B2B products from trusted international suppliers at AgriGuru Online.'}
          </p>
        </div>
        
        {/* The Products Carousel */}
        {products.length > 0 && (
          <InfiniteMarketedProductsCarousel 
            products={products} 
            lang={activeLang} 
            common={common} 
            imageBaseUrl={imageBaseUrl} 
            userType={userType} 
            dict={pageDict}
          />
        )}
      </section>

      {/* Latest Offers for Buyer Section */}
      <LatestOffersForBuyerSection 
        offers={buyerOffers} 
        lang={activeLang} 
        imageBaseUrl={imageBaseUrl}
        userType={userType}
        dict={pageDict}
      />

      {/* Latest Inquiries for Seller Section */}
      <LatestInquiriesForSellerSection
        inquiries={sellerInquiries}
        lang={activeLang}
        imageBaseUrl={imageBaseUrl}
        userType={userType}
        dict={pageDict}
      />

      {/* Video Gallery Section */}
      <section className="w-full pt-6 pb-8">
        <div className="max-w-3xl mx-auto text-center px-4">
          {/* Premium Section Title Feel */}
          <div className="inline-block mb-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
              {pageDict?.home?.video_title || 'Agri Video Gallery & Insights'}
              {/* Decorative beautiful underline */}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
            </h2>
          </div>
          
          {/* SEO Description for Video Gallery */}
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
            {pageDict?.home?.video_desc || 'Watch expert agricultural market analysis, video commodity updates, tutorial guides, and industry event coverage.'}
          </p>
        </div>
        
        {/* The Video Gallery Carousel */}
        {videoCategories.length > 0 && (
          <InfiniteVideoGalleryCarousel videoCategories={videoCategories} lang={activeLang} imageBaseUrl={imageBaseUrl} dict={pageDict} />
        )}
      </section>

      {/* Market Updates Section */}
      <section className="w-full pt-6 pb-8">
        <div className="max-w-3xl mx-auto text-center px-4">
          {/* Premium Section Title Feel */}
          <div className="inline-block mb-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
              {pageDict?.home?.updates_title || 'Daily Market Updates'}
              {/* Decorative beautiful underline */}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
            </h2>
          </div>
          
          {/* SEO Description for Market Updates */}
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
            {pageDict?.home?.updates_desc || 'Stay informed with our latest market updates, flyers, and daily price trends in the global agricultural sector.'}
          </p>
        </div>
        
        {/* The Market Updates Carousel */}
        {marketUpdates.length > 0 && (
          <InfiniteMarketUpdatesCarousel updates={marketUpdates} lang={activeLang} dict={pageDict} />
        )}
      </section>

      {/* Participation Gallery Section */}
      <section className="w-full pt-6 pb-8">
        <div className="max-w-3xl mx-auto text-center px-4">
          {/* Premium Section Title Feel */}
          <div className="inline-block mb-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
              {pageDict?.home?.participation_title || 'Participation Gallery'}
              {/* Decorative beautiful underline */}
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
            </h2>
          </div>
          
          {/* SEO Description for Participation Gallery */}
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
            {pageDict?.home?.participation_desc || 'Explore our participation in global agricultural events and exhibitions, showcasing our commitment to the international trade community.'}
          </p>
        </div>
        
        {/* The Participation Carousel */}
        {participationCategories.length > 0 && (
          <InfiniteParticipationCarousel categories={participationCategories} lang={activeLang} dict={pageDict} />
        )}
      </section>

      {/* Associate Partners Section */}
      {associatePartners.length > 0 && (
        <section className="w-full pt-6 pb-8 border-t border-border/40">
          <div className="max-w-3xl mx-auto text-center px-4 mb-4">
            {/* Premium Section Title Feel */}
            <div className="inline-block">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground relative pb-3">
                {pageDict?.home?.partners_title || 'Associate Partners'}
                {/* Decorative beautiful underline */}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
              </h2>
            </div>
            
            {/* SEO Description for Associate Partners */}
            <p className="text-sm sm:text-base text-muted-foreground mt-4 leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
              {pageDict?.home?.partners_desc || 'AgriGuru Online partners with global organizations and industry leaders to build a trusted, highly efficient B2B agricultural trade ecosystem worldwide.'}
            </p>
          </div>
          
          <AssociatePartnersCarousel partners={associatePartners} />
        </section>
      )}
    </>
  )
}



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
import { getAssetsUrl } from '@/lib/api-utils'
import type { Metadata } from 'next'
import { getStandardMetadata, getSafeLanguage } from '@/lib/seo'
import WatchlistSection from '@/components/home/WatchlistSection'

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

// Helper to create a timeout promise so slow APIs don't block the FCP infinitely
const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeoutPromise
  ]);
};

import { Suspense } from 'react'

function HomeFeedSkeleton() {
  return (
    <div className="w-full space-y-8 animate-pulse pt-4 pb-8">
      {/* Section 1 Skeleton */}
      <div className="space-y-4">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-64 bg-muted rounded-lg" />
          <div className="h-4 w-96 max-w-full bg-muted/60 rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-72 rounded-2xl bg-card border border-border" />
          ))}
        </div>
      </div>
      {/* Section 2 Skeleton */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-8 w-64 bg-muted rounded-lg" />
          <div className="h-4 w-96 max-w-full bg-muted/60 rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-72 rounded-2xl bg-card border border-border" />
          ))}
        </div>
      </div>
    </div>
  );
}

async function HomeFeed({ activeLang, dict }: { activeLang: string; dict: any }) {
  const API_TIMEOUT = 2000;

  const [
    newsData,
    eventsData,
    productsData,
    videoData,
    marketUpdatesData,
    participationData,
    associatePartnersData,
    buyerOffersData,
    sellerInquiriesData
  ] = await Promise.all([
    withTimeout(cmsService.getLatestNews({ lang: activeLang, page: 1, limit: 12 }).catch(() => null), API_TIMEOUT, null),
    withTimeout(cmsService.getLatestEvents({ lang: activeLang, page: 1, limit: 12 }).catch(() => null), API_TIMEOUT, null),
    withTimeout(tradingService.getMarketedProducts(activeLang, 1, 12).catch(() => null), API_TIMEOUT, null),
    withTimeout(cmsService.getVideoCategories().catch(() => null), API_TIMEOUT, null),
    withTimeout(cmsService.getMarketUpdates(activeLang, 1, 12).catch(() => null), API_TIMEOUT, null),
    withTimeout(cmsService.getParticipationCategories(activeLang, 1, 12).catch(() => null), API_TIMEOUT, null),
    withTimeout(cmsService.getAssociatePartners(1, 25).catch(() => null), API_TIMEOUT, null),
    withTimeout(tradingService.getLatestTradingInquiries({ type: 'BUYER', page: 1, limit: 12, lang: activeLang }).catch(() => null), API_TIMEOUT, null),
    withTimeout(tradingService.getLatestTradingInquiries({ type: 'SELLER', page: 1, limit: 12, lang: activeLang }).catch(() => null), API_TIMEOUT, null),
  ]);

  const articles = newsData?.data?.news || [];
  const events = eventsData?.data?.events || [];
  const products = productsData?.products || [];
  const videoCategories = (videoData?.data?.categories || []).slice(0, 12);
  const marketUpdates = marketUpdatesData?.data?.flyers || [];
  const participationCategories = participationData?.data?.categories || [];
  const associatePartners = associatePartnersData?.data?.logo || [];
  const buyerOffers = buyerOffersData?.data?.inquiries || [];
  const sellerInquiries = sellerInquiriesData?.data?.inquiries || [];

  const commonDict = (dict as any)?.common || {};
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
  
  const userType = null;

  return (
    <>
      {articles.length > 0 && (
        <section className="w-full pt-8 pb-2">
          <div className="max-w-3xl mx-auto text-center px-4">
            <div className="inline-block mb-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
                {dict?.home?.news_title || 'Global Agri Commodity Trading News'}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
              </h2>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
              {dict?.home?.news_desc || 'Explore daily breaking headlines, international trade policies, and crucial market updates shaping the global agricultural commodity sector for B2B traders.'}
            </p>
          </div>
          <InfiniteNewsCarousel articles={articles} lang={activeLang} dict={dict} />
        </section>
      )}

      {events.length > 0 && (
        <section className="w-full pt-6 pb-2">
          <div className="max-w-3xl mx-auto text-center px-4">
            <div className="inline-block mb-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
                {dict?.home?.events_title || 'Global Agri Events & Conferences'}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
              </h2>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
              {dict?.home?.events_desc || 'Discover upcoming international agricultural exhibitions, trade shows, and B2B conferences tailored for commodity traders and industry leaders.'}
            </p>
          </div>
          <InfiniteEventsCarousel events={events} lang={activeLang} dict={dict} />
        </section>
      )}

      {products.length > 0 && (
        <section className="w-full pt-6 pb-8">
          <div className="max-w-3xl mx-auto text-center px-4">
            <div className="inline-block mb-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
                {dict?.home?.products_title || 'Premium Marketed Products'}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
              </h2>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
              {dict?.home?.products_desc || 'Source premium agricultural commodities for global trade. Explore top-tier B2B products from trusted international suppliers at AgriGuru Online.'}
            </p>
          </div>
          <InfiniteMarketedProductsCarousel 
            products={products} 
            lang={activeLang} 
            common={common} 
            imageBaseUrl={imageBaseUrl} 
            userType={userType} 
            dict={dict}
          />
        </section>
      )}

      {buyerOffers.length > 0 && (
        <LatestOffersForBuyerSection 
          offers={buyerOffers} 
          lang={activeLang} 
          imageBaseUrl={imageBaseUrl}
          userType={userType}
          dict={dict}
        />
      )}

      {sellerInquiries.length > 0 && (
        <LatestInquiriesForSellerSection
          inquiries={sellerInquiries}
          lang={activeLang}
          imageBaseUrl={imageBaseUrl}
          userType={userType}
          dict={dict}
        />
      )}

      {videoCategories.length > 0 && (
        <section className="w-full pt-6 pb-8">
          <div className="max-w-3xl mx-auto text-center px-4">
            <div className="inline-block mb-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
                {dict?.home?.video_title || 'Agri Video Gallery & Insights'}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
              </h2>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
              {dict?.home?.video_desc || 'Watch expert agricultural market analysis, video commodity updates, tutorial guides, and industry event coverage.'}
            </p>
          </div>
          <InfiniteVideoGalleryCarousel videoCategories={videoCategories} lang={activeLang} imageBaseUrl={imageBaseUrl} dict={dict} />
        </section>
      )}

      {marketUpdates.length > 0 && (
        <section className="w-full pt-6 pb-8">
          <div className="max-w-3xl mx-auto text-center px-4">
            <div className="inline-block mb-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
                {dict?.home?.updates_title || 'Daily Market Updates'}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
              </h2>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
              {dict?.home?.updates_desc || 'Stay informed with our latest market updates, flyers, and daily price trends in the global agricultural sector.'}
            </p>
          </div>
          <InfiniteMarketUpdatesCarousel updates={marketUpdates} lang={activeLang} dict={dict} />
        </section>
      )}

      {participationCategories.length > 0 && (
        <section className="w-full pt-6 pb-8">
          <div className="max-w-3xl mx-auto text-center px-4">
            <div className="inline-block mb-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
                {dict?.home?.participation_title || 'Participation Gallery'}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
              </h2>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
              {dict?.home?.participation_desc || 'Explore our participation in global agricultural events and exhibitions, showcasing our commitment to the international trade community.'}
            </p>
          </div>
          <InfiniteParticipationCarousel categories={participationCategories} lang={activeLang} dict={dict} />
        </section>
      )}

      {associatePartners.length > 0 && (
        <section className="w-full pt-6 pb-8 border-t border-border/40">
          <div className="max-w-3xl mx-auto text-center px-4 mb-4">
            <div className="inline-block">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground relative pb-3">
                {dict?.home?.partners_title || 'Associate Partners'}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
              </h2>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground mt-4 leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
              {dict?.home?.partners_desc || 'AgriGuru Online partners with global organizations and industry leaders to build a trusted, highly efficient B2B agricultural trade ecosystem worldwide.'}
            </p>
          </div>
          <AssociatePartnersCarousel partners={associatePartners} />
        </section>
      )}
    </>
  );
}

export default async function LocalizedHomePage() {
  const rawLang = await lang()
  const activeLang = getSafeLanguage(rawLang)
  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'
  
  // dict is a LOCAL JSON file read — takes ~5ms, no need to wrap in timeout
  const dict = await getDictionary(activeLang as any).catch(() => ({}) as any)

  return (
    <>
      <OrganizationSchema />
      {/* Hero carousel first slide title is LCP — renders immediately without blocking on external APIs */}

      <div className="bg-background text-foreground transition-theme" dir={dir}>
        <div className="w-full pad-for-badges">
          <div className="max-w-7xl mx-auto pt-3 pb-5">
            <HeroCarousel lang={activeLang} dict={dict} />
            
            <section className="w-full pt-6 pb-2">
              <div className="max-w-3xl mx-auto text-center px-4">
                <div className="inline-block mb-4">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
                    {dict?.home?.watchlist_title || 'Market Watchlist'}
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
                  </h2>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
                  {dict?.home?.watchlist_desc || 'Easily track FOB, CNF/CFR, and CIF product prices. Monitor live Ocean Port-to-Port freight rates to stay updated on global market trends effortlessly.'}
                </p>
              </div>
              <Suspense fallback={<div className="w-full min-h-[300px] mt-5 flex flex-col gap-4 animate-pulse"><div className="flex gap-4 w-full h-14 bg-muted/30 rounded-xl"/><div className="w-full h-72 bg-muted/20 rounded-xl" /></div>}>
                <WatchlistSection dict={dict} lang={activeLang} />
              </Suspense>
            </section>

            <Suspense fallback={<HomeFeedSkeleton />}>
              <HomeFeed activeLang={activeLang} dict={dict} />
            </Suspense>

          </div>
        </div>
      </div>
    </>
  )
}

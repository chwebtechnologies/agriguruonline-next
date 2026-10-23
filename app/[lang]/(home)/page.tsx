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
import { getAssetsUrl, withTimeout } from '@/lib/api-utils'
import type { Metadata } from 'next'
import { getStandardMetadata, getSafeLanguage, getSiteUrl, serializeJsonLd } from '@/lib/seo'
import WatchlistSection from '@/components/home/WatchlistSection'
import WatchlistSectionSkeleton from '@/components/home/WatchlistSectionSkeleton'
import WatchlistScrollHandler from '@/components/home/WatchlistScrollHandler'
import { cookies } from 'next/headers'
import { getUserProfile } from '@/lib/user-data'
import { Suspense } from 'react'

function OrganizationSchema({ lang }: { lang: string }) {
  const siteUrl = getSiteUrl()
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        'name': 'AgriGuru Online',
        'url': siteUrl,
        'logo': {
          '@type': 'ImageObject',
          'url': `${siteUrl}/logo.png`,
          'caption': 'AgriGuru Online Logo'
        },
        'description': 'The premium B2B SaaS platform for global agricultural trade.',
        'contactPoint': {
          '@type': 'ContactPoint',
          'contactType': 'customer service',
          'availableLanguage': ['en', 'ar', 'zh', 'fr']
        },
        'sameAs': [
          'https://www.linkedin.com/company/agriguru-online',
          'https://twitter.com/agriguruonline',
          'https://www.facebook.com/agriguruonline'
        ]
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        'url': siteUrl,
        'name': 'AgriGuru Online',
        'publisher': {
          '@id': `${siteUrl}/#organization`
        },
        'potentialAction': {
          '@type': 'SearchAction',
          'target': {
            '@type': 'EntryPoint',
            'urlTemplate': `${siteUrl}/${lang}/products?search={search_term_string}`
          },
          'query-input': 'required name=search_term_string'
        }
      }
    ]
  }

  return (
    <script
      id="schema-org"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
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
  const API_TIMEOUT = 2500;

  // Resolve user authentication, membership & role securely
  let userType: string | null = null;
  let isLoggedIn = false;
  let isMember = false;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (token) {
      const userResult = await withTimeout(getUserProfile(token, activeLang), 2000, { userProfile: null, shouldLogout: false });
      if (userResult.userProfile) {
        isLoggedIn = true;
        const u = userResult.userProfile;
        const rawUserType = typeof u.user_type === 'object' && u.user_type !== null ? (u.user_type.name || u.user_type.title) : u.user_type;
        const rawRole = typeof u.role === 'object' && u.role !== null ? u.role.name : u.role;
        const normUT = String(rawUserType || '').toLowerCase();
        const normR = String(rawRole || '').toLowerCase();
        if (normUT === 'buyer' || normR === 'buyer') userType = 'buyer';
        else if (normUT === 'seller' || normR === 'seller') userType = 'seller';
        else userType = normUT || normR || null;

        // Check membership:
        const planName = String(u.membership?.plan_name || '').toLowerCase();
        const isRegularUser = normUT === 'regular' || normR === 'regular' || planName === 'regular' || planName === 'guest';
        // A user is a member if they have an active plan or valid trader status that is not regular/guest
        if ((u.membership && planName && planName !== 'guest' && planName !== 'regular') || ((userType === 'buyer' || userType === 'seller') && !isRegularUser)) {
          isMember = true;
        }
      }
    }
    if (!userType) {
      const userInfoCookie = cookieStore.get('user_info')?.value;
      if (userInfoCookie) {
        const u = JSON.parse(decodeURIComponent(userInfoCookie));
        isLoggedIn = true;
        const rawType = String(u.user_type || u.role || '').toLowerCase();
        if (rawType.includes('buyer')) userType = 'buyer';
        else if (rawType.includes('seller')) userType = 'seller';

        const planName = String(u.membership?.plan_name || '').toLowerCase();
        const isRegularUser = rawType.includes('regular') || planName === 'regular' || planName === 'guest';
        if ((u.membership && planName && planName !== 'guest' && planName !== 'regular') || ((userType === 'buyer' || userType === 'seller') && !isRegularUser)) {
          isMember = true;
        }
      }
    }
  } catch {}

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
    // Buyer offers are inquiries of type 'SELLER' (sellers offering commodities for buyers to buy)
    withTimeout(tradingService.getLatestTradingInquiries({ type: 'SELLER', page: 1, limit: 12, lang: activeLang }).catch(() => null), API_TIMEOUT, null),
    // Seller inquiries are inquiries of type 'BUYER' (buyers demanding commodities for sellers to fulfill)
    withTimeout(tradingService.getLatestTradingInquiries({ type: 'BUYER', page: 1, limit: 12, lang: activeLang }).catch(() => null), API_TIMEOUT, null),
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
    perMT: commonDict.per_mt || "/ MT",
    only_buyer_can_buy: commonDict.only_buyer_can_buy || "Only Buyer accounts can purchase products.",
    only_seller_can_sell: commonDict.only_seller_can_sell || "Only Seller accounts can offer products for sale."
  };

  const assetsUrl = getAssetsUrl();
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`;

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

      {/* 
        Buyer Offers & Seller Inquiries Display Logic:
        - If user is a member:
            - Buyer sees ONLY 'Latest Offers for Buyer'
            - Seller sees ONLY 'Latest Inquiries for Seller'
        - If guest or not a member:
            - Both sections are visible
      */}
      {buyerOffers.length > 0 && (!isMember || userType !== 'seller') && (
        <LatestOffersForBuyerSection 
          offers={buyerOffers} 
          lang={activeLang} 
          imageBaseUrl={imageBaseUrl}
          userType={userType}
          isLoggedIn={isLoggedIn}
          dict={dict}
        />
      )}

      {sellerInquiries.length > 0 && (!isMember || userType !== 'buyer') && (
        <LatestInquiriesForSellerSection
          inquiries={sellerInquiries}
          lang={activeLang}
          imageBaseUrl={imageBaseUrl}
          userType={userType}
          isLoggedIn={isLoggedIn}
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
      <OrganizationSchema lang={activeLang} />
      {/* Hero carousel first slide title is LCP — renders immediately without blocking on external APIs */}

      <div className="bg-background text-foreground transition-theme" dir={dir}>
        <div className="w-full pad-for-badges">
          <div className="max-w-7xl mx-auto pt-3 pb-5">
            <h1 className="sr-only">AgriGuru Online - {dict?.home?.hero_title || 'Global B2B Agricultural Trade Platform'}</h1>
            <div className="hidden md:block">
              <HeroCarousel lang={activeLang} dict={dict} />
            </div>
            
            <section id="market-watchlist" className="w-full pt-1 md:pt-6 pb-2 scroll-mt-14 md:scroll-mt-24">
              <WatchlistScrollHandler />
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
              <Suspense fallback={<WatchlistSectionSkeleton dict={dict} />}>
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

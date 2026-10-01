import Link from 'next/link';
import { OfferCard } from '@/components/shared/OfferCard';

interface LatestOffersForBuyerSectionProps {
  offers: any[];
  lang: string;
  imageBaseUrl: string;
  userType?: string | null;
  dict?: any;
}

export default function LatestOffersForBuyerSection({ 
  offers, lang, imageBaseUrl, userType, dict = {} 
}: LatestOffersForBuyerSectionProps) {
  if (!offers || offers.length === 0) return null;

  return (
    <section className="w-full pt-6 pb-8">
      <div className="w-full bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row w-full">
          {/* Left Column: Title, Description, Button, Video */}
          <div className="w-full lg:w-1/2 p-5 sm:p-8 flex flex-col space-y-6 border-b lg:border-b-0 lg:border-r border-border">
            <div className="inline-block">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
                {dict?.common?.latest_offers_for_buyer || 'Latest Offers for Buyer'}
                <span className="absolute bottom-0 left-0 w-16 h-1.5 bg-primary rounded-full"></span>
              </h2>
            </div>
            
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed flex-1">
              {dict?.common?.latest_offers_desc || 'Discover the latest premium offers from trusted international suppliers. Browse through our exclusive selection and find the best deals for your business needs. Connect securely through our platform and secure your commodities today.'}
            </p>
            
            <div>
              <Link 
                href={`/${lang}/latest-offers-for-buyers`}
                className="inline-flex items-center justify-center px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 text-sm md:text-base rounded-xl bg-primary text-white font-bold hover:bg-primary-hover transition-colors shadow-sm hover:shadow-md hover:-translate-y-0.5"
              >
                {dict?.common?.view_all_offers || 'View All Offers'} <i className="fa-solid fa-arrow-right ml-2"></i>
              </Link>
            </div>
            
            {/* YouTube Video Tutorial */}
            <div className="relative aspect-video rounded-xl overflow-hidden shadow-lg border border-border mt-auto">
              <iframe 
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/vi0fcb-IjLA" 
                title={dict?.common?.agriguru_online_tutorial || "AgriGuru Online Tutorial"} 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            </div>
          </div>

          {/* Right Column: Vertical Auto Scrolling Offers */}
          <div className="w-full lg:w-1/2 bg-muted/20 relative flex flex-col p-4 sm:p-6 lg:p-8 overflow-hidden min-h-[500px]">
            {/* Gradient Mask Top */}
            <div className="absolute top-0 left-0 w-full h-12 sm:h-16 z-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to bottom, var(--ag-card-bg) 0%, transparent 100%)' }}></div>
            
            <div className="flex-1 w-full relative overflow-hidden">
              <div className="animate-marquee-vertical flex flex-col gap-4 absolute top-0 left-0 w-full h-max">
                {/* Double the list for seamless looping */}
                {[...offers, ...offers].map((offer, idx) => (
                  <OfferCard 
                    key={`${offer.id}-${idx}`} 
                    inquiry={offer} 
                    lang={lang} 
                    imageBaseUrl={imageBaseUrl} 
                    offerType="BUYER"
                    userType={userType}
                    dict={dict}
                  />
                ))}
              </div>
            </div>
            
            {/* Gradient Mask Bottom */}
            <div className="absolute bottom-0 left-0 w-full h-12 sm:h-16 z-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to top, var(--ag-card-bg) 0%, transparent 100%)' }}></div>
          </div>
        </div>
      </div>
    </section>
  );
}

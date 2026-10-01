import Link from 'next/link';
import { OfferCard } from '@/components/shared/OfferCard';

interface LatestInquiriesForSellerSectionProps {
  inquiries: any[];
  lang: string;
  imageBaseUrl: string;
  userType?: string | null;
  dict?: any;
}

export default function LatestInquiriesForSellerSection({ 
  inquiries, lang, imageBaseUrl, userType, dict = {} 
}: LatestInquiriesForSellerSectionProps) {
  if (!inquiries || inquiries.length === 0) return null;

  return (
    <section className="w-full pt-6 pb-8">
      <div className="w-full bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row-reverse w-full">
          
          {/* Right Column: Title, Description, Button, Video (Shown first on mobile) */}
          <div className="w-full lg:w-1/2 p-5 sm:p-8 flex flex-col space-y-6 border-b lg:border-b-0 lg:border-l border-border">
            <div className="inline-block">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
                {dict?.common?.latest_inquiries_for_seller || 'Latest Inquiries for Seller'}
                <span className="absolute bottom-0 left-0 w-16 h-1.5 bg-primary rounded-full"></span>
              </h2>
            </div>
            
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed flex-1">
              {dict?.common?.latest_inquiries_desc || 'Explore the latest buying inquiries from verified global buyers. Review their requirements, match them with your premium commodities, and start trading today. Connect securely through our platform and expand your business globally.'}
            </p>
            
            <div className="flex justify-end">
              <Link 
                href={`/${lang}/latest-inquiries-for-sellers`}
                className="inline-flex items-center justify-center px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 text-sm md:text-base rounded-xl bg-primary text-white font-bold hover:bg-primary-hover transition-colors shadow-sm hover:shadow-md hover:-translate-y-0.5"
              >
                {dict?.common?.view_all_inquiries || 'View All Inquiries'} <i className="fa-solid fa-arrow-right ml-2"></i>
              </Link>
            </div>
            
            {/* YouTube Video Tutorial */}
            <div className="relative aspect-video rounded-xl overflow-hidden shadow-lg border border-border mt-auto">
              <iframe 
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/neEQrat8yuU" 
                title={dict?.common?.agriguru_online_tutorial || "AgriGuru Online Tutorial"} 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            </div>
          </div>

          {/* Left Column: Vertical Auto Scrolling Inquiries (Shown second on mobile) */}
          <div className="w-full lg:w-1/2 bg-muted/20 relative flex flex-col p-4 sm:p-6 lg:p-8 overflow-hidden min-h-[500px]">
            {/* Gradient Mask Top */}
            <div className="absolute top-0 left-0 w-full h-12 sm:h-16 z-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to bottom, var(--ag-card-bg) 0%, transparent 100%)' }}></div>
            
            <div className="flex-1 w-full relative overflow-hidden">
              <div className="animate-marquee-vertical flex flex-col gap-4 absolute top-0 left-0 w-full h-max">
                {/* Double the list for seamless looping */}
                {[...inquiries, ...inquiries].map((inquiry, idx) => (
                  <OfferCard 
                    key={`${inquiry.id}-${idx}`} 
                    inquiry={inquiry} 
                    lang={lang} 
                    imageBaseUrl={imageBaseUrl} 
                    offerType="SELLER"
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

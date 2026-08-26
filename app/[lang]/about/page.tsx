import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { getDictionary } from '@/app/[lang]/dictionaries'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Welcome to AgriGuru Online: The Future of Global Agri-Commodity Trading.',
}

// Enable Incremental Static Regeneration (ISR) for this page (1 hour)
export default async function AboutPage(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params;
  const lang = params.lang || 'en';
  
  const dict = await getDictionary(lang);
  const commonDict = (dict as Record<string, any>).common || {};
  const backText = commonDict.back || "Back";

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="About Us" backText={backText} />

          {/* Hero Section */}
          <div className="mt-8 mb-16 text-center w-full">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Welcome to AgriGuru Online<br/>
              <span className="text-brand-blue text-2xl sm:text-3xl lg:text-4xl mt-2 inline-block">The Future of Agri-Commodity Trading</span>
            </h1>
            <div className="w-full">
              <p className="text-lg text-foreground/80 leading-relaxed text-justify mb-4">
                AgriGuru Online is an AI-powered B2B mobile app and web platform designed for global agri-commodity trading. We simplify cross-border trade for key agricultural products including Rice, Sugar, Pulses, Spices, Grains, and many more from different origins worldwide.
              </p>
              <p className="text-lg text-foreground/80 leading-relaxed text-justify">
                In a world powered by digital speed and real-time intelligence, almost every major global industry operates at the touch of a button. Yet, agricultural commodity trading—the foundational engine that feeds the global population through cross-border trade—still relies heavily on legacy, manual practices.
              </p>
            </div>
          </div>

          <div className="space-y-16 w-full">
            
            {/* Title Section */}
            <div className="text-center w-full">
              <h2 className="text-3xl font-bold text-foreground mb-2">Three Global Trade Problems.</h2>
              <h3 className="text-2xl font-semibold text-brand-green">Three AgriGuru Solutions.</h3>
            </div>

            {/* Problem 1 - Image Left, Text Right */}
            <div className="grid md:grid-cols-2 items-center w-full">
              <div className="w-full h-[350px] relative">
                <Image
                  src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80"
                  alt="Product Prices"
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </div>
              <div className="flex flex-col gap-6 pl-0 md:pl-8 py-4">
                <h2 className="text-2xl font-bold text-foreground">Live, Origin-specific Product Prices</h2>
                
                <div>
                  <h3 className="text-lg font-semibold text-brand-red mb-2">The Challenge</h3>
                  <p className="text-base text-foreground/80 leading-relaxed text-justify">
                    Finding live, accurate commodity pricing tied directly to specific origins is frustratingly difficult. Traders waste hours making phone calls or comparing outdated email quotes, leading to delayed decisions and missed deals.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-brand-green mb-2">The Solution</h3>
                  <p className="text-base text-foreground/80 leading-relaxed text-justify">
                    AgriGuru Online delivers real-time price updates tied directly to the country of origin — Indian Non-Basmati White Rice 5% Broken FOB Nhava Sheva right alongside Vietnam 5% Broken White Rice FOB Ho Chi Minh. You know precisely what you are buying, where it&apos;s coming from, and what it costs right now.
                  </p>
                </div>
              </div>
            </div>

            {/* Problem 2 - Text Left, Image Right */}
            <div className="grid md:grid-cols-2 items-center w-full bg-ag-subheader-bg/20">
              <div className="flex flex-col gap-6 order-2 md:order-1 pr-0 md:pr-8 py-4">
                <h2 className="text-2xl font-bold text-foreground">Real-Time Ocean Freight Integration</h2>
                
                <div>
                  <h3 className="text-lg font-semibold text-brand-red mb-2">The Challenge</h3>
                  <p className="text-base text-foreground/80 leading-relaxed text-justify">
                    Calculating true landed costs requires chasing multiple freight forwarders for ocean quotes from Port of Loading (POL) to Port of Discharge (POD). Without real-time freight rates, traders struggle to protect their profit margins.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-brand-green mb-2">The Solution</h3>
                  <p className="text-base text-foreground/80 leading-relaxed text-justify">
                    AgriGuru Online integrates live ocean freight rates across major global maritime corridors directly alongside commodity FOB prices, eliminating manual freight inquiries and enabling traders to calculate accurate CIF landed costs instantly before executing contracts.
                  </p>
                </div>
              </div>
              <div className="w-full h-[350px] order-1 md:order-2 relative">
                <Image
                  src="/cargo-ship.jpg"
                  alt="Ocean Freight"
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </div>

            {/* Problem 3 - Image Left, Text Right */}
            <div className="grid md:grid-cols-2 items-center w-full">
              <div className="w-full h-[350px] relative">
                <Image
                  src="https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=1200&q=80"
                  alt="Smart Docs"
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
              <div className="flex flex-col gap-6 pl-0 md:pl-8 py-4">
                <h2 className="text-2xl font-bold text-foreground">Smart Trade Documentation</h2>
                
                <div>
                  <h3 className="text-lg font-semibold text-brand-red mb-2">The Challenge</h3>
                  <p className="text-base text-foreground/80 leading-relaxed text-justify">
                    Managing trade documents—Bills of Lading, Phytosanitary Certificates, and LCs—via manual emails and chat threads leads to typos, lost paperwork, customs holds, and expensive port demurrage fees.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-brand-green mb-2">The Solution</h3>
                  <p className="text-base text-foreground/80 leading-relaxed text-justify">
                    A centralized digital hub that automates trade contracts, shipping paperwork, and compliance documents to eliminate typos, customs holds, and expensive port demurrage fees.
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Features List */}
            <div className="pt-12 w-full">
              <h2 className="text-3xl font-bold text-foreground mb-12 text-center">Beyond the Basics: Additional Features</h2>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-12">
                
                <div className="w-full">
                  <h4 className="font-bold text-xl text-brand-blue mb-3">AI Analytics &amp; Market Reports</h4>
                  <p className="text-base text-foreground/80 leading-relaxed text-justify">
                    AgriGuru Online equips market participants with predictive analytics and comprehensive monthly intelligence reports. By synthesizing macroeconomic shifts, climatic events, and regulatory changes into actionable insights, AgriGuru Online enables traders to make informed, risk-managed decisions before global physical supplies are affected.
                  </p>
                </div>
                
                <div className="w-full">
                  <h4 className="font-bold text-xl text-brand-blue mb-3">Custom Price Alerts</h4>
                  <p className="text-base text-foreground/80 leading-relaxed text-justify">
                    Set tailored notifications for specific commodities or origins so you never miss a profitable market move. Set target price thresholds for any commodity origin or freight rate, and get notified instantly the moment the market hits your target. You stop chasing the market; you let the market come to you.
                  </p>
                </div>
                
                <div className="w-full">
                  <h4 className="font-bold text-xl text-brand-blue mb-3">Global Agri News &amp; Event Updates</h4>
                  <p className="text-base text-foreground/80 leading-relaxed text-justify">
                    To navigate cross-border trade successfully, access to real-time market intelligence is just as crucial as tracking physical commodity prices. AgriGuru Online integrates a dedicated Global Agri News &amp; Event Updates hub into its platform, giving traders instant access to major industry headlines, shifting regulatory and export policies, monthly market analysis reports, and upcoming global trade expos.
                  </p>
                </div>
                
                <div className="w-full">
                  <h4 className="font-bold text-xl text-brand-blue mb-3">Interactive Chart Trend Analysis</h4>
                  <p className="text-base text-foreground/80 leading-relaxed text-justify">
                    Making high-stakes trade decisions requires more than looking at today&apos;s static quote—it demands visual, data-driven market intelligence. AgriGuru Online equips traders with an Interactive Chart Trend Analysis tool that plots historical and real-time market movements for both physical commodity prices and ocean freight rates.
                  </p>
                </div>

              </div>
            </div>

            {/* Aim & Vision Section */}
            <div className="grid md:grid-cols-2 gap-8 pt-12 w-full">
              <div className="w-full pr-0 md:pr-4">
                <h2 className="text-2xl font-bold text-brand-blue mb-4">Our Aim</h2>
                <p className="text-base text-foreground/80 leading-relaxed text-justify">
                  Our goal is to serve as the one-stop digital solution for global agri-commodity trading. We aim to replace outdated operational headaches with a smooth, streamlined experience for every buyer, seller, and trader worldwide.
                </p>
              </div>
              <div className="w-full pl-0 md:pl-4">
                <h2 className="text-2xl font-bold text-brand-green mb-4">Our Vision</h2>
                <p className="text-base text-foreground/80 leading-relaxed text-justify">
                  To build a transparent, highly efficient, and trust-driven future for global agri-commodity trade, empowering market participants to stop reacting to market chaos and start anticipating profitable opportunities with total confidence.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}


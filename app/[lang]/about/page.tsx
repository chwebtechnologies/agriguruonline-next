import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { getDictionary } from '@/app/[lang]/dictionaries'
import Image from 'next/image'

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = getSafeLanguage(params?.lang);

  return getStandardMetadata({
    pageKey: 'about',
    pathname: 'about',
    lang,
  });
}

export const revalidate = 3600;

export default async function AboutPage(props: { params: Promise<{ lang: string }> }) {
  const params = await props.params;
  const lang = params.lang || 'en';
  
  const dict = await getDictionary(lang);
  const commonDict = (dict as Record<string, any>).common || {};
  const backText = commonDict.back || "Back";

  const aboutDict = (dict as Record<string, any>).about || {};

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={aboutDict.title || "About Us"} backText={backText} />

          {/* Hero Section */}
          <div className="mt-8 mb-16 text-center w-full relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-[120%] bg-brand-blue/5 blur-[100px] rounded-full pointer-events-none"></div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground mb-6 tracking-tight relative z-10">
              {aboutDict.hero_title || "Welcome to AgriGuru Online"}<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green text-2xl sm:text-3xl lg:text-4xl mt-2 inline-block">{aboutDict.hero_subtitle || "The Future of Agri-Commodity Trading"}</span>
            </h1>
            <div className="w-full max-w-4xl mx-auto bg-card border border-border/60 shadow-sm p-6 sm:p-8 rounded-3xl relative z-10 hover:border-brand-blue/30 transition-colors">
              <p className="text-base sm:text-lg text-foreground leading-relaxed text-justify mb-6">
                {aboutDict.hero_desc1 || "AgriGuru Online is an AI-powered B2B mobile app and web platform designed for global agri-commodity trading. We simplify cross-border trade for key agricultural products including Rice, Sugar, Pulses, Spices, Grains, and many more from different origins worldwide."}
              </p>
              <p className="text-base sm:text-lg text-foreground leading-relaxed text-justify">
                {aboutDict.hero_desc2 || "In a world powered by digital speed and real-time intelligence, almost every major global industry operates at the touch of a button. Yet, agricultural commodity trading—the foundational engine that feeds the global population through cross-border trade—still relies heavily on legacy, manual practices."}
              </p>
            </div>
          </div>

          <div className="space-y-16 w-full">
            
            {/* Title Section */}
            <div className="text-center w-full">
              <h2 className="text-3xl font-black text-foreground mb-2">{aboutDict.problems_title || "Three Global Trade Problems."}</h2>
              <h3 className="text-2xl font-bold text-brand-green">{aboutDict.solutions_title || "Three AgriGuru Solutions."}</h3>
            </div>

            {/* Problem 1 - Image Left, Text Right */}
            <div className="grid md:grid-cols-2 items-center w-full gap-8">
              <div className="w-full h-[350px] relative rounded-2xl overflow-hidden shadow-lg border border-border/50">
                <Image
                  src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80"
                  alt="Product Prices"
                  title="Live Origin-Specific Commodity Prices"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </div>
              <div className="flex flex-col gap-6 py-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{aboutDict.problem1_title || "Live, Origin-specific Product Prices"}</h2>
                
                <div className="bg-brand-red/5 border border-brand-red/20 p-5 rounded-2xl">
                  <h3 className="text-lg font-bold text-brand-red flex items-center gap-2 mb-3">
                    <i className="fa-solid fa-circle-exclamation"></i> {aboutDict.challenge || "The Challenge"}
                  </h3>
                  <p className="text-[15px] sm:text-base text-foreground leading-relaxed text-justify">
                    {aboutDict.problem1_challenge || "Finding live, accurate commodity pricing tied directly to specific origins is frustratingly difficult. Traders waste hours making phone calls or comparing outdated email quotes, leading to delayed decisions and missed deals."}
                  </p>
                </div>
                
                <div className="bg-brand-green/5 border border-brand-green/20 p-5 rounded-2xl">
                  <h3 className="text-lg font-bold text-brand-green flex items-center gap-2 mb-3">
                    <i className="fa-solid fa-circle-check"></i> {aboutDict.solution || "The Solution"}
                  </h3>
                  <p className="text-[15px] sm:text-base text-foreground leading-relaxed text-justify">
                    {aboutDict.problem1_solution || "AgriGuru Online delivers real-time price updates tied directly to the country of origin — Indian Non-Basmati White Rice 5% Broken FOB Nhava Sheva right alongside Vietnam 5% Broken White Rice FOB Ho Chi Minh. You know precisely what you are buying, where it's coming from, and what it costs right now."}
                  </p>
                </div>
              </div>
            </div>

            {/* Problem 2 - Text Left, Image Right */}
            <div className="grid md:grid-cols-2 items-center w-full gap-8">
              <div className="flex flex-col gap-6 order-2 md:order-1 py-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{aboutDict.problem2_title || "Real-Time Ocean Freight Integration"}</h2>
                
                <div className="bg-brand-red/5 border border-brand-red/20 p-5 rounded-2xl">
                  <h3 className="text-lg font-bold text-brand-red flex items-center gap-2 mb-3">
                    <i className="fa-solid fa-circle-exclamation"></i> {aboutDict.challenge || "The Challenge"}
                  </h3>
                  <p className="text-[15px] sm:text-base text-foreground leading-relaxed text-justify">
                    {aboutDict.problem2_challenge || "Calculating true landed costs requires chasing multiple freight forwarders for ocean quotes from Port of Loading (POL) to Port of Discharge (POD). Without real-time freight rates, traders struggle to protect their profit margins."}
                  </p>
                </div>
                
                <div className="bg-brand-green/5 border border-brand-green/20 p-5 rounded-2xl">
                  <h3 className="text-lg font-bold text-brand-green flex items-center gap-2 mb-3">
                    <i className="fa-solid fa-circle-check"></i> {aboutDict.solution || "The Solution"}
                  </h3>
                  <p className="text-[15px] sm:text-base text-foreground leading-relaxed text-justify">
                    {aboutDict.problem2_solution || "AgriGuru Online integrates live ocean freight rates across major global maritime corridors directly alongside commodity FOB prices, eliminating manual freight inquiries and enabling traders to calculate accurate CIF landed costs instantly before executing contracts."}
                  </p>
                </div>
              </div>
              <div className="w-full h-[350px] order-1 md:order-2 relative rounded-2xl overflow-hidden shadow-lg border border-border/50">
                <Image
                  src="/cargo-ship.jpg"
                  alt="Ocean Freight"
                  title="Real-Time Ocean Freight Integration"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </div>

            {/* Problem 3 - Image Left, Text Right */}
            <div className="grid md:grid-cols-2 items-center w-full gap-8">
              <div className="w-full h-[350px] relative rounded-2xl overflow-hidden shadow-lg border border-border/50">
                <Image
                  src="https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=1200&q=80"
                  alt="Smart Docs"
                  title="Smart Agricultural Trade Documentation"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
              <div className="flex flex-col gap-6 py-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{aboutDict.problem3_title || "Smart Trade Documentation"}</h2>
                
                <div className="bg-brand-red/5 border border-brand-red/20 p-5 rounded-2xl">
                  <h3 className="text-lg font-bold text-brand-red flex items-center gap-2 mb-3">
                    <i className="fa-solid fa-circle-exclamation"></i> {aboutDict.challenge || "The Challenge"}
                  </h3>
                  <p className="text-[15px] sm:text-base text-foreground leading-relaxed text-justify">
                    {aboutDict.problem3_challenge || "Managing trade documents—Bills of Lading, Phytosanitary Certificates, and LCs—via manual emails and chat threads leads to typos, lost paperwork, customs holds, and expensive port demurrage fees."}
                  </p>
                </div>
                
                <div className="bg-brand-green/5 border border-brand-green/20 p-5 rounded-2xl">
                  <h3 className="text-lg font-bold text-brand-green flex items-center gap-2 mb-3">
                    <i className="fa-solid fa-circle-check"></i> {aboutDict.solution || "The Solution"}
                  </h3>
                  <p className="text-[15px] sm:text-base text-foreground leading-relaxed text-justify">
                    {aboutDict.problem3_solution || "A centralized digital hub that automates trade contracts, shipping paperwork, and compliance documents to eliminate typos, customs holds, and expensive port demurrage fees."}
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Features List */}
            <div className="pt-16 w-full">
              <h2 className="text-3xl font-black text-foreground mb-12 text-center">{aboutDict.features_title || "Beyond the Basics: Additional Features"}</h2>
              <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
                
                <div className="bg-card border border-border/60 hover:border-brand-blue/40 shadow-sm hover:shadow-md p-6 sm:p-8 rounded-3xl transition-all h-full">
                  <div className="w-12 h-12 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center mb-5">
                    <i className="fa-solid fa-brain text-xl"></i>
                  </div>
                  <h4 className="font-bold text-xl text-foreground mb-3 tracking-tight">{aboutDict.feature1_title || "AI Analytics & Market Reports"}</h4>
                  <p className="text-[15px] sm:text-base text-foreground/90 leading-relaxed text-justify">
                    {aboutDict.feature1_desc || "AgriGuru Online equips market participants with predictive analytics and comprehensive monthly intelligence reports. By synthesizing macroeconomic shifts, climatic events, and regulatory changes into actionable insights, AgriGuru Online enables traders to make informed, risk-managed decisions before global physical supplies are affected."}
                  </p>
                </div>
                
                <div className="bg-card border border-border/60 hover:border-brand-blue/40 shadow-sm hover:shadow-md p-6 sm:p-8 rounded-3xl transition-all h-full">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-5">
                    <i className="fa-solid fa-bell text-xl"></i>
                  </div>
                  <h4 className="font-bold text-xl text-foreground mb-3 tracking-tight">{aboutDict.feature2_title || "Custom Price Alerts"}</h4>
                  <p className="text-[15px] sm:text-base text-foreground/90 leading-relaxed text-justify">
                    {aboutDict.feature2_desc || "Set tailored notifications for specific commodities or origins so you never miss a profitable market move. Set target price thresholds for any commodity origin or freight rate, and get notified instantly the moment the market hits your target. You stop chasing the market; you let the market come to you."}
                  </p>
                </div>
                
                <div className="bg-card border border-border/60 hover:border-brand-blue/40 shadow-sm hover:shadow-md p-6 sm:p-8 rounded-3xl transition-all h-full">
                  <div className="w-12 h-12 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center mb-5">
                    <i className="fa-solid fa-newspaper text-xl"></i>
                  </div>
                  <h4 className="font-bold text-xl text-foreground mb-3 tracking-tight">{aboutDict.feature3_title || "Global Agri News & Event Updates"}</h4>
                  <p className="text-[15px] sm:text-base text-foreground/90 leading-relaxed text-justify">
                    {aboutDict.feature3_desc || "To navigate cross-border trade successfully, access to real-time market intelligence is just as crucial as tracking physical commodity prices. AgriGuru Online integrates a dedicated Global Agri News & Event Updates hub into its platform, giving traders instant access to major industry headlines, shifting regulatory and export policies, monthly market analysis reports, and upcoming global trade expos."}
                  </p>
                </div>
                
                <div className="bg-card border border-border/60 hover:border-brand-blue/40 shadow-sm hover:shadow-md p-6 sm:p-8 rounded-3xl transition-all h-full">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-5">
                    <i className="fa-solid fa-chart-line text-xl"></i>
                  </div>
                  <h4 className="font-bold text-xl text-foreground mb-3 tracking-tight">{aboutDict.feature4_title || "Interactive Chart Trend Analysis"}</h4>
                  <p className="text-[15px] sm:text-base text-foreground/90 leading-relaxed text-justify">
                    {aboutDict.feature4_desc || "Making high-stakes trade decisions requires more than looking at today's static quote—it demands visual, data-driven market intelligence. AgriGuru Online equips traders with an Interactive Chart Trend Analysis tool that plots historical and real-time market movements for both physical commodity prices and ocean freight rates."}
                  </p>
                </div>

              </div>
            </div>

            {/* Aim & Vision Section */}
            <div className="grid md:grid-cols-2 gap-6 pt-16 w-full">
              <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-brand-blue/20 text-brand-blue flex items-center justify-center">
                    <i className="fa-solid fa-bullseye text-lg"></i>
                  </div>
                  <h2 className="text-2xl font-bold text-brand-blue">{aboutDict.aim_title || "Our Aim"}</h2>
                </div>
                <p className="text-[15px] sm:text-base text-foreground font-medium leading-relaxed text-justify">
                  {aboutDict.aim_desc || "Our goal is to serve as the one-stop digital solution for global agri-commodity trading. We aim to replace outdated operational headaches with a smooth, streamlined experience for every buyer, seller, and trader worldwide."}
                </p>
              </div>
              <div className="bg-brand-green/5 border border-brand-green/20 rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-brand-green/20 text-brand-green flex items-center justify-center">
                    <i className="fa-solid fa-eye text-lg"></i>
                  </div>
                  <h2 className="text-2xl font-bold text-brand-green">{aboutDict.vision_title || "Our Vision"}</h2>
                </div>
                <p className="text-[15px] sm:text-base text-foreground font-medium leading-relaxed text-justify">
                  {aboutDict.vision_desc || "To build a transparent, highly efficient, and trust-driven future for global agri-commodity trade, empowering market participants to stop reacting to market chaos and start anticipating profitable opportunities with total confidence."}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* JSON-LD Structured Data Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            "name": `${dict.header?.about_us || "About Us"} - AgriGuru Online`,
            "description": "The AI-powered B2B platform simplifying global agricultural commodity trade for buyers, sellers, and traders worldwide.",
            "url": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/about`,
            "mainEntity": {
              "@type": "Organization",
              "name": "AgriGuru Online",
              "url": process.env.NEXT_PUBLIC_SITE_URL || "https://agriguruonline.com",
              "logo": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/logo.png`,
              "description": "The premium B2B SaaS platform for global agricultural trade.",
              "sameAs": [
                "https://twitter.com/AgriGuruOnline",
                "https://www.linkedin.com/company/agriguruonline"
              ]
            }
          }).replace(/</g, '\\u003c')
        }}
      />
    </div>
  )
}


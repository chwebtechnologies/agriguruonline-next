import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { IPhoneFrame } from '../../../components/mobile-app/IPhoneFrame'
import { PageHeader } from '../../../components/ui/PageHeader'

// REQUIRED for CSS bug fix: forces full SSG at build time — no server hits at runtime.
// CSS is bundled with static HTML once, eliminating client-nav CSS chunk race conditions.
export const dynamic = 'force-static'
export const revalidate = false

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo'

export async function generateMetadata(props: {
  params?: Promise<{ lang: string }>
}): Promise<Metadata> {
  const params = props.params ? await props.params : undefined
  const lang = getSafeLanguage(params?.lang)

  return getStandardMetadata({
    pageKey: 'download_app',
    pathname: 'download-application',
    lang,
  })
}

import { getDictionary } from '../dictionaries'

export default async function DownloadAppPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = await params
  const lang = (resolvedParams?.lang || 'en') as 'en' | 'ar' | 'fr' | 'zh'
  const dict = await getDictionary(lang)
  
  const downDict = (dict as Record<string, any>).download_app || {};
  const commonDict = (dict as Record<string, any>).common || {};
  const backText = commonDict.back || "Back";

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          
          {/* Header */}
          <PageHeader title={dict.header?.download_app || "Download App"} backText={backText} />

          {/* SECTION 1: HERO - 2 Column Layout */}
          <section className="relative pt-4 sm:pt-6 lg:pt-8 pb-8 lg:pb-12">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
              
              {/* Left: Text & CTA with QR codes */}
              <div className="flex-1 text-center lg:text-left relative z-10 w-full lg:w-1/2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-blue/10 text-brand-blue font-bold text-xs sm:text-sm mb-5 border border-brand-blue/20 shadow-xs">
                  <i className="fa-solid fa-globe"></i> {downDict.for_importers_exporters || "For Agri Commodity Importers & Exporters"}
                </div>
                
                <h1 className="text-3xl sm:text-5xl lg:text-[56px] font-black tracking-tight text-foreground mb-4 sm:mb-6 leading-[1.15]">
                  {downDict.hero_title_1 || "Your AgriTrade &"}<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-green">{downDict.hero_title_2 || "Our AgriTech."}</span>
                </h1>
                
                <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mb-6 sm:mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  {downDict.hero_desc || "Are you always busy but never sure if you got the right price? Stop calling multiple brokers just to find out the market has already moved. The ultimate B2B platform built by traders to solve your core bottlenecks: Product Prices (FOB, CNF, CIF), Ocean Freight Rates, and Smart Documentation."}
                </p>
                
                {/* Download Buttons + QR Codes */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4">
                  {/* Apple Card */}
                  <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3 bg-card border border-border/80 p-2 sm:p-2.5 rounded-2xl shadow-xs hover:border-brand-blue/50 transition-all group">
                    <div className="hidden sm:flex flex-col items-center justify-center p-1 bg-white rounded-xl shadow-xs shrink-0">
                      <Image src="/apple-qr.svg" alt="Scan to download iOS App" width={56} height={56} className="rounded-lg" />
                    </div>
                    <Link href="https://apps.apple.com/in/app/agriguru-online/id6472804536" target="_blank" className="flex-1 sm:flex-none flex items-center justify-center gap-3 bg-foreground text-background px-5 sm:px-6 py-2.5 rounded-xl hover:scale-[1.02] transition-all">
                      <i className="fa-brands fa-apple text-2xl sm:text-3xl"></i>
                      <div className="text-left flex flex-col justify-center">
                        <span className="text-[10px] leading-none mb-1 font-medium opacity-80">Download on the</span>
                        <span className="text-sm font-bold leading-none">App Store</span>
                      </div>
                    </Link>
                  </div>

                  {/* Google Play Card */}
                  <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3 bg-card border border-border/80 p-2 sm:p-2.5 rounded-2xl shadow-xs hover:border-brand-green/50 transition-all group">
                    <div className="hidden sm:flex flex-col items-center justify-center p-1 bg-white rounded-xl shadow-xs shrink-0">
                      <Image src="/android-qr.svg" alt="Scan to download Android App" width={56} height={56} className="rounded-lg" />
                    </div>
                    <Link href="https://play.google.com/store/apps/details?id=com.app.agriguruonline&hl=en_IN" target="_blank" className="flex-1 sm:flex-none flex items-center justify-center gap-3 bg-foreground text-background px-5 sm:px-6 py-2.5 rounded-xl hover:scale-[1.02] transition-all">
                      <i className="fa-brands fa-google-play text-2xl sm:text-3xl"></i>
                      <div className="text-left flex flex-col justify-center">
                        <span className="text-[10px] leading-none mb-1 font-medium opacity-80">GET IT ON</span>
                        <span className="text-sm font-bold leading-none">Google Play</span>
                      </div>
                    </Link>
                  </div>
                </div>

                {/* Mobile QR Quick Note */}
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-3 flex items-center justify-center lg:justify-start gap-1.5">
                  <i className="fa-solid fa-qrcode text-brand-blue"></i>
                  <span>{downDict.scan_qr || "Scan QR code with your phone camera or click to download."}</span>
                </p>
              </div>

              {/* Right: 3 Slim Smartphone Frames */}
              <div className="flex-1 w-full lg:w-1/2 relative h-[300px] sm:h-[420px] lg:h-[470px] flex justify-center items-center mt-6 lg:mt-0 self-center">
                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] sm:w-[350px] h-[220px] sm:h-[350px] bg-brand-green/20 blur-[70px] sm:blur-[90px] rounded-full pointer-events-none"></div>
                
                {/* Left Phone (Background) */}
                <div className="absolute z-10 -translate-x-[45px] sm:-translate-x-[80px] lg:-translate-x-[95px] translate-y-3 sm:translate-y-5">
                  <IPhoneFrame 
                    imageSrc="/top-left.webp" 
                    className="w-[120px] sm:w-[170px] lg:w-[195px] h-[250px] sm:h-[355px] lg:h-[410px] shadow-xl opacity-90 sm:opacity-100" 
                    priority={true}
                  />
                </div>
                
                {/* Right Phone (Background) */}
                <div className="absolute z-20 translate-x-[45px] sm:translate-x-[80px] lg:translate-x-[95px] translate-y-3 sm:translate-y-5">
                  <IPhoneFrame 
                    imageSrc="/top-right.webp" 
                    className="w-[120px] sm:w-[170px] lg:w-[195px] h-[250px] sm:h-[355px] lg:h-[410px] shadow-xl opacity-90 sm:opacity-100" 
                    priority={true}
                  />
                </div>

                {/* Center Phone (Foreground) */}
                <div className="relative z-30">
                  <IPhoneFrame 
                    imageSrc="/top-middle.webp" 
                    className="w-[135px] sm:w-[190px] lg:w-[220px] h-[280px] sm:h-[400px] lg:h-[460px] shadow-2xl" 
                    priority={true}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: CORE PROBLEM 1 - PRODUCT PRICE */}
          <section className="pt-8 sm:pt-10 pb-12 sm:pb-16 border-t border-border/50 relative overflow-hidden">
            
            <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
              <h2 className="text-2xl sm:text-4xl font-black mb-3 text-foreground tracking-tight">{downDict.price_intel_title || "Complete Price Intelligence"}</h2>
              <p className="text-muted-foreground text-xs sm:text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: downDict.price_intel_desc || "Master the global market with live Product Prices (FOB, CNF, CIF). Let <strong>AI Predict</strong> be your pocket market analyst to understand risks and know when to buy or sell, while <strong>Create Alert</strong> notifies you the moment prices hit your target deal level." }} />
            </div>
            
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-14">
              {/* Left side: Phone with backdrop cards */}
              <div className="flex-1 flex justify-center items-center relative w-full py-4 sm:py-6">
                <div className="relative">
                  {/* Ambient Glow */}
                  <div className="absolute -inset-4 bg-gradient-to-r from-brand-blue/20 via-brand-green/15 to-brand-blue/10 rounded-full blur-2xl pointer-events-none"></div>

                  {/* Phone-Shaped Card 1 (Blue) */}
                  <div className="absolute -inset-2 sm:-inset-4 bg-brand-blue/10 dark:bg-brand-blue/15 border border-brand-blue/25 rounded-[2rem] sm:rounded-[3rem] -rotate-3 sm:-rotate-6 pointer-events-none shadow-xs"></div>
                  
                  {/* Phone-Shaped Card 2 (Green) */}
                  <div className="absolute -inset-2 sm:-inset-4 bg-brand-green/10 dark:bg-brand-green/15 border border-brand-green/25 rounded-[2rem] sm:rounded-[3rem] rotate-3 sm:rotate-6 pointer-events-none shadow-xs"></div>

                  {/* Phone Frame */}
                  <IPhoneFrame 
                    className="w-[150px] sm:w-[195px] lg:w-[220px] h-[310px] sm:h-[405px] lg:h-[460px] shadow-2xl relative z-10" 
                  />
                </div>
              </div>

              {/* Right side: Features Grid */}
              <div className="flex-[1.5] w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                {[
                  { icon: "fa-tags", title: downDict.feature_realtime_title || "Realtime Prices", desc: downDict.feature_realtime_desc || "Live FOB, CNF, and CIF pricing directly on your mobile." },
                  { icon: "fa-chart-area", title: downDict.feature_historical_title || "Historical Charts", desc: downDict.feature_historical_desc || "Analyze past trends with detailed historical price charts." },
                  { icon: "fa-bell", title: downDict.feature_alerts_title || "Alert Setups", desc: downDict.feature_alerts_desc || "Configure triggers to notify you exactly when prices hit your target." },
                  { icon: "fa-brain", title: downDict.feature_ai_title || "AI Price Prediction", desc: downDict.feature_ai_desc || "Leverage market analysis and AI to predict future price movements." },
                  { icon: "fa-file-pdf", title: downDict.feature_reports_title || "Market Reports", desc: downDict.feature_reports_desc || "Deep-dive insights and downloadable product market reports." },
                  { icon: "fa-handshake", title: downDict.feature_inquiries_title || "Inquiries / Offers", desc: downDict.feature_inquiries_desc || "Direct connection between genuine Importers and Exporters." },                  
                ].map((feature, idx) => (
                  <div key={idx} className="bg-card p-4 sm:p-5 rounded-xl shadow-xs border border-border/60 hover:border-brand-blue/60 hover:shadow-sm transition-all duration-200 group">
                    <div className="flex items-center gap-3 mb-1.5 sm:mb-2">
                      <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0 group-hover:bg-brand-blue group-hover:text-white transition-colors duration-200">
                        <i className={`fa-solid ${feature.icon} text-sm sm:text-base`}></i>
                      </div>
                      <h4 className="font-bold text-sm sm:text-base tracking-tight text-foreground line-clamp-1">{feature.title}</h4>
                    </div>
                    <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 3: CORE PROBLEM 2 - FREIGHT RATES */}
          <section className="py-10 sm:py-16 border-t border-border/50 relative overflow-hidden">
            
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-14">
              
              <div className="flex-[1.5] order-2 lg:order-1 text-center lg:text-left w-full">
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                  <div className="inline-flex items-center justify-center w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-brand-green/10 text-brand-green shrink-0 shadow-xs">
                    <i className="fa-solid fa-ship text-lg sm:text-xl"></i>
                  </div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight text-foreground tracking-tight text-left">
                    {downDict.freight_title || "Ocean Freight Rates."}<br/>
                    <span className="text-muted-foreground font-light text-lg sm:text-2xl lg:text-3xl">{downDict.freight_subtitle || "Without the Wait."}</span>
                  </h2>
                </div>
                <p className="text-muted-foreground mb-6 text-xs sm:text-base leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  {downDict.freight_desc || "Different sources give different numbers. Vessel availability, port conditions, booking periods—all affect your bottom line. Stop waiting days for freight quotes. Instantly access Ocean Freight Rates across major Port to Port Routes globally."}
                </p>
                
                <div className="space-y-3 sm:space-y-4 max-w-xl mx-auto lg:mx-0 text-left">
                  <div className="flex items-start gap-3.5 sm:gap-4 p-4 sm:p-5 bg-card rounded-xl border border-border/60 shadow-xs hover:border-brand-green/60 transition-colors">
                    <div className="mt-0.5 w-9 sm:w-10 h-9 sm:h-10 rounded-xl bg-brand-green/15 text-brand-green flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-location-dot text-sm sm:text-base"></i>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm sm:text-base mb-1 text-foreground">{downDict.freight_feature1_title || "Instant Port-to-Port Routes"}</h4>
                      <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{downDict.freight_feature1_desc || "Select your origin and destination ports to instantly view highly accurate shipping costs."}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3.5 sm:gap-4 p-4 sm:p-5 bg-card rounded-xl border border-border/60 shadow-xs hover:border-brand-green/60 transition-colors">
                    <div className="mt-0.5 w-9 sm:w-10 h-9 sm:h-10 rounded-xl bg-brand-green/15 text-brand-green flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-bolt text-sm sm:text-base"></i>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm sm:text-base mb-1 text-foreground">{downDict.freight_feature2_title || "Live Market Adjustments"}</h4>
                      <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{downDict.freight_feature2_desc || "Freight rates are updated constantly to reflect true, current market dynamics avoiding nasty surprises."}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right side: Phone with backdrop cards */}
              <div className="flex-1 flex justify-center items-center order-1 lg:order-2 relative w-full py-4 sm:py-6">
                <div className="relative">
                  {/* Ambient Glow */}
                  <div className="absolute -inset-4 bg-gradient-to-r from-brand-green/20 via-brand-blue/15 to-brand-green/10 rounded-full blur-2xl pointer-events-none"></div>

                  {/* Phone-Shaped Card 1 (Green) */}
                  <div className="absolute -inset-2 sm:-inset-4 bg-brand-green/10 dark:bg-brand-green/15 border border-brand-green/25 rounded-[2rem] sm:rounded-[3rem] rotate-3 sm:rotate-6 pointer-events-none shadow-xs"></div>
                  
                  {/* Phone-Shaped Card 2 (Blue) */}
                  <div className="absolute -inset-2 sm:-inset-4 bg-brand-blue/10 dark:bg-brand-blue/15 border border-brand-blue/25 rounded-[2rem] sm:rounded-[3rem] -rotate-3 sm:-rotate-6 pointer-events-none shadow-xs"></div>

                  {/* Phone Frame */}
                  <IPhoneFrame 
                    className="w-[150px] sm:w-[195px] lg:w-[220px] h-[310px] sm:h-[405px] lg:h-[460px] shadow-2xl relative z-10" 
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: CORE PROBLEM 3 - SMART DOCS (COMING SOON) */}
          <section className="py-10 sm:py-16 border-t border-border/50 relative overflow-hidden">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-14">
              
              <div className="flex-1 w-full relative h-[260px] sm:h-[380px] lg:h-[440px] flex justify-center items-center order-2 lg:order-1 mt-2 lg:mt-0">
                {/* Background Phone */}
                <div className="relative">
                  <IPhoneFrame 
                    className="w-[140px] sm:w-[185px] lg:w-[210px] h-[290px] sm:h-[385px] lg:h-[440px] opacity-40 grayscale blur-[1px]" 
                  />
                </div>
                
                {/* Coming soon badge */}
                <div className="absolute z-30 bg-gradient-to-br from-brand-red to-brand-red/85 text-white rounded-2xl px-5 py-4 sm:p-6 shadow-xl border border-white/20 animate-bounce" style={{animationDuration: '3s'}}>
                  <div className="flex items-center gap-2 mb-1">
                    <i className="fa-solid fa-hourglass-half text-base sm:text-xl animate-pulse"></i>
                    <h3 className="font-black text-base sm:text-xl uppercase tracking-wider">{downDict.coming_soon || "Coming Soon"}</h3>
                  </div>
                  <p className="font-medium text-white/90 text-[11px] sm:text-xs">{downDict.dev_full_swing || "Development is in full swing."}</p>
                </div>
              </div>
              
              <div className="flex-1 text-center lg:text-left order-1 lg:order-2 w-full">
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                  <div className="inline-flex items-center justify-center w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-brand-red/10 text-brand-red shrink-0 shadow-xs">
                    <i className="fa-solid fa-file-invoice text-lg sm:text-xl"></i>
                  </div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight text-foreground tracking-tight text-left">
                    {downDict.docs_title || "Smart Export"}<br/>
                    <span className="text-muted-foreground font-light text-lg sm:text-2xl lg:text-3xl">{downDict.docs_subtitle || "Shipping Documents"}</span>
                  </h2>
                </div>
                <p className="text-muted-foreground text-xs sm:text-base leading-relaxed mb-6 max-w-2xl mx-auto lg:mx-0">
                  {downDict.docs_desc || "Anyone who has done international agri trade knows how one small mistake in documents can hold up an entire shipment or cause bank rejections. Soon, you will be able to flawlessly prepare smart export shipping documents right from your phone."}
                </p>
                
                <div className="bg-card border border-border/60 rounded-xl p-4 sm:p-5 shadow-xs text-left w-full max-w-2xl mx-auto lg:mx-0">
                  <h4 className="font-bold text-sm sm:text-base mb-1.5 flex items-center gap-2 text-foreground">
                    <i className="fa-solid fa-bolt text-brand-red"></i> {downDict.docs_feature_title || "Quick Preparation"}
                  </h4>
                  <p className="text-muted-foreground leading-relaxed text-xs sm:text-sm">
                    {downDict.docs_feature_desc || "Automated, compliant templates for Importers & Exporters reducing errors to zero and saving hours of repetitive administrative work per shipment."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: BOTTOM CTA */}
          <section className="relative bg-gradient-to-br from-brand-blue via-brand-blue/90 to-brand-green text-white rounded-3xl overflow-hidden py-10 sm:py-12 lg:py-14 px-6 sm:px-12 mt-8 sm:mt-12 mb-4 shadow-xl">
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
              <div className="flex-[1.4] text-center lg:text-left w-full">
                <span className="bg-white/15 border border-white/25 px-3.5 py-1 rounded-full text-white font-bold tracking-wider uppercase text-[10px] sm:text-xs mb-4 inline-block shadow-xs">
                  Your AgriTrade &amp; Our AgriTech
                </span>
                <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black mb-3 sm:mb-4 leading-[1.15] tracking-tight" dangerouslySetInnerHTML={{ __html: downDict.cta_title || "Try It Risk-Free.<br/>90 Days Completely Free." }} />
                <p className="text-white/90 text-xs sm:text-base mb-6 max-w-xl mx-auto lg:mx-0">
                  {downDict.cta_desc || "The Silver Plan trial costs nothing. No credit card, no banking details, no catch. Just sign up and explore it for yourself."}
                </p>
                
                {/* Download Cards with Prominent Large QR Codes */}
                <div className="flex flex-col sm:flex-row items-stretch justify-center lg:justify-start gap-4">
                  {/* Apple Card */}
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-3.5 shadow-lg">
                    <div className="bg-white p-2 rounded-xl shadow-md shrink-0">
                      <Image src="/apple-qr.svg" alt="Scan to download iOS App" width={96} height={96} className="w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] rounded-lg" />
                    </div>
                    <div className="flex flex-col justify-between items-center sm:items-start gap-2 w-full">
                      <div className="text-center sm:text-left">
                        <span className="text-[11px] font-bold text-white/90 uppercase tracking-wider block">iOS App</span>
                        <span className="text-xs text-white/70">Scan with iPhone Camera</span>
                      </div>
                      <Link href="https://apps.apple.com/in/app/agriguru-online/id6472804536" target="_blank" className="w-full flex items-center justify-center gap-2.5 bg-white text-black px-4 py-2.5 rounded-xl hover:scale-105 hover:shadow-lg transition-all duration-200">
                        <i className="fa-brands fa-apple text-xl text-black"></i>
                        <div className="text-left flex flex-col justify-center">
                          <span className="text-[8px] leading-none mb-0.5 font-medium opacity-80 uppercase text-black">Download on</span>
                          <span className="text-xs font-black leading-none text-black">App Store</span>
                        </div>
                      </Link>
                    </div>
                  </div>

                  {/* Android Card */}
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-3.5 shadow-lg">
                    <div className="bg-white p-2 rounded-xl shadow-md shrink-0">
                      <Image src="/android-qr.svg" alt="Scan to download Android App" width={96} height={96} className="w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] rounded-lg" />
                    </div>
                    <div className="flex flex-col justify-between items-center sm:items-start gap-2 w-full">
                      <div className="text-center sm:text-left">
                        <span className="text-[11px] font-bold text-white/90 uppercase tracking-wider block">Android App</span>
                        <span className="text-xs text-white/70">Scan with Android Camera</span>
                      </div>
                      <Link href="https://play.google.com/store/apps/details?id=com.app.agriguruonline&hl=en_IN" target="_blank" className="w-full flex items-center justify-center gap-2.5 bg-white text-black px-4 py-2.5 rounded-xl hover:scale-105 hover:shadow-lg transition-all duration-200">
                        <i className="fa-brands fa-google-play text-xl text-black"></i>
                        <div className="text-left flex flex-col justify-center">
                          <span className="text-[8px] leading-none mb-0.5 font-medium opacity-80 uppercase text-black">GET IT ON</span>
                          <span className="text-xs font-black leading-none text-black">Google Play</span>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Bottom 2 Phones - Unique Dynamic Angled Showcase with Feature Badges */}
              <div className="flex-1 w-full flex justify-center items-center relative mt-6 lg:mt-0 lg:pr-6 h-[350px] sm:h-[440px] lg:h-[490px]">
                {/* Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-white/15 blur-[60px] rounded-full pointer-events-none"></div>

                {/* Badge 1: Live Market Prices (Top-Left) */}
                <div className="absolute top-1 left-1 sm:left-4 z-30 bg-white/95 text-slate-900 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 border border-white/60 backdrop-blur-xs animate-bounce" style={{ animationDuration: '4s' }}>
                  <i className="fa-solid fa-chart-line text-brand-blue text-xs sm:text-sm"></i>
                  <span>{downDict.live_market_prices || 'Live Market Prices'}</span>
                </div>

                {/* Badge 2: Live Freight Rates (Top-Right) */}
                <div className="absolute top-3 right-1 sm:right-4 z-30 bg-white/95 text-slate-900 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 border border-white/60 backdrop-blur-xs animate-bounce" style={{ animationDuration: '4.8s' }}>
                  <i className="fa-solid fa-ship text-brand-green text-xs sm:text-sm"></i>
                  <span>{downDict.live_freight_rates || 'Live Freight Rates'}</span>
                </div>

                {/* Badge 3: AI Predict (Middle-Left) */}
                <div className="absolute top-[38%] -left-1 sm:-left-3 lg:-left-5 z-30 bg-white/95 text-slate-900 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 border border-white/60 backdrop-blur-xs animate-bounce" style={{ animationDuration: '3.6s' }}>
                  <i className="fa-solid fa-brain text-purple-600 text-xs sm:text-sm"></i>
                  <span>{downDict.ai_predict || 'AI Predict'}</span>
                </div>

                {/* Left Phone (Angled Back Layer) */}
                <div className="absolute z-10 -translate-x-[35px] sm:-translate-x-[55px] lg:-translate-x-[70px] translate-y-3 sm:translate-y-4 transform -rotate-6 sm:-rotate-8 hover:-rotate-3 transition-transform duration-500">
                  <IPhoneFrame 
                    imageSrc="/top-left.webp" 
                    className="w-[130px] sm:w-[170px] lg:w-[195px] h-[270px] sm:h-[350px] lg:h-[400px] shadow-2xl opacity-90 sm:opacity-95" 
                  />
                </div>

                {/* Right Phone (Angled Front Layer) */}
                <div className="relative z-20 translate-x-[35px] sm:translate-x-[55px] lg:translate-x-[70px] -translate-y-2 sm:-translate-y-3 transform rotate-3 sm:rotate-4 hover:rotate-1 transition-transform duration-500">
                  <IPhoneFrame 
                    imageSrc="/top-middle.webp" 
                    className="w-[145px] sm:w-[185px] lg:w-[215px] h-[300px] sm:h-[380px] lg:h-[440px] shadow-2xl" 
                  />
                </div>

                {/* Badge 4: Create Alert (Middle-Right) */}
                <div className="absolute top-[42%] -right-1 sm:-right-3 lg:-right-4 z-30 bg-white/95 text-slate-900 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 border border-white/60 backdrop-blur-xs animate-bounce" style={{ animationDuration: '4.4s' }}>
                  <i className="fa-solid fa-bell text-amber-500 text-xs sm:text-sm"></i>
                  <span>{downDict.create_alert || 'Create Alert'}</span>
                </div>

                {/* Badge 5: Smart Docs (Bottom-Left) */}
                <div className="absolute bottom-9 left-1 sm:left-3 z-30 bg-white/95 text-slate-900 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 border border-white/60 backdrop-blur-xs animate-bounce" style={{ animationDuration: '3.9s' }}>
                  <i className="fa-solid fa-file-invoice text-brand-red text-xs sm:text-sm"></i>
                  <span>{downDict.smart_docs || 'Smart Docs'}</span>
                </div>

                {/* Badge 6: iOS & Android Ready (Bottom-Center - Static) */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-30 bg-white/95 text-slate-900 text-[10px] sm:text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 border border-white/60 backdrop-blur-xs whitespace-nowrap">
                  <i className="fa-solid fa-circle-check text-brand-blue text-xs sm:text-sm"></i>
                  <span>{downDict.ios_android_ready || 'iOS & Android Ready'}</span>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}

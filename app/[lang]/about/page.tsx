import type { Metadata } from 'next';
import Image from 'next/image';
import { PageHeader } from '@/components/ui/PageHeader';
import { getDictionary } from '@/app/[lang]/dictionaries';
import { getStandardMetadata, getSafeLanguage } from '@/lib/seo';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }];
}

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

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <AboutPageContent lang={lang} />
        </div>
      </div>
    </div>
  );
}

async function AboutPageContent({ lang }: { lang: string }) {
  const dict = await getDictionary(lang);
  const commonDict = (dict as Record<string, any>).common || {};
  const backText = commonDict.back || 'Back';
  const aboutDict = (dict as Record<string, any>).about || {};

  return (
    <>
      <PageHeader title={aboutDict.title || 'About Us'} backText={backText} />

      {/* First Section: Hero / Introduction */}
      <section className="mt-6 md:mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Column: Heading, Subtitle, and Desc 1 */}
          <div className="flex flex-col justify-center space-y-4 md:space-y-5">
            <div className="space-y-2.5 sm:space-y-3">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
                {aboutDict.hero_title || 'Welcome to AgriGuru Online'}
              </h2>
              {aboutDict.hero_subtitle && (
                <div className="border-l-3 border-emerald-500 pl-3 py-0.5">
                  <p className="text-sm sm:text-base md:text-lg font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    {aboutDict.hero_subtitle}
                  </p>
                </div>
              )}
            </div>

            <p className="text-base min-[400px]:text-lg sm:text-lg md:text-xl text-muted-foreground/90 leading-relaxed text-justify">
              {aboutDict.hero_desc1 ||
                'AgriGuru Online is an AI-powered B2B mobile app and web platform designed for global agri-commodity trading. We simplify cross-border trade for key agricultural products including Rice, Sugar, Pulses, Spices, Grains, and many more from different origins worldwide.'}
            </p>
          </div>

          {/* Right Column: 50% Image in Original Dimensions / Aspect Ratio */}
          <div className="w-full flex items-center justify-center">
            <div className="relative w-full overflow-hidden rounded-2xl border border-border/40 bg-muted/20 shadow-sm transition-all duration-300 hover:shadow-md">
              <Image
                src="/media/aboutUs1.svg"
                alt={aboutDict.hero_title || 'About AgriGuru Online'}
                width={667}
                height={388}
                priority
                className="w-full h-auto object-cover object-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Second Section: Modernizing the Trade Network (Centered Heading & Matched Paragraph) */}
      <section className="mt-8 md:mt-12 space-y-3 md:space-y-4">
        <div className="text-center space-y-2.5 max-w-4xl mx-auto">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground tracking-tight leading-snug">
            {aboutDict.hero_network_title ||
              'Modernizing the World’s Most Vital Agri-commodity Trade Network'}
          </h3>
          <div className="w-12 sm:w-16 h-1 bg-emerald-500 mx-auto rounded-full"></div>
        </div>
        <p className="text-base min-[400px]:text-lg sm:text-lg md:text-xl text-muted-foreground/90 leading-relaxed text-justify max-w-5xl mx-auto">
          {aboutDict.hero_desc2 ||
            'In a world powered by digital speed and real-time intelligence, almost every major global industry operates at the touch of a button. Yet, agricultural commodity trading—the foundational engine that feeds the global population through cross-border trade—still relies heavily on legacy, manual practices.'}
        </p>
      </section>

      {/* Third Section: Core Industry Problems */}
      <section className="mt-10 md:mt-14 space-y-6 md:space-y-8">
        <div className="text-center space-y-2.5 max-w-4xl mx-auto">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground tracking-tight leading-snug">
            {aboutDict.core_problems_title || 'Core Industry Problems'}
          </h3>
          <div className="w-12 sm:w-16 h-1 bg-emerald-500 mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Problem 1: Unclear, Origin-Specific Product Prices */}
          <div className="group relative flex flex-col rounded-2xl border border-border/50 bg-card p-5 sm:p-6 shadow-sm transition-all duration-300 hover:border-emerald-500/50 hover:shadow-md">
            {/* Title above image */}
            <div className="mb-4 flex items-start gap-2.5">
              <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-sm mt-0.5">
                1
              </span>
              <h4 className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug">
                {aboutDict.problem1_title ||
                  'Unclear, Origin-Specific Product Prices (FOB/CNF/CIF)'}
              </h4>
            </div>

            {/* Image */}
            <div className="relative mb-4 flex h-48 w-full items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-muted/20 p-4 transition-colors group-hover:bg-muted/30">
              <Image
                src="/media/product-prices.svg"
                alt={
                  aboutDict.problem1_title ||
                  '1. Unclear, Origin-Specific Product Prices (FOB/CNF/CIF)'
                }
                width={330}
                height={151}
                className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            {/* Description */}
            <p className="text-base min-[400px]:text-lg text-muted-foreground/90 leading-relaxed text-justify">
              {aboutDict.problem1_challenge ||
                'Finding live, accurate commodity pricing tied directly to specific origins is frustratingly difficult. Traders waste hours making phone calls or comparing outdated email quotes, leading to delayed decisions and missed deals.'}
            </p>
          </div>

          {/* Problem 2: Disconnected Ocean Freight Discovery */}
          <div className="group relative flex flex-col rounded-2xl border border-border/50 bg-card p-5 sm:p-6 shadow-sm transition-all duration-300 hover:border-emerald-500/50 hover:shadow-md">
            {/* Title above image */}
            <div className="mb-4 flex items-start gap-2.5">
              <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-sm mt-0.5">
                2
              </span>
              <h4 className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug">
                {aboutDict.problem2_title ||
                  'Disconnected Ocean Freight Discovery'}
              </h4>
            </div>

            {/* Image */}
            <div className="relative mb-4 flex h-48 w-full items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-muted/20 p-4 transition-colors group-hover:bg-muted/30">
              <Image
                src="/media/freight-rates.svg"
                alt={
                  aboutDict.problem2_title ||
                  '2. Disconnected Ocean Freight Discovery'
                }
                width={271}
                height={182}
                className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            {/* Description */}
            <p className="text-base min-[400px]:text-lg text-muted-foreground/90 leading-relaxed text-justify">
              {aboutDict.problem2_challenge ||
                'Calculating true landed costs requires chasing multiple freight forwarders for ocean quotes from the Port of Loading (POL) to the Port of Discharge (POD). Without real-time freight rates, traders struggle to protect their profit margins.'}
            </p>
          </div>

          {/* Problem 3: Costly, Paper-Heavy Documentation */}
          <div className="group relative flex flex-col rounded-2xl border border-border/50 bg-card p-5 sm:p-6 shadow-sm transition-all duration-300 hover:border-emerald-500/50 hover:shadow-md">
            {/* Title above image */}
            <div className="mb-4 flex items-start gap-2.5">
              <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-sm mt-0.5">
                3
              </span>
              <h4 className="text-lg sm:text-xl font-bold text-foreground tracking-tight leading-snug">
                {aboutDict.problem3_title ||
                  'Costly, Paper-Heavy Documentation'}
              </h4>
            </div>

            {/* Image */}
            <div className="relative mb-4 flex h-48 w-full items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-muted/20 p-4 transition-colors group-hover:bg-muted/30">
              <Image
                src="/media/smart-docs.svg"
                alt={
                  aboutDict.problem3_title ||
                  '3. Costly, Paper-Heavy Documentation'
                }
                width={202}
                height={161}
                className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            {/* Description */}
            <p className="text-base min-[400px]:text-lg text-muted-foreground/90 leading-relaxed text-justify">
              {aboutDict.problem3_challenge ||
                'Managing trade documents—such as Bills of Lading, Phytosanitary Certificates, and LCs—via manual emails and chat threads leads to typos, lost paperwork, customs holds, and expensive port demurrage fees.'}
            </p>
          </div>
        </div>

        {/* Highlight Quote / Core Statement Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-6 sm:p-8 md:p-10 shadow-sm text-center">
          <div className="mx-auto max-w-4xl space-y-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-1">
              <i className="fa-solid fa-quote-left text-lg"></i>
            </span>
            <p className="text-base min-[400px]:text-lg sm:text-xl md:text-2xl font-semibold text-foreground/95 leading-relaxed tracking-tight">
              &ldquo;{aboutDict.core_problems_quote ||
                'AgriGuru Online is built to directly target the critical pain points of global agri-commodity trading through a single, fully integrated platform engineered specifically for modern trade.'}&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* Fourth Section: Solutions Breakdown (Alternating 50-50 Rows) */}
      <section className="mt-12 md:mt-16 space-y-12 md:space-y-16">
        {/* Solution 1: Text Left, Image Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Text */}
          <div className="flex flex-col justify-center space-y-4 md:space-y-5">
            <div className="space-y-2.5 sm:space-y-3">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
                {aboutDict.solution1_title || 'Live, Origin-specific Product Prices'}
              </h3>
              <div className="w-12 sm:w-16 h-1 bg-emerald-500 rounded-full"></div>
            </div>

            <p className="text-base min-[400px]:text-lg sm:text-lg md:text-xl text-muted-foreground/90 leading-relaxed text-justify">
              {aboutDict.solution1_p1 ||
                'Prices vary wildly depending on where a crop is grown. AgriGuru Online delivers real-time price updates tied directly to the country of origin.'}
            </p>

            <p className="text-base min-[400px]:text-lg sm:text-lg md:text-xl text-muted-foreground/90 leading-relaxed text-justify">
              {aboutDict.solution1_p2 ||
                'For example, instead of seeing a generic "White Rice" price, you get live, origin-specific quotes—like Indian Non-Basmati White Rice 5% Broken FOB Nhava Sheva right alongside Vietnam 5% Broken White Rice FOB Ho Chi Minh. You know precisely what you are buying, where it’s coming from, and what it costs right now.'}
            </p>

            <div className="border-l-3 border-emerald-500 pl-3 py-1">
              <p className="text-base min-[400px]:text-lg sm:text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                {aboutDict.solution1_p3 ||
                  'Stay ahead of market swings with instant, origin-specific commodity prices.'}
              </p>
            </div>
          </div>

          {/* Right: Image */}
          <div className="w-full flex items-center justify-center">
            <div className="relative w-full overflow-hidden rounded-2xl border border-border/40 bg-muted/20 shadow-sm transition-all duration-300 hover:shadow-md flex items-center justify-center p-4 sm:p-8">
              <Image
                src="/media/product-prices.svg"
                alt={aboutDict.solution1_title || 'Live, Origin-specific Product Prices'}
                width={626}
                height={395}
                className="w-full max-h-[380px] h-auto object-contain"
              />
            </div>
          </div>
        </div>

        {/* Solution 2: Image Left, Text Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Image (order-2 on mobile, order-1 on lg) */}
          <div className="w-full flex items-center justify-center order-2 lg:order-1">
            <div className="relative w-full overflow-hidden rounded-2xl border border-border/40 bg-muted/20 shadow-sm transition-all duration-300 hover:shadow-md flex items-center justify-center p-4 sm:p-8">
              <Image
                src="/media/freight-rates.svg"
                alt={aboutDict.solution2_title || 'Real-Time Ocean Freight Rate Integration'}
                width={626}
                height={395}
                className="w-full max-h-[380px] h-auto object-contain"
              />
            </div>
          </div>

          {/* Right: Text (order-1 on mobile, order-2 on lg) */}
          <div className="flex flex-col justify-center space-y-4 md:space-y-5 order-1 lg:order-2">
            <div className="space-y-2.5 sm:space-y-3">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
                {aboutDict.solution2_title || 'Real-Time Ocean Freight Rate Integration'}
              </h3>
              <div className="w-12 sm:w-16 h-1 bg-emerald-500 rounded-full"></div>
            </div>

            <p className="text-base min-[400px]:text-lg sm:text-lg md:text-xl text-muted-foreground/90 leading-relaxed text-justify">
              {aboutDict.solution2_desc ||
                'Getting the product price right is only half the equation—shipping logistics can make or break a deal. AgriGuru Online solves this by integrating live ocean freight rates across major global maritime corridors directly alongside commodity FOB prices, eliminating manual freight inquiries and enabling traders to calculate accurate CIF (Cost, Insurance, and Freight) landed costs instantly before executing contracts.'}
            </p>
          </div>
        </div>

        {/* How It Works - Example Scenario Showcase */}
        <div className="rounded-3xl border border-border/60 bg-gradient-to-b from-card/80 to-muted/20 p-6 sm:p-8 lg:p-10 shadow-sm transition-all space-y-6 md:space-y-8">
          <div className="space-y-2 text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <i className="fa-solid fa-calculator"></i>
              <span>{aboutDict.how_it_works_title || 'How It Works (Example Scenario)'}</span>
            </span>
            <h4 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              From Port of Loading to Port of Discharge
            </h4>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              {aboutDict.how_it_works_subtitle ||
                'Imagine an exporter in Mundra, India selling IR64 Parboiled Rice to an importer in Mombasa, Kenya:'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            {/* Step 1: FOB Price Discovery */}
            <div className="flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-5 sm:p-6 shadow-sm space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    1
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Commodity Price
                  </span>
                </div>
                <h5 className="text-lg font-bold text-foreground">
                  FOB Price Discovery
                </h5>
                <div className="space-y-2 text-sm sm:text-[15px] text-muted-foreground/90">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Product:</span>
                    <span className="font-medium text-foreground text-right">IR64 Parboiled Rice 5%</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Origin / POL:</span>
                    <span className="font-medium text-foreground text-right">Mundra Port, India</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                <span className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-300 block">
                  AgriGuru Live FOB Price
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  $370 <span className="text-sm font-normal text-muted-foreground">/ MT</span>
                </span>
              </div>
            </div>

            {/* Step 2: Ocean Freight Discovery */}
            <div className="flex flex-col justify-between rounded-2xl border border-border/50 bg-card p-5 sm:p-6 shadow-sm space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                    2
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Maritime Logistics
                  </span>
                </div>
                <h5 className="text-lg font-bold text-foreground">
                  Real-Time Freight Discovery
                </h5>
                <div className="space-y-2 text-sm sm:text-[15px] text-muted-foreground/90">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Destination / POD:</span>
                    <span className="font-medium text-foreground text-right">Mombasa Port, Kenya</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Route Corridor:</span>
                    <span className="font-medium text-foreground text-right">South Asia &rarr; East Africa</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-center">
                <span className="text-xs uppercase font-bold text-blue-700 dark:text-blue-300 block">
                  Live Freight + Insurance
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                  $45 + $5 <span className="text-sm font-normal text-muted-foreground">/ MT</span>
                </span>
              </div>
            </div>

            {/* Step 3: Instant CIF Landed Cost Calculation */}
            <div className="flex flex-col justify-between rounded-2xl border-2 border-emerald-500/40 bg-card p-5 sm:p-6 shadow-md space-y-4 relative overflow-hidden">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500 text-white font-bold text-sm">
                    3
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Instant Calculation
                  </span>
                </div>
                <h5 className="text-lg font-bold text-foreground">
                  Instant CIF Landed Cost
                </h5>
                <div className="rounded-lg bg-muted/40 p-2.5 text-xs sm:text-sm font-mono text-muted-foreground text-center">
                  CIF = FOB ($370) + Freight ($45) + Insurance ($5)
                </div>
              </div>
              <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-center text-white shadow-sm">
                <span className="text-xs uppercase font-bold tracking-wider opacity-90 block">
                  CIF Mombasa Landed Price
                </span>
                <span className="text-2xl sm:text-3xl font-black tracking-tight">
                  $420 <span className="text-base font-normal opacity-90">/ MT</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Solution 3: Text Left, Image Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Text */}
          <div className="flex flex-col justify-center space-y-4 md:space-y-5">
            <div className="space-y-2.5 sm:space-y-3">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
                {aboutDict.solution3_title || 'Smart Pre-to-Post Trade Documentation'}
              </h3>
              <div className="w-12 sm:w-16 h-1 bg-emerald-500 rounded-full"></div>
            </div>

            <p className="text-base min-[400px]:text-lg sm:text-lg md:text-xl text-muted-foreground/90 leading-relaxed text-justify">
              {aboutDict.solution3_desc ||
                'A centralized digital hub that automates trade contracts, shipping paperwork, and compliance documents to eliminate typos, customs holds, and expensive port demurrage fees.'}
            </p>
          </div>

          {/* Right: Image */}
          <div className="w-full flex items-center justify-center">
            <div className="relative w-full overflow-hidden rounded-2xl border border-border/40 bg-muted/20 shadow-sm transition-all duration-300 hover:shadow-md flex items-center justify-center p-4 sm:p-8">
              <Image
                src="/media/smart-docs.svg"
                alt={aboutDict.solution3_title || 'Smart Pre-to-Post Trade Documentation'}
                width={626}
                height={395}
                className="w-full max-h-[380px] h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Fifth Section: Additional Features */}
      <section className="mt-14 md:mt-20 space-y-8 md:space-y-10">
        <div className="text-center space-y-3 max-w-4xl mx-auto">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
            {aboutDict.features_title || 'Additional Features'}
          </h3>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive tools engineered to elevate every stage of your global trade workflow
          </p>
          <div className="w-12 sm:w-16 h-1 bg-emerald-500 mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
          {/* Feature 1: AI Analytics & Market Reports */}
          <div className="group relative flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-1">
            <div className="mb-4 flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                <i className="fa-solid fa-brain"></i>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 bg-muted/40 px-2.5 py-1 rounded-md">
                Intelligence
              </span>
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-foreground mb-2.5 tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {aboutDict.feature1_title || 'AI Analytics & Market Reports'}
            </h4>
            <p className="text-sm sm:text-base text-muted-foreground/90 leading-relaxed text-justify flex-1">
              {aboutDict.feature1_desc ||
                'AgriGuru Online equips market participants with predictive analytics, weather impact tracking, policy monitoring, and comprehensive monthly intelligence reports. By synthesizing macroeconomic shifts, climatic events, and regulatory changes into actionable insights, AgriGuru online enables traders to make informed, risk-managed decisions before global physical supplies are affected.'}
            </p>
          </div>

          {/* Feature 2: Custom Price Alerts */}
          <div className="group relative flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-1">
            <div className="mb-4 flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                <i className="fa-solid fa-bell"></i>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 bg-muted/40 px-2.5 py-1 rounded-md">
                Alerts
              </span>
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-foreground mb-2.5 tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {aboutDict.feature2_title || 'Custom Price Alerts'}
            </h4>
            <p className="text-sm sm:text-base text-muted-foreground/90 leading-relaxed text-justify flex-1">
              {aboutDict.feature2_desc ||
                'Set tailored notifications for specific commodities or origins so you never miss a profitable market move. Set target price thresholds for any commodity origin or freight rate, and get notified instantly the moment the market hits your target. You stop chasing the market; you let the market come to you.'}
            </p>
          </div>

          {/* Feature 3: Global Agri News & Event Updates */}
          <div className="group relative flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-1">
            <div className="mb-4 flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                <i className="fa-solid fa-newspaper"></i>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 bg-muted/40 px-2.5 py-1 rounded-md">
                News & Events
              </span>
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-foreground mb-2.5 tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {aboutDict.feature3_title || 'Global Agri News & Event Updates'}
            </h4>
            <p className="text-sm sm:text-base text-muted-foreground/90 leading-relaxed text-justify flex-1">
              {aboutDict.feature3_desc ||
                'To navigate cross-border trade successfully, access to real-time market intelligence is just as crucial as tracking physical commodity prices. AgriGuru Online integrates a dedicated Global Agri News & Event Updates hub into its platform, giving traders instant access to major industry headlines, shifting regulatory and export policies, monthly market analysis reports, and upcoming global trade expos. By keeping you informed on macroeconomic factors before they impact local pricing, AgriGuru Online helps you make proactive, risk-managed trading decisions.'}
            </p>
          </div>

          {/* Feature 4: Interactive Chart Trend Analysis */}
          <div className="group relative flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-1">
            <div className="mb-4 flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                <i className="fa-solid fa-chart-line"></i>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 bg-muted/40 px-2.5 py-1 rounded-md">
                Analytics
              </span>
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-foreground mb-2.5 tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {aboutDict.feature4_title || 'Interactive Chart Trend Analysis'}
            </h4>
            <p className="text-sm sm:text-base text-muted-foreground/90 leading-relaxed text-justify flex-1">
              {aboutDict.feature4_desc ||
                'Making high-stakes trade decisions requires more than looking at today’s static quote—it demands visual, data-driven market intelligence. AgriGuru Online equips traders with an Interactive Chart Trend Analysis tool that plots historical and real-time market movements for both physical commodity prices and ocean freight rates. By visualizing price trajectories, seasonality, and freight volatility across major trade corridors, AgriGuru online empowers buyers and sellers to identify optimal entry/exit points and execute trades with statistical confidence.'}
            </p>
          </div>

          {/* Feature 5: Cross-border Multi-Language Support */}
          <div className="group relative flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-1">
            <div className="mb-4 flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                <i className="fa-solid fa-globe"></i>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 bg-muted/40 px-2.5 py-1 rounded-md">
                Accessibility
              </span>
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-foreground mb-2.5 tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {aboutDict.feature5_title || 'Cross-Border Multi-Language Support'}
            </h4>
            <p className="text-sm sm:text-base text-muted-foreground/90 leading-relaxed text-justify flex-1">
              {aboutDict.feature5_desc ||
                'Global agri-commodity trading brings together buyers and sellers from diverse cultures, regions, and native tongues. To ensure that international trade is accessible and frictionless, AgriGuru Online features a built-in Multi-Language Module supporting English, Arabic, French, and Chinese.'}
            </p>
          </div>

          {/* Feature 6: Tailored Notification */}
          <div className="group relative flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-1">
            <div className="mb-4 flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                <i className="fa-solid fa-sliders"></i>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 bg-muted/40 px-2.5 py-1 rounded-md">
                Customization
              </span>
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-foreground mb-2.5 tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {aboutDict.feature6_title || 'Tailored Notifications'}
            </h4>
            <p className="text-sm sm:text-base text-muted-foreground/90 leading-relaxed text-justify flex-1">
              {aboutDict.feature6_desc ||
                'In the fast-moving world of global agriculture, active trading platforms can easily generate dozens of daily notifications, many of which may be irrelevant to your specific business focus. To cut through this digital noise and eliminate information overload, AgriGuru Online features a customized notification system that allows users to tailor their alert preferences precisely to their needs. Whether you trade exclusively in rice or specialize in a single commodity category, you can easily configure your settings to receive real-time updates and price movements only for what matters to your trade desk, allowing you to instantly filter out unnecessary distractions and focus entirely on your core market opportunities.'}
            </p>
          </div>
        </div>
      </section>

      {/* Sixth Section: Mobile App & Web Platform Features */}
      <section className="mt-14 md:mt-20 space-y-8 md:space-y-10">
        <div className="text-center space-y-3 max-w-4xl mx-auto">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
            {aboutDict.platform_features_title ||
              'AgriGuru Online Mobile App & Web Platform Features'}
          </h3>
          <div className="w-12 sm:w-16 h-1 bg-emerald-500 mx-auto rounded-full"></div>
          <p className="text-base sm:text-lg text-muted-foreground/90 max-w-3xl mx-auto leading-relaxed pt-1 text-center">
            {aboutDict.platform_features_desc ||
              'AgriGuru Online offers a comprehensive range of features, providing significant benefits to exporters and importers in the agricultural business globally, as outlined below:'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5">
          {[
            {
              title: aboutDict.pf_price_updates_title || 'Price Updates',
              desc: aboutDict.pf_price_updates_desc || 'Product Price Updates Online',
              icon: 'fa-solid fa-tags',
              color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_freight_rates_title || 'Freight Rates',
              desc: aboutDict.pf_freight_rates_desc || 'Ocean Freight Rates Update Online',
              icon: 'fa-solid fa-ship',
              color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_smart_docs_title || 'Smart Documentation',
              desc: aboutDict.pf_smart_docs_desc || 'Export Docs & Shipping Docs',
              icon: 'fa-solid fa-folder-open',
              color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_price_alerts_title || 'Setup Price Alerts',
              desc: aboutDict.pf_price_alerts_desc || 'Setup Your Alert And Get Triggered Price',
              icon: 'fa-solid fa-bell',
              color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 group-hover:bg-yellow-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_ai_prediction_title || 'AI Price Prediction',
              desc: aboutDict.pf_ai_prediction_desc || 'Profits With AI Predictions',
              icon: 'fa-solid fa-wand-magic-sparkles',
              color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_chart_trends_title || 'Chart Trends',
              desc: aboutDict.pf_chart_trends_desc || 'Product Chart & Freight Chart',
              icon: 'fa-solid fa-chart-simple',
              color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:bg-teal-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_trusted_clients_title || 'Trusted Clients',
              desc: aboutDict.pf_trusted_clients_desc || 'Genuine Buyers & Sellers',
              icon: 'fa-solid fa-handshake',
              color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_market_reports_title || 'Market Reports',
              desc: aboutDict.pf_market_reports_desc || 'Download Product And Freight',
              icon: 'fa-solid fa-chart-pie',
              color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_free_membership_title || 'Free Membership',
              desc: aboutDict.pf_free_membership_desc || 'Free Trial Membership available',
              icon: 'fa-solid fa-id-card',
              color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:bg-sky-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_ai_chatbot_title || 'AI Guru Chatbot',
              desc: aboutDict.pf_ai_chatbot_desc || 'Instant AI Expertise At Your Fingertips',
              icon: 'fa-solid fa-robot',
              color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_inquiries_offers_title || 'Inquiries & Offers',
              desc: aboutDict.pf_inquiries_offers_desc || 'Fast Responses For Every Inquiry & Offer',
              icon: 'fa-solid fa-envelope-open-text',
              color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 group-hover:bg-orange-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_multi_language_title || 'Multiple Language',
              desc: aboutDict.pf_multi_language_desc || 'Global Multi Language Experience',
              icon: 'fa-solid fa-language',
              color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_quality_control_title || 'Quality Control',
              desc: aboutDict.pf_quality_control_desc || 'On-Time Quality Reports By Experts',
              icon: 'fa-solid fa-clipboard-check',
              color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_verified_kyc_title || 'Verified KYC Member',
              desc: aboutDict.pf_verified_kyc_desc || 'Trusted KYC Docs Verified Clients Only',
              icon: 'fa-solid fa-shield-halved',
              color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white',
            },
            {
              title: aboutDict.pf_shipment_tracking_title || 'Shipment Tracking',
              desc: aboutDict.pf_shipment_tracking_desc || 'Live Shipments Tracking',
              icon: 'fa-solid fa-location-dot',
              color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white',
            },
          ].map((item, index) => (
            <div
              key={index}
              className="group relative flex items-center gap-3.5 sm:gap-4 rounded-2xl border border-border/60 bg-card p-4 sm:p-4.5 shadow-sm transition-all duration-300 hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-0.5"
            >
              <div
                className={`w-12 h-12 rounded-xl ${item.color} flex-shrink-0 flex items-center justify-center text-xl transition-all duration-300 group-hover:scale-105 shadow-xs`}
              >
                <i className={item.icon}></i>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-base sm:text-lg font-bold text-foreground tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-snug">
                  {item.title}
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground/90 font-medium leading-relaxed mt-0.5">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Seventh Section: Our Aim & Our Vision */}
      <section className="mt-14 md:mt-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Card 1: Our Aim */}
          <div className="group relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-emerald-500/[0.04] p-7 sm:p-9 lg:p-10 shadow-sm transition-all duration-300 hover:border-emerald-500/40 hover:shadow-lg">
            {/* Background Decorative Glow */}
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl transition-opacity group-hover:opacity-100 opacity-60"></div>

            <div className="relative space-y-4 sm:space-y-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xl sm:text-2xl shadow-sm transition-transform duration-300 group-hover:scale-105">
                  <i className="fa-solid fa-bullseye"></i>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {aboutDict.aim_title || 'Our Aim'}
                </h3>
              </div>

              <div className="w-12 h-1 bg-emerald-500 rounded-full"></div>

              <p className="text-base sm:text-lg md:text-xl text-muted-foreground/95 leading-relaxed text-justify pt-1">
                {aboutDict.aim_desc ||
                  'Our goal is to serve as the one-stop digital solution for global agri-commodity trading. We aim to replace outdated operational headaches with a smooth, streamlined experience for every buyer, seller, and trader worldwide.'}
              </p>
            </div>
          </div>

          {/* Card 2: Our Vision */}
          <div className="group relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-teal-500/[0.04] p-7 sm:p-9 lg:p-10 shadow-sm transition-all duration-300 hover:border-teal-500/40 hover:shadow-lg">
            {/* Background Decorative Glow */}
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl transition-opacity group-hover:opacity-100 opacity-60"></div>

            <div className="relative space-y-4 sm:space-y-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center text-xl sm:text-2xl shadow-sm transition-transform duration-300 group-hover:scale-105">
                  <i className="fa-solid fa-compass"></i>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {aboutDict.vision_title || 'Our Vision'}
                </h3>
              </div>

              <div className="w-12 h-1 bg-teal-500 rounded-full"></div>

              <p className="text-base sm:text-lg md:text-xl text-muted-foreground/95 leading-relaxed text-justify pt-1">
                {aboutDict.vision_desc ||
                  'To build a transparent, highly efficient, and trust-driven future for global agri-commodity trade—empowering market participants to stop reacting to market chaos and start anticipating profitable opportunities with total confidence.'}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

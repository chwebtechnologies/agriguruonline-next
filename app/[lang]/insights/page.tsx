import { getDictionary } from '../dictionaries'
import { cmsService } from '@/lib/api/cms.service'
import { withTimeout } from '@/lib/api-utils'
import InfiniteMarketUpdatesCarousel from '@/components/home/InfiniteMarketUpdatesCarousel'
import InfiniteNewsCarousel from '@/components/home/InfiniteNewsCarousel'
import InfiniteMarketReportsCarousel from '@/components/home/InfiniteMarketReportsCarousel'
import InfiniteEventsCarousel from '@/components/home/InfiniteEventsCarousel'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Metadata } from 'next'
import { getStandardMetadata, getSafeLanguage, getSiteUrl, serializeJsonLd } from '@/lib/seo'
import { cookies } from 'next/headers'
import { Suspense } from 'react'

export const revalidate = 60;

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const activeLang = getSafeLanguage(params?.lang)

  return getStandardMetadata({
    pageKey: 'insights',
    pathname: 'insights',
    lang: activeLang,
  })
}

function InsightsSchema({ lang, title }: { lang: string; title: string }) {
  const siteUrl = getSiteUrl();
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${siteUrl}/${lang}/insights/#webpage`,
        'url': `${siteUrl}/${lang}/insights`,
        'name': title,
        'description': 'Comprehensive agricultural market intelligence, daily news updates, commodity research reports, and global events.',
        'isPartOf': {
          '@type': 'WebSite',
          '@id': `${siteUrl}/#website`,
          'url': siteUrl,
          'name': 'AgriGuru Online',
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${siteUrl}/${lang}/insights/#breadcrumb`,
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': `${siteUrl}/${lang}`,
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': title,
            'item': `${siteUrl}/${lang}/insights`,
          },
        ],
      },
    ],
  };

  return (
    <script
      id="insights-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
    />
  );
}

function sanitizeReport(report: any) {
  if (!report) return null;
  return {
    ...report,
    id: report.id || report._id,
    _id: report.id || report._id,
    title: report.title || report.subject_title,
    subject_title: report.subject_title || report.title,
    description: report.description || report.page_description,
    page_description: report.page_description || report.description,
    category: report.category || report.categories?.[0] || report.category_name,
    category_name: report.category_name || (typeof report.category === 'string' ? report.category : report.category?.name),
    publish_date: report.publish_date || report.created_at || report.report_date || report.date,
    created_at: report.created_at || report.publish_date || report.date,
    date: report.date || report.publish_date || report.created_at,
    id_no: report.id_no || report.report_no,
    thumbnail: report.thumbnail || report.image,
    image: report.image || report.thumbnail,
    file: report.file || report.file_url || report.pdf_file,
    file_url: report.file_url || report.file || report.pdf_file,
    translations: Array.isArray(report.translations) ? report.translations.map((t: any) => ({
      lang_code: t.lang_code,
      title: t.title || t.subject_title,
      subject_title: t.subject_title || t.title,
      description: t.description
    })) : []
  };
}

async function InsightsFeed({ activeLang, dict }: { activeLang: string; dict: any }) {
  const API_TIMEOUT = 2500;

  // Read auth token for reports modal/access if required
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get('auth_token')?.value;
  } catch {}

  const [
    marketUpdatesData,
    newsData,
    marketReportsData,
    eventsData
  ] = await Promise.all([
    withTimeout(cmsService.getMarketUpdates(activeLang, 1, 12).catch(() => null), API_TIMEOUT, null),
    withTimeout(cmsService.getLatestNews({ lang: activeLang, page: 1, limit: 12 }).catch(() => null), API_TIMEOUT, null),
    withTimeout(cmsService.getMarketReports({ lang: activeLang, page: 1, limit: 12, token }).catch(() => null), API_TIMEOUT, null),
    withTimeout(cmsService.getLatestEvents({ lang: activeLang, page: 1, limit: 12 }).catch(() => null), API_TIMEOUT, null),
  ]);

  const marketUpdates = marketUpdatesData?.data?.flyers || [];
  const articles = newsData?.data?.news || [];
  const rawReports = (marketReportsData?.data as any)?.market_reports || (marketReportsData?.data as any) || [];
  const reports = (Array.isArray(rawReports) ? rawReports : []).slice(0, 12).map(sanitizeReport).filter(Boolean);
  const events = eventsData?.data?.events || [];

  return (
    <div className="w-full space-y-10 sm:space-y-12 pt-2 pb-8">
      {/* 1. Market Updates Carousel */}
      {marketUpdates.length > 0 && (
        <section className="w-full">
          <div className="max-w-3xl mx-auto text-center px-4">
            <div className="inline-block mb-3">
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

      {/* 2. News Carousel */}
      {articles.length > 0 && (
        <section className="w-full">
          <div className="max-w-3xl mx-auto text-center px-4">
            <div className="inline-block mb-3">
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

      {/* 3. Market Reports Carousel */}
      {reports.length > 0 && (
        <section className="w-full">
          <div className="max-w-3xl mx-auto text-center px-4">
            <div className="inline-block mb-3">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground relative pb-3">
                {dict?.home?.reports_title || 'Agri Market Intelligence & Reports'}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-primary rounded-full"></span>
              </h2>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed text-balance w-full max-w-4xl mx-auto line-clamp-2">
              {dict?.home?.reports_desc || 'Access exclusive commodity research reports, supply-demand forecasts, and in-depth harvest analysis.'}
            </p>
          </div>
          <InfiniteMarketReportsCarousel reports={reports} lang={activeLang} dict={dict} isLoggedIn={!!token} />
        </section>
      )}

      {/* 4. Events Carousel */}
      {events.length > 0 && (
        <section className="w-full">
          <div className="max-w-3xl mx-auto text-center px-4">
            <div className="inline-block mb-3">
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
    </div>
  );
}

export default async function InsightsPage(props: {
  params: Promise<{ lang: string }>
}) {
  const params = await props.params;
  const activeLang = getSafeLanguage(params?.lang);
  const dict = await getDictionary(activeLang as any).catch(() => ({} as any));
  const common = dict?.common || {};
  const pageTitle = dict?.header?.insights || dict?.navigation?.insights || 'Insights';

  return (
    <div className="bg-background text-foreground">
      <InsightsSchema lang={activeLang} title={pageTitle} />
      {/* Main Content adhering strictly to layout standards */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={pageTitle} backText={common.back || 'Back'} />

          <Suspense fallback={
            <div className="w-full space-y-12 animate-pulse pt-4 pb-8">
              {[0, 1, 2, 3].map((sectionIndex) => (
                <div key={sectionIndex} className="space-y-4">
                  <div className="flex flex-col items-center space-y-2 max-w-3xl mx-auto">
                    <div className="h-8 w-64 bg-muted rounded-lg" />
                    <div className="h-4 w-96 max-w-full bg-muted/60 rounded-md" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-72 rounded-2xl bg-card border border-border" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          }>
            <InsightsFeed activeLang={activeLang} dict={dict} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

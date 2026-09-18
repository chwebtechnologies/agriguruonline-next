// @ts-nocheck
import { PageHeader } from '@/components/ui/PageHeader'
import MarketReportCard from '@/components/marketReports/MarketReportCard'
import { Pagination } from '@/components/ui/Pagination'
import ListingFilters from '@/components/shared/ListingFilters'
import type { Metadata } from 'next'
import type { MarketReportsResponse } from '@/types/marketReports'
import { cache, Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCategories } from '@/lib/category'
import { ForceLogout } from '@/components/auth/ForceLogout'
import { getDictionary } from '../dictionaries'

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
    pageKey: 'market_reports',
    pathname: 'market-reports',
    lang,
  });
}



import { cmsService } from '@/lib/api/cms.service'

/* ---------- Skeleton shown during Suspense ---------- */
function MarketReportsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 mt-2">
      {[...Array(10)].map((_, i) => (
        <div 
          key={i} 
          className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs animate-pulse"
        >
          {/* Reverted aspect ratio for Market Reports */}
          <div className="w-full aspect-[794/1120] bg-muted border-b border-border"></div>
          <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
            <div className="flex items-center justify-between mb-2">
              <div className="w-14 h-4 rounded bg-muted"></div>
              <div className="w-16 h-3 rounded bg-muted"></div>
            </div>
            <div className="w-full h-4 rounded bg-muted mb-1.5"></div>
            <div className="w-3/4 h-4 rounded bg-muted mb-3"></div>
            <div className="flex-grow"></div>
            <div className="flex items-center justify-between mt-auto border-t border-border pt-3">
              <div className="w-20 h-4 rounded bg-muted"></div>
              <div className="w-6 h-6 rounded-full bg-muted"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Async component that fetches and renders market reports grid ---------- */
async function MarketReportsGrid({ lang, page, apiLimit, displayLimit, search, token, categoryId, dict }: {
  lang: string
  page: number
  apiLimit: number
  displayLimit: number
  search?: string
  token: string
  categoryId?: string
  dict: any
}) {
  const reportsData = await cmsService.getMarketReports({ lang, page, limit: apiLimit, search, token, categoryId })
  
  // Try to safely extract array of reports and total
  let reports = reportsData?.data?.market_reports || reportsData?.data || []
  if (!Array.isArray(reports)) {
    reports = []
  }
  
  const totalItems = reportsData?.data?.total || reports.length || 0
  const totalPages = Math.ceil(totalItems / displayLimit)

  // Slice the array to display exactly 20 (displayLimit) records
  reports = reports.slice(0, displayLimit)

  if (reports.length === 0) {
    return (
      <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
          <i className="fa-solid fa-file-pdf text-2xl"></i>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">No Market Reports Found</h2>
        <p className="text-foreground/80 max-w-md mx-auto">
          We couldn&apos;t find any market reports at the moment. Please check back later.
        </p>
      </div>
    )
  }

  const sanitizeReport = (report: any) => {
    if (!report) return null;
    return {
      id: report.id || report._id,
      _id: report.id || report._id,
      title: report.title,
      slug: report.slug,
      date: report.date,
      thumbnail: report.thumbnail,
      file: report.file,
      translations: report.translations ? report.translations.map((t: any) => ({
        lang_code: t.lang_code,
        title: t.title
      })) : []
    };
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 mt-2">
        {reports.map(sanitizeReport).filter(Boolean).map((report: any, index: number) => (
          <MarketReportCard priority={index < 4} key={report.id || report._id || Math.random()} report={report} lang={lang} dict={dict} />
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} baseUrl={`/${lang}/market-reports`} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}`
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Market Reports",
                  "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/market-reports`
                }
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              "itemListElement": reports.map((report: any, index: number) => {
                const title = report.translations?.find((t: any) => t.lang_code === lang)?.title || report.title || "Report"
                return {
                  "@type": "ListItem",
                  "position": index + 1,
                  "item": {
                    "@type": "Article",
                    "headline": title,
                    "url": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/${lang}/market-reports`
                  }
                }
              })
            }
          ]).replace(/</g, '\u003c')
        }}
      />
    </>
  )
}

/* ---------- Main page component ---------- */
export default async function MarketReportsPage(props: { 
  params: Promise<{ lang: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  const params = await props.params;
  const lang = params.lang || 'en'
  
  if (!token) {
    redirect(`/${lang}/login`);
  }

  const searchParams = await props.searchParams;
  
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1
  const currentPage = !isNaN(page) && page > 0 ? page : 1
  const apiLimit = 25 // Limit as per API requirement
  const displayLimit = 20
  const searchQuery = typeof searchParams.search === 'string' ? searchParams.search : undefined
  const categoryQuery = typeof searchParams.category === 'string' ? searchParams.category : undefined
  

  // Fetch categories using identical Next.js cached configuration as Header
  const apiCategories = await getCategories(lang)
  
  let categoryId = undefined;
  if (categoryQuery && apiCategories) {
    const selectedCat = apiCategories.find((c: any) => c.slug === categoryQuery);
    if (selectedCat) {
      categoryId = (selectedCat as any).id || (selectedCat as any)._id;
    }
  }

  const filterCategories = apiCategories.map((c: any) => ({
    slug: c.slug,
    name: c.name
  }))

  const dict = await getDictionary(lang)

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={dict.header?.market_reports || "Market Reports"} backText={dict.common?.back || "Back"} />
          <ListingFilters categories={filterCategories} />
          <Suspense fallback={<MarketReportsGridSkeleton />}>
            <MarketReportsGrid lang={lang} page={currentPage} apiLimit={apiLimit} displayLimit={displayLimit} search={searchQuery} token={token} categoryId={categoryId} dict={dict.common} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

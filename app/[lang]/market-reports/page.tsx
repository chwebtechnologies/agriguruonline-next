import { PageHeader } from '@/components/ui/PageHeader'
import MarketReportCard from '@/components/marketReports/MarketReportCard'
import { Pagination } from '@/components/ui/Pagination'
import ListingFilters from '@/components/ui/ListingFilters'
import type { Metadata } from 'next'
import type { MarketReportsResponse } from '@/types/marketReports'
import { cache, Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCategories } from '@/lib/category'
import { ForceLogout } from '@/components/auth/ForceLogout'
import { getCmsApiUrl, getTradingApiUrl } from '@/lib/api-utils'

export const metadata: Metadata = {
  title: 'Market Reports - AgriGuru Online',
  description: 'Access exclusive market reports and insights for registered users.',
}



const getMarketReports = cache(async (lang: string, page: number, limit: number, search?: string, token?: string, categoryId?: string): Promise<MarketReportsResponse | null> => {
  const cmsApiUrl = getCmsApiUrl();
  let url = `${cmsApiUrl}/market-report/?is_active=true&lang_code=${lang}&source=web&page=${page}&limit=${limit}`
  if (search) url += `&search=${encodeURIComponent(search)}`
  if (categoryId) url += `&category_id=${encodeURIComponent(categoryId)}`

  let shouldLogout = false;
  try {
    const res = await fetch(url, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      cache: 'no-store'
    })
    
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        shouldLogout = true;
      } else {
        return null;
      }
    } else {
      const json = await res.json()
      if (json.success === false && (
          json.message?.toLowerCase().includes('token') || 
          json.message?.toLowerCase().includes('unauthorized') || 
          json.message?.toLowerCase().includes('invalid') ||
          json.message?.toLowerCase().includes('expire')
      )) {
         shouldLogout = true;
      } else {
         return json;
      }
    }
  } catch (error) {
    console.error('Failed to fetch market reports:', error)
    return null
  }

  return null;
})

/* ---------- Skeleton shown during Suspense ---------- */
function MarketReportsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 mt-2">
      {[...Array(10)].map((_, i) => (
        <div 
          key={i} 
          className="flex flex-col rounded-xl bg-background border border-ag-header-border overflow-hidden h-full shadow-sm animate-pulse"
        >
          {/* Reverted aspect ratio for Market Reports */}
          <div className="w-full aspect-[794/1120] bg-ag-header-border/50 border-b border-ag-header-border"></div>
          <div className="px-2 py-2 sm:px-3 sm:py-3 flex flex-col flex-grow">
            <div className="w-full h-5 rounded bg-ag-header-border/50 mb-2"></div>
            <div className="w-3/4 h-5 rounded bg-ag-header-border/50 mb-4"></div>
            <div className="w-full h-3 rounded bg-ag-header-border/50 mb-1.5"></div>
            <div className="w-full h-3 rounded bg-ag-header-border/50 mb-1.5"></div>
            <div className="w-4/5 h-3 rounded bg-ag-header-border/50 mb-4"></div>
            <div className="flex-grow"></div>
            <div className="flex items-center justify-between mt-auto border-t border-ag-header-border pt-3">
              <div className="w-20 h-4 rounded bg-ag-header-border/50"></div>
              <div className="w-6 h-6 rounded-full bg-ag-header-border/50"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Async component that fetches and renders market reports grid ---------- */
async function MarketReportsGrid({ lang, page, apiLimit, displayLimit, search, token, categoryId }: {
  lang: string
  page: number
  apiLimit: number
  displayLimit: number
  search?: string
  token: string
  categoryId?: string
}) {
  const reportsData = await getMarketReports(lang, page, apiLimit, search, token, categoryId)
  
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
      <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-ag-header-border mt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-ag-header-border mb-4 text-foreground/60">
          <i className="fa-solid fa-file-pdf text-2xl"></i>
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No Market Reports Found</h3>
        <p className="text-foreground/70 max-w-md mx-auto">
          We couldn&apos;t find any market reports at the moment. Please check back later.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 mt-2">
        {reports.map((report: any, index: number) => (
          <MarketReportCard priority={index < 4} key={report.id || report._id || Math.random()} report={report} lang={lang} />
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} baseUrl={`/${lang}/market-reports`} />
    </>
  )
}

/* ---------- Main page component ---------- */
export default async function MarketReportsPage(props: { 
  params: Promise<{ lang: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Authorization check
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
  
  // Unique key forces Suspense to re-mount and show skeleton when filters change
  const suspenseKey = `market-reports-${currentPage}-${searchQuery || ''}-${categoryQuery || ''}`

  // Fetch categories using identical Next.js cached configuration as Header
  const tradingApiUrl = getTradingApiUrl();
  const categoriesApiUrl = `${tradingApiUrl}/category`;
  const cacheStale = Number(process.env.CATEGORIES_CACHE_STALE) || 300
  const cacheRevalidate = Number(process.env.CATEGORIES_CACHE_REVALIDATE) || 3600
  const cacheExpire = Number(process.env.CATEGORIES_CACHE_EXPIRE) || 86400

  const apiCategories = await getCategories(lang, {
    apiUrl: categoriesApiUrl,
    stale: cacheStale,
    revalidate: cacheRevalidate,
    expire: cacheExpire
  })
  
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

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Market Reports" backText="Back" />
          <ListingFilters categories={filterCategories} />
          
          <Suspense key={suspenseKey} fallback={<MarketReportsGridSkeleton />}>
            <MarketReportsGrid lang={lang} page={currentPage} apiLimit={apiLimit} displayLimit={displayLimit} search={searchQuery} token={token} categoryId={categoryId} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

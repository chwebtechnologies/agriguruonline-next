import { PageHeader } from '@/components/ui/PageHeader'
import NewsCard from '@/components/news/NewsCard'
import { Pagination } from '@/components/ui/Pagination'
import ListingFilters from '@/components/shared/ListingFilters'
import type { Metadata } from 'next'
import type { NewsResponse } from '@/types/news'
import { getCategories } from '@/lib/category'
import { cache, Suspense } from 'react'
import { getTradingApiUrl, getCmsApiUrl } from '@/lib/api-utils';

export async function generateMetadata(
  props: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = params.lang || 'en';
  const title = 'Global Agriculture & Commodity Trade News';
  const fullTitle = 'Global Agriculture & Commodity Trade News | AgriGuru Online';
  const description = 'Read latest global agriculture news, international commodity market developments, government trade policies, and price forecasts on AgriGuru Online.';

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com';
  const pageUrl = `${siteUrl}/${lang}/news`;

  return {
    title,
    description,
    keywords: [
      'Global Agriculture News',
      'Commodity Market News',
      'Agri Trade Updates',
      'Crop Export News',
      'AgriGuru Online',
      'B2B Grain Intelligence'
    ],
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: pageUrl,
      siteName: 'AgriGuru Online',
      images: [
        {
          url: `${siteUrl}/logo.png`,
          width: 1200,
          height: 630,
          alt: 'Global Agriculture News',
        },
      ],
      locale: lang,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [`${siteUrl}/logo.png`],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates: {
      canonical: pageUrl,
      languages: {
        en: `${siteUrl}/en/news`,
        ar: `${siteUrl}/ar/news`,
        fr: `${siteUrl}/fr/news`,
        zh: `${siteUrl}/zh/news`,
        'x-default': `${siteUrl}/en/news`,
      }
    }
  };
}



const getLatestNews = cache(async (lang: string, page: number, limit: number, search?: string, categoryId?: string): Promise<NewsResponse | null> => {
  const cmsApiUrl = getCmsApiUrl(); const url = `${cmsApiUrl}/latestnews?is_active=true&lang_code=${lang}&source=web&page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}${categoryId ? `&category_id=${categoryId}` : ''}`

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }
    })

    if (!res.ok) {
      return null
    }

    const json = await res.json()
    return json
  } catch (error) {
    console.error('Failed to fetch latest news:', error)
    return null
  }
})

/* ---------- Skeleton shown during Suspense ---------- */
function NewsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden h-full shadow-xs animate-pulse"
        >
          <div className="w-full aspect-[3/2] bg-muted border-b border-border"></div>
          <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
            <div className="flex items-center mb-2">
              <div className="w-4 h-4 rounded bg-muted mr-2"></div>
              <div className="w-24 h-3 rounded bg-muted"></div>
            </div>
            <div className="w-full h-5 rounded bg-muted mb-2"></div>
            <div className="w-3/4 h-5 rounded bg-muted mb-4"></div>
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

/* ---------- Async component that fetches and renders news grid ---------- */
async function NewsGrid({ lang, page, limit, search, categoryId }: {
  lang: string
  page: number
  limit: number
  search?: string
  categoryId?: string
}) {
  const newsData = await getLatestNews(lang, page, limit, search, categoryId)
  const articles = newsData?.data?.news || []
  const totalItems = newsData?.data?.total || 0
  const totalPages = Math.ceil(totalItems / limit)

  if (articles.length === 0) {
    return (
      <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/60">
          <i className="fa-regular fa-newspaper text-2xl"></i>
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No News Found</h3>
        <p className="text-foreground/70 max-w-md mx-auto">
          We couldn&apos;t find any latest news articles at the moment. Please check back later.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
        {articles.map((article, index) => (
          <NewsCard priority={index < 4} key={article.id} article={article} lang={lang} />
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} baseUrl={`/${lang}/news`} />

      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": articles.map((article, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "item": {
                "@type": "NewsArticle",
                "headline": article.translations?.[0]?.title || article.slug,
                "image": [
                  article.thumbnail.startsWith('http')
                    ? article.thumbnail
                    : `https://assets.agriguruonline.cloud/${article.thumbnail}`
                ],
                "datePublished": article.posting_date,
                "url": `https://agriguruonline.com/${lang}/news/${article.slug}`
              }
            }))
          }).replace(/</g, '\\u003c')
        }}
      />
    </>
  )
}

/* ---------- Main page component ---------- */
export default async function LatestNewsPage(props: {
  params: Promise<{ lang: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const lang = params.lang || 'en'
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1
  const currentPage = !isNaN(page) && page > 0 ? page : 1
  const limit = 12
  const searchQuery = typeof searchParams.search === 'string' ? searchParams.search : undefined
  const categorySlug = typeof searchParams.category === 'string' ? searchParams.category : undefined

  const tradingApiUrl = getTradingApiUrl(); const apiCategories = await getCategories(lang, {
    apiUrl: `${tradingApiUrl.replace(/\/$/, '')}/category`,
    stale: 300,
    revalidate: 3600,
    expire: 86400
  })

  // Resolve slug to ID server-side so ID never leaks to the client
  const matchedCategory = categorySlug
    ? apiCategories.find(cat => cat.slug === categorySlug)
    : undefined
  const categoryId = matchedCategory?.id

  const categoryOptions = apiCategories
    .filter(cat => cat.is_active !== false)
    .map(cat => {
      const translation = cat.translations?.find(t => t.lang_code === lang)
      return { slug: cat.slug, name: translation ? translation.name : cat.name }
    })

  // Unique key forces Suspense to re-mount and show skeleton when filters change
  const suspenseKey = `news-${currentPage}-${searchQuery || ''}-${categorySlug || ''}`

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Latest News" backText="Back" />
          <ListingFilters categories={categoryOptions} />

          <Suspense key={suspenseKey} fallback={<NewsGridSkeleton />}>
            <NewsGrid lang={lang} page={currentPage} limit={limit} search={searchQuery} categoryId={categoryId} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

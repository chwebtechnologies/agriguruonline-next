import { PageHeader } from '@/components/ui/PageHeader'
import NewsCard from '@/components/news/NewsCard'
import { Pagination } from '@/components/ui/Pagination'
import ListingFilters from '@/components/shared/ListingFilters'
import type { Metadata } from 'next'
import type { NewsResponse } from '@/types/news'
import { getCategories } from '@/lib/category'
import { cache, Suspense } from 'react'
import { getTradingApiUrl, getCmsApiUrl } from '@/lib/api-utils';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

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
      next: { revalidate: 60 }
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

  const tradingApiUrl = getTradingApiUrl();
  const apiCategories = await getCategories(lang, {
    apiUrl: `${tradingApiUrl.replace(/\/$/, '')}/category`,
    stale: 300,
    revalidate: 0,
    expire: 86400
  })

  // Resolve slug to ID server-side so ID never leaks to the client
  const matchedCategory = categorySlug
    ? apiCategories.find(cat => cat.slug === categorySlug)
    : undefined
  const categoryId = matchedCategory?.id

  const newsData = await getLatestNews(lang, currentPage, limit, searchQuery, categoryId)
  const articles = newsData?.data?.news || []
  const totalItems = newsData?.data?.total || 0
  const totalPages = Math.ceil(totalItems / limit)

  const categoryOptions = apiCategories
    .filter(cat => cat.is_active !== false)
    .map(cat => {
      const translation = cat.translations?.find(t => t.lang_code === lang)
      return { slug: cat.slug, name: translation ? translation.name : cat.name }
    })

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Latest News" backText="Back" />
          <ListingFilters categories={categoryOptions} />

          {articles.length === 0 ? (
            <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
                <i className="fa-regular fa-newspaper text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No News Found</h3>
              <p className="text-foreground/80 max-w-md mx-auto">
                We couldn&apos;t find any latest news articles at the moment. Please check back later.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
                {articles.map((article, index) => (
                  <NewsCard priority={index < 2} key={article.id} article={article} lang={lang} />
                ))}
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={`/${lang}/news`} />

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
                          article.thumbnail?.startsWith('http')
                            ? article.thumbnail
                            : article.thumbnail
                              ? `https://assets.agriguruonline.com/${article.thumbnail}`
                              : 'https://agriguruonline.com/logo.png'
                        ],
                        "datePublished": article.posting_date,
                        "url": `https://agriguruonline.com/${lang}/news/${article.slug}`
                      }
                    }))
                  }).replace(/</g, '\\u003c')
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

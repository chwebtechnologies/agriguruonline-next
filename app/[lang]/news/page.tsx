import { PageHeader } from '@/components/ui/PageHeader'
import NewsCard from '@/components/news/NewsCard'
import { Pagination } from '@/components/ui/Pagination'
import ListingFilters from '@/components/shared/ListingFilters'
import type { Metadata } from 'next'
import type { NewsResponse } from '@/types/news'
import { getCategories } from '@/lib/category'
import { cache, Suspense } from 'react'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { getTradingApiUrl, getCmsApiUrl } from '@/lib/api-utils';

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
    pageKey: 'news',
    pathname: 'news',
    lang,
  });
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
  const dict = await getDictionary(lang);

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
      return { slug: cat.slug, name: cat.name }
    })

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title={dict.header?.news || "Latest News"} backText={dict.common?.back || "Back"} />
          <ListingFilters categories={categoryOptions} />

          {articles.length === 0 ? (
            <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
                <i className="fa-regular fa-newspaper text-2xl"></i>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{dict.common?.no_search_results_found_for ? dict.common.no_search_results_found_for.replace('for', '').trim() : "No News Found"}</h2>
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
                  __html: JSON.stringify([
                    {
                      "@context": "https://schema.org",
                      "@type": "BreadcrumbList",
                      "itemListElement": [
                        {
                          "@type": "ListItem",
                          "position": 1,
                          "name": dict.navigation?.home || "Home",
                          "item": `https://agriguruonline.com/${lang}`
                        },
                        {
                          "@type": "ListItem",
                          "position": 2,
                          "name": dict.header?.news || "News",
                          "item": `https://agriguruonline.com/${lang}/news`
                        },
                        ...(matchedCategory ? [{
                          "@type": "ListItem",
                          "position": 3,
                          "name": matchedCategory.name,
                          "item": `https://agriguruonline.com/${lang}/news?category=${matchedCategory.slug}`
                        }] : [])
                      ]
                    },
                    {
                    "@context": "https://schema.org",
                    "@type": "ItemList",
                    "itemListElement": articles.map((article, index) => ({
                      "@type": "ListItem",
                      "position": index + 1,
                      "item": {
                        "@type": "NewsArticle",
                        "headline": article.translations?.find((t: any) => t.lang_code === lang)?.title || article.title || article.slug,
                        "description": article.translations?.find((t: any) => t.lang_code === lang)?.description || article.description,
                        "image": [
                          article.thumbnail?.startsWith('http')
                            ? article.thumbnail
                            : article.thumbnail
                              ? `https://assets.agriguruonline.com/${article.thumbnail}`
                              : 'https://agriguruonline.com/logo.png'
                        ],
                        "datePublished": article.posting_date || article.created_at,
                        "dateModified": article.posting_date || article.created_at,
                        "author": {
                          "@type": "Organization",
                          "name": article.translations?.find((t: any) => t.lang_code === lang)?.source || article.source || "AgriGuru Online"
                        },
                        "publisher": {
                          "@type": "Organization",
                          "name": "AgriGuru Online",
                          "logo": {
                            "@type": "ImageObject",
                            "url": "https://agriguruonline.com/logo.png"
                          }
                        },
                        "url": `https://agriguruonline.com/${lang}/news/${article.slug}`
                      }
                    }))
                  }]).replace(/</g, '\\u003c')
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { PageHeader } from '@/components/ui/PageHeader'
import NewsCard from '@/components/news/NewsCard'
import { Pagination } from '@/components/ui/Pagination'
import ListingFilters from '@/components/shared/ListingFilters'
import type { Metadata } from 'next'
import type { NewsResponse } from '@/types/news'
import { getCategories } from '@/lib/category'
import { cache, Suspense } from 'react'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { cmsService } from '@/lib/api/cms.service'
import { getStandardMetadata, getSafeLanguage } from '@/lib/seo'

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

export const revalidate = 60;

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

/* ---------- Skeleton Component ---------- */
function NewsGridSkeleton() {
  return (
    <>
      <PageHeader title="Latest News" backText="Back" />
      <div className="w-full h-12 bg-muted rounded-xl animate-pulse mt-4 mb-4"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 mt-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-2xl border border-border p-3 animate-pulse bg-card">
            <div className="w-full aspect-[4/3] bg-muted rounded-xl"></div>
            <div className="h-4 bg-muted w-3/4 mt-2 rounded"></div>
            <div className="h-4 bg-muted w-1/2 rounded"></div>
            <div className="h-3 bg-muted w-1/4 mt-auto rounded"></div>
          </div>
        ))}
      </div>
    </>
  )
}

import { withTimeout } from '@/lib/api-utils'

/* ---------- News Feed Component ---------- */
async function NewsFeed({ lang, currentPage, limit, searchQuery, categoryId, matchedCategory, dict }: any) {
  const newsData = await withTimeout(
    cmsService.getLatestNews({ lang, page: currentPage, limit, search: searchQuery, categoryId }).catch(() => null),
    2500,
    null
  )
  const articles = newsData?.data?.news || []
  const totalItems = newsData?.data?.total || 0
  const totalPages = Math.ceil(totalItems / limit)

  if (articles.length === 0) {
    return (
      <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-border mt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-border mb-4 text-foreground/75">
          <i className="fa-regular fa-newspaper text-2xl"></i>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">{dict.common?.no_search_results_found_for ? dict.common.no_search_results_found_for.replace('for', '').trim() : "No News Found"}</h2>
        <p className="text-foreground/80 max-w-md mx-auto">
          We couldn&apos;t find any latest news articles at the moment. Please check back later.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 mt-2">
        {articles.map((article: any, index: number) => (
          <div key={article.id} style={index >= 4 ? { contentVisibility: 'auto' } : undefined}>
            <NewsCard priority={index < 2} article={article} lang={lang} />
          </div>
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
            "itemListElement": articles.map((article: any, index: number) => ({
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
  )
}

async function NewsPageContent({ lang, searchParams }: { lang: string, searchParams: { [key: string]: string | string[] | undefined } }) {
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1
  const currentPage = !isNaN(page) && page > 0 ? page : 1
  const limit = 12
  const searchQuery = typeof searchParams.search === 'string' ? searchParams.search : undefined
  const categorySlug = typeof searchParams.category === 'string' ? searchParams.category : undefined
  
  const [dict, apiCategories] = await Promise.all([
    getDictionary(lang).catch(() => ({} as any)),
    getCategories(lang).catch(() => [])
  ]);

  const matchedCategory = categorySlug
    ? apiCategories.find(cat => cat.slug === categorySlug)
    : undefined
  const categoryId = matchedCategory?.id

  const categoryOptions = apiCategories
    .filter(cat => cat.is_active !== false)
    .map(cat => ({ slug: cat.slug, name: cat.name }))

  return (
    <>
      <PageHeader title={dict.header?.news || "Latest News"} backText={dict.common?.back || "Back"} />
      <ListingFilters categories={categoryOptions} />
      <NewsFeed 
        lang={lang} 
        currentPage={currentPage} 
        limit={limit} 
        searchQuery={searchQuery} 
        categoryId={categoryId} 
        matchedCategory={matchedCategory} 
        dict={dict} 
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

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <Suspense key={`${lang}-${searchParams?.page || 1}-${searchParams?.category || ''}`} fallback={<NewsGridSkeleton />}>
            <NewsPageContent lang={lang} searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

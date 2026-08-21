import { PageHeader } from '@/components/ui/PageHeader'
import NewsCard from '@/components/news/NewsCard'
import { Pagination } from '@/components/ui/Pagination'
import type { Metadata } from 'next'
import type { NewsResponse } from '@/types/news'
import { cache } from 'react'

export const metadata: Metadata = {
  title: 'Latest News - AgriGuru Online',
  description: 'Stay updated with the latest news, market trends, and insights in the agricultural industry.',
}

const getLatestNews = cache(async (lang: string, page: number, limit: number): Promise<NewsResponse | null> => {
  const cmsApiUrl = process.env.NEXT_PUBLIC_CMS_API_URL || 'https://cms-api.agriguruonline.cloud'
  const url = `${cmsApiUrl}/latestnews?is_active=true&lang_code=${lang}&source=web&page=${page}&limit=${limit}`

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

export default async function LatestNewsPage(props: { 
  params: Promise<{ lang: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  
  const lang = params.lang || 'en'
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1
  const currentPage = !isNaN(page) && page > 0 ? page : 1
  const limit = 12 // 4 items per row, 3 rows
  
  const newsData = await getLatestNews(lang, currentPage, limit)
  const articles = newsData?.data?.news || []
  const totalItems = newsData?.data?.total || 0
  const totalPages = Math.ceil(totalItems / limit)

  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          <PageHeader title="Latest News" backText="Back" />
          
          {articles.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 px-2 sm:px-0 mt-2">
                {articles.map((article) => (
                  <NewsCard key={article.id} article={article} lang={lang} />
                ))}
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={`/${lang}/latest-news`} />
            </>
          ) : (
            <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-ag-header-border mt-2">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-ag-header-border mb-4 text-foreground/60">
                <i className="fa-regular fa-newspaper text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No News Found</h3>
              <p className="text-foreground/70 max-w-md mx-auto">
                We couldn&apos;t find any latest news articles at the moment. Please check back later.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

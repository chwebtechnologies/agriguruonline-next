import type { Metadata } from 'next'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { ShareButton } from '@/components/ui/ShareButton'
import { getCmsApiUrl, getAssetsUrl } from '@/lib/api-utils'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import type { NewsArticle, NewsResponse } from '@/types/news'
import { cache } from 'react'

interface NewsDetail {
  id: string
  title: string
  description: string
  image: string
  thumbnail: string
  posting_date: string
  created_at?: string
  source: string
  source_url: string
  slug: string
  meta_keywords?: string
  meta_description?: string
  categories?: Array<{
    id: string
    name: string
  }>
  translations?: import('@/types/news').NewsTranslation[]
}

const getNewsDetail = cache(async (slug: string, lang: string): Promise<NewsDetail | null> => {
  const cmsApiUrl = getCmsApiUrl()
  const url = `${cmsApiUrl}/latestnews/${slug}?lang_code=${lang}&source=web`
  
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }
    })
    
    if (!res.ok) {
      return null
    }
    
    const json = await res.json()
    if (json.success && json.data) {
      return json.data
    }
    return null
  } catch (error) {
    console.error('Failed to fetch news detail:', error)
    return null
  }
})

const getOtherNews = cache(async (lang: string, categoryId?: string, limit = 6): Promise<NewsArticle[]> => {
  const cmsApiUrl = getCmsApiUrl()
  const url = `${cmsApiUrl}/latestnews?is_active=true&lang_code=${lang}&source=web&page=1&limit=${limit}${categoryId ? `&category_id=${categoryId}` : ''}`
  
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }
    })
    
    if (!res.ok) {
      return []
    }
    
    const json: NewsResponse = await res.json()
    return json?.data?.news || []
  } catch (error) {
    console.error('Failed to fetch other news:', error)
    return []
  }
})

export async function generateStaticParams() {
  const languages = ['en', 'ar', 'zh', 'fr']
  const params: Array<{ lang: string; slug: string }> = []

  try {
    const cmsApiUrl = getCmsApiUrl()
    const res = await fetch(`${cmsApiUrl}/latestnews?is_active=true&source=web&page=1&limit=50`, {
      next: { revalidate: 60 }
    })
    if (res.ok) {
      const json: NewsResponse = await res.json()
      const newsList = json?.data?.news || []
      for (const lang of languages) {
        for (const article of newsList) {
          if (article.slug) {
            params.push({ lang, slug: article.slug })
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to generate static params for news detail:', error)
  }

  return params
}

import { getAlternates, getSafeLanguage } from '@/lib/seo'

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params
  const lang = getSafeLanguage(params.lang)
  const slug = params.slug
  
  // URL decode slug in case it contains special characters
  const decodedSlug = decodeURIComponent(slug)
  const article = await getNewsDetail(decodedSlug, lang)
  const alternates = getAlternates(`news/${slug}`, lang)
  
  if (!article) {
    const notFoundTitles: Record<string, string> = {
      en: 'News Not Found',
      ar: 'الخبر غير موجود',
      zh: '未找到新闻',
      fr: 'Actualité Non Trouvée',
    }
    const notFoundDescs: Record<string, string> = {
      en: 'The requested news article could not be found on AgriGuru Online.',
      ar: 'تعذر العثور على المقال الإخباري المطلوب على AgriGuru Online.',
      zh: '在 AgriGuru Online 上未找到所请求的新闻报道。',
      fr: 'L’article d’actualité demandé est introuvable sur AgriGuru Online.',
    }
    return {
      title: notFoundTitles[lang] || notFoundTitles.en,
      description: notFoundDescs[lang] || notFoundDescs.en,
      alternates,
    }
  }

  const translation = article.translations?.find((t: any) => t.lang_code === lang)
  const title = translation?.title || article.title || 'AgriGuru Online News'
  
  const rawDescription = translation?.description || article.description || ''
  const cleanDescription = article.meta_description 
    || rawDescription.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160)
  
  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  
  const sourceImage = article.image || article.thumbnail
  const imagePath = sourceImage?.startsWith('/') ? sourceImage.slice(1) : sourceImage
  const imageUrl = sourceImage?.startsWith('http') 
    ? sourceImage 
    : (sourceImage ? `${imageBaseUrl}${imagePath}` : 'https://agriguruonline.com/logo.png')
  
  const fullTitle = `${title} | AgriGuru Online`

  return {
    title, // Uses root layout template "%s | AgriGuru Online" for clean title
    description: cleanDescription,
    keywords: article.meta_keywords ? article.meta_keywords.split(',').map(k => k.trim()) : [title, 'AgriGuru', 'Agriculture News', 'Commodities'],
    authors: [{ name: article.source || 'AgriGuru Online', url: article.source_url || alternates.canonical }],
    creator: 'AgriGuru Online',
    publisher: 'AgriGuru Online',
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: fullTitle,
      description: cleanDescription,
      url: alternates.canonical,
      siteName: 'AgriGuru Online',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: lang,
      type: 'article',
      publishedTime: article.posting_date || article.created_at,
      modifiedTime: article.created_at || article.posting_date,
      authors: [article.source || 'AgriGuru Online'],
      section: article.categories?.[0]?.name || 'Agriculture News',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: cleanDescription,
      images: [imageUrl],
      creator: '@AgriGuruOnline',
      site: '@AgriGuruOnline',
    },
    alternates,
  }
}

// Editorial content formatter
function formatEditorialContent(htmlContent: string, dict?: any): string {
  if (!htmlContent) return ''
  
  let formatted = htmlContent
    .replace(/<p>\s*(<br\s*\/?>|&nbsp;|\s)*\s*<\/p>/gi, '')
    .replace(/(<br\s*\/?>\s*){2,}/gi, '<br />')

  const forTradersStr = dict?.for_traders || "For Traders"
  const forExportersStr = dict?.for_exporters || "For Exporters"
  const forImportersStr = dict?.for_importers || "For Importers"
  const keyRiskStr = dict?.key_risk || "Key Risk"

  // Format "For Traders:"
  formatted = formatted.replace(
    /<p>(\s*<strong>)?(\s*For Traders:)(\s*<\/strong>)?([\s\S]*?)<\/p>/gi,
    `<div class="editorial-callout callout-traders">
      <div class="callout-label"><i class="fa-solid fa-chart-line"></i> ${forTradersStr}</div>
      <p class="callout-text">$4</p>
    </div>`
  )

  // Format "For Exporters:"
  formatted = formatted.replace(
    /<p>(\s*<strong>)?(\s*For Exporters:)(\s*<\/strong>)?([\s\S]*?)<\/p>/gi,
    `<div class="editorial-callout callout-exporters">
      <div class="callout-label"><i class="fa-solid fa-ship"></i> ${forExportersStr}</div>
      <p class="callout-text">$4</p>
    </div>`
  )

  // Format "For Importers:"
  formatted = formatted.replace(
    /<p>(\s*<strong>)?(\s*For Importers:)(\s*<\/strong>)?([\s\S]*?)<\/p>/gi,
    `<div class="editorial-callout callout-importers">
      <div class="callout-label"><i class="fa-solid fa-boxes-packing"></i> ${forImportersStr}</div>
      <p class="callout-text">$4</p>
    </div>`
  )

  // Format "Key Risk:"
  formatted = formatted.replace(
    /<p>(\s*<strong>)?(\s*Key Risk:)(\s*<\/strong>)?([\s\S]*?)<\/p>/gi,
    `<div class="editorial-callout callout-risk">
      <div class="callout-label"><i class="fa-solid fa-triangle-exclamation"></i> ${keyRiskStr}</div>
      <p class="callout-text">$4</p>
    </div>`
  )

  return formatted.trim()
}

export default async function NewsDetailPage(props: { params: Promise<{ lang: string; slug: string }> }) {
  const params = await props.params
  const { lang, slug } = params
  
  const article = await getNewsDetail(slug, lang)
  
  if (!article) {
    notFound()
  }

  const categoryId = article.categories?.[0]?.id
  let allLatestNews = await getOtherNews(lang, categoryId, 6)
  let otherNewsList = allLatestNews.filter(item => item.slug !== slug)

  if (otherNewsList.length === 0 && categoryId) {
    allLatestNews = await getOtherNews(lang, undefined, 6)
    otherNewsList = allLatestNews.filter(item => item.slug !== slug)
  }

  otherNewsList = otherNewsList.slice(0, 5)

  const translation = article.translations?.find((t: any) => t.lang_code === lang)
  const title = translation?.title || article.title
  const rawContent = translation?.description || article.description || ''
  const dict = await getDictionary(lang as any)
  const formattedContent = formatEditorialContent(rawContent, dict.common)
  const sourceName = translation?.source || article.source || "Agriguru Online"
  const categoryName = article.categories?.[0]?.name

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  const imageUrl = article.image.startsWith('http') ? article.image : `${imageBaseUrl}${article.image}`
  
  const postDateObj = new Date(article.posting_date)
  const formattedDate = postDateObj.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
  const formattedTime = postDateObj.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })

  // Calculate reading time
  const plainText = rawContent.replace(/<[^>]+>/g, '')
  const wordCount = plainText.trim().split(/\s+/).length
  const readingTime = Math.max(1, Math.ceil(wordCount / 200))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const articleUrl = `${siteUrl}/${lang}/news/${slug}`

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Header */}
          <PageHeader title="Latest News" backText="Back" backHref={`/${lang}/news`} />

          {/* 50-50 Split Layout using CSS Grid Areas */}
          <div className="mt-3 w-full max-w-full overflow-hidden">
            {/* Screen Reader Only H1 to enforce descending heading hierarchy for Accessibility & SEO */}
            <h1 className="sr-only">{title}</h1>
            <div className="responsive-layout-grid gap-y-0 md:gap-y-6 md:gap-x-6 lg:gap-x-8 items-start w-full max-w-full">
              
              {/* FEATURED IMAGE */}
              <div className="grid-area-image w-full max-w-full min-w-0 space-y-4">
                {/* Featured Image Card - Top rounded, Bottom WITHOUT curve (flat) */}
                <div className="bg-card rounded-t-2xl rounded-b-none md:rounded-2xl border border-border border-b-0 md:border-b p-2 sm:p-2.5 shadow-xs overflow-hidden">
                  <div className="relative w-full aspect-[3/2] rounded-t-xl rounded-b-none overflow-hidden bg-muted/40">
                    <ImageWithSkeleton
                      src={imageUrl}
                      alt={title}
                      title={title}
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                    />
                    {categoryName && (
                      <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-sm transform-gpu text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 pointer-events-none">
                        <i className="fa-solid fa-tag text-[9px] text-sky-300"></i>
                        {categoryName}
                      </div>
                    )}
                  </div>
                  
                  {/* Below Image: Publish Date, Time & Share with "Share" Text (Touch-to-touch edge alignment) */}
                  <div className="flex items-center justify-between gap-1 sm:gap-3 px-0.5 sm:px-1 pt-2.5 pb-0.5 w-full max-w-full overflow-hidden">
                    <div className="flex items-center gap-1.5 sm:gap-2.5 text-foreground min-w-0 flex-1">
                      <div className="inline-flex items-center gap-1 min-[380px]:gap-1.5 text-[12px] min-[360px]:text-[13px] sm:text-[14px] leading-none shrink-0">
                        <i className="fa-regular fa-calendar-days text-[12.5px] min-[360px]:text-[14px] sm:text-[15px] text-foreground/70 shrink-0"></i>
                        <span className="font-bold text-foreground shrink-0">Publish Date:</span>
                        <time dateTime={article.posting_date} className="font-medium text-foreground whitespace-nowrap">
                          {formattedDate}
                          {formattedTime && <span className="hidden md:inline">{` at ${formattedTime}`}</span>}
                        </time>
                      </div>
                      <span className="text-border hidden md:inline">•</span>
                      {/* Reading Time: Desktop Only */}
                      <div className="hidden md:inline-flex items-center gap-1.5 text-[13px] sm:text-[14px] font-medium px-2 py-0.5 rounded-md bg-muted text-foreground/80 whitespace-nowrap shrink-0 border border-border/60 leading-none">
                        <i className="fa-regular fa-clock text-xs sm:text-sm text-foreground/75"></i>
                        <span>{readingTime} min read</span>
                      </div>
                    </div>

                    {/* Share Button (Entire text and icon are directly clickable) */}
                    <ShareButton 
                      title={title} 
                      url={`/${lang}/news/${slug}`} 
                      label="Share"
                      className="inline-flex items-center gap-1 min-[380px]:gap-1.5 text-[12px] min-[360px]:text-[13px] sm:text-[14px] font-bold text-foreground hover:text-brand-blue transition-colors shrink-0 leading-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* OTHER NEWS (Mobile: Bottom, Desktop: Under Image, matched height with Content) */}
              {otherNewsList.length > 0 && (
                <div className="grid-area-other w-full max-w-full min-w-0 mt-6 md:mt-0 md:h-full md:min-h-[340px]">
                  <div className="bg-card rounded-2xl border border-border p-3 sm:p-4 md:p-5 shadow-xs space-y-3 sm:space-y-3.5 overflow-hidden flex flex-col md:h-full md:min-h-[340px] md:max-h-[720px]">
                    <div className="flex items-center justify-between pb-2 border-b border-border shrink-0">
                      <h2 
                        className="text-[15px] sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
                        style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}
                      >
                        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-muted text-foreground/80 text-xs border border-border/60">
                          <i className="fa-regular fa-newspaper"></i>
                        </span>
                        Other News
                      </h2>
                      <Link
                        href={`/${lang}/news`}
                        className="text-xs font-bold text-foreground/80 hover:text-brand-blue hover:underline flex items-center gap-1 transition-colors"
                      >
                        View All
                        <i className="fa-solid fa-chevron-right text-[10px]"></i>
                      </Link>
                    </div>

                    {/* Scrollable list on desktop when content card is tall */}
                    <div className="space-y-2.5 sm:space-y-3 md:flex-1 md:overflow-y-auto md:pr-1 custom-scrollbar min-h-0">
                      {otherNewsList.map((newsItem) => {
                        const itemTitle = newsItem.title || newsItem.slug
                        const itemDesc = (newsItem.description || '').replace(/<[^>]+>/g, '').trim()
                        const itemImg = newsItem.thumbnail?.startsWith('http') 
                          ? newsItem.thumbnail 
                          : `${imageBaseUrl}${newsItem.thumbnail}`
                        
                        const itemPostDate = new Date(newsItem.posting_date)
                        const itemDateFormatted = itemPostDate.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })

                        return (
                          <Link
                            key={newsItem.id}
                            href={`/${lang}/news/${newsItem.slug}`}
                            className="group flex flex-col p-2.5 sm:p-3 rounded-xl bg-background/50 hover:bg-muted/60 transition-all border border-border/70 hover:border-brand-blue/40 overflow-hidden"
                          >
                            {/* Top Content: Thumbnail on Left, Title & Description on Right */}
                            <div className="flex flex-row gap-2.5 sm:gap-3.5 items-start">
                              {/* 3:2 Ratio Image */}
                              <div className="relative w-[95px] min-[360px]:w-[110px] sm:w-[130px] min-w-[95px] min-[360px]:min-w-[110px] sm:min-w-[130px] aspect-[3/2] rounded-lg overflow-hidden shrink-0 border border-border bg-muted/40">
                                <ImageWithSkeleton
                                  src={itemImg}
                                  alt={itemTitle}
                                  title={itemTitle}
                                  fill
                                  sizes="(max-width: 640px) 110px, 130px"
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </div>

                              {/* Title & Description */}
                              <div className="flex-1 min-w-0 space-y-1">
                                <h3 className="text-[13px] min-[360px]:text-[14px] font-bold text-foreground line-clamp-2 leading-snug group-hover:text-brand-blue transition-colors">
                                  {itemTitle}
                                </h3>
                                {itemDesc && (
                                  <p className="text-[11.5px] min-[360px]:text-[12px] sm:text-[12.5px] text-foreground/75 line-clamp-2 leading-relaxed text-left">
                                    {itemDesc}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Full-Width Footer: 100% Horizontal Alignment for Date and Read More */}
                            <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-border/50 text-[11px] sm:text-xs">
                              {/* Date with High-Contrast Visible Color */}
                              <div className="flex items-center gap-1.5 font-semibold text-foreground/80">
                                <i className="fa-regular fa-calendar-days text-[11px] text-foreground/70 shrink-0"></i>
                                <time dateTime={newsItem.posting_date}>{itemDateFormatted}</time>
                              </div>

                              {/* Read More Aligned with Theme Blue */}
                              <div className="flex items-center gap-1 font-bold text-sky-700 dark:text-sky-400 shrink-0 group-hover:underline">
                                <span>Read More<span className="sr-only">: {itemTitle}</span></span>
                                <i className="fa-solid fa-arrow-right text-[8px] sm:text-[9px] group-hover:translate-x-1 transition-transform" aria-hidden="true"></i>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ARTICLE CONTENT (Mobile: Middle, Desktop: Right Column, matches layout) */}
              <div className="grid-area-content w-full max-w-full min-w-0 bg-card rounded-b-2xl rounded-t-none md:rounded-2xl border border-border p-4 sm:p-7 md:p-8 shadow-xs flex flex-col overflow-hidden self-start md:h-auto">
                
                {/* Title with reduced bottom margin */}
                <h2 
                  className="article-title text-xl sm:text-2xl md:text-[25px] font-bold text-foreground mb-3 pb-2.5 border-b border-border leading-[1.3] tracking-tight"
                >
                  {title}
                </h2>

                {/* Article Content */}
                <div 
                  className="editorial-body text-foreground flex-1 w-full max-w-full overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: formattedContent }}
                />

                {/* Scoped CSS for World-Class Typography & Fluid Justification */}
                <style dangerouslySetInnerHTML={{ __html: `
                  .responsive-layout-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                    grid-template-areas: 
                      "image"
                      "content"
                      "other";
                    width: 100%;
                    max-width: 100%;
                  }
                  @media (min-width: 768px) {
                    .responsive-layout-grid {
                      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                      grid-template-rows: auto 1fr;
                      grid-template-areas: 
                        "image content"
                        "other content";
                    }
                  }
                  .grid-area-image { grid-area: image; min-width: 0; max-width: 100%; }
                  .grid-area-content { grid-area: content; min-width: 0; max-width: 100%; }
                  .grid-area-other { grid-area: other; min-width: 0; max-width: 100%; }

                  .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: 9999px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: var(--foreground);
                    opacity: 0.3;
                  }

                  .article-title {
                    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, sans-serif;
                    text-align: justify !important;
                    text-justify: inter-word !important;
                    text-align-last: left !important;
                    word-break: break-word;
                    overflow-wrap: break-word;
                  }

                  .editorial-body {
                    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, sans-serif;
                    font-size: 16px;
                    font-weight: 500;
                    line-height: 1.85;
                    color: var(--foreground);
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    word-break: break-word;
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    max-width: 100%;
                  }

                  .editorial-body p {
                    text-align: justify !important;
                    text-justify: inter-word !important;
                    text-align-last: left !important;
                    margin-bottom: 1.25rem;
                    line-height: 1.85;
                    font-weight: 500;
                    color: var(--foreground);
                    hyphens: auto;
                    -webkit-hyphens: auto;
                    word-break: break-word;
                    overflow-wrap: break-word;
                  }

                  .editorial-body p:last-child {
                    margin-bottom: 0 !important;
                  }

                  .editorial-callout {
                    margin: 1.3rem 0;
                    padding: 0.9rem 1.15rem;
                    border-radius: 0.875rem;
                    background: var(--muted);
                    border: 1px solid var(--border);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
                    word-break: break-word;
                    overflow-wrap: break-word;
                    max-width: 100%;
                  }

                  .editorial-callout .callout-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.875rem;
                    font-weight: 700;
                    margin-bottom: 0.35rem;
                    color: var(--foreground);
                  }

                  .editorial-callout .callout-text {
                    font-size: 0.925rem !important;
                    line-height: 1.7 !important;
                    margin: 0 !important;
                    text-align: justify !important;
                    text-justify: inter-word !important;
                    text-align-last: left !important;
                    word-break: break-word;
                    overflow-wrap: break-word;
                  }

                  .callout-traders {
                    border-left: 3.5px solid var(--brand-blue) !important;
                  }
                  .callout-traders .callout-label {
                    color: var(--foreground);
                  }

                  .callout-exporters {
                    border-left: 3.5px solid var(--brand-green) !important;
                  }
                  .callout-exporters .callout-label {
                    color: var(--foreground);
                  }

                  .callout-importers {
                    border-left: 3.5px solid #f59e0b !important;
                  }
                  .callout-importers .callout-label {
                    color: var(--foreground);
                  }

                  .callout-risk {
                    border-left: 3.5px solid var(--brand-red) !important;
                  }
                  .callout-risk .callout-label {
                    color: var(--foreground);
                  }
                `}} />

                {/* Bottom of Content: Source on the LEFT side with reduced spacing */}
                <div className="mt-4 pt-3 border-t border-border flex justify-start items-center text-sm text-foreground/80">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-foreground/80 font-semibold">Source:</span>
                    {article.source_url ? (
                      <a 
                        href={article.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1.5"
                      >
                        {sourceName}
                        <i className="fa-solid fa-arrow-up-right-from-square text-[11px]"></i>
                      </a>
                    ) : (
                      <span className="font-semibold text-foreground">{sourceName}</span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>

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
                      "item": `${siteUrl}/${lang}`
                    },
                    {
                      "@type": "ListItem",
                      "position": 2,
                      "name": dict.header?.news || "News",
                      "item": `${siteUrl}/${lang}/news`
                    },
                    {
                      "@type": "ListItem",
                      "position": 3,
                      "name": title,
                      "item": articleUrl
                    }
                  ]
                },
                {
                  "@context": "https://schema.org",
                  "@type": "NewsArticle",
                  "mainEntityOfPage": {
                    "@type": "WebPage",
                    "@id": articleUrl
                  },
                  "headline": title,
                  "image": [imageUrl],
                  "datePublished": article.posting_date,
                  "dateModified": (article as any).updated_at || article.posting_date,
                  "author": [{
                    "@type": "Organization",
                    "name": sourceName,
                    "url": article.source_url || siteUrl
                  }],
                  "publisher": {
                    "@type": "Organization",
                    "name": "AgriGuru Online",
                    "logo": {
                      "@type": "ImageObject",
                      "url": `${siteUrl}/logo.png`
                    }
                  },
                  "description": article.meta_description || plainText.substring(0, 160),
                  "about": [
                    ...(article.categories?.map(cat => ({
                      "@type": "Thing",
                      "name": cat.name
                    })) || []),
                    { "@type": "Thing", "name": "B2B Agri Commodity Trading" },
                    { "@type": "Thing", "name": "Global Agriculture Import Export" },
                    { "@type": "Thing", "name": "Commodity Market News" }
                  ],
                  "articleBody": plainText.substring(0, 5000), // Limiting to prevent massive payload
                  "wordCount": wordCount,
                  "articleSection": categoryName || "Agriculture News",
                  "keywords": article.meta_keywords || "AgriGuru, Agriculture News, Commodities"
                }
              ]).replace(/</g, '\\u003c')
            }}
          />
        </div>
      </div>
    </div>
  )
}

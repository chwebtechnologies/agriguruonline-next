import type { Metadata } from 'next'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { ShareButton } from '@/components/ui/ShareButton'
import { getCmsApiUrl, getAssetsUrl } from '@/lib/api-utils'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { cache } from 'react'
import { MarketUpdateItem, MarketUpdatesResponse } from '@/types/marketUpdates'

const getMarketUpdateDetail = cache(async (slug: string, lang: string): Promise<MarketUpdateItem & { created_at?: string } | null> => {
  const cmsApiUrl = getCmsApiUrl()
  const url = `${cmsApiUrl}/flyer/${slug}?lang_code=${lang}&source=web`
  
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
    console.error('Failed to fetch market update detail:', error)
    return null
  }
})

const getOtherUpdates = cache(async (lang: string, limit = 6): Promise<MarketUpdateItem[]> => {
  const cmsApiUrl = getCmsApiUrl()
  const url = `${cmsApiUrl}/flyer?is_active=true&lang_code=${lang}&source=web&page=1&limit=${limit}`
  
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 }
    })
    
    if (!res.ok) {
      return []
    }
    
    const json: MarketUpdatesResponse = await res.json()
    return json?.data?.flyers || []
  } catch (error) {
    console.error('Failed to fetch other market updates:', error)
    return []
  }
})

export async function generateStaticParams() {
  const languages = ['en', 'ar', 'zh', 'fr']
  const params: Array<{ lang: string; slug: string }> = []

  try {
    const cmsApiUrl = getCmsApiUrl()
    const res = await fetch(`${cmsApiUrl}/flyer?is_active=true&source=web&page=1&limit=50`, {
      next: { revalidate: 60 }
    })
    if (res.ok) {
      const json: MarketUpdatesResponse = await res.json()
      const list = json?.data?.flyers || []
      for (const lang of languages) {
        for (const item of list) {
          if (item.slug) {
            params.push({ lang, slug: item.slug })
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to generate static params for market update detail:', error)
  }

  return params
}

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params
  const { lang, slug } = params
  
  const decodedSlug = decodeURIComponent(slug)
  const article = await getMarketUpdateDetail(decodedSlug, lang)
  
  if (!article) {
    return {
      title: 'Market Update Not Found',
      description: 'The requested market update could not be found on AgriGuru Online.',
    }
  }

  const translation = article.translations?.find((t: any) => t.lang_code === lang)
  const title = translation?.title || article.title || 'AgriGuru Online Market Updates'
  
  const rawDescription = translation?.description || article.description || ''
  const cleanDescription = rawDescription.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160)
  
  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  
  const sourceImage = article.image || article.thumbnail
  const imagePath = sourceImage?.startsWith('/') ? sourceImage.slice(1) : sourceImage
  const imageUrl = sourceImage?.startsWith('http') 
    ? sourceImage 
    : (sourceImage ? `${imageBaseUrl}${imagePath}` : 'https://agriguruonline.com/logo.png')
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const articleUrl = `${siteUrl}/${lang}/market-updates/${slug}`

  const fullTitle = `${title} | AgriGuru Online`

  return {
    title,
    description: cleanDescription,
    keywords: ['AgriGuru', 'Market Updates', 'Agriculture', 'Commodities'],
    authors: [{ name: 'AgriGuru Online', url: siteUrl }],
    creator: 'AgriGuru Online',
    publisher: 'AgriGuru Online',
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: fullTitle,
      description: cleanDescription,
      url: articleUrl,
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
      publishedTime: article.created_at,
      authors: ['AgriGuru Online'],
      section: 'Market Updates',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: cleanDescription,
      images: [imageUrl],
      creator: '@AgriGuruOnline',
      site: '@AgriGuruOnline',
    },
    alternates: {
      canonical: articleUrl,
      languages: {
        en: `${siteUrl}/en/market-updates/${slug}`,
        ar: `${siteUrl}/ar/market-updates/${slug}`,
        fr: `${siteUrl}/fr/market-updates/${slug}`,
        zh: `${siteUrl}/zh/market-updates/${slug}`,
        'x-default': `${siteUrl}/en/market-updates/${slug}`,
      }
    }
  }
}

function formatEditorialContent(htmlContent: string, dict?: any): string {
  if (!htmlContent) return ''
  
  let formatted = htmlContent
    .replace(/<p>\s*(<br\s*\/?>|&nbsp;|\s)*\s*<\/p>/gi, '')
    .replace(/(<br\s*\/?>\s*){2,}/gi, '<br />')

  const forTradersStr = dict?.for_traders || "For Traders"

  // Support editorial callouts if any
  formatted = formatted.replace(
    /<p>(\s*<strong>)?(\s*For Traders:)(\s*<\/strong>)?([\s\S]*?)<\/p>/gi,
    `<div class="editorial-callout callout-traders">
      <div class="callout-label"><i class="fa-solid fa-chart-line"></i> ${forTradersStr}</div>
      <p class="callout-text">$4</p>
    </div>`
  )

  return formatted.trim()
}

export default async function MarketUpdateDetailPage(props: { params: Promise<{ lang: string; slug: string }> }) {
  const params = await props.params
  const { lang, slug } = params
  
  const article = await getMarketUpdateDetail(slug, lang)
  
  if (!article) {
    notFound()
  }

  const allUpdates = await getOtherUpdates(lang, 6)
  let otherList = allUpdates.filter(item => item.slug !== slug).slice(0, 5)

  const translation = article.translations?.find((t: any) => t.lang_code === lang)
  const title = translation?.title || article.title
  const rawContent = translation?.description || article.description

  const dict = await getDictionary(lang as any)
  const formattedContent = formatEditorialContent(rawContent, dict.common)

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  const imageUrl = article.image?.startsWith('http') ? article.image : `${imageBaseUrl}${article.image}`
  
  const postDateObj = article.created_at ? new Date(article.created_at) : new Date()
  const formattedDate = postDateObj.toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
  
  const plainText = rawContent?.replace(/<[^>]+>/g, '') || ''
  const wordCount = plainText.trim().split(/\s+/).length
  const readingTime = Math.max(1, Math.ceil(wordCount / 200))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'
  const articleUrl = `${siteUrl}/${lang}/market-updates/${slug}`

  return (
    <div className="bg-background text-foreground">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-8">
          {/* Header */}
          <PageHeader title="Market Updates" backText="Back" backHref={`/${lang}/market-updates`} />

          {/* 50-50 Split Layout using CSS Grid Areas */}
          <div className="mt-3 w-full max-w-full overflow-hidden">
            {/* Screen Reader Only H1 to enforce descending heading hierarchy for Accessibility & SEO */}
            <h1 className="sr-only">{title}</h1>
            <div className="responsive-layout-grid gap-y-0 md:gap-y-6 md:gap-x-6 lg:gap-x-8 items-start w-full max-w-full">
              
              {/* FEATURED IMAGE */}
              <div className="grid-area-image w-full max-w-full min-w-0 space-y-4">
                <div className="bg-card rounded-t-2xl rounded-b-none md:rounded-2xl border border-border border-b-0 md:border-b p-2 sm:p-2.5 shadow-xs overflow-hidden">
                  <div className="relative w-full aspect-[1/1.414] rounded-t-xl rounded-b-none overflow-hidden bg-muted/40">
                    <ImageWithSkeleton
                      src={imageUrl}
                      alt={title}
                      title={title}
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 50vw"
                      style={{ objectFit: 'contain' }}
                      className="!object-contain"
                    />
                  </div>
                  
                  {/* Below Image: Publish Date, Time & Share with "Share" Text */}
                  <div className="flex items-center justify-between gap-1 sm:gap-3 px-0.5 sm:px-1 pt-2.5 pb-0.5 w-full max-w-full overflow-hidden">
                    <div className="flex items-center gap-1.5 sm:gap-2.5 text-foreground min-w-0 flex-1">
                      <div className="inline-flex items-center gap-1 min-[380px]:gap-1.5 text-[12px] min-[360px]:text-[13px] sm:text-[14px] leading-none shrink-0">
                        <i className="fa-regular fa-calendar-days text-[12.5px] min-[360px]:text-[14px] sm:text-[15px] text-foreground/70 shrink-0"></i>
                        <span className="font-bold text-foreground shrink-0">Date:</span>
                        <time dateTime={article.created_at} className="font-medium text-foreground whitespace-nowrap">
                          {formattedDate}
                        </time>
                      </div>
                      <span className="text-border hidden md:inline">•</span>
                      {/* Reading Time: Desktop Only */}
                      <div className="hidden md:inline-flex items-center gap-1.5 text-[13px] sm:text-[14px] font-medium px-2 py-0.5 rounded-md bg-muted text-foreground/80 whitespace-nowrap shrink-0 border border-border/60 leading-none">
                        <i className="fa-regular fa-clock text-xs sm:text-sm text-foreground/75"></i>
                        <span>{readingTime} min read</span>
                      </div>
                    </div>

                    <ShareButton 
                      title={title} 
                      url={`/${lang}/market-updates/${slug}`} 
                      label="Share"
                      className="inline-flex items-center gap-1 min-[380px]:gap-1.5 text-[12px] min-[360px]:text-[13px] sm:text-[14px] font-bold text-foreground hover:text-brand-blue transition-colors shrink-0 leading-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* OTHER UPDATES */}
              {otherList.length > 0 && (
                <div className="grid-area-other w-full max-w-full min-w-0 mt-6 md:mt-0 md:h-full md:min-h-[340px]">
                  <div className="bg-card rounded-2xl border border-border p-3 sm:p-4 md:p-5 shadow-xs space-y-3 sm:space-y-3.5 overflow-hidden flex flex-col md:h-full md:min-h-[340px] md:max-h-[720px]">
                    <div className="flex items-center justify-between pb-2 border-b border-border shrink-0">
                      <h2 
                        className="text-[15px] sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2"
                        style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}
                      >
                        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-muted text-foreground/80 text-xs border border-border/60">
                          <i className="fa-solid fa-bolt"></i>
                        </span>
                        Other Market Updates
                      </h2>
                      <Link
                        href={`/${lang}/market-updates`}
                        className="text-xs font-bold text-foreground/80 hover:text-brand-blue hover:underline flex items-center gap-1 transition-colors"
                      >
                        View All
                        <i className="fa-solid fa-chevron-right text-[10px]"></i>
                      </Link>
                    </div>

                    <div className="space-y-2.5 sm:space-y-3 md:flex-1 md:overflow-y-auto md:pr-1 custom-scrollbar min-h-0">
                      {otherList.map((item) => {
                        const itemTranslation = item.translations?.find((t: any) => t.lang_code === lang) || item.translations?.[0]
                        const itemTitle = itemTranslation?.title || item.slug
                        const itemDesc = (itemTranslation?.description || '').replace(/<[^>]+>/g, '').trim()
                        const itemImg = item.thumbnail?.startsWith('http') 
                          ? item.thumbnail 
                          : `${imageBaseUrl}${item.thumbnail}`
                        
                        return (
                          <Link
                            key={item.id}
                            href={`/${lang}/market-updates/${item.slug}`}
                            className="group flex flex-row p-2.5 sm:p-3 rounded-xl bg-background/50 hover:bg-muted/60 transition-all border border-border/70 hover:border-brand-blue/40 hover:shadow-sm overflow-hidden items-stretch gap-3 sm:gap-4"
                          >
                            <div className="relative w-[85px] min-w-[85px] sm:w-[100px] sm:min-w-[100px] aspect-[3/4] rounded-lg overflow-hidden shrink-0 border border-border/50 bg-muted/40 shadow-xs">
                              <ImageWithSkeleton
                                src={itemImg}
                                alt={itemTitle}
                                title={itemTitle}
                                fill
                                sizes="(max-width: 640px) 100px, 120px"
                                style={{ objectFit: 'contain' }}
                                className="!object-contain group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>

                            <div className="flex flex-col flex-1 min-w-0 justify-between py-0.5">
                              <div className="space-y-1.5">
                                <h3 className="text-[13px] sm:text-[14.5px] font-bold text-foreground line-clamp-2 leading-[1.3] group-hover:text-brand-blue transition-colors">
                                  {itemTitle}
                                </h3>
                                {itemDesc && (
                                  <p className="text-[11.5px] sm:text-[12.5px] text-foreground/70 line-clamp-2 leading-relaxed">
                                    {itemDesc}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center justify-end mt-2 pt-2 border-t border-border/40">
                                <div className="inline-flex items-center gap-1.5 font-bold text-[11px] sm:text-[12px] text-sky-700 dark:text-sky-400 shrink-0 group-hover:underline">
                                  <span>Read More<span className="sr-only">: {itemTitle}</span></span>
                                  <i className="fa-solid fa-arrow-right text-[10px] group-hover:translate-x-1 transition-transform" aria-hidden="true"></i>
                                </div>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ARTICLE CONTENT */}
              <div className="grid-area-content w-full max-w-full min-w-0 bg-card rounded-b-2xl rounded-t-none md:rounded-2xl border border-border p-4 sm:p-7 md:p-8 shadow-xs flex flex-col overflow-hidden self-start md:h-auto">
                
                <h2 
                  className="article-title text-xl sm:text-2xl md:text-[25px] font-bold text-foreground mb-3.5 pb-2.5 border-b border-border leading-[1.3] tracking-tight"
                >
                  {title}
                </h2>

                <div 
                  className="editorial-body text-foreground flex-1 w-full max-w-full overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: formattedContent }}
                />

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
                `}} />
              </div>

            </div>
          </div>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": articleUrl
                },
                "headline": title,
                "image": [imageUrl],
                "datePublished": article.created_at,
                "author": {
                  "@type": "Organization",
                  "name": "AgriGuru Online",
                  "url": siteUrl
                },
                "publisher": {
                  "@type": "Organization",
                  "name": "AgriGuru Online",
                  "logo": {
                    "@type": "ImageObject",
                    "url": `${siteUrl}/logo.png`
                  }
                },
                "description": plainText.substring(0, 160)
              }).replace(/</g, '\\u003c')
            }}
          />
        </div>
      </div>
    </div>
  )
}

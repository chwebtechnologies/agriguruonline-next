import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import AuthorNewsCard from '@/components/author/AuthorNewsCard'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { cmsService } from '@/lib/api/cms.service'
import { getAssetsUrl, withTimeout } from '@/lib/api-utils'
import { getAlternates, getSafeLanguage, getSiteUrl, serializeJsonLd } from '@/lib/seo'
import DOMPurify from 'isomorphic-dompurify'
import { getAuthorInitials } from '@/components/news/NewsAuthorCard'

export const revalidate = 60

export async function generateStaticParams() {
  const languages = ['en', 'ar', 'zh', 'fr']
  const defaultAuthors = ['mr-deepak-pareek']

  return languages.flatMap((lang) =>
    defaultAuthors.map((slug) => ({
      lang,
      slug,
    }))
  )
}

function cleanHtmlText(html?: string): string {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params
  const lang = getSafeLanguage(params?.lang)
  const slug = decodeURIComponent(params?.slug || '')

  let author = await withTimeout(
    cmsService.getAuthorDetail(slug).catch(() => null),
    3000,
    null
  )

  if (!author && slug && slug !== 'undefined' && slug !== 'null') {
    const formattedName = slug
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
    if (formattedName) {
      author = {
        id: slug,
        name: formattedName,
        short_description: `${formattedName} is an agriculture market contributor and commodity analyst writing market insights and trade intelligence on AgriGuru Online.`,
        long_description: '',
        image: '',
        thumbnail: '',
        slug,
      }
    }
  }

  const siteUrl = getSiteUrl()
  const alternates = getAlternates(`author/${slug}`, lang)

  if (!author) {
    const notFoundTitles: Record<string, string> = {
      en: 'Author Not Found | AgriGuru Online',
      ar: 'المؤلف غير موجود | AgriGuru Online',
      zh: '未找到作者 | AgriGuru Online',
      fr: 'Auteur Non Trouvé | AgriGuru Online',
    }
    const notFoundDescs: Record<string, string> = {
      en: 'The requested author profile could not be found on AgriGuru Online.',
      ar: 'تعذر العثور على ملف تعريف الكاتب المطلوب على AgriGuru Online.',
      zh: '在 AgriGuru Online 上未找到请求的作者资料。',
      fr: 'Le profil de l’auteur demandé est introuvable sur AgriGuru Online.',
    }
    return {
      title: notFoundTitles[lang] || notFoundTitles.en,
      description: notFoundDescs[lang] || notFoundDescs.en,
      robots: { index: false, follow: true },
      alternates,
    }
  }

  const rawBio = author.short_description || author.long_description || ''
  const cleanBio = cleanHtmlText(rawBio)
  const descriptionSnippet = cleanBio.length > 155 ? `${cleanBio.slice(0, 152)}...` : cleanBio

  const titles: Record<string, string> = {
    en: `${author.name} - Author | AgriGuru Online`,
    ar: `${author.name} - كاتب | AgriGuru Online`,
    zh: `${author.name} - 专栏作者 | AgriGuru Online`,
    fr: `${author.name} - Auteur | AgriGuru Online`,
  }

  const defaultMetaDesc: Record<string, string> = {
    en: `Read agricultural market insights, commodity forecasts, and news analyses written by ${author.name} on AgriGuru Online. ${descriptionSnippet}`,
    ar: `اقرأ تحليلات الأسواق الزراعية وتوقعات السلع والأخبار المكتوبة بواسطة ${author.name} على AgriGuru Online. ${descriptionSnippet}`,
    zh: `阅读由 ${author.name} 在 AgriGuru Online 上撰写的农业市场深度分析、大宗商品预测及外贸新闻。${descriptionSnippet}`,
    fr: `Consultez les analyses de marché, prévisions et actualités agricoles rédigées par ${author.name} sur AgriGuru Online. ${descriptionSnippet}`,
  }

  const title = titles[lang] || titles.en
  const metaDescription = defaultMetaDesc[lang] || defaultMetaDesc.en

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  const rawImage = author.image || author.thumbnail
  const imageUrl = rawImage
    ? rawImage.startsWith('http')
      ? rawImage
      : `${imageBaseUrl}${rawImage}`
    : `${siteUrl}/logo.png`

  return {
    title,
    description: metaDescription,
    keywords: [
      author.name,
      `${author.name} AgriGuru`,
      'AgriGuru Online News Author',
      'Agricultural News',
      'Commodity Market Insights',
    ],
    authors: [{ name: author.name, url: `${siteUrl}/${lang}/author/${slug}` }],
    alternates,
    openGraph: {
      title,
      description: metaDescription,
      url: `${siteUrl}/${lang}/author/${slug}`,
      siteName: 'AgriGuru Online',
      type: 'profile',
      locale: lang,
      images: [
        {
          url: imageUrl,
          alt: `${author.name} - AgriGuru Online Author`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: metaDescription,
      images: [imageUrl],
      creator: '@AgriGuruOnline',
      site: '@AgriGuruOnline',
    },
    robots: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  }
}

interface AuthorPageProps {
  params: Promise<{ lang: string; slug: string }>
  searchParams?: Promise<{ page?: string }>
}

export default async function AuthorPage(props: AuthorPageProps) {
  const params = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const lang = getSafeLanguage(params.lang)
  const slug = decodeURIComponent(params.slug || '')

  const currentPage = Math.max(1, parseInt(searchParams.page || '1', 10) || 1)
  // 4 cards per row on desktop, 2 rows before pagination = 8 items per page
  const limit = 8

  // Fetch author details and dictionary in parallel
  const [authorData, dict] = await Promise.all([
    withTimeout(cmsService.getAuthorDetail(slug).catch(() => null), 3000, null),
    getDictionary(lang).catch(() => ({})),
  ])

  let author = authorData
  if (!author && slug && slug !== 'undefined' && slug !== 'null') {
    const formattedName = slug
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
    if (formattedName) {
      author = {
        id: slug,
        name: formattedName,
        short_description: `${formattedName} is an agriculture market contributor and commodity analyst writing market insights and trade intelligence on AgriGuru Online.`,
        long_description: '',
        image: '',
        thumbnail: '',
        slug,
      }
    }
  }

  if (!author) {
    notFound()
  }

  // Fetch author published news
  const newsData = await withTimeout(
    cmsService
      .getAuthorNews({ authorId: author.id, page: currentPage, limit })
      .catch(() => null),
    3000,
    null
  )

  const articles = newsData?.news || []
  const totalArticles = newsData?.total || 0
  const totalPages = Math.ceil(totalArticles / limit)

  const siteUrl = getSiteUrl()
  const authorPageUrl = `${siteUrl}/${lang}/author/${slug}`

  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  const rawImage = author.image || author.thumbnail
  const authorImageUrl = rawImage
    ? rawImage.startsWith('http')
      ? rawImage
    : `${imageBaseUrl}${rawImage}`
    : `${siteUrl}/logo.png`

  const sanitizedShortBio = author.short_description
    ? DOMPurify.sanitize(author.short_description)
    : ''
  const sanitizedLongBio = author.long_description
    ? DOMPurify.sanitize(author.long_description)
    : ''

  const plainShortBio = cleanHtmlText(author.short_description)
  const plainLongBio = cleanHtmlText(author.long_description)
  const fullPlainBio = `${plainShortBio} ${plainLongBio}`.trim()

  const commonDict = (dict as Record<string, any>).common || {}
  const backText = commonDict.back || 'Back'

  const labels: Record<string, {
    articlesPublished: string;
    readArticles: string;
    noArticles: string;
    noArticlesDesc: string;
  }> = {
    en: {
      articlesPublished: 'Articles Published',
      readArticles: 'Published News & Market Insights',
      noArticles: 'No Articles Published Yet',
      noArticlesDesc: 'This author has not published any news articles yet. Please check back later.',
    },
    ar: {
      articlesPublished: 'مقالة منشورة',
      readArticles: 'الأخبار المنشورة وتحليلات السوق',
      noArticles: 'لم يتم نشر مقالات بعد',
      noArticlesDesc: 'لم ينشر هذا المؤلف أي مقالات إخبارية حتى الآن. يرجى المتابعة لاحقاً.',
    },
    zh: {
      articlesPublished: '篇已发布文章',
      readArticles: '已发布的新闻与市场深度分析',
      noArticles: '暂未发布文章',
      noArticlesDesc: '该作者目前尚未发布任何新闻报道，请稍后再次查看。',
    },
    fr: {
      articlesPublished: 'Articles Publiés',
      readArticles: 'Actualités & Analyses de Marché Publiées',
      noArticles: 'Aucun Article Publié pour le Moment',
      noArticlesDesc: 'Cet auteur n’a pas encore publié d’article. Revenez bientôt.',
    },
  }

  const currentLabel = labels[lang] || labels.en

  // JSON-LD Schemas according to Google E-E-A-T and Search Central recommendations
  const jsonLdData = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: (dict as Record<string, any>)?.navigation?.home || 'Home',
          item: `${siteUrl}/${lang}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: (dict as Record<string, any>)?.header?.news || 'News',
          item: `${siteUrl}/${lang}/news`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: author.name,
          item: authorPageUrl,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      '@id': `${authorPageUrl}#profilepage`,
      url: authorPageUrl,
      name: `${author.name} - Author Profile`,
      isPartOf: {
        '@type': 'WebSite',
        name: 'AgriGuru Online',
        url: siteUrl,
      },
      mainEntity: {
        '@type': 'Person',
        '@id': `${authorPageUrl}#person`,
        name: author.name,
        alternateName: author.name.replace(/^(Mr\.|Ms\.|Dr\.|Prof\.)\s+/i, ''),
        url: authorPageUrl,
        image: authorImageUrl,
        jobTitle: 'Author',
        description: fullPlainBio || `${author.name} writes agricultural commodity news and market analyses on AgriGuru Online.`,
        worksFor: {
          '@type': 'Organization',
          name: 'AgriGuru Online',
          url: siteUrl,
          logo: `${siteUrl}/logo.png`,
        },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Published News by ${author.name}`,
      numberOfItems: articles.length,
      itemListElement: articles.map((art, index) => ({
        '@type': 'ListItem',
        position: (currentPage - 1) * limit + index + 1,
        item: {
          '@type': 'NewsArticle',
          headline: art.title,
          url: `${siteUrl}/${lang}/news/${art.slug}`,
          datePublished: art.posting_date || art.created_at,
          image: art.thumbnail || art.image
            ? (art.thumbnail || art.image).startsWith('http')
              ? (art.thumbnail || art.image)
              : `${imageBaseUrl}${art.thumbnail || art.image}`
            : undefined,
          author: {
            '@type': 'Person',
            name: author.name,
            url: authorPageUrl,
          },
        },
      })),
    },
  ]

  return (
    <div className="bg-background text-foreground min-h-[60vh]">
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
          {/* Top Page Header with Back Navigation to News */}
          <PageHeader
            title={author.name}
            backText={backText}
            backHref={`/${lang}/news`}
            headingTag="div"
          />

          {/* AUTHOR PROFILE HERO CARD */}
          <section
            aria-label="Author Profile"
            className="mt-2 mb-6 sm:mb-8 rounded-2xl bg-card border border-border p-4 sm:p-6 md:p-8 shadow-xs"
          >
            <div className="flex flex-col md:flex-row gap-5 sm:gap-7 items-center md:items-start">
              {/* Author Photo or Initials Avatar */}
              <div className="relative shrink-0 w-full sm:w-auto flex justify-center md:block">
                {rawImage && !rawImage.includes('logo.png') ? (
                  <div className="w-full max-w-[280px] sm:max-w-[320px] md:w-72 lg:w-80 aspect-[3/2] rounded-2xl overflow-hidden border border-border/80 bg-muted/20 shadow-xs relative flex items-center justify-center p-2">
                    <ImageWithSkeleton
                      src={authorImageUrl}
                      alt={author.name}
                      title={author.name}
                      fill
                      sizes="(max-width: 640px) 280px, (max-width: 768px) 320px, 360px"
                      className="object-contain"
                      priority={true}
                    />
                  </div>
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 text-white font-bold flex items-center justify-center shadow-md ring-4 ring-background border border-white/20 select-none">
                    <span className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-wider font-sans drop-shadow-xs">
                      {getAuthorInitials(author.name)}
                    </span>
                  </div>
                )}
              </div>

              {/* Author Headline & Bio Details */}
              <div className="flex-1 w-full text-center md:text-left">
                {/* Main H1 for SEO & Accessibility */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-3">
                  {author.name}
                </h1>

                {/* Short Bio / Executive Summary from Backend */}
                {sanitizedShortBio && (
                  <div
                    className="text-sm sm:text-base text-foreground/85 leading-relaxed font-normal mb-3 text-left md:text-left"
                    dangerouslySetInnerHTML={{ __html: sanitizedShortBio }}
                  />
                )}

                {/* Biography (Long Description from Backend) directly under short description */}
                {sanitizedLongBio && (
                  <div
                    className="text-sm sm:text-base text-foreground/80 leading-relaxed font-normal text-left md:text-left"
                    dangerouslySetInnerHTML={{ __html: sanitizedLongBio }}
                  />
                )}
              </div>
            </div>
          </section>

          {/* PUBLISHED ARTICLES SECTION */}
          <section aria-labelledby="author-articles-heading" className="w-full">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-6 bg-brand-blue rounded-full"></div>
                <h2
                  id="author-articles-heading"
                  className="text-lg sm:text-xl font-bold text-foreground"
                >
                  {currentLabel.readArticles}
                </h2>
              </div>
              <span className="text-xs font-semibold text-foreground/80 bg-muted px-2.5 py-1 rounded-full border border-border">
                {totalArticles} {currentLabel.articlesPublished}
              </span>
            </div>

            {/* Articles Grid (Mobile: 1, Tab: 2, Desktop: 4 per row matching news listing) */}
            {articles.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-2">
                  {articles.map((article, index) => (
                    <div key={article.slug} className="h-full flex flex-col">
                      <AuthorNewsCard
                        article={article}
                        lang={lang}
                        dict={dict}
                        priority={index < 4}
                      />
                    </div>
                  ))}
                </div>

                {/* Pagination (appears after 2 rows = 8 items) */}
                {totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      baseUrl={`/${lang}/author/${slug}`}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 px-4 bg-card rounded-2xl border border-dashed border-border mt-3">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-blue/10 border border-brand-blue/20 mb-3 text-brand-blue">
                  <i className="fa-regular fa-newspaper text-2xl" aria-hidden="true"></i>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  {currentLabel.noArticles}
                </h3>
                <p className="text-sm text-foreground/75 max-w-md mx-auto">
                  {currentLabel.noArticlesDesc}
                </p>
              </div>
            )}
          </section>

          {/* Google News & E-E-A-T Structured Data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd(jsonLdData),
            }}
          />
        </div>
      </div>
    </div>
  )
}

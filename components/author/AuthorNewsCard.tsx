import FastLink from '@/components/ui/FastLink'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ShareButton } from '@/components/ui/ShareButton'
import type { AuthorNewsArticle } from '@/types/author'
import { getAssetsUrl } from '@/lib/api-utils'

interface AuthorNewsCardProps {
  article: AuthorNewsArticle
  lang: string
  dict?: any
  priority?: boolean
}

export default function AuthorNewsCard({
  article,
  lang,
  dict = {},
  priority = false,
}: AuthorNewsCardProps) {
  const title = article.title || ''
  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  
  const rawImage = article.thumbnail || article.image || ''
  const imageUrl = rawImage
    ? rawImage.startsWith('http')
      ? rawImage
      : `${imageBaseUrl}${rawImage}`
    : '/placeholder.png'

  let formattedDate = ''
  try {
    const dateObj = new Date(article.posting_date || article.created_at)
    if (!isNaN(dateObj.getTime())) {
      formattedDate = new Intl.DateTimeFormat(
        lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-CN' : 'en-US',
        {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }
      ).format(dateObj)
    }
  } catch {
    formattedDate = ''
  }

  const readMoreText = dict?.common?.read_more || 'Read More'

  return (
    <article className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs h-full">
      <FastLink
        href={`/${lang}/news/${article.slug}`}
        aria-label={title}
        className="relative w-full aspect-[3/2] bg-card/30 overflow-hidden border-b border-border block"
      >
        <ImageWithSkeleton
          src={imageUrl}
          alt={title}
          title={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          priority={priority}
        />
      </FastLink>

      <div className="px-3.5 py-3 sm:px-4 sm:py-4 flex flex-col flex-1 justify-between">
        <div>
          {formattedDate && (
            <div className="flex items-center text-xs text-foreground/80 font-medium mb-1.5 sm:mb-2 h-4">
              <i className="fa-regular fa-calendar mr-1.5 text-foreground/70"></i>
              <time dateTime={article.posting_date || article.created_at}>{formattedDate}</time>
            </div>
          )}

          <h3 className="text-[15px] sm:text-[18px] font-semibold text-foreground mb-1.5 sm:mb-2 leading-snug line-clamp-2 h-[42px] sm:h-[50px] flex items-center">
            <FastLink
              href={`/${lang}/news/${article.slug}`}
              title={title}
              className="hover:text-brand-blue transition-colors line-clamp-2 break-words"
            >
              {title}
            </FastLink>
          </h3>
        </div>

        <div className="flex items-center justify-between mt-auto border-t border-border pt-2">
          <FastLink
            href={`/${lang}/news/${article.slug}`}
            aria-label={`${readMoreText}: ${title}`}
            className="text-[12px] uppercase tracking-wide font-bold text-sky-700 dark:text-sky-400 hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 group/link min-h-[36px] py-1.5"
          >
            <span>{readMoreText}</span>
            <i
              className="fa-solid fa-arrow-right text-[10px] group-hover/link:translate-x-1 transition-transform"
              aria-hidden="true"
            ></i>
          </FastLink>

          <ShareButton
            title={title}
            url={`/${lang}/news/${article.slug}`}
          />
        </div>
      </div>
    </article>
  )
}

import FastLink from '@/components/ui/FastLink'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ShareButton } from '@/components/ui/ShareButton'
import type { NewsArticle } from '@/types/news'
import { getAssetsUrl } from '@/lib/api-utils';

interface NewsCardProps {
  article: NewsArticle
  lang: string
  dict?: any
  priority?: boolean;
}

export default function NewsCard({ article, lang, dict = {}, priority = false }: NewsCardProps) {
  const translation = article.translations?.find(t => t.lang_code === lang)
  const title = translation?.title || article.title || ''
  const description = translation?.description || article.description || ''
  const source = translation?.source || article.source || ''
  
  const assetsUrl = getAssetsUrl();const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  const imageUrl = article.thumbnail.startsWith('http') ? article.thumbnail : `${imageBaseUrl}${article.thumbnail}`

  const formattedDate = new Intl.DateTimeFormat(lang, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(article.posting_date))

  // Basic HTML strip for excerpt
  const excerpt = description.replace(/<[^>]+>/g, '').slice(0, 150) + '...'

  return (
    <article className="group flex flex-col rounded-2xl bg-card border border-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-xs h-full">
      <FastLink href={`/${lang}/news/${article.slug}`} aria-label={title} className="relative w-full aspect-[3/2] bg-card/30 overflow-hidden border-b border-border block">
        <ImageWithSkeleton
          src={imageUrl}
          alt={title}
          title={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
          className="object-cover"
          priority={priority}
        />
      </FastLink>
      
      <div className="px-3.5 py-3 sm:px-4 sm:py-4 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-center text-xs text-foreground/80 font-medium mb-1.5 sm:mb-2 h-4">
            <i className="fa-regular fa-calendar mr-1.5 text-foreground/70"></i>
            <time dateTime={article.posting_date}>{formattedDate}</time>
          </div>
          
          <h2 className="text-[15px] sm:text-[18px] font-semibold text-foreground mb-1.5 sm:mb-2 leading-snug h-[42px] sm:h-[50px] flex items-center">
            <FastLink 
              href={`/${lang}/news/${article.slug}`} 
              title={title}
              className="hover:text-brand-blue transition-colors line-clamp-2 break-words"
            >
              {title}
            </FastLink>
          </h2>
          
          <p className="text-[13px] text-foreground/80 mb-3 sm:mb-4 line-clamp-2 break-words leading-relaxed h-[38px] sm:h-[40px] overflow-hidden">
            {excerpt}
          </p>
        </div>
        
        <div className="flex items-center justify-between mt-auto border-t border-border pt-2">
          <FastLink 
            href={`/${lang}/news/${article.slug}`}
            aria-label={`Read more: ${title}`}
            className="text-[12px] uppercase tracking-wide font-bold text-sky-700 dark:text-sky-400 hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 group/link min-h-[36px] py-1.5"
          >
            <span>{dict?.common?.read_more || 'Read More'}<span className="sr-only">: {title}</span></span>
            <i className="fa-solid fa-arrow-right text-[10px] group-hover/link:translate-x-1 transition-transform" aria-hidden="true"></i>
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

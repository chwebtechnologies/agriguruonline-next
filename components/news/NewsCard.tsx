import Link from 'next/link'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import { ShareButton } from '@/components/ui/ShareButton'
import type { NewsArticle, NewsTranslation } from '@/types/news'
import { getAssetsUrl } from '@/lib/api-utils';

interface NewsCardProps {
  article: NewsArticle
  lang: string
  priority?: boolean;
}

export default function NewsCard({ article, lang, priority = false }: NewsCardProps) {
  const getTranslatedData = (translations: NewsTranslation[]) => {
    const translation = translations.find(t => t.lang_code === lang) || translations[0]
    return translation || { title: '', description: '', source: '' }
  }

  const { title, description, source } = getTranslatedData(article.translations)
  
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
    <article className="group flex flex-col rounded-xl bg-background border border-ag-header-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-sm h-full">
      <Link href={`/${lang}/news/${article.slug}`} className="relative w-full aspect-[3/2] bg-ag-header-border/10 overflow-hidden border-b border-ag-header-border block">
        <ImageWithSkeleton src={imageUrl}
          alt={title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300" priority={priority} />
      </Link>
      
      <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col flex-grow">
        <div className="flex items-center text-xs text-foreground/60 mb-2">
          <i className="fa-regular fa-calendar mr-1.5"></i>
          <time dateTime={article.posting_date}>{formattedDate}</time>
        </div>
        
        <h3 className="text-[16px] sm:text-[18px] font-semibold text-foreground mb-2 line-clamp-2" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}>
          <Link href={`/${lang}/news/${article.slug}`} className="hover:text-brand-blue transition-colors">
            {title}
          </Link>
        </h3>
        
        <p className="text-[13px] text-foreground/70 mb-4 line-clamp-3 flex-grow">
          {excerpt}
        </p>
        
        <div className="flex items-center justify-between mt-auto border-t border-ag-header-border pt-3">
          <Link 
            href={`/${lang}/news/${article.slug}`}
            className="text-[12px] uppercase tracking-wide font-bold text-brand-blue hover:text-[#1080d0] transition-colors flex items-center gap-1.5 group/link"
          >
            Read More
            <i className="fa-solid fa-arrow-right text-[10px] group-hover/link:translate-x-1 transition-transform"></i>
          </Link>
          
          <ShareButton 
            title={title} 
            url={`/${lang}/news/${article.slug}`} 
          />
        </div>
      </div>
    </article>
  )
}

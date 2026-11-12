import Link from 'next/link'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'

interface NewsAuthorCardProps {
  name: string
  bio?: string
  slug?: string | null
  image?: string | null
  lang: string
}

export function decodeHtmlEntities(str?: string | null): string {
  if (!str) return ''
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
}

export function getAuthorInitials(name?: string | null): string {
  if (!name) return 'AG'
  const decoded = decodeHtmlEntities(name)
  const clean = decoded.replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s+/i, '').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'AG'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AuthorAvatar({
  name,
  image,
  size = 'md',
  className = '',
}: {
  name?: string | null
  image?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const initials = getAuthorInitials(name)
  const isCustomImage = Boolean(
    image &&
      !image.includes('placeholder') &&
      !image.endsWith('/logo.png') &&
      !image.includes('logo.png')
  )

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-14 h-14 sm:w-16 sm:h-16 text-base sm:text-lg',
    lg: 'w-18 h-18 sm:w-20 sm:h-20 text-xl sm:text-2xl',
  }

  if (isCustomImage && image) {
    return (
      <div
        className={`relative rounded-full overflow-hidden shrink-0 border border-border/70 shadow-2xs bg-muted/30 aspect-square ${sizeClasses[size]} ${className}`}
      >
        <ImageWithSkeleton
          src={image}
          alt={name || 'Author'}
          title={name || 'Author'}
          fill
          sizes={size === 'sm' ? '32px' : size === 'md' ? '64px' : '80px'}
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div
      aria-label={name || 'Author'}
      className={`rounded-full bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 text-white font-bold flex items-center justify-center shrink-0 shadow-2xs ring-1 ring-background border border-white/20 select-none tracking-wider font-sans aspect-square ${sizeClasses[size]} ${className}`}
    >
      <span className="font-extrabold">{initials}</span>
    </div>
  )
}

const labels: Record<string, { writtenBy: string; author: string }> = {
  en: { writtenBy: 'Written by', author: 'Author' },
  ar: { writtenBy: 'بقلم', author: 'كاتب' },
  zh: { writtenBy: '作者', author: '专栏作者' },
  fr: { writtenBy: 'Rédigé par', author: 'Auteur' },
}

export default function NewsAuthorCard({
  name,
  bio,
  slug,
  image,
  lang,
}: NewsAuthorCardProps) {
  const currentLabel = labels[lang] || labels.en
  const authorHref = slug ? `/${lang}/author/${slug}` : null
  const decodedName = decodeHtmlEntities(name)
  const decodedBio = decodeHtmlEntities(bio)

  const CardWrapper = authorHref ? Link : 'div'
  const wrapperProps = authorHref
    ? {
        href: authorHref,
        className:
          'group block p-3.5 sm:p-4 rounded-2xl border border-border bg-card hover:bg-muted/30 hover:border-brand-blue/50 transition-all shadow-xs cursor-pointer',
        'aria-label': `${currentLabel.writtenBy}: ${decodedName}`,
      }
    : {
        className:
          'block p-3.5 sm:p-4 rounded-2xl border border-border bg-card shadow-xs',
      }

  return (
    <CardWrapper {...(wrapperProps as any)}>
      <div className="flex items-start gap-3 sm:gap-3.5">
        {/* Round Avatar with Initials / Photo */}
        <AuthorAvatar
          name={decodedName}
          image={image}
          size="md"
          className="mt-0.5 group-hover:scale-105 transition-transform duration-200"
        />

        {/* Author Info & Full Short Bio */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
              <span className="text-[11px] font-semibold text-foreground/60 uppercase tracking-wider">
                {currentLabel.writtenBy}
              </span>
              <span className="text-sm sm:text-[15px] font-bold text-foreground group-hover:text-brand-blue transition-colors">
                {decodedName}
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                <i className="fa-solid fa-circle-check text-[8px]" aria-hidden="true"></i>
                {currentLabel.author}
              </span>
            </div>

            {authorHref && (
              <span className="text-foreground/40 group-hover:text-brand-blue group-hover:translate-x-0.5 transition-all text-xs shrink-0 pr-0.5">
                <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
              </span>
            )}
          </div>

          {decodedBio && (
            <p className="mt-1 text-xs sm:text-[13px] text-foreground/85 leading-relaxed font-normal">
              {decodedBio}
            </p>
          )}
        </div>
      </div>
    </CardWrapper>
  )
}

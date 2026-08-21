import Link from 'next/link'
import Image from 'next/image'
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton'
import ProductLink from '@/components/ui/ProductLink'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { ShareButton } from '@/components/ui/ShareButton'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { getCategories } from '@/lib/category'
import { cache } from 'react'

interface SubCategory {
  id: string
  name: string
  slug: string
  image: string
  translations: Array<{
    name: string
    lang_code: string
  }>
}

interface CategoryData {
  sub_categories: SubCategory[]
  category: {
    id: string
    name: string
    slug: string
    translations: Array<{
      name: string
      lang_code: string
    }>
  }
}

const getSubCategories = cache(async (slug: string, lang: string): Promise<CategoryData | null> => {
  const tradingApiUrl = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://trading-api.agriguruonline.cloud'
  const url = `${tradingApiUrl}/sub-category/for-category/web/${slug}?lang_code=${lang}&source=web`

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }
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
    console.error('Failed to fetch sub-categories:', error)
    return null
  }
})

export async function generateMetadata(
  props: { params: Promise<{ lang: string; slug: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const lang = params.lang || 'en'
  const slug = params.slug

  // Instantly format slug instead of awaiting the slow API call
  // Example: 'rice' -> 'Rice'
  const categoryName = slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
    
  const title = `${categoryName} - AgriGuru Online`
  const description = `Explore ${categoryName} and related sub-categories on AgriGuru Online.`

  let imageUrl = 'https://agriguru.online/logo.png'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://agriguru.online/${lang}/category/${slug}`,
      siteName: 'AgriGuru Online',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: categoryName,
        },
      ],
      locale: lang,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: `https://agriguru.online/${lang}/category/${slug}`,
    }
  }
}

export const instant = false

export default async function CategoryPage(props: { params: Promise<{ lang: string; slug: string }> }) {
  const params = await props.params;
  const lang = params.lang || 'en'
  const slug = params.slug

  const [data, dict] = await Promise.all([
    getSubCategories(slug, lang),
    getDictionary(lang)
  ])
  const commonDict = (dict as Record<string, any>).common || {}
  const common = {
    back: commonDict.back || "Back",
    all_country_origins: commonDict.all_country_origins || "All Country Origins",
    explore: commonDict.explore || "Explore"
  }

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Category not found</h1>
          <Link href={`/${lang}`} className="text-[#1D92EB] hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  // Helper to get translated name
  const getTranslatedName = (translations: Array<{ name: string; lang_code: string }> | undefined, defaultName: string) => {
    if (!translations || !Array.isArray(translations)) return defaultName
    const translation = translations.find(t => t.lang_code === lang)
    return translation ? translation.name : defaultName
  }

  const categoryName = getTranslatedName(data.category?.translations, data.category?.name || 'Category')

  // Use the assets URL from ENV, fallback to the default domain, and ensure it ends with a slash
  const assetsUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.cloud'
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  
  return (
    <div className="bg-background text-foreground">
      {/* Main Content */}
      <div className="w-full pad-for-badges">
        <div className="max-w-7xl mx-auto pt-3 pb-5">
        <PageHeader title={`${categoryName} (${common.all_country_origins})`} backText={common.back} />

        {data.sub_categories && data.sub_categories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 px-2 sm:px-0">
            {data.sub_categories.map((subCat, index) => {
              const name = getTranslatedName(subCat.translations, subCat.name)
              const imageUrl = subCat.image.startsWith('http') ? subCat.image : `${imageBaseUrl}${subCat.image}`
              
              return (
                <div 
                  key={subCat.id} 
                  className="group flex flex-col rounded-xl bg-background border border-ag-header-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-sm"
                >
                  <ProductLink href={`/${lang}/category/${slug}/${subCat.slug}`} className="relative w-full aspect-[16/10] bg-background overflow-hidden border-b border-ag-header-border block">
                    <ImageWithSkeleton
                      src={imageUrl}
                      alt={name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      priority={index < 10}
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </ProductLink>
                  
                  <div className="px-2 sm:px-3 py-2 sm:py-2.5 flex flex-col">
                    <h3 className="text-[16px] sm:text-[19px] font-semibold text-foreground mb-0 sm:mb-1 line-clamp-1" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}>
                      <ProductLink href={`/${lang}/category/${slug}/${subCat.slug}`} className="hover:text-brand-blue transition-colors">
                        {name}
                      </ProductLink>
                    </h3>
                    
                    <div className="flex items-center justify-between mt-0 sm:mt-0">
                      <ProductLink 
                        href={`/${lang}/category/${slug}/${subCat.slug}`}
                        className="text-[11px] sm:text-[13px] uppercase tracking-wide font-bold text-brand-blue hover:text-[#1080d0] transition-colors flex items-center gap-1 sm:gap-1.5 group/link"
                      >
                        {common.explore}
                        <i className="fa-solid fa-arrow-right text-[9px] sm:text-[10px] group-hover/link:translate-x-1 transition-transform"></i>
                      </ProductLink>
                      
                      <ShareButton 
                        title={name} 
                        url={`/${lang}/category/${slug}/${subCat.slug}`} 
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-background rounded-2xl border border-dashed border-ag-header-border">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background border border-ag-header-border mb-4 text-foreground/60">
              <i className="fa-solid fa-box-open text-2xl"></i>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No Sub Categories Found</h3>
            <p className="text-foreground/70 max-w-md mx-auto">
              We couldn&apos;t find any sub categories for this category at the moment. Please check back later.
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { ShareButton } from '@/components/ui/ShareButton'

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

async function getSubCategories(slug: string, lang: string): Promise<CategoryData | null> {
  const tradingApiUrl = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://trading-api.agriguruonline.com'
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
}

export const instant = false

export default async function CategoryPage(props: { params: Promise<{ lang: string; slug: string }> }) {
  const params = await props.params;
  const lang = params.lang || 'en'
  const slug = params.slug

  const data = await getSubCategories(slug, lang)

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Category not found</h1>
          <Link href={`/${lang}`} className="text-[#0c5a53] hover:underline">
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
  const assetsUrl = process.env.NEXT_PUBLIC_ASSETS_URL || 'https://assets.agriguruonline.com'
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Main Content */}
      <div className="w-full px-4 lg:px-12 xl:px-14 2xl:px-4">
        <div className="max-w-7xl mx-auto py-8">
        <PageHeader title={categoryName + " (All Country Origins)"} />

        {data.sub_categories && data.sub_categories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {data.sub_categories.map((subCat) => {
              const name = getTranslatedName(subCat.translations, subCat.name)
              const imageUrl = subCat.image.startsWith('http') ? subCat.image : `${imageBaseUrl}${subCat.image}`
              
              return (
                <div 
                  key={subCat.id} 
                  className="group flex flex-col rounded-xl bg-background border border-ag-header-border overflow-hidden hover:shadow-lg transition-all duration-300 shadow-sm"
                >
                  <div className="relative w-full aspect-[3/2] bg-background overflow-hidden border-b border-ag-header-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  
                  <div className="p-3 flex flex-col">
                    <h3 className="text-[17px] font-semibold text-foreground mb-2 line-clamp-1" style={{ fontFamily: 'SF Pro Display, -apple-system, sans-serif' }}>
                      {name}
                    </h3>
                    
                    <div className="flex items-center justify-between">
                      <Link 
                        href={`/${lang}/category/${slug}/${subCat.slug}`}
                        className="text-[13px] uppercase tracking-wide font-bold text-brand-blue hover:text-[#1080d0] transition-colors flex items-center gap-1.5 group/link"
                      >
                        Explore
                        <i className="fa-solid fa-arrow-right text-[10px] group-hover/link:translate-x-1 transition-transform"></i>
                      </Link>
                      
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

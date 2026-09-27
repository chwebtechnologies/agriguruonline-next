import { getDictionary } from '../dictionaries'
import { lang } from 'next/root-params'
import HeroCarousel from '@/components/home/HeroCarousel'

import type { Metadata } from 'next'

// SEO Organization & WebSite schema component helper
function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://agriguruonline.com/#organization',
        'name': 'AgriGuru Online',
        'url': 'https://agriguruonline.com',
        'logo': {
          '@type': 'ImageObject',
          'url': 'https://agriguruonline.com/logo.png'
        },
        'description': 'The premium B2B SaaS platform for global agricultural trade.'
      },
      {
        '@type': 'WebSite',
        '@id': 'https://agriguruonline.com/#website',
        'url': 'https://agriguruonline.com',
        'name': 'AgriGuru Online',
        'publisher': {
          '@id': 'https://agriguruonline.com/#organization'
        },
        'potentialAction': {
          '@type': 'SearchAction',
          'target': 'https://agriguruonline.com/en/search?q={search_term_string}',
          'query-input': 'required name=search_term_string'
        }
      }
    ]
  }

  return (
    <script
      id="schema-org"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
    />
  )
}

import { getStandardMetadata, getSafeLanguage } from '@/lib/seo'

export async function generateMetadata(
  props: { params?: Promise<{ lang: string }> }
): Promise<Metadata> {
  const params = props.params ? await props.params : undefined;
  const activeLang = getSafeLanguage(params?.lang)

  return getStandardMetadata({
    pageKey: 'home',
    pathname: '',
    lang: activeLang,
  })
}

export const revalidate = 60;

import { Suspense } from 'react'

export default async function LocalizedHomePage() {
  const activeLang = (await lang()) || 'en'
  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  return (
    <>
      <OrganizationSchema />
      <div className="bg-background text-foreground transition-theme" dir={dir}>
        <div className="w-full pad-for-badges">
          <div className="max-w-7xl mx-auto pt-3 pb-5 px-2 sm:px-0">
            <HeroCarousel lang={activeLang} />
            
            <Suspense fallback={<HomePageSkeleton />}>
              <LocalizedHomePageContent activeLang={activeLang} />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  )
}

function HomePageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="h-12 sm:h-16 w-3/4 sm:w-1/2 bg-muted animate-pulse rounded-2xl"></div>
    </div>
  )
}

async function LocalizedHomePageContent({ activeLang }: { activeLang: string }) {
  const rawDict = await getDictionary()

  const defaultHome = {
    title: "Welcome to AgriGuru Online",
  }

  const dict = {
    home: {
      ...defaultHome,
      ...rawDict?.home
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-center mb-6">
        {dict.home.title}
      </h1>
      <p className="text-muted-foreground text-center max-w-2xl">
        The premium B2B SaaS platform for global agricultural trade. Start exploring our market updates, latest products, and global network today.
      </p>
    </div>
  )
}

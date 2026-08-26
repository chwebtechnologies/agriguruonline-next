import { getDictionary } from './dictionaries'
import { lang } from 'next/root-params'
import Script from 'next/script'
import type { Metadata } from 'next'

// SEO Organization schema component helper
function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': 'AgriGuru Online',
    'url': 'https://agriguruonline.com',
    'logo': 'https://agriguruonline.com/logo.png',
    'description': 'The premium B2B SaaS platform for global agricultural trade.',
  }

  return (
    <Script
      id="schema-org"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
    />
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const activeLang = await lang()
  const rawDict = await getDictionary()
  const title = rawDict?.home?.title || "Welcome to AgriGuru Online"
  const description = "The premium B2B SaaS platform for global agricultural trade."

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${activeLang}`,
      siteName: 'AgriGuru Online',
      images: [
        {
          url: `${siteUrl}/logo.png`,
          width: 1200,
          height: 630,
          alt: 'AgriGuru Online Logo',
        },
      ],
      locale: activeLang,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${siteUrl}/logo.png`],
    },
    alternates: {
      canonical: `${siteUrl}/${activeLang}`,
      languages: {
        'en': `${siteUrl}/en`,
        'ar': `${siteUrl}/ar`,
        'fr': `${siteUrl}/fr`,
        'zh': `${siteUrl}/zh`,
      },
    },
  }
}

export default async function LocalizedHomePage() {
  const activeLang = await lang()
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

  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  return (
    <>
      <OrganizationSchema />

      <div className="flex flex-col items-center justify-center py-32 sm:py-48 bg-background text-foreground transition-theme" dir={dir}>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-center">
          {dict.home.title}
        </h1>
      </div>
    </>
  )
}

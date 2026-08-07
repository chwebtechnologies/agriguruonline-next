import { getDictionary } from './dictionaries'
import { lang } from 'next/root-params'
import Script from 'next/script'

// SEO Organization schema component helper
function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': 'AgriGuru Online',
    'url': 'https://agriguru.online',
    'logo': 'https://agriguru.online/logo.png',
    'description': 'The premium B2B SaaS platform for global agricultural trade.',
  }

  return (
    <Script
      id="schema-org"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
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

import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { lang } from 'next/root-params'
import ThemeInitializer from '@/components/ui/ThemeInitializer'
import Header from '@/components/layout/Header'
import { HeaderGuest, HeaderGuestStatic, HeaderGuestSkeleton } from '@/components/layout/HeaderGuest'
import Footer from '@/components/layout/Footer'
import AnnouncementBar from '@/components/layout/AnnouncementBar'
import NavigationProgress from '@/components/ui/NavigationProgress'
import { Suspense } from 'react'
import { Toaster } from 'sonner'
import ServiceWorkerRegister from '@/components/ui/ServiceWorkerRegister'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { getCategories } from '@/lib/category'
import { getTradingApiUrl } from '@/lib/api-utils'
import { getAlternates, getSafeLanguage, getSiteUrl, SEO_DICTIONARY } from '@/lib/seo'
import { NotificationProvider } from '@/components/providers/NotificationProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import '../globals.css'

export async function generateMetadata(props: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const params = await props.params
  const activeLang = getSafeLanguage(params?.lang)
  const siteUrl = getSiteUrl()
  const seo = SEO_DICTIONARY.root[activeLang]
  const alternates = getAlternates('', activeLang)

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: seo.title,
      template: '%s | AgriGuru Online',
    },
    description: seo.description,
    keywords: seo.keywords,
    authors: [{ name: 'AgriGuru Online', url: siteUrl }],
    creator: 'AgriGuru Online',
    publisher: 'AgriGuru Online',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'AgriGuru Online',
      title: seo.title,
      description: seo.description,
      url: alternates.canonical,
      locale: activeLang,
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          alt: 'AgriGuru Online Logo',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: ['/logo.png'],
      site: '@AgriGuruOnline',
      creator: '@AgriGuruOnline',
    },
    alternates,
    icons: {
      icon: '/favicon.ico',
      apple: '/logo.png',
    },
    manifest: '/manifest.json',
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default async function LocalizedRootLayout({
  children,
}: LayoutProps<'/[lang]'>) {
  const activeLang = (await lang()) || 'en'
  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  const rawDict = await getDictionary(activeLang)
  const tradingApiUrl = getTradingApiUrl()
  const categoriesApiUrl = `${tradingApiUrl.replace(/\/$/, '')}/category`

  const apiCategories = await getCategories(activeLang, {
    apiUrl: categoriesApiUrl,
    stale: 300,
    revalidate: 3600,
    expire: 86400
  })

  const categories = apiCategories
    .filter(cat => cat.is_active !== false)
    .map(cat => {
      const name = cat.name
      return {
        name,
        href: `/${activeLang}/category/${cat.slug}`
      }
    })

  const defaultNavigation = {
    login: "Login",
    register: "Register",
    logout: "Log Out",
    dashboard: "Dashboard"
  }

  const defaultHeader = {
    announcement: "Download Our Mobile App Now ! Click Here",
    download_app: "Download Application",
    contact_us: "Contact Us",
    search_placeholder: "Search Product",
    home: "Home",
    about_us: "About Us",
    register_here: "Register Here",
    menu: "Menu"
  }

  const dict = {
    navigation: {
      ...defaultNavigation,
      ...rawDict?.navigation
    },
    header: {
      ...defaultHeader,
      ...rawDict?.header,
      categories: {
        ...rawDict?.header?.categories
      }
    },
    common: rawDict?.common || {}
  }

  return (
    <html
      lang={activeLang}
      dir={dir}
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <link rel="preconnect" href="https://assets.agriguruonline.com" />
        <link rel="dns-prefetch" href="https://assets.agriguruonline.com" />
        <link rel="preconnect" href="https://assets.agriguruonline.cloud" />
        <link rel="dns-prefetch" href="https://assets.agriguruonline.cloud" />
        <link rel="preconnect" href="https://trading-api.agriguruonline.cloud" />
        <link rel="dns-prefetch" href="https://trading-api.agriguruonline.cloud" />
        <link rel="preconnect" href="https://cms-api.agriguruonline.cloud" />
        <link rel="dns-prefetch" href="https://cms-api.agriguruonline.cloud" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" precedence="default" />
        <Script
          id="trusted-types-policy"
          dangerouslySetInnerHTML={{
            __html: `if(typeof window!=='undefined'&&window.trustedTypes&&window.trustedTypes.createPolicy){try{if(!window.trustedTypes.defaultPolicy){window.trustedTypes.createPolicy('default',{createHTML:function(s){return s},createScript:function(s){return s},createScriptURL:function(s){return s}})}}catch(e){}}`
          }}
        />
        <ThemeInitializer />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <NotificationProvider>
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            <Suspense fallback={<div className="h-10 bg-brand-blue" />}>
              <AnnouncementBar />
            </Suspense>
            <Suspense fallback={<HeaderGuest dict={dict} activeLang={activeLang} categories={categories} />}>
              <Header dict={dict} activeLang={activeLang} categories={categories} />
            </Suspense>

          <main className="flex-grow w-full relative">
            {children}
          </main>

          <Footer />
          <ServiceWorkerRegister />
          <Toaster position="top-right" richColors closeButton />
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}


import type { Metadata, Viewport } from 'next'
import { lang } from 'next/root-params'
import ThemeInitializer from '@/components/ui/ThemeInitializer'
import Header from '@/components/layout/Header'
import { HeaderGuestSkeleton } from '@/components/layout/HeaderGuest'
import Footer from '@/components/layout/Footer'
import AnnouncementBar from '@/components/layout/AnnouncementBar'
import { Suspense } from 'react'
import { Toaster } from 'sonner'
import '../globals.css'



export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'),
  title: {
    default: 'AgriGuru Online - Global Agricultural Trading',
    template: '%s | AgriGuru Online',
  },
  description: 'The premium B2B SaaS platform for global agricultural trade.',
  keywords: [
    'Agriculture',
    'Commodity Trading',
    'B2B Marketplace',
    'Agricultural Commodities',
    'AgriGuru Online',
    'Agricultural Trade',
    'Commodity Prices',
    'Crop Intelligence',
    'Export',
    'Import'
  ],
  authors: [{ name: 'AgriGuru Online', url: 'https://agriguruonline.com' }],
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
    title: 'AgriGuru Online - Global Agricultural Trading',
    description: 'The premium B2B SaaS platform for global agricultural trade.',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com',
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
    title: 'AgriGuru Online - Global Agricultural Trading',
    description: 'The premium B2B SaaS platform for global agricultural trade.',
    images: ['/logo.png'],
    site: '@AgriGuruOnline',
    creator: '@AgriGuruOnline',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
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
  const activeLang = await lang()
  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  return (
    <html
      lang={activeLang}
      dir={dir}
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="alternate" hrefLang="x-default" href={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://agriguruonline.com'}/`} />
        <ThemeInitializer />
        <link rel="preconnect" href="https://assets.agriguruonline.com" />
        <link rel="dns-prefetch" href="https://assets.agriguruonline.com" />
        <link rel="preconnect" href="https://trading-api.agriguruonline.cloud" />
        <link rel="dns-prefetch" href="https://trading-api.agriguruonline.cloud" />
        <link rel="dns-prefetch" href="https://user-api.agriguruonline.cloud" />
        <link rel="dns-prefetch" href="https://cms-api.agriguruonline.cloud" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground transition-colors duration-200">
        <Suspense fallback={<div className="h-10 w-full bg-primary-gradient shrink-0" />}>
          <AnnouncementBar />
        </Suspense>

        <Suspense fallback={<HeaderGuestSkeleton />}>
          <Header />
        </Suspense>

        <main className="flex-grow w-full relative">
          <div id="skeleton-portal" className="absolute inset-0 z-50 pointer-events-none empty:hidden"></div>
          {children}
        </main>

        <Footer />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}


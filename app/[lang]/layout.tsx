import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { lang } from 'next/root-params'
import ThemeInitializer from '@/components/ui/ThemeInitializer'
import Header from '@/components/layout/Header'
import { HeaderGuest } from '@/components/layout/HeaderGuest'
import Footer from '@/components/layout/Footer'
import AnnouncementBar from '@/components/layout/AnnouncementBar'
import { Suspense } from 'react'
import '../globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'AgriGuru Online',
  description: 'The future-oriented SaaS platform built on Next.js 16',
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeInitializer />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
          integrity="sha512-z3gLpd7yknf1YoNbCzqRKc4qyor8gaKU1qmn+CShxbuBusANI9QpRohGBreCFkKxLhei6S9CQXFEbbKuqLg0DA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-50">
        <Suspense fallback={<div className="h-10 w-full bg-[#0c5a53] shrink-0" />}>
          <AnnouncementBar />
        </Suspense>

        <Suspense fallback={<HeaderGuest loading={true} />}>
          <Header />
        </Suspense>
        
        <main className="flex-grow w-full">
          {children}
        </main>
        
        <Footer />
      </body>
    </html>
  )
}
export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}


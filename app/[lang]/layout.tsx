import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})
import Header from '@/components/layout/Header'
import { HeaderGuest, HeaderGuestStatic, HeaderGuestSkeleton } from '@/components/layout/HeaderGuest'
import dynamic from 'next/dynamic'
const Footer = dynamic(() => import('@/components/layout/Footer'))
import AnnouncementBar from '@/components/layout/AnnouncementBar'
import NavigationProgress from '@/components/ui/NavigationProgress'
import { Suspense } from 'react'
import { Toaster } from 'sonner'
import ServiceWorkerRegister from '@/components/ui/ServiceWorkerRegister'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { getCategories } from '@/lib/category'
import { getTradingApiUrl, getAssetsUrl } from '@/lib/api-utils'
import { getAlternates, getSafeLanguage, getSiteUrl, SEO_DICTIONARY } from '@/lib/seo'
import { NotificationProvider } from '@/components/providers/NotificationProvider'
import { NotificationPermissionPopup } from '@/components/modals/NotificationPermissionPopup'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import OfflineNotification from '@/components/layout/OfflineNotification'

import '@fortawesome/fontawesome-free/css/all.min.css'
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

export default async function LocalizedRootLayout(props: {
  children: React.ReactNode,
  params: Promise<{ lang: string }>
}) {
  const { children } = props;
  const params = await props.params;
  const activeLang = params.lang || 'en'
  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  const rawDict = await getDictionary(activeLang)
  const tradingApiUrl = getTradingApiUrl()
  const assetsUrl = getAssetsUrl()
  const imageBaseUrl = assetsUrl.endsWith('/') ? assetsUrl.slice(0, -1) : assetsUrl
  const categoriesApiUrl = `${tradingApiUrl.replace(/\/$/, '')}/category`

  const apiCategories = await getCategories(activeLang)

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
      className={`h-full antialiased ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>





        <Script
          id="trusted-types-policy"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `if(typeof window!=='undefined'&&window.trustedTypes&&window.trustedTypes.createPolicy){try{if(!window.trustedTypes.defaultPolicy){window.trustedTypes.createPolicy('default',{createHTML:function(s){return s},createScript:function(s){return s},createScriptURL:function(s){return s}})}}catch(e){}}`
          }}
        />
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('theme') || 'system';
                  var d = document.documentElement;
                  if (t === 'dark') {
                    d.classList.add('dark');
                    d.classList.remove('light');
                  } else if (t === 'light') {
                    d.classList.remove('dark');
                    d.classList.add('light');
                  } else {
                    d.classList.remove('dark');
                    d.classList.remove('light');
                  }
                } catch(e) {}
              })()
            `,
          }}
        />
        <script
          id="responsive-scaler"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var isUpdating = false;
                function updateScale() {
                  if (isUpdating) return;
                  try {
                    if (!('zoom' in document.documentElement.style)) return;
                    
                    var currentZoom = parseFloat(document.documentElement.style.zoom) || 1;
                    var rawW = window.innerWidth || document.documentElement.clientWidth || screen.width;
                    if (!rawW || rawW <= 0) return;
                    
                    // Derive true unzoomed display width
                    var w = Math.round(rawW * currentZoom);
                    if (!w || w <= 0) return;

                    var scale = 1;
                    if (w >= 1440) {
                      // Desktop >= 1440px: Scaled up proportionally based on 1440px laptop baseline
                      scale = w / 1440;
                    } else if (w >= 1024) {
                      // Laptop / Desktop (1024px - 1439px): Exact baseline
                      scale = 1;
                    } else if (w >= 768) {
                      // Tablet (768px - 1023px): Proportional to iPad Air (820px)
                      scale = w / 820;
                    } else {
                      // Mobile (< 768px): Proportional to iPhone 17 Pro Max (430px)
                      if (w < 430) {
                        scale = w / 430;
                      } else {
                        scale = Math.min(1.15, w / 430);
                      }
                    }

                    // Round to 3 decimal places to avoid subpixel calculation noise
                    scale = Math.round(scale * 1000) / 1000;

                    // If scale is virtually identical to current zoom, DO NOT update (breaks infinite resize jitter loop)
                    if (Math.abs(scale - currentZoom) < 0.005) {
                      return;
                    }

                    isUpdating = true;
                    document.documentElement.style.zoom = scale;
                    setTimeout(function() {
                      isUpdating = false;
                    }, 50);
                  } catch(e) {
                    isUpdating = false;
                  }
                }

                // Initial immediate synchronous run before paint
                updateScale();

                // Smooth debounced resize using requestAnimationFrame
                var rAF = null;
                function scheduleUpdate() {
                  if (rAF) cancelAnimationFrame(rAF);
                  rAF = requestAnimationFrame(updateScale);
                }

                window.addEventListener('resize', scheduleUpdate, { passive: true });
                window.addEventListener('orientationchange', scheduleUpdate, { passive: true });
              })();
            `,
          }}
        />

      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <NotificationProvider>
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            <OfflineNotification />
            <AnnouncementBar />
            <Header dict={dict} activeLang={activeLang} categories={categories} />

          <main className="flex-grow w-full relative">
            {children}
          </main>

          <Footer />
          <ServiceWorkerRegister />
          <Toaster position="top-right" richColors closeButton />
          <NotificationPermissionPopup />
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ar' }, { lang: 'zh' }, { lang: 'fr' }]
}

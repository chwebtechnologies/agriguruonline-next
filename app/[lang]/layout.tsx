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
                var lastAppliedScale = -1;
                var lastViewportContent = '';

                function updateScale() {
                  if (isUpdating) return;
                  isUpdating = true;

                  try {
                    var screenW = window.screen.width;
                    var screenH = window.screen.height;
                    var isLandscape = window.matchMedia && window.matchMedia("(orientation: landscape)").matches;
                    
                    // Fallback to basic dimension check if matchMedia fails
                    if (typeof isLandscape === 'undefined') {
                      isLandscape = window.innerWidth > window.innerHeight;
                    }
                    
                    var logicalWidth = isLandscape ? Math.max(screenW, screenH) : Math.min(screenW, screenH);
                    
                    // On desktop, logicalWidth might be very large, use window.innerWidth
                    var w = (logicalWidth && logicalWidth < 1024) ? logicalWidth : (window.innerWidth || document.documentElement.clientWidth || screenW);

                    if (!w || w <= 0) {
                      isUpdating = false;
                      return;
                    }

                    if (w < 1024) {
                      document.documentElement.style.zoom = '1';
                      
                      var viewportMeta = document.querySelector('meta[name="viewport"]');
                      if (!viewportMeta) {
                        viewportMeta = document.createElement('meta');
                        viewportMeta.name = 'viewport';
                        document.head.appendChild(viewportMeta);
                      }

                      var targetWidth = 'device-width';
                      var scale = 1;
                      var newContent = '';
                      
                      if (w < 430) {
                        // Force 430px width (iPhone 14/15/16/17 Pro Max) and scale it down to fit perfectly on smaller screens
                        targetWidth = '430';
                        scale = w / 430;
                        scale = Math.floor(scale * 1000) / 1000;
                        newContent = 'width=' + targetWidth + ', initial-scale=' + scale + ', maximum-scale=' + scale + ', minimum-scale=' + scale + ', user-scalable=no';
                      } else if (w >= 768 && w < 820) {
                        // iPad Mini scaling
                        targetWidth = '820';
                        scale = w / 820;
                        scale = Math.floor(scale * 1000) / 1000;
                        newContent = 'width=' + targetWidth + ', initial-scale=' + scale + ', maximum-scale=' + scale + ', minimum-scale=' + scale + ', user-scalable=no';
                      } else {
                        newContent = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
                      }
                      
                      if (viewportMeta.getAttribute('content') !== newContent && lastViewportContent !== newContent) {
                        viewportMeta.setAttribute('content', newContent);
                        lastViewportContent = newContent;
                      }
                      
                      isUpdating = false;
                      return;
                    }

                    // Desktop CSS Zoom
                    var wDesktop = window.innerWidth || document.documentElement.clientWidth;
                    var scaleDesktop = 1;
                    if (wDesktop >= 1440) {
                      scaleDesktop = wDesktop / 1440;
                    }
                    scaleDesktop = Math.round(scaleDesktop * 1000) / 1000;

                    if (lastAppliedScale > 0 && Math.abs(scaleDesktop - lastAppliedScale) < 0.005) {
                      isUpdating = false;
                      return;
                    }

                    lastAppliedScale = scaleDesktop;
                    document.documentElement.style.zoom = scaleDesktop;

                    setTimeout(function() { isUpdating = false; }, 50);
                  } catch(e) {
                    isUpdating = false;
                  }
                }

                // Initial synchronous run before first paint
                updateScale();

                // Observe if Next.js tries to overwrite our viewport meta tag during hydration
                try {
                  var headObserver = new MutationObserver(function(mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                      var m = mutations[i];
                      if (m.type === 'attributes' && m.target.name === 'viewport') {
                        if (m.target.getAttribute('content') !== lastViewportContent && lastViewportContent !== '') {
                          // Next.js changed it, change it back immediately!
                          m.target.setAttribute('content', lastViewportContent);
                        }
                      }
                    }
                  });
                  var existingMeta = document.querySelector('meta[name="viewport"]');
                  if (existingMeta) {
                    headObserver.observe(existingMeta, { attributes: true, attributeFilter: ['content'] });
                  } else {
                    headObserver.observe(document.head, { childList: true, subtree: true });
                  }
                } catch(e) {}

                // On resize: run synchronously so zoom + layout paint in a SINGLE frame
                window.addEventListener('resize', updateScale, { passive: true });
                window.addEventListener('orientationchange', updateScale, { passive: true });
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

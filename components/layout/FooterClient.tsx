'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { FooterSections, FooterLinkItem } from '@/types/cms'

interface FooterProps {
  dict: {
    footer: {
      tagline: string
      download_today: string
      company_details: string
      trade_services: string
      membership_plans: string
      regulatory_norms: string
      contact_us: string
      get_in_touch?: string
      about_us: string
      founder_profile: string
      career?: string
      user_manual: string
      user_guide: string
      disclaimer: string
      terms_conditions: string
      refund_cancellation: string
      privacy_policy: string
      copyright: string
    }
    navigation?: {
      home: string
      products?: string
      freight?: string
      price?: string
      chart?: string
      insights?: string
      [key: string]: unknown
    }
  }
  activeLang: string
  footerData?: FooterSections | null
}

export default function FooterClient({ dict, activeLang, footerData }: FooterProps) {
  const pathname = usePathname() || '/'
  const [showScrollTop, setShowScrollTop] = useState(false)

  const tabs = [
    {
      label: dict.navigation?.products || 'Products',
      href: `/${activeLang}/products`,
      iconClass: 'fa-solid fa-leaf',
      isActive: pathname.startsWith(`/${activeLang}/products`),
    },
    {
      label: dict.navigation?.freight || 'Freight',
      href: `/${activeLang}/freight-charts`,
      iconClass: 'fa-solid fa-ship',
      isActive: pathname.startsWith(`/${activeLang}/freight-charts`),
    },
    {
      label: dict.navigation?.price || 'Price',
      href: `/${activeLang}/product-charts`,
      iconClass: 'fa-solid fa-dollar-sign',
      isActive: pathname.startsWith(`/${activeLang}/product-charts`),
    },
    {
      label: dict.navigation?.insights || 'Insights',
      href: `/${activeLang}/insights`,
      iconClass: 'fa-solid fa-lightbulb',
      isActive: pathname.startsWith(`/${activeLang}/insights`),
    },
    {
      label: dict.navigation?.home || 'Home',
      href: `/${activeLang}`,
      iconClass: 'fa-solid fa-house',
      isActive: pathname === `/${activeLang}` || pathname === `/${activeLang}/` || pathname === '/',
    },
  ]

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const fallbackSections: FooterSections = useMemo(
    () => ({
      'Company Details': [
        { name: dict.footer.about_us, title: dict.footer.about_us, link_type: 'PAGE', slug: 'about-us', url: '' },
        { name: dict.footer.founder_profile, title: dict.footer.founder_profile, link_type: 'PAGE', slug: 'founder-profile', url: '' },
        { name: 'Our Team', title: 'Our Team', link_type: 'PAGE', slug: 'our-team', url: '' },
      ],
      'Trade Services': [
        { name: dict.footer.user_manual, title: dict.footer.user_manual, link_type: 'PAGE', slug: 'user-manual', url: '' },
        { name: dict.footer.user_guide, title: dict.footer.user_guide, link_type: 'PAGE', slug: 'agriguru-user-guide', url: '' },
        { name: dict.footer.disclaimer, title: dict.footer.disclaimer, link_type: 'PAGE', slug: 'disclaimer', url: '' },
        { name: dict.footer.terms_conditions, title: dict.footer.terms_conditions, link_type: 'PAGE', slug: 'terms-conditions', url: '' },
        { name: dict.footer.refund_cancellation, title: dict.footer.refund_cancellation, link_type: 'PAGE', slug: 'refund-cancellation-policy', url: '' },
      ],
      'Membership Plans': [
        { name: dict.footer.membership_plans, title: dict.footer.membership_plans, link_type: 'PAGE', slug: 'membership', url: '' },
      ],
      'Regulatory Norms': [
        { name: dict.footer.privacy_policy, title: dict.footer.privacy_policy, link_type: 'PAGE', slug: 'privacy-policy', url: '' },
      ],
      'Contact Us': [
        { name: dict.footer.contact_us, title: dict.footer.contact_us, link_type: 'PAGE', slug: 'contact-us', url: '' },
        { name: dict.footer.career || 'Career', title: dict.footer.career || 'Career', link_type: 'PAGE', slug: 'career', url: '' },
      ],
    }),
    [dict]
  )

  const sections = useMemo(() => {
    return footerData && Object.keys(footerData).length > 0 ? footerData : fallbackSections
  }, [footerData, fallbackSections])

  const getSectionTitle = (sectionKey: string): string => {
    const normalized = sectionKey.trim().toLowerCase()
    if (normalized.includes('company')) return dict.footer.company_details || sectionKey
    if (normalized.includes('trade') || normalized.includes('service')) return dict.footer.trade_services || sectionKey
    if (normalized.includes('membership') || normalized.includes('plan')) return dict.footer.membership_plans || sectionKey
    if (normalized.includes('regulatory') || normalized.includes('norm')) return dict.footer.regulatory_norms || sectionKey
    if (normalized.includes('contact') || normalized.includes('touch')) return dict.footer.get_in_touch || dict.footer.contact_us || sectionKey
    return sectionKey
  }

  const getProcessedItems = (sectionKey: string, rawItems: FooterLinkItem[]): FooterLinkItem[] => {
    const normalized = sectionKey.trim().toLowerCase()
    if (normalized.includes('company')) {
      const hasAboutUs = rawItems.some(item => item.slug === 'about-us' || item.slug === 'about')
      if (!hasAboutUs) {
        return [
          {
            name: dict.footer.about_us || 'About Us',
            title: dict.footer.about_us || 'About Us',
            link_type: 'PAGE',
            slug: 'about-us',
            url: '',
          },
          ...rawItems,
        ]
      }
    }
    return rawItems
  }

  const getLinkHref = (item: FooterLinkItem): { href: string; isExternal: boolean } => {
    const slug = (item.slug || '').trim()
    const url = (item.url || '').trim()

    // 1. Dedicated custom pages always route cleanly
    if (slug === 'about' || slug === 'about-us') {
      return { href: `/${activeLang}/about-us`, isExternal: false }
    }
    if (slug === 'contact-us') {
      return { href: `/${activeLang}/contact-us`, isExternal: false }
    }
    if (slug === 'membership' || slug === 'become-member') {
      return { href: `/${activeLang}/membership`, isExternal: false }
    }
    if (slug === 'career') {
      return { href: `/${activeLang}/career`, isExternal: false }
    }
    if (slug === 'user-guide') {
      return { href: `/${activeLang}/agriguru-user-guide`, isExternal: false }
    }

    // 2. Generic CMS Page
    if (item.link_type === 'PAGE' || (!url && slug)) {
      return { href: `/${activeLang}/${slug}`, isExternal: false }
    }

    // 3. URL handling (Check if internal/staging or external)
    if (url) {
      if (url.includes('nstackapp.com') || url.includes('agriguruonline') || url.startsWith('/')) {
        if (slug) {
          return { href: `/${activeLang}/${slug}`, isExternal: false }
        }
        try {
          const parsed = new URL(url)
          const path = parsed.pathname.replace(/^\/(en|ar|zh|fr)/, '')
          return { href: `/${activeLang}${path}`, isExternal: false }
        } catch {
          return { href: url.startsWith('/') ? `/${activeLang}${url}` : url, isExternal: false }
        }
      }
      return { href: url, isExternal: true }
    }

    return { href: slug ? `/${activeLang}/${slug}` : '#', isExternal: false }
  }

  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  return (
    <footer id="footer" className="w-full font-sans bg-card text-muted-foreground pt-3 sm:pt-4 md:pt-6 pb-0 relative transition-theme border-t border-border" dir={dir}>

      {/* ======================================================== */}
      {/* Links Section (Layout matched perfectly with Header)      */}
      {/* ======================================================== */}
      <div className="w-full pad-for-badges" style={{ paddingLeft: 'var(--ag-container-px)', paddingRight: 'var(--ag-container-px)' }}>
        <div className="mx-auto max-w-7xl w-full py-2 sm:py-3 md:py-6">

          {/* Desktop & Tablet View: Equal columns touching layout left & right with equal spacing */}
          <div 
            className="hidden md:grid gap-4 lg:gap-6 xl:gap-8 w-full text-xs sm:text-[13px] lg:text-sm font-bold tracking-wide"
            style={{
              gridTemplateColumns: `repeat(${Object.keys(sections).length || 5}, minmax(0, 1fr))`
            }}
          >
            {Object.entries(sections).map(([sectionKey, rawItems]) => {
              const items = getProcessedItems(sectionKey, rawItems || [])
              const sectionTitle = getSectionTitle(sectionKey)
              return (
                <div key={sectionKey} className="min-w-0 w-full">
                  <h2 className="font-black text-foreground uppercase tracking-wider mb-2.5 border-b border-border pb-1.5 break-words">
                    {sectionTitle}
                  </h2>
                  <ul className="space-y-1.5 text-muted-foreground">
                    {items.map((item, idx) => {
                      const { href, isExternal } = getLinkHref(item)
                      const label = item.title || item.name
                      return (
                        <li key={`${item.slug || item.url || idx}`} className="min-w-0">
                          {isExternal ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-brand-blue dark:hover:text-brand-blue hover:underline transition-colors block py-0.5 md:py-0 break-words leading-snug"
                            >
                              {label}
                            </a>
                          ) : (
                            <Link
                              href={href}
                              className="hover:text-brand-blue dark:hover:text-brand-blue hover:underline transition-colors block py-0.5 md:py-0 break-words leading-snug"
                            >
                              {label}
                            </Link>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>

          {/* Mobile View (< 768px): Sleek, Apple-style Bordered Accordions */}
          <div className="block md:hidden divide-y divide-border/70 border-y border-border/70">
            {Object.entries(sections).map(([sectionKey, rawItems]) => {
              const items = getProcessedItems(sectionKey, rawItems || [])
              const sectionTitle = getSectionTitle(sectionKey)
              return (
                <details key={sectionKey} className="group py-0.5">
                  <summary className="w-full flex justify-between items-center py-3 text-foreground font-bold text-sm tracking-wide cursor-pointer list-none select-none transition-colors group-hover:text-brand-blue [&::-webkit-details-marker]:hidden">
                    <span>{sectionTitle}</span>
                    <span className="w-5 h-5 flex items-center justify-center text-muted-foreground group-open:rotate-180 transition-transform duration-200">
                      <i className="fa-solid fa-chevron-down text-xs" />
                    </span>
                  </summary>
                  <ul className="pb-3 pt-0.5 space-y-2 text-sm text-muted-foreground font-medium pl-2">
                    {items.map((item, idx) => {
                      const { href, isExternal } = getLinkHref(item)
                      const label = item.title || item.name
                      return (
                        <li key={`${item.slug || item.url || idx}`}>
                          {isExternal ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block py-1 hover:text-brand-blue dark:hover:text-brand-blue transition-colors"
                            >
                              {label}
                            </a>
                          ) : (
                            <Link
                              href={href}
                              className="block py-1 hover:text-brand-blue dark:hover:text-brand-blue transition-colors"
                            >
                              {label}
                            </Link>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </details>
              )
            })}
          </div>

        </div>
      </div>

      {/* Copyright Bar */}
      <div className="w-full pad-for-badges py-2.5 pb-[72px] min-[390px]:pb-[76px] lg:py-3 lg:pb-3 text-center text-[12px] sm:text-[13px] border-t border-border bg-muted text-muted-foreground font-semibold transition-theme" style={{ paddingLeft: 'var(--ag-container-px)', paddingRight: 'var(--ag-container-px)' }}>
        <div className="mx-auto max-w-7xl w-full flex items-center justify-center">
          <span>{dict.footer.copyright}</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Side Viewport Sticky Tabs ("Membership")                  */}
      {/* ======================================================== */}

      {/* Left side tab - Crown at the top pointing right */}
      <Link
        href={`/${activeLang}/membership`}
        className="group hidden xl:flex fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-primary-gradient border-none text-white rounded-r-xl shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20 cursor-pointer py-5 px-2 select-none flex-col items-center gap-3 w-[38px] hover:scale-105 active:scale-95 origin-left duration-200 transition-all"
      >
        <i className="fa-solid fa-crown text-white/90 text-[14px] shrink-0 rotate-90 transition-transform duration-200 group-hover:scale-115"></i>
        <span className="[writing-mode:vertical-lr] text-sm font-black uppercase tracking-widest leading-none">Membership</span>
      </Link>

      {/* Right side tab - Crown at the top pointing left */}
      <Link
        href={`/${activeLang}/membership`}
        className="group hidden xl:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-primary-gradient border-none text-white rounded-l-xl shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20 cursor-pointer py-5 px-2 select-none flex-col items-center gap-3 w-[38px] hover:scale-105 active:scale-95 origin-right duration-200 transition-all"
      >
        <i className="fa-solid fa-crown text-white/90 text-[14px] shrink-0 -rotate-90 transition-transform duration-200 group-hover:scale-115"></i>
        <span className="[writing-mode:vertical-lr] rotate-180 text-sm font-black uppercase tracking-widest leading-none">Membership</span>
      </Link>

      {/* ======================================================== */}
      {/* Floating Action Buttons                                   */}
      {/* ======================================================== */}

      {/* Bottom Left: Email Mail Floater (Hidden on mobile, visible on desktop) */}
      <a 
        href="mailto:support@agriguru.online" 
        className="hidden lg:flex fixed bottom-6 left-6 z-45 h-11 w-11 items-center justify-center rounded-full bg-brand-blue text-white shadow-xl hover:scale-110 active:scale-95 duration-200 transition-all border border-blue-400/20" 
        aria-label="Mail Support"
      >
        <i className="fa-solid fa-envelope text-lg"></i>
      </a>

      {/* Bottom Right Float Group */}
      <div className="fixed bottom-20 lg:bottom-6 right-6 z-45 flex flex-col gap-2.5">
        {/* Scroll To Top button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="flex h-9.5 w-9.5 items-center justify-center rounded-full bg-muted border border-border text-foreground hover:text-brand-blue shadow-lg hover:scale-115 active:scale-95 duration-200 transition-all cursor-pointer"
            aria-label="Scroll to top"
          >
            <i className="fa-solid fa-chevron-up text-[15px]"></i>
          </button>
        )}

        {/* WhatsApp Chat Floater (Hidden on mobile, visible on desktop) */}
        <a 
          href="https://wa.me/123456789" 
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl hover:scale-110 active:scale-95 duration-200 transition-all border border-green-400/20" 
          aria-label="WhatsApp support"
        >
          <i className="fa-brands fa-whatsapp text-2xl"></i>
        </a>
      </div>

      {/* ======================================================== */}
      {/* 6. Mobile Bottom Navigation Bar (Pixel Perfect)            */}
      {/* ======================================================== */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-45 bg-card border-t border-border shadow-2xl h-[64px] min-[390px]:h-[68px]">
        <div className="w-full max-w-2xl mx-auto h-full px-2 py-1 flex justify-between items-center">
        {tabs.map((tab, idx) => (
          <Link
            key={idx}
            href={tab.href}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-[390px]:gap-1 transition-colors duration-150 py-1 px-0.5 rounded-lg select-none group text-center ${
              tab.isActive 
                ? 'text-[#0F6FBF] dark:text-brand-blue scale-105' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex h-6 min-[390px]:h-6.5 w-6 min-[390px]:w-6.5 items-center justify-center shrink-0">
              <i className={`${tab.iconClass} text-[19px] min-[390px]:text-[21px] transition-colors duration-150 ${
                tab.isActive 
                  ? 'text-[#0F6FBF] dark:text-brand-blue drop-shadow-[0_0_8px_rgba(29,146,235,0.35)]' 
                  : 'text-muted-foreground group-hover:text-foreground'
              }`} />
            </div>
            <span className={`text-[10px] min-[360px]:text-[11px] min-[390px]:text-[12px] font-bold tracking-tight transition-colors duration-150 truncate max-w-full px-0.5 whitespace-nowrap leading-tight text-center block ${
              tab.isActive 
                ? 'text-[#0F6FBF] dark:text-brand-blue font-extrabold' 
                : 'text-muted-foreground group-hover:text-foreground'
              }`}>
              {tab.label}
            </span>
          </Link>
        ))}
        </div>
      </div>

    </footer>
  )
}

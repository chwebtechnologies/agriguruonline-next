'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
      about_us: string
      founder_profile: string
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
      [key: string]: unknown
    }
  }
  activeLang: string
}

export default function FooterClient({ dict, activeLang }: FooterProps) {
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
      href: `/${activeLang}/freight`,
      iconClass: 'fa-solid fa-ship',
      isActive: pathname.startsWith(`/${activeLang}/freight`),
    },
    {
      label: dict.navigation?.price || 'Price',
      href: `/${activeLang}/prices`,
      iconClass: 'fa-solid fa-dollar-sign',
      isActive: pathname.startsWith(`/${activeLang}/prices`),
    },
    {
      label: dict.navigation?.chart || 'Charts',
      href: `/${activeLang}/product-charts`,
      iconClass: 'fa-solid fa-chart-line',
      isActive: pathname.startsWith(`/${activeLang}/product-charts`),
    },
    {
      label: dict.navigation?.home || 'Home',
      href: `/${activeLang}`,
      iconClass: 'fa-solid fa-house',
      isActive: pathname === `/${activeLang}` || pathname === `/${activeLang}/` || pathname === '/',
    },
  ]
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    company: false,
    services: false,
    plans: false,
    norms: false,
    contact: false,
  })

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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const dir = activeLang === 'ar' ? 'rtl' : 'ltr'

  return (
    <footer id="footer" className="w-full font-sans bg-ag-footer-bg text-ag-footer-text pt-8 pb-18 md:pb-6 relative transition-theme border-t border-ag-footer-border" dir={dir}>

      {/* ======================================================== */}
      {/* 1. App Download Section (Compact alignment)               */}
      {/* ======================================================== */}
      

      {/* ======================================================== */}
      {/* 2. Social Media Icon Row (More compact)                   */}
      {/* ======================================================== */}
      

      {/* ======================================================== */}
      {/* 3. Links Section (Reduced height, tight padding)           */}
      {/* ======================================================== */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">

        {/* Desktop View (md:grid) */}
        <div className="hidden md:grid grid-cols-5 gap-6 text-sm font-bold tracking-wide">
          {/* Column 1: Company Details */}
          <div>
            <h3 className="font-black text-ag-footer-heading-text uppercase tracking-wider mb-2.5 border-b border-ag-footer-border pb-1.5">{dict.footer.company_details}</h3>
            <ul className="space-y-1.5 text-ag-footer-text">
              <li><Link href={`/${activeLang}/about`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">{dict.footer.about_us}</Link></li>
              <li><Link href={`/${activeLang}/founder`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">{dict.footer.founder_profile}</Link></li>
            </ul>
          </div>

          {/* Column 2: Trade Services */}
          <div>
            <h3 className="font-black text-ag-footer-heading-text uppercase tracking-wider mb-2.5 border-b border-ag-footer-border pb-1.5">{dict.footer.trade_services}</h3>
            <ul className="space-y-1.5 text-ag-footer-text">
              <li><Link href={`/${activeLang}/manual`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">{dict.footer.user_manual}</Link></li>
              <li><Link href={`/${activeLang}/guide`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">{dict.footer.user_guide}</Link></li>
            </ul>
          </div>

          {/* Column 3: Membership Plans */}
          <div>
            <h3 className="font-black text-ag-footer-heading-text uppercase tracking-wider mb-2.5 border-b border-ag-footer-border pb-1.5">{dict.footer.membership_plans}</h3>
            <ul className="space-y-1.5 text-ag-footer-text">
              <li><Link href={`/${activeLang}/membership`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">{dict.footer.membership_plans}</Link></li>
            </ul>
          </div>

          {/* Column 4: Regulatory Norms */}
          <div>
            <h3 className="font-black text-ag-footer-heading-text uppercase tracking-wider mb-2.5 border-b border-ag-footer-border pb-1.5">{dict.footer.regulatory_norms}</h3>
            <ul className="space-y-1.5 text-ag-footer-text">
              <li><Link href={`/${activeLang}/disclaimer`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">{dict.footer.disclaimer}</Link></li>
              <li><Link href={`/${activeLang}/terms`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">{dict.footer.terms_conditions}</Link></li>
              <li><Link href={`/${activeLang}/refund`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">{dict.footer.refund_cancellation}</Link></li>
              <li><Link href={`/${activeLang}/privacy`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">{dict.footer.privacy_policy}</Link></li>
            </ul>
          </div>

          {/* Column 5: Contact Us */}
          <div>
            <h3 className="font-black text-ag-footer-heading-text uppercase tracking-wider mb-2.5 border-b border-ag-footer-border pb-1.5">{dict.footer.contact_us}</h3>
            <ul className="space-y-1.5 text-ag-footer-text">
              <li><Link href={`/${activeLang}/contact`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">{dict.footer.contact_us}</Link></li>
            </ul>
          </div>
        </div>

        {/* Mobile View (Accordions) */}
        <div className="block md:hidden space-y-2.5">

          {/* Accordion 1: Company Details */}
          <div className="border-b border-ag-footer-border pb-1">
            <button
              onClick={() => toggleSection('company')}
              className="w-full flex justify-between items-center py-1.5 text-ag-footer-heading-text font-bold text-sm"
            >
              <span>{dict.footer.company_details}</span>
              <span className={`transform text-[10px] transition-transform duration-200 ${expandedSections.company ? 'rotate-180' : 'rotate-0'}`}>▼</span>
            </button>
            {expandedSections.company && (
              <ul className="pl-4 py-1.5 space-y-1.5 text-sm text-ag-footer-text">
                <li><Link href={`/${activeLang}/about`} className="block py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400">{dict.footer.about_us}</Link></li>
                <li><Link href={`/${activeLang}/founder`} className="block py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400">{dict.footer.founder_profile}</Link></li>
              </ul>
            )}
          </div>

          {/* Accordion 2: Trade Services */}
          <div className="border-b border-ag-footer-border pb-1">
            <button
              onClick={() => toggleSection('services')}
              className="w-full flex justify-between items-center py-1.5 text-ag-footer-heading-text font-bold text-sm"
            >
              <span>{dict.footer.trade_services}</span>
              <span className={`transform text-[10px] transition-transform duration-200 ${expandedSections.services ? 'rotate-180' : 'rotate-0'}`}>▼</span>
            </button>
            {expandedSections.services && (
              <ul className="pl-4 py-1.5 space-y-1.5 text-sm text-ag-footer-text">
                <li><Link href={`/${activeLang}/manual`} className="block py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400">{dict.footer.user_manual}</Link></li>
                <li><Link href={`/${activeLang}/guide`} className="block py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400">{dict.footer.user_guide}</Link></li>
              </ul>
            )}
          </div>

          {/* Accordion 3: Membership Plans */}
          <div className="border-b border-ag-footer-border pb-1">
            <button
              onClick={() => toggleSection('plans')}
              className="w-full flex justify-between items-center py-1.5 text-ag-footer-heading-text font-bold text-sm"
            >
              <span>{dict.footer.membership_plans}</span>
              <span className={`transform text-[10px] transition-transform duration-200 ${expandedSections.plans ? 'rotate-180' : 'rotate-0'}`}>▼</span>
            </button>
            {expandedSections.plans && (
              <ul className="pl-4 py-1.5 space-y-1.5 text-sm text-ag-footer-text">
                <li><Link href={`/${activeLang}/membership`} className="block py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400">{dict.footer.membership_plans}</Link></li>
              </ul>
            )}
          </div>

          {/* Accordion 4: Regulatory Norms */}
          <div className="border-b border-ag-footer-border pb-1">
            <button
              onClick={() => toggleSection('norms')}
              className="w-full flex justify-between items-center py-1.5 text-ag-footer-heading-text font-bold text-sm"
            >
              <span>{dict.footer.regulatory_norms}</span>
              <span className={`transform text-[10px] transition-transform duration-200 ${expandedSections.norms ? 'rotate-180' : 'rotate-0'}`}>▼</span>
            </button>
            {expandedSections.norms && (
              <ul className="pl-4 py-1.5 space-y-1.5 text-sm text-ag-footer-text">
                <li><Link href={`/${activeLang}/disclaimer`} className="block py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400">{dict.footer.disclaimer}</Link></li>
                <li><Link href={`/${activeLang}/terms`} className="block py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400">{dict.footer.terms_conditions}</Link></li>
                <li><Link href={`/${activeLang}/refund`} className="block py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400">{dict.footer.refund_cancellation}</Link></li>
                <li><Link href={`/${activeLang}/privacy`} className="block py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400">{dict.footer.privacy_policy}</Link></li>
              </ul>
            )}
          </div>

          {/* Accordion 5: Contact Us */}
          <div className="border-b border-ag-footer-border pb-1">
            <button
              onClick={() => toggleSection('contact')}
              className="w-full flex justify-between items-center py-1.5 text-ag-footer-heading-text font-bold text-sm"
            >
              <span>{dict.footer.contact_us}</span>
              <span className={`transform text-[10px] transition-transform duration-200 ${expandedSections.contact ? 'rotate-180' : 'rotate-0'}`}>▼</span>
            </button>
            {expandedSections.contact && (
              <ul className="pl-4 py-1.5 space-y-1.5 text-sm text-ag-footer-text">
                <li><Link href={`/${activeLang}/contact`} className="block py-0.5 hover:text-emerald-600 dark:hover:text-emerald-400">{dict.footer.contact_us}</Link></li>
              </ul>
            )}
          </div>

        </div>

      </div>

      {/* Copyright Bar */}
      <div className="w-full py-3.5 text-center text-[13px] border-t border-ag-footer-border bg-ag-footer-bottom-bg text-ag-footer-text font-semibold transition-theme">
        <div className="mx-auto max-w-7xl px-4 flex items-center justify-center">
          <span>{dict.footer.copyright}</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. Side Viewport Sticky Tabs ("Membership")               */}
      {/* ======================================================== */}

      {/* Left side tab - Crown at the top pointing right, text goes top-to-bottom (facing right/inwards) */}
      <Link
        href={`/${activeLang}/membership`}
        className="group hidden lg:flex fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-primary-gradient border-y border-r border-emerald-500/30 text-white rounded-r-xl shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/20 cursor-pointer lg:py-3.5 lg:px-1.5 xl:py-5 xl:px-2 select-none flex-col items-center gap-2.5 xl:gap-3 w-[32px] xl:w-[38px] hover:scale-105 active:scale-95 origin-left duration-200 transition-all"
      >
        <i className="fa-solid fa-crown text-white/90 text-[12px] xl:text-[14px] shrink-0 rotate-90 transition-transform duration-200 group-hover:scale-115"></i>
        <span className="[writing-mode:vertical-lr] text-[11px] xl:text-sm font-black uppercase tracking-widest leading-none">Membership</span>
      </Link>

      {/* Right side tab - Crown at the top pointing left, text goes bottom-to-top (facing left/inwards) */}
      <Link
        href={`/${activeLang}/membership`}
        className="group hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-primary-gradient border-y border-l border-emerald-500/30 text-white rounded-l-xl shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/20 cursor-pointer lg:py-3.5 lg:px-1.5 xl:py-5 xl:px-2 select-none flex-col items-center gap-2.5 xl:gap-3 w-[32px] xl:w-[38px] hover:scale-105 active:scale-95 origin-right duration-200 transition-all"
      >
        <i className="fa-solid fa-crown text-white/90 text-[12px] xl:text-[14px] shrink-0 -rotate-90 transition-transform duration-200 group-hover:scale-115"></i>
        <span className="[writing-mode:vertical-lr] rotate-180 text-[11px] xl:text-sm font-black uppercase tracking-widest leading-none">Membership</span>
      </Link>

      {/* ======================================================== */}
      {/* 5. Floating Action Buttons (bottom of viewport)          */}
      {/* ======================================================== */}

      {/* Bottom Left: Email Mail Floater */}
      <a href="mailto:support@agriguru.online" className="fixed bottom-18 md:bottom-6 left-6 z-45 flex h-11 w-11 items-center justify-center rounded-full bg-[#0084ff] text-white shadow-xl hover:scale-110 active:scale-95 duration-200 transition-all border border-blue-400/20" aria-label="Mail Support">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      </a>

      {/* Bottom Right Float Group */}
      <div className="fixed bottom-18 md:bottom-6 right-6 z-45 flex flex-col gap-2.5">
        {/* Scroll To Top button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="flex h-9.5 w-9.5 items-center justify-center rounded-full bg-ag-login-bg border border-ag-login-border text-ag-login-text hover:text-brand-blue shadow-lg hover:scale-115 active:scale-95 duration-200 transition-all cursor-pointer"
            aria-label="Scroll to top"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>
        )}

        {/* WhatsApp Chat Floater */}
        <a href="https://wa.me/123456789" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25d366] text-white shadow-xl hover:scale-110 active:scale-95 duration-200 transition-all border border-emerald-400/20" aria-label="WhatsApp support">
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.335 4.963L2 22l5.233-1.371a9.96 9.96 0 004.773 1.212h.005c5.506 0 9.989-4.479 9.99-9.985A9.994 9.994 0 0012.012 2zm5.836 14.199c-.24.675-1.18 1.233-1.63 1.282-.45.05-1.02.08-2.93-.67-2.44-.96-4.01-3.43-4.13-3.6-.12-.17-1.02-1.36-1.02-2.59 0-1.23.64-1.83.87-2.08a.86.86 0 01.63-.29c.15 0 .3.01.43.01.14 0 .33-.05.51.38.19.45.64 1.57.7 1.69.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.25.25-.11.49.14.24.63 1.03 1.35 1.67.93.82 1.71 1.08 1.95 1.2.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.53-.12s1.35.63 1.58.75c.23.12.38.18.44.28.06.11.06.61-.18 1.29z" />
          </svg>
        </a>
      </div>

      {/* ======================================================== */}
      {/* 6. Mobile Bottom Navigation Bar (Pixel Perfect)            */}
      {/* ======================================================== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-45 bg-ag-header-bg border-t border-ag-header-border shadow-2xl backdrop-blur-md px-1 py-1 transition-all duration-200 flex justify-between items-center h-[64px] min-[390px]:h-[68px]">
        {tabs.map((tab, idx) => (
          <Link
            key={idx}
            href={tab.href}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-[390px]:gap-1 transition-all duration-200 py-1 px-0.5 rounded-lg select-none group text-center ${
              tab.isActive 
                ? 'text-brand-blue scale-105' 
                : 'text-ag-nav-link hover:text-ag-nav-link-hover'
            }`}
          >
            <div className="flex h-6 min-[390px]:h-6.5 w-6 min-[390px]:w-6.5 items-center justify-center shrink-0 transition-transform duration-200 group-active:scale-90">
              <i className={`${tab.iconClass} text-[19px] min-[390px]:text-[21px] transition-all duration-200 ${
                tab.isActive 
                  ? 'text-brand-blue drop-shadow-[0_0_8px_rgba(29,146,235,0.35)]' 
                  : 'text-ag-nav-link group-hover:text-ag-nav-link-hover'
              }`} />
            </div>
            <span className={`text-[10px] min-[360px]:text-[11px] min-[390px]:text-[12px] font-bold tracking-tight transition-colors duration-200 truncate max-w-full px-0.5 whitespace-nowrap leading-tight text-center block ${
              tab.isActive 
                ? 'text-brand-blue font-extrabold' 
                : 'text-ag-nav-link group-hover:text-ag-nav-link-hover'
              }`}>
              {tab.label}
            </span>
          </Link>
        ))}
      </div>

    </footer>
  )
}

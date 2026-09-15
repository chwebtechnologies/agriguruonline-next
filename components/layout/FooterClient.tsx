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
    <footer id="footer" className="w-full font-sans bg-card text-muted-foreground pt-8 pb-18 md:pb-6 relative transition-theme border-t border-border" dir={dir}>

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
            <h2 className="font-black text-foreground uppercase tracking-wider mb-2.5 border-b border-border pb-1.5">{dict.footer.company_details}</h2>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link href={`/${activeLang}/about`} className="hover:text-brand-blue dark:hover:text-brand-blue hover:underline transition-colors">{dict.footer.about_us}</Link></li>
              <li><Link href={`/${activeLang}/founder`} className="hover:text-brand-blue dark:hover:text-brand-blue hover:underline transition-colors">{dict.footer.founder_profile}</Link></li>
            </ul>
          </div>

          {/* Column 2: Trade Services */}
          <div>
            <h2 className="font-black text-foreground uppercase tracking-wider mb-2.5 border-b border-border pb-1.5">{dict.footer.trade_services}</h2>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link href={`/${activeLang}/manual`} className="hover:text-brand-blue dark:hover:text-brand-blue hover:underline transition-colors">{dict.footer.user_manual}</Link></li>
              <li><Link href={`/${activeLang}/guide`} className="hover:text-brand-blue dark:hover:text-brand-blue hover:underline transition-colors">{dict.footer.user_guide}</Link></li>
            </ul>
          </div>

          {/* Column 3: Membership Plans */}
          <div>
            <h2 className="font-black text-foreground uppercase tracking-wider mb-2.5 border-b border-border pb-1.5">{dict.footer.membership_plans}</h2>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link href={`/${activeLang}/membership`} className="hover:text-brand-blue dark:hover:text-brand-blue hover:underline transition-colors">{dict.footer.membership_plans}</Link></li>
            </ul>
          </div>

          {/* Column 4: Regulatory Norms */}
          <div>
            <h2 className="font-black text-foreground uppercase tracking-wider mb-2.5 border-b border-border pb-1.5">{dict.footer.regulatory_norms}</h2>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link href={`/${activeLang}/disclaimer`} className="hover:text-brand-blue dark:hover:text-brand-blue hover:underline transition-colors">{dict.footer.disclaimer}</Link></li>
              <li><Link href={`/${activeLang}/terms`} className="hover:text-brand-blue dark:hover:text-brand-blue hover:underline transition-colors">{dict.footer.terms_conditions}</Link></li>
              <li><Link href={`/${activeLang}/refund`} className="hover:text-brand-blue dark:hover:text-brand-blue hover:underline transition-colors">{dict.footer.refund_cancellation}</Link></li>
              <li><Link href={`/${activeLang}/privacy`} className="hover:text-brand-blue dark:hover:text-brand-blue hover:underline transition-colors">{dict.footer.privacy_policy}</Link></li>
            </ul>
          </div>

          {/* Column 5: Contact Us */}
          <div>
            <h2 className="font-black text-foreground uppercase tracking-wider mb-2.5 border-b border-border pb-1.5">{dict.footer.contact_us}</h2>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link href={`/${activeLang}/contact-us`} className="hover:text-brand-blue dark:hover:text-brand-blue hover:underline transition-colors">{dict.footer.contact_us}</Link></li>
            </ul>
          </div>
        </div>

        {/* Mobile View (Accordions) */}
        <div className="block md:hidden space-y-2.5">

          {/* Accordion 1: Company Details */}
          <details className="group border-b border-border pb-1">
            <summary className="w-full flex justify-between items-center py-1.5 text-foreground font-bold text-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span>{dict.footer.company_details}</span>
              <span className="transform text-[10px] transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            <ul className="pl-4 py-1.5 space-y-1.5 text-sm text-muted-foreground">
              <li><Link href={`/${activeLang}/about`} className="block py-0.5 hover:text-brand-blue dark:hover:text-brand-blue">{dict.footer.about_us}</Link></li>
              <li><Link href={`/${activeLang}/founder`} className="block py-0.5 hover:text-brand-blue dark:hover:text-brand-blue">{dict.footer.founder_profile}</Link></li>
            </ul>
          </details>

          {/* Accordion 2: Trade Services */}
          <details className="group border-b border-border pb-1">
            <summary className="w-full flex justify-between items-center py-1.5 text-foreground font-bold text-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span>{dict.footer.trade_services}</span>
              <span className="transform text-[10px] transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            <ul className="pl-4 py-1.5 space-y-1.5 text-sm text-muted-foreground">
              <li><Link href={`/${activeLang}/manual`} className="block py-0.5 hover:text-brand-blue dark:hover:text-brand-blue">{dict.footer.user_manual}</Link></li>
              <li><Link href={`/${activeLang}/guide`} className="block py-0.5 hover:text-brand-blue dark:hover:text-brand-blue">{dict.footer.user_guide}</Link></li>
            </ul>
          </details>

          {/* Accordion 3: Membership Plans */}
          <details className="group border-b border-border pb-1">
            <summary className="w-full flex justify-between items-center py-1.5 text-foreground font-bold text-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span>{dict.footer.membership_plans}</span>
              <span className="transform text-[10px] transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            <ul className="pl-4 py-1.5 space-y-1.5 text-sm text-muted-foreground">
              <li><Link href={`/${activeLang}/membership`} className="block py-0.5 hover:text-brand-blue dark:hover:text-brand-blue">{dict.footer.membership_plans}</Link></li>
            </ul>
          </details>

          {/* Accordion 4: Regulatory Norms */}
          <details className="group border-b border-border pb-1">
            <summary className="w-full flex justify-between items-center py-1.5 text-foreground font-bold text-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span>{dict.footer.regulatory_norms}</span>
              <span className="transform text-[10px] transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            <ul className="pl-4 py-1.5 space-y-1.5 text-sm text-muted-foreground">
              <li><Link href={`/${activeLang}/disclaimer`} className="block py-0.5 hover:text-brand-blue dark:hover:text-brand-blue">{dict.footer.disclaimer}</Link></li>
              <li><Link href={`/${activeLang}/terms`} className="block py-0.5 hover:text-brand-blue dark:hover:text-brand-blue">{dict.footer.terms_conditions}</Link></li>
              <li><Link href={`/${activeLang}/refund`} className="block py-0.5 hover:text-brand-blue dark:hover:text-brand-blue">{dict.footer.refund_cancellation}</Link></li>
              <li><Link href={`/${activeLang}/privacy`} className="block py-0.5 hover:text-brand-blue dark:hover:text-brand-blue">{dict.footer.privacy_policy}</Link></li>
            </ul>
          </details>

          {/* Accordion 5: Contact Us */}
          <details className="group border-b border-border pb-1">
            <summary className="w-full flex justify-between items-center py-1.5 text-foreground font-bold text-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span>{dict.footer.contact_us}</span>
              <span className="transform text-[10px] transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            <ul className="pl-4 py-1.5 space-y-1.5 text-sm text-muted-foreground">
              <li><Link href={`/${activeLang}/contact-us`} className="block py-0.5 hover:text-brand-blue dark:hover:text-brand-blue">{dict.footer.contact_us}</Link></li>
            </ul>
          </details>

        </div>

      </div>

      {/* Copyright Bar */}
      <div className="w-full py-3.5 text-center text-[13px] border-t border-border bg-muted text-muted-foreground font-semibold transition-theme">
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
        className="group hidden lg:flex fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-primary-gradient border-y border-r border-blue-500/30 text-white rounded-r-xl shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20 cursor-pointer lg:py-3.5 lg:px-1.5 xl:py-5 xl:px-2 select-none flex-col items-center gap-2.5 xl:gap-3 w-[32px] xl:w-[38px] hover:scale-105 active:scale-95 origin-left duration-200 transition-all"
      >
        <i className="fa-solid fa-crown text-white/90 text-[12px] xl:text-[14px] shrink-0 rotate-90 transition-transform duration-200 group-hover:scale-115"></i>
        <span className="[writing-mode:vertical-lr] text-[11px] xl:text-sm font-black uppercase tracking-widest leading-none">Membership</span>
      </Link>

      {/* Right side tab - Crown at the top pointing left, text goes bottom-to-top (facing left/inwards) */}
      <Link
        href={`/${activeLang}/membership`}
        className="group hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-primary-gradient border-y border-l border-blue-500/30 text-white rounded-l-xl shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/20 cursor-pointer lg:py-3.5 lg:px-1.5 xl:py-5 xl:px-2 select-none flex-col items-center gap-2.5 xl:gap-3 w-[32px] xl:w-[38px] hover:scale-105 active:scale-95 origin-right duration-200 transition-all"
      >
        <i className="fa-solid fa-crown text-white/90 text-[12px] xl:text-[14px] shrink-0 -rotate-90 transition-transform duration-200 group-hover:scale-115"></i>
        <span className="[writing-mode:vertical-lr] rotate-180 text-[11px] xl:text-sm font-black uppercase tracking-widest leading-none">Membership</span>
      </Link>

      {/* ======================================================== */}
      {/* 5. Floating Action Buttons (bottom of viewport)          */}
      {/* ======================================================== */}

      {/* Bottom Left: Email Mail Floater */}
      <a href="mailto:support@agriguru.online" className="fixed bottom-18 md:bottom-6 left-6 z-45 flex h-11 w-11 items-center justify-center rounded-full bg-brand-blue text-white shadow-xl hover:scale-110 active:scale-95 duration-200 transition-all border border-blue-400/20" aria-label="Mail Support">
        <i className="fa-solid fa-envelope text-lg"></i>
      </a>

      {/* Bottom Right Float Group */}
      <div className="fixed bottom-18 md:bottom-6 right-6 z-45 flex flex-col gap-2.5">
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

        {/* WhatsApp Chat Floater */}
        <a href="https://wa.me/123456789" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl hover:scale-110 active:scale-95 duration-200 transition-all border border-green-400/20" aria-label="WhatsApp support">
          <i className="fa-brands fa-whatsapp text-2xl"></i>
        </a>
      </div>

      {/* ======================================================== */}
      {/* 6. Mobile Bottom Navigation Bar (Pixel Perfect)            */}
      {/* ======================================================== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-45 bg-card border-t border-border shadow-2xl px-1 py-1 transition-all duration-200 flex justify-between items-center h-[64px] min-[390px]:h-[68px]">
        {tabs.map((tab, idx) => (
          <Link
            key={idx}
            href={tab.href}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-[390px]:gap-1 transition-all duration-200 py-1 px-0.5 rounded-lg select-none group text-center ${
              tab.isActive 
                ? 'text-[#0F6FBF] dark:text-brand-blue scale-105' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex h-6 min-[390px]:h-6.5 w-6 min-[390px]:w-6.5 items-center justify-center shrink-0 transition-transform duration-200 group-active:scale-90">
              <i className={`${tab.iconClass} text-[19px] min-[390px]:text-[21px] transition-all duration-200 ${
                tab.isActive 
                  ? 'text-[#0F6FBF] dark:text-brand-blue drop-shadow-[0_0_8px_rgba(29,146,235,0.35)]' 
                  : 'text-muted-foreground group-hover:text-foreground'
              }`} />
            </div>
            <span className={`text-[10px] min-[360px]:text-[11px] min-[390px]:text-[12px] font-bold tracking-tight transition-colors duration-200 truncate max-w-full px-0.5 whitespace-nowrap leading-tight text-center block ${
              tab.isActive 
                ? 'text-[#0F6FBF] dark:text-brand-blue font-extrabold' 
                : 'text-muted-foreground group-hover:text-foreground'
              }`}>
              {tab.label}
            </span>
          </Link>
        ))}
      </div>

    </footer>
  )
}

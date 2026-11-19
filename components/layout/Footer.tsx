import { getDictionary } from '@/app/[lang]/dictionaries'
import { lang } from 'next/root-params'
import FooterClient from './FooterClient'
import { getSafeLanguage } from '@/lib/seo'
import { cmsService } from '@/lib/api/cms.service'

export default async function Footer() {
  const rawLang = await lang()
  const activeLang = getSafeLanguage(rawLang)
  const [rawDict, footerData]: [any, any] = await Promise.all([
    getDictionary(activeLang).catch(() => ({})),
    cmsService.getFooter(activeLang).catch(() => null),
  ])

  const defaultFooter = {
    tagline: "\"Your AgriTrade & Our AgriTech\"",
    download_today: "Download AgriGuru Online Today!",
    company_details: "Company Details",
    trade_services: "Trade Services",
    membership_plans: "Membership Plans",
    regulatory_norms: "Regulatory Norms",
    contact_us: "Contact Us",
    get_in_touch: "Get In Touch",
    about_us: "About Us",
    founder_profile: "Founder Profile",
    career: "Career",
    user_manual: "User Manual",
    user_guide: "User Guide",
    disclaimer: "Disclaimer",
    terms_conditions: "Terms & Condition",
    refund_cancellation: "Refund & Cancellation",
    privacy_policy: "Privacy & Policy",
    copyright: "Copyright © by Agriguru Online Trade Pvt Ltd"
  }

  const dict = {
    footer: {
      ...defaultFooter,
      ...rawDict?.footer
    },
    navigation: rawDict?.navigation || {}
  }

  return (
    <FooterClient dict={dict} activeLang={activeLang} footerData={footerData} />
  )
}

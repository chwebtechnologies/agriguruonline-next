import { getDictionary } from '@/app/[lang]/dictionaries'
import { lang } from 'next/root-params'
import FooterClient from './FooterClient'

export default async function Footer() {
  const activeLang = (await lang()) || 'en'
  const rawDict = await getDictionary()

  const defaultFooter = {
    tagline: "\"Your AgriTrade & Our AgriTech\"",
    download_today: "Download AgriGuru Online Today!",
    company_details: "Company Details",
    trade_services: "Trade Services",
    membership_plans: "Membership Plans",
    regulatory_norms: "Regulatory Norms",
    contact_us: "Contact Us",
    about_us: "About Us",
    founder_profile: "Founder Profile",
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

  return <FooterClient dict={dict} activeLang={activeLang} />
}

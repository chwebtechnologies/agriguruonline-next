import { getDictionary } from '@/app/[lang]/dictionaries'
import { lang } from 'next/root-params'
import AnnouncementBarClient from './AnnouncementBarClient'
import { Suspense } from 'react'
import { cmsService } from '@/lib/api';

export default async function AnnouncementBar() {
  const activeLang = (await lang()) || 'en'
  const rawDict = await getDictionary()

  const defaultHeader = {
    download_app: "Download Application",
    contact_us: "Contact Us",
  }

  const dict = {
    header: {
      ...defaultHeader,
      ...rawDict?.header,
    }
  }

  // Fetch announcements from dynamic CMS endpoint
  let announcements = await cmsService.getMarketingHeaders(activeLang);

  // Fallback to static values if API is down/empty to prevent layout breakage
  if (announcements.length === 0) {
    announcements = [
      {
        id: 'default-ann-1',
        title: "Your AgriTrade & Our AgriTech",
        label: "Download Now",
        link: "#download-section",
      }
    ]
  }

  return (
    <AnnouncementBarClient 
      announcements={announcements as any} 
      dict={dict} 
      activeLang={activeLang} 
    />
  )
}

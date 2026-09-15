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

  const mappedAnnouncements = announcements.map((ann: any) => ({
    id: ann.id,
    title: ann.title,
    label: ann.label,
    link: ann.link,
    translations: ann.translations ? ann.translations.map((t: any) => ({
      lang_code: t.lang_code,
      title: t.title,
      label: t.label
    })) : undefined
  }));

  return (
    <AnnouncementBarClient 
      announcements={mappedAnnouncements as any} 
      dict={dict} 
      activeLang={activeLang} 
    />
  )
}

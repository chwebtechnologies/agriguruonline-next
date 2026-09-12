import { getDictionary } from '@/app/[lang]/dictionaries'
import { lang } from 'next/root-params'
import AnnouncementBarClient from './AnnouncementBarClient'
import { Suspense } from 'react'
import { getCmsApiUrl } from '@/lib/api-utils';

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
  let announcements = []
  try {
    const cmsApiUrl = getCmsApiUrl();
    const res = await fetch(`${cmsApiUrl}/marketingheaders/?page=1&limit=25&is_active=1&source=web&lang_code=${activeLang}`, {
      next: { revalidate: 300 } // cache on edge server for 5 minutes
    })
    
    if (res.ok) {
      const json = await res.json()
      if (json.success === 1 && json.data?.marketing_headers) {
        announcements = json.data.marketing_headers.filter((item: { is_active?: boolean; type?: string; [key: string]: unknown }) => {
          if (!item.is_active) return false
          const type = (item.type || '').toUpperCase()
          // Only permit announcements with type 'WEB' or 'ALL'
          return type === 'WEB' || type === 'ALL'
        })
      }
    }
  } catch (err) {
    console.error('[AnnouncementBar API Exception] Fetching marketing headers failed:', err)
  }

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
    <Suspense fallback={null}>
      <AnnouncementBarClient 
        announcements={announcements} 
        dict={dict} 
        activeLang={activeLang} 
      />
    </Suspense>
  )
}

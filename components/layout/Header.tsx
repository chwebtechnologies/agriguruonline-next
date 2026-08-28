import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { HeaderGuest } from './HeaderGuest'
import { HeaderAuth } from './HeaderAuth'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { lang } from 'next/root-params'
import { getCategories } from '@/lib/category'
import { ForceLogout } from '@/components/auth/ForceLogout'
import { getUserApiUrl, getTradingApiUrl } from '@/lib/api-utils';
export default async function Header() {
  const activeLang = (await lang()) || 'en'
  const rawDict = await getDictionary()

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
    }
  }

  const tradingApiUrl = getTradingApiUrl()
  const categoriesApiUrl = `${tradingApiUrl.replace(/\/$/, '')}/category`

  const apiCategories = await getCategories(activeLang, {
    apiUrl: categoriesApiUrl,
    stale: 300,
    revalidate: 3600,
    expire: 86400
  })

  const categories = apiCategories
    .filter(cat => cat.is_active !== false)
    .map(cat => {
      const translation = cat.translations?.find(t => t.lang_code === activeLang)
      const name = translation ? translation.name : cat.name
      return {
        name,
        href: `/${activeLang}/category/${cat.slug}`
      }
    })

  let token: string | undefined = undefined
  let userProfile: any = null
  let shouldLogout = false

  try {
    const cookieStore = await cookies()
    token = cookieStore.get('auth_token')?.value
    if (token) {
      const userApiUrl = getUserApiUrl()
      const res = await fetch(`${userApiUrl}/user/my-profile?lang_code=${activeLang}&source=web`, {
        headers: { 'Authorization': `Bearer ${token}` },
        next: { revalidate: 300, tags: ['user-profile'] }
      })
      if (res.ok) {
        const profileJson = await res.json()
        userProfile = profileJson?.data || null
      } else if (res.status === 401 || res.status === 403) {
        shouldLogout = true
      }
    }
  } catch (e) {}

  if (shouldLogout) {
    return <ForceLogout lang={activeLang} />;
  }

  if (token) {
    return <HeaderAuth token={token} dict={dict} activeLang={activeLang} categories={categories} profile={userProfile} />
  }

  return <HeaderGuest dict={dict} activeLang={activeLang} categories={categories} />
}

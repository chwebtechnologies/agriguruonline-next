import { cookies } from 'next/headers'
import { HeaderGuest } from './HeaderGuest'
import { HeaderAuth } from './HeaderAuth'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { lang } from 'next/root-params'
import { getCategories } from '@/lib/category'
import { ForceLogout } from '@/components/auth/ForceLogout'
import { getAuthData } from '@/lib/user-data'

interface HeaderProps {
  dict?: any
  activeLang?: string
  categories?: Array<{ name: string; href: string }>
}

export default async function Header(props?: HeaderProps) {
  const activeLang = props?.activeLang || (await lang()) || 'en'

  let dict = props?.dict
  if (!dict) {
    const rawDict = await getDictionary()
    const defaultNav = {
      login: "Login",
      register: "Register",
      logout: "Log Out",
      dashboard: "Dashboard"
    }
    const defaultHead = {
      announcement: "Download Our Mobile App Now ! Click Here",
      download_app: "Download Application",
      contact_us: "Contact Us",
      search_placeholder: "Search Product",
      home: "Home",
      about_us: "About Us",
      register_here: "Register Here",
      menu: "Menu"
    }
    dict = {
      navigation: {
        ...defaultNav,
        ...rawDict?.navigation
      },
      header: {
        ...defaultHead,
        ...rawDict?.header,
        categories: { ...rawDict?.header?.categories }
      },
      common: rawDict?.common || {}
    }
  }

  let categories = props?.categories
  if (!categories) {
    const apiCategories = await getCategories(activeLang)
    categories = apiCategories
      .filter(cat => cat.is_active !== false)
      .map(cat => ({
        name: cat.name,
        href: `/${activeLang}/category/${cat.slug}`
      }))
  }

  let token: string | undefined = undefined
  try {
    const cookieStore = await cookies()
    token = cookieStore.get('auth_token')?.value
  } catch (_) {}

  if (!token) {
    return <HeaderGuest dict={dict} activeLang={activeLang} categories={categories} />
  }

  // getAuthData is deduplicated via React cache() — single fetch group per request
  const { userProfile, shouldLogout, alertsData, notificationsData, aiPredictsData } =
    await getAuthData(token, activeLang)

  if (shouldLogout) {
    return (
      <>
        <ForceLogout lang={activeLang} />
        <HeaderGuest dict={dict} activeLang={activeLang} categories={categories} />
      </>
    )
  }

  return (
    <HeaderAuth
      token={token}
      dict={dict}
      activeLang={activeLang}
      categories={categories}
      profile={userProfile}
      alerts={alertsData}
      notifications={notificationsData}
      aiPredicts={aiPredictsData}
    />
  )
}

import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { HeaderGuest } from './HeaderGuest'
import { HeaderAuth } from './HeaderAuth'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { lang } from 'next/root-params'
import { getCategories } from '@/lib/category'

export default async function Header() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  
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

  const defaultHeaderCategories = {    
    // rice: "Rice",
    // sugar: "Sugar",
    // grains: "Grains",
    // pulses: "Pulses",
    // spices: "Spices",
    // oil_seeds: "Oil Seeds",
    // feed_meal: "Feed Meal",
    // flours: "Flours",
    // edible_oil: "Edible Oil",
    // others: "Others"
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
        ...defaultHeaderCategories,
        ...rawDict?.header?.categories
      }
    }
  }

  // Read configurations outside the cached scope and pass them as serializable config parameter
  const tradingApiUrl = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://trading-api.agriguruonline.cloud'
  const categoriesApiUrl = `${tradingApiUrl.replace(/\/$/, '')}/category`
  const cacheStale = Number(process.env.CATEGORIES_CACHE_STALE) || 300
  const cacheRevalidate = Number(process.env.CATEGORIES_CACHE_REVALIDATE) || 3600
  const cacheExpire = Number(process.env.CATEGORIES_CACHE_EXPIRE) || 86400

  const apiCategories = await getCategories(activeLang, {
    apiUrl: categoriesApiUrl,
    stale: cacheStale,
    revalidate: cacheRevalidate,
    expire: cacheExpire
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

  let userProfile = null
  if (token) {
    try {
      const userApiUrl = process.env.USER_API_URL || process.env.NEXT_PUBLIC_USER_API_URL;
      if (!userApiUrl) throw new Error("Missing USER_API_URL in environment");
      const profileRes = await fetch(`${userApiUrl.replace(/\/$/, '')}/user/my-profile?lang_code=${activeLang}&source=web`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        next: { revalidate: 300 }
      })
      if (profileRes.ok) {
        const profileJson = await profileRes.json()
        userProfile = profileJson?.data || null
      }
    } catch (e) {
      console.error("Failed to fetch user profile in Header", e)
    }
  }

  if (!token) {
    return <HeaderGuest dict={dict} activeLang={activeLang} categories={categories} />
  }

  return (
    <Suspense fallback={<HeaderGuest dict={dict} activeLang={activeLang} loading categories={categories} />}>
      <HeaderAuth token={token} dict={dict} activeLang={activeLang} categories={categories} profile={userProfile} />
    </Suspense>
  )
}

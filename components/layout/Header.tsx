import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { HeaderGuest } from './HeaderGuest'
import { HeaderAuth } from './HeaderAuth'
import { getDictionary } from '@/app/[lang]/dictionaries'
import { lang } from 'next/root-params'
import { getCategories } from '@/lib/category'
import { ForceLogout } from '@/components/auth/ForceLogout'
import { getAuthData } from '@/lib/user-data'
import { tradingService } from '@/lib/api'
import { SearchProduct } from '@/types/search'

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

  // Fetch initial search products for SearchModal and HeaderSearch
  let initialSearchProducts: SearchProduct[] = []
  try {
    const searchRes = await tradingService.searchProducts({ isActive: true, lang: activeLang, limit: 50 });
    let productsArray: SearchProduct[] = []
    if (searchRes?.data?.products && Array.isArray(searchRes.data.products)) {
      productsArray = searchRes.data.products
    } else if (searchRes?.data && Array.isArray(searchRes.data)) {
      productsArray = searchRes.data
    } else if (Array.isArray(searchRes)) {
      productsArray = searchRes
    }
    const activeProducts = productsArray.filter((p: any) => p.is_active !== false)
    
    // Select only the items needed by the frontend search menus (max 12 total)
    const freq = activeProducts.filter((p: any) => p.frequently_search).slice(0, 4)
    const freqIds = new Set(freq.map((p: any) => p.id))
    const marketed = activeProducts.filter((p: any) => p.is_marketed && !freqIds.has(p.id)).slice(0, 4)
    const marketedIds = new Set(marketed.map((p: any) => p.id))
    const best = activeProducts.filter((p: any) => p.best_seller && !freqIds.has(p.id) && !marketedIds.has(p.id)).slice(0, 4)
    
    const selectedProducts = [...freq, ...marketed, ...best]

    initialSearchProducts = selectedProducts.map((p: any) => {
      const mapped: any = {
        id: p.id,
        name: p.name,
      }
      if (p.slug) mapped.slug = p.slug;
      if (p.product_code) mapped.product_code = p.product_code;
      if (p.image) mapped.image = p.image;
      if (p.thumbnail) mapped.thumbnail = p.thumbnail;
      if (p.frequently_search) mapped.frequently_search = true;
      if (p.is_marketed) mapped.is_marketed = true;
      if (p.best_seller) mapped.best_seller = true;
      if (p.country?.name) {
        mapped.country = { name: p.country.name };
        if (p.country.flag) mapped.country.flag = p.country.flag;
      }
      if (p.category?.name) mapped.category = { name: p.category.name };
      
      return mapped;
    })
  } catch (error) {
    console.error('Error fetching initial search products:', error)
  }

  let token: string | undefined = undefined
  try {
    const cookieStore = await cookies()
    token = cookieStore.get('auth_token')?.value
  } catch (_) {}

  if (!token) {
    return <HeaderGuest dict={dict} activeLang={activeLang} categories={categories} initialSearchProducts={initialSearchProducts} />
  }

  // getAuthData is deduplicated via React cache() — single fetch group per request
  const { userProfile, shouldLogout, alertsData, notificationsData, aiPredictsData } =
    await getAuthData(token, activeLang)

  if (shouldLogout) {
    return (
      <>
        <ForceLogout lang={activeLang} />
        <HeaderGuest dict={dict} activeLang={activeLang} categories={categories} initialSearchProducts={initialSearchProducts} />
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
      initialSearchProducts={initialSearchProducts}
    />
  )
}

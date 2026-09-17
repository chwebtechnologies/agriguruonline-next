'use client'
import { useEffect } from 'react'
import { logoutUser } from '@/app/actions/auth'

export function ForceLogout({ lang }: { lang: string }) {
  useEffect(() => {
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en'
    
    // Instantly destroy token locally to prevent authenticated UI flashes
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;'
    document.cookie = '__Secure-uid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;'
    localStorage.removeItem('auth_token')
    sessionStorage.clear()

    logoutUser().finally(() => {
      // Force hardware reload to login to guarantee no caching issues
      window.location.href = `/${safeLang}/login`
    })
  }, [lang])
  
  // Return null to avoid rendering a broken loader and ruining the layout
  return null
}

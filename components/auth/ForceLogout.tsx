'use client'
import { useEffect } from 'react'

export function ForceLogout({ lang }: { lang: string }) {
  useEffect(() => {
    const safeLang = /^[a-z]{2}$/.test(lang) ? lang : 'en'
    fetch(`/api/auth/logout?lang=${safeLang}`, { method: 'POST' })
      .then(() => {
        window.location.href = `/${safeLang}/login`
      })
      .catch(() => {
        window.location.href = `/${safeLang}/login`
      })
  }, [lang])
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        <p className="font-semibold text-sm animate-pulse">Logging out securely...</p>
      </div>
    </div>
  )
}

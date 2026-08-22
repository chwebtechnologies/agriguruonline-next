'use client'
import { useEffect } from 'react'

export function ForceLogout({ lang }: { lang: string }) {
  useEffect(() => {
    window.location.href = `/api/auth/logout?lang=${lang}`
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

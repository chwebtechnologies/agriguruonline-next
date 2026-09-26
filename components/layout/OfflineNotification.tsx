'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function OfflineNotification() {
  const [status, setStatus] = useState<'online' | 'offline' | 'restored'>('online')
  const router = useRouter()
  const timeoutRefs = useRef<NodeJS.Timeout[]>([])

  useEffect(() => {
    // Initial check
    if (!navigator.onLine) {
      setStatus('offline')
    }

    const clearTimeouts = () => {
      timeoutRefs.current.forEach(clearTimeout)
      timeoutRefs.current = []
    }

    const handleOnline = () => {
      clearTimeouts()
      setStatus('restored')
      
      // 1. Soft refresh to re-fetch missing server components/data
      router.refresh()
      
      // 2. Retry broken images that failed to load while offline
      const imgTimeout = setTimeout(() => {
        const images = document.querySelectorAll('img')
        images.forEach(img => {
          if (!img.complete || img.naturalWidth === 0) {
            const currentSrc = img.src
            // Clear and reassign to force the browser to re-evaluate the image load
            img.src = ''
            img.src = currentSrc
          }
        })
      }, 500)
      
      // 3. Hide the "Back Online" message after 3 seconds
      const hideTimeout = setTimeout(() => {
        setStatus('online')
      }, 3000)

      timeoutRefs.current = [imgTimeout, hideTimeout]
    }

    const handleOffline = () => {
      clearTimeouts()
      setStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      clearTimeouts()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [router])

  if (status === 'online') return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-8 duration-300">
      {status === 'offline' ? (
        <div className="bg-background border border-border shadow-2xl rounded-full px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
            <i className="fa-solid fa-wifi text-red-500 text-sm relative">
              <div className="absolute top-1/2 left-1/2 w-[120%] h-0.5 bg-red-500 -translate-x-1/2 -translate-y-1/2 -rotate-45" />
            </i>
          </div>
          <div className="flex flex-col">
            <span className="text-foreground font-semibold text-sm leading-tight">No Internet Connection</span>
            <span className="text-foreground/70 text-xs">You are currently offline.</span>
          </div>
        </div>
      ) : (
        <div className="bg-background border border-border shadow-2xl rounded-full px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <i className="fa-solid fa-wifi text-green-500 text-sm"></i>
          </div>
          <div className="flex flex-col">
            <span className="text-foreground font-semibold text-sm leading-tight">Back Online</span>
            <span className="text-foreground/70 text-xs">Connection restored. Refreshing content...</span>
          </div>
        </div>
      )}
    </div>
  )
}

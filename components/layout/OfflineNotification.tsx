'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function OfflineNotification() {
  const [status, setStatus] = useState<'online' | 'offline' | 'restored' | 'slow'>('online')
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
      
      // Broadcast app:online custom event to notify all client components to silently refetch
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:online'))
      }

      // 1. Soft refresh to re-fetch missing server components/data without full page reload
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

    const handleSlowConnection = () => {
      setStatus(prev => {
        if (prev === 'online') {
          const slowTimeout = setTimeout(() => {
            setStatus(current => (current === 'slow' ? 'online' : current))
          }, 4000)
          timeoutRefs.current.push(slowTimeout)
          return 'slow'
        }
        return prev
      })
    }

    const handleSlowResolved = () => {
      setStatus(prev => (prev === 'slow' ? 'online' : prev))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('app:slow-connection', handleSlowConnection)
    window.addEventListener('app:slow-connection-resolved', handleSlowResolved)

    return () => {
      clearTimeouts()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('app:slow-connection', handleSlowConnection)
      window.removeEventListener('app:slow-connection-resolved', handleSlowResolved)
    }
  }, [router])

  if (status === 'online') return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-8 duration-300 pointer-events-none">
      {status === 'offline' && (
        <div className="bg-background border border-border shadow-2xl rounded-full px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
            <i className="fa-solid fa-wifi text-red-500 text-sm relative">
              <span className="absolute top-1/2 left-1/2 w-[120%] h-0.5 bg-red-500 -translate-x-1/2 -translate-y-1/2 -rotate-45" />
            </i>
          </div>
          <div className="flex flex-col">
            <span className="text-foreground font-semibold text-sm leading-tight">No Internet Connection</span>
            <span className="text-foreground/70 text-xs">You are currently offline.</span>
          </div>
        </div>
      )}

      {status === 'restored' && (
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

      {status === 'slow' && (
        <div className="bg-background border border-amber-500/30 shadow-2xl rounded-full px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <i className="fa-solid fa-gauge-simple-high text-amber-600 dark:text-amber-400 text-sm"></i>
          </div>
          <div className="flex flex-col">
            <span className="text-foreground font-semibold text-sm leading-tight">Slow Network Detected</span>
            <span className="text-foreground/70 text-xs">Loading data, please wait...</span>
          </div>
        </div>
      )}
    </div>
  )
}

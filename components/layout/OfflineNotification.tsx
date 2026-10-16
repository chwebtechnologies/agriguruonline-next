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
    <div className="fixed bottom-[76px] lg:bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100vw-1.5rem)] sm:max-w-none w-max animate-in slide-in-from-bottom-8 duration-300 pointer-events-none">
      {status === 'offline' && (
        <div className="bg-red-950/95 text-white border-2 border-red-500/80 shadow-[0_10px_35px_rgba(239,68,68,0.4)] backdrop-blur-md rounded-full px-4 sm:px-5 py-2.5 sm:py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/25 border border-red-400/40 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-wifi text-red-300 text-sm relative">
              <span className="absolute top-1/2 left-1/2 w-[120%] h-0.5 bg-red-300 -translate-x-1/2 -translate-y-1/2 -rotate-45" />
            </i>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm leading-tight whitespace-nowrap tracking-wide">No Internet Connection</span>
            <span className="text-red-200/90 text-xs whitespace-nowrap">You are currently offline.</span>
          </div>
        </div>
      )}

      {status === 'restored' && (
        <div className="bg-emerald-950/95 text-white border-2 border-emerald-500/80 shadow-[0_10px_35px_rgba(16,185,129,0.4)] backdrop-blur-md rounded-full px-4 sm:px-5 py-2.5 sm:py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/25 border border-emerald-400/40 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-wifi text-emerald-300 text-sm"></i>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm leading-tight whitespace-nowrap tracking-wide">Back Online</span>
            <span className="text-emerald-200/90 text-xs whitespace-nowrap">Connection restored. Refreshing content...</span>
          </div>
        </div>
      )}

      {status === 'slow' && (
        <div className="bg-amber-950/95 text-white border-2 border-amber-500/80 shadow-[0_10px_35px_rgba(245,158,11,0.4)] backdrop-blur-md rounded-full px-4 sm:px-5 py-2.5 sm:py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/25 border border-amber-400/40 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-gauge-simple-high text-amber-300 text-sm"></i>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm leading-tight whitespace-nowrap tracking-wide">Slow Network Detected</span>
            <span className="text-amber-200/90 text-xs whitespace-nowrap">Loading data, please wait...</span>
          </div>
        </div>
      )}
    </div>
  )
}

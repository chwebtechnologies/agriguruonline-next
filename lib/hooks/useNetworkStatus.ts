'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface NetworkStatus {
  isOnline: boolean
  isSlowConnection: boolean
  effectiveType?: string
  saveData?: boolean
}

/**
 * Universal hook to monitor online/offline and network connection quality.
 * Supports smooth auto-recovery and slow network warning.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlowConnection: false,
    effectiveType: undefined,
    saveData: false,
  })

  useEffect(() => {
    const updateNetworkInfo = () => {
      const isOnline = navigator.onLine
      let isSlow = false
      let effectiveType: string | undefined
      let saveData = false

      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
      if (connection) {
        effectiveType = connection.effectiveType
        saveData = Boolean(connection.saveData)
        if (effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g') {
          isSlow = true
        }
      }

      setStatus({
        isOnline,
        isSlowConnection: isSlow,
        effectiveType,
        saveData,
      })
    }

    updateNetworkInfo()

    const handleOnline = () => updateNetworkInfo()
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    if (connection && connection.addEventListener) {
      connection.addEventListener('change', updateNetworkInfo)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (connection && connection.removeEventListener) {
        connection.removeEventListener('change', updateNetworkInfo)
      }
    }
  }, [])

  return status
}

/**
 * Hook to execute a callback when the application transitions back online.
 * Perfect for silent auto-refetching of charts, listings, and forms without page reload.
 */
export function useOnOnline(callback: () => void | Promise<void>) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    const handler = () => {
      try {
        savedCallback.current?.()
      } catch (err) {
        console.error('Error executing useOnOnline callback:', err)
      }
    }

    window.addEventListener('online', handler)
    window.addEventListener('app:online', handler)

    return () => {
      window.removeEventListener('online', handler)
      window.removeEventListener('app:online', handler)
    }
  }, [])
}

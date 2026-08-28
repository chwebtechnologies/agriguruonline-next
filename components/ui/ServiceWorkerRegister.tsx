'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            // Service worker successfully registered
          })
          .catch((err) => {
            // Silently handle if SW fails in unsupported environments
          })
      })
    }
  }, [])

  return null
}

'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        window.addEventListener('load', () => {
          navigator.serviceWorker
            .register('/sw.js')
            .then((reg) => {})
            .catch((err) => {})
        })
      } else {
        // UNREGISTER ROGUE SW IN DEVELOPMENT!
        // This permanently fixes the issue of broken designs on normal refreshes
        // caused by stale CSS being served from old service workers.
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for(let registration of registrations) {
            registration.unregister()
          }
        })
      }
    }
  }, [])

  return null
}

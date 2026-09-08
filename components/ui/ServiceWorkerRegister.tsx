'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then(() => {})
          .catch(() => {})
      })
    } else {
      // In development: Serwist's /sw.js is disabled, so only unregister
      // non-firebase SWs that may be stale from previous production builds.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          const swUrl =
            registration.active?.scriptURL ||
            registration.installing?.scriptURL ||
            registration.waiting?.scriptURL ||
            '';
          // Keep firebase SW (any scope), remove everything else
          if (!swUrl.includes('firebase-messaging-sw')) {
            registration.unregister();
          }
        }
      });
    }
  }, [])

  return null
}

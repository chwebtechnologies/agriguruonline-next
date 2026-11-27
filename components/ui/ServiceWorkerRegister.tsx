'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      const registerSw = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            // Proactively check for updates when the tab becomes active again
            const handleVisibilityChange = () => {
              if (document.visibilityState === 'visible') {
                registration.update().catch(() => {});
              }
            };
            document.addEventListener('visibilitychange', handleVisibilityChange);
          })
          .catch(() => {});
      };

      if (document.readyState === 'complete') {
        registerSw();
      } else {
        window.addEventListener('load', registerSw, { once: true });
      }
    } else {
      // In development: Serwist's /sw.js is disabled, so safely unregister
      // any non-firebase SWs that may be stale from previous production builds.
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
  }, []);

  return null;
}


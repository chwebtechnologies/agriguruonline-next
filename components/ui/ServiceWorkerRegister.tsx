'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      const isInitialController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;

      // When a new service worker takes over (after a new build is deployed),
      // reload the page once so the user immediately gets the latest UI without manual cache clear.
      const handleControllerChange = () => {
        if (!isInitialController) {
          // Initial SW activation on first visit — do not reload
          return;
        }
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      const registerSw = () => {
        navigator.serviceWorker
          .register('/sw.js', { updateViaCache: 'none' })
          .then((registration) => {
            registration.update().catch(() => {});

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

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
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
  }, []);

  return null;
}

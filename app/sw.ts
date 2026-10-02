/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  StaleWhileRevalidate,
  CacheFirst,
  ExpirationPlugin,
  CacheableResponsePlugin,
} from "serwist";

// This allows TypeScript to recognize the injected manifest variable
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Import Firebase Messaging into the main worker for full background push coverage in production
try {
  self.importScripts('/firebase-messaging-sw.js');
} catch (e) {
  // Ignored if file is loaded separately
}

const serwist = new Serwist({
  precacheEntries: [
    ...(self.__SW_MANIFEST || []),
    { url: "/~offline", revision: "offline-fallback-v1" }
  ],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
  runtimeCaching: [
    // 1. Aggressively cache all images (Next.js image proxy, CDN assets, local icons/images)
    // CacheFirst serves from browser storage instantly (0ms), eliminating network latency and blinking
    {
      matcher: ({ request, url }) => {
        return (
          request.destination === "image" ||
          url.pathname.startsWith("/_next/image") ||
          url.hostname === "assets.agriguruonline.com" ||
          url.hostname === "assets.agriguruonline.cloud" ||
          /\.(?:png|jpg|jpeg|svg|webp|gif|avif|ico)$/i.test(url.pathname)
        );
      },
      handler: new CacheFirst({
        cacheName: "agriguru-images-v1",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            purgeOnQuotaError: true,
          }),
          new CacheableResponsePlugin({
            statuses: [0, 200],
          }),
        ],
      }),
    },
    // 2. Next.js RSC payloads (the data fetched during client-side navigation)
    // StaleWhileRevalidate will serve the page INSTANTLY from cache, then update in background.
    {
      matcher: ({ url }) => url.searchParams.has('_rsc'),
      handler: new StaleWhileRevalidate({
        cacheName: 'rsc-payloads',
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              if (response && response.status === 200) {
                return response;
              }
              return null;
            },
          },
        ],
      }),
    },
    // 3. Page navigations
    {
      matcher: ({ request }) => request.mode === 'navigate',
      handler: new StaleWhileRevalidate({
        cacheName: 'pages',
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              if (response && response.status === 200) {
                return response;
              }
              return null;
            },
          },
        ],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

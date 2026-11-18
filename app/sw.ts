/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  StaleWhileRevalidate,
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
  ExpirationPlugin,
  CacheableResponsePlugin,
} from "serwist";

const PRIVATE_DYNAMIC_PATH_PREFIXES = [
  "/smart-docs",
  "/profile",
  "/dashboard",
  "/my-inquiries",
  "/my-offers",
  "/my-settings",
  "/alerts-setups",
  "/become-member",
  "/login",
  "/register",
];

function isPrivateDynamicPath(pathname: string): boolean {
  return PRIVATE_DYNAMIC_PATH_PREFIXES.some((prefix) => pathname.includes(prefix));
}

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
  navigationPreload: false,
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
    // 0. Private / dynamic authenticated workspaces (Smart Docs, Profile, Dashboard, etc.)
    // MUST explicitly use NetworkOnly BEFORE defaultCache so they NEVER fall through to defaultCache's
    // "others" or "pages-rsc" caches (which caused stale HTML referencing old CSS hashes on normal refresh).
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && isPrivateDynamicPath(url.pathname),
      handler: new NetworkOnly(),
    },
    // 0b. Next.js static CSS & JS assets and local stylesheets: ONLY cache 200 OK responses so a 404/500 never poisons styles.
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin &&
        (
          (url.pathname.startsWith("/_next/static/") && /\.(?:css|js)$/i.test(url.pathname)) ||
          url.pathname === "/fa-all.min.css"
        ),
      handler: new CacheFirst({
        cacheName: "next-static-assets-v2",
        plugins: [
          new CacheableResponsePlugin({
            statuses: [200],
          }),
          new ExpirationPlugin({
            maxEntries: 120,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 1. Smoothly cache all images (Next.js image proxy, CDN assets, local icons/images)
    // StaleWhileRevalidate serves cached images instantly while safely revalidating in background.
    // Crucially: ONLY status 200 is cached (status 0 opaque/aborted requests during fast scrolling are never poisoned into cache)
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
      handler: new StaleWhileRevalidate({
        cacheName: "agriguru-images-v3",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 1000,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            purgeOnQuotaError: true,
          }),
          new CacheableResponsePlugin({
            statuses: [200],
          }),
        ],
      }),
    },
    // 2. Next.js RSC payloads (public pages only)
    // NetworkFirst guarantees fresh chunk hashes from server when online, falling back to cache if offline
    {
      matcher: ({ url }) => {
        if (!url.searchParams.has('_rsc')) return false;
        if (isPrivateDynamicPath(url.pathname)) return false;
        return true;
      },
      handler: new NetworkFirst({
        cacheName: 'rsc-payloads-v2',
        networkTimeoutSeconds: 3,
        plugins: [
          new CacheableResponsePlugin({
            statuses: [200],
          }),
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 1 day
          }),
        ],
      }),
    },
    // 3. Page navigations (public pages only)
    // NetworkFirst guarantees the latest HTML referencing valid chunks is fetched online, avoiding 404 chunk errors
    {
      matcher: ({ request, url }) => {
        if (request.mode !== 'navigate') return false;
        if (isPrivateDynamicPath(url.pathname)) return false;
        return true;
      },
      handler: new NetworkFirst({
        cacheName: 'pages-v2',
        networkTimeoutSeconds: 3,
        plugins: [
          new CacheableResponsePlugin({
            statuses: [200],
          }),
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
});

// Purge stale legacy caches on SW activation so previously cached smart-docs HTML or old CSS chunks are wiped automatically
self.addEventListener("activate", (event) => {
  const legacyCachesToDelete = [
    "others",
    "pages",
    "pages-rsc",
    "pages-rsc-prefetch",
    "rsc-payloads",
    "static-style-assets",
    "agriguru-images-v1",
    "agriguru-images-v2",
  ];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => legacyCachesToDelete.includes(name))
          .map((name) => caches.delete(name))
      )
    )
  );
});

serwist.addEventListeners();

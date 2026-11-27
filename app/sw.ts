/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  CacheFirst,
  NetworkOnly,
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

// Import Firebase Messaging into the main worker for background push coverage
try {
  self.importScripts('/firebase-messaging-sw.js');
} catch (e) {
  // Ignored if file is loaded separately
}

const serwist = new Serwist({
  precacheEntries: [
    ...(self.__SW_MANIFEST || []),
    { url: "/~offline", revision: "offline-fallback-v3" }
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
    // 1. Next.js RSC requests (header RSC: 1, Next-Router-Prefetch: 1, ?_rsc=...) MUST ALWAYS be NetworkOnly!
    // Next.js App Router relies on chunked streaming flight payloads.
    // Caching RSC in ServiceWorker breaks streaming, causes skeletons to freeze indefinitely,
    // and produces 404 chunk mismatches across deployments.
    {
      matcher: ({ request, url }) => {
        return (
          request.headers.get("RSC") === "1" ||
          request.headers.get("Next-Router-Prefetch") === "1" ||
          request.headers.get("Next-Router-State-Tree") !== null ||
          url.searchParams.has("_rsc")
        );
      },
      handler: new NetworkOnly(),
    },
    // 2. All Page Navigations (request.mode === 'navigate') MUST be NetworkOnly!
    // Live pages must always stream fresh HTML from the server.
    // If the network is offline or fails, Serwist's `fallbacks` automatically serves /~offline.
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
    // 3. All API routes and dynamic backend microservices MUST be NetworkOnly!
    {
      matcher: ({ url }) => {
        return (
          url.pathname.startsWith("/api/") ||
          url.hostname.includes("agriguruonline.cloud") ||
          url.hostname.includes("api")
        );
      },
      handler: new NetworkOnly(),
    },
    // 4. Cross-origin requests (CDNs, YouTube, external images, third parties) MUST be NetworkOnly!
    // Never intercept cross-origin CDN images (assets.agriguruonline.com, images.unsplash.com, etc.).
    // The browser's native HTTP cache handles cross-origin images far more reliably without ERR_FAILED or opaque aborts.
    {
      matcher: ({ sameOrigin }) => !sameOrigin,
      handler: new NetworkOnly(),
    },
    // 5. Next.js static content-hashed CSS and JS bundles, and static webfonts:
    // Safe to cache with CacheFirst because they have immutable content hashes.
    // Only cache status 200 OK responses.
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin &&
        (
          (url.pathname.startsWith("/_next/static/") && /\.(?:css|js)$/i.test(url.pathname)) ||
          url.pathname === "/fa-all.min.css" ||
          url.pathname.startsWith("/webfonts/")
        ),
      handler: new CacheFirst({
        cacheName: "agriguru-static-assets-v4",
        plugins: [
          new CacheableResponsePlugin({
            statuses: [200],
          }),
          new ExpirationPlugin({
            maxEntries: 150,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 6. Local same-origin static icons/images (/logo.png, /favicon.ico, /manifest.json)
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin &&
        /\.(?:png|jpg|jpeg|svg|webp|gif|avif|ico)$/i.test(url.pathname),
      handler: new CacheFirst({
        cacheName: "agriguru-local-icons-v4",
        plugins: [
          new CacheableResponsePlugin({
            statuses: [200],
          }),
          new ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 14 * 24 * 60 * 60, // 14 days
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },
    // 7. Everything else: fallback to NetworkOnly (safe, no poisoned caches)
    {
      matcher: /.*/i,
      handler: new NetworkOnly(),
    },
  ],
});

// Purge ALL stale legacy caches on SW activation so corrupted RSC, old pages, and failed image caches are immediately wiped
self.addEventListener("activate", (event) => {
  const currentCaches = ["agriguru-static-assets-v4", "agriguru-local-icons-v4", "serwist-precache-v2"];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name) || name.includes("v1") || name.includes("v2") || name.includes("v3"))
          .map((name) => caches.delete(name))
      )
    )
  );
});

serwist.addEventListeners();

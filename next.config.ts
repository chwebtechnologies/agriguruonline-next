import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import path from "path";

// Suppress Serwist warning about Turbopack not being supported
process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  // cacheComponents: true,     // REMOVED: caches RSC payloads in memory but skips CSS chunk re-injection on navigation
  // partialPrefetching: true,  // REMOVED: lazily loads CSS chunks causing FOUC (Flash of Unstyled Content) on first visit
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // optimizeCss: true,  // DISABLED: critters defers page-unique CSS (IPhoneFrame, gradients) — never re-injected on client-nav
    staleTimes: {
      dynamic: 300,  // 5 minutes for dynamic pages (prevents RSC refetch on GPRS)
      static: 3600,  // 1 hour for fully static routes
    },
    optimizePackageImports: [
      '@fortawesome/fontawesome-free',
      'recharts',
      'libphonenumber-js',
      'sonner',
      'yet-another-react-lightbox',
      'date-fns',
    ],
  },
  turbopack: {
    root: __dirname,
  },
  // Allow mobile devices on local network & cloudflare tunnels to access dev server HMR in development
  allowedDevOrigins: [
    '*.trycloudflare.com',
    '*.ngrok-free.app',
    '*.ngrok.io',
    '*.loca.lt',
    'localhost:*',
    '127.0.0.1:*',
    '192.168.*.*',
    '10.*.*.*',
  ],
  async headers() {
    const cspHeader = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com https://unpkg.com https://www.google.com/recaptcha/ https://www.gstatic.com https://accounts.google.com https://ssl.gstatic.com https://appleid.cdn-apple.com https://checkout.razorpay.com https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com https://*.paypalobjects.com https://paypalobjects.com",
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://accounts.google.com",
      "img-src 'self' data: blob: https://assets.agriguruonline.com https://assets.agriguruonline.cloud https://agriguruonline.com https://images.unsplash.com https://www.transparenttextures.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://img.youtube.com https://i.ytimg.com https://lh3.googleusercontent.com https://appleid.cdn-apple.com https://www.paypalobjects.com https://*.paypal.com",
      "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com",
      "connect-src 'self' https://trading-api.agriguruonline.cloud https://cms-api.agriguruonline.cloud https://user-api.agriguruonline.cloud https://assets.agriguruonline.com https://assets.agriguruonline.cloud https://agriguruonline.com https://images.unsplash.com ws: wss: https://unpkg.com https://get.geojs.io https://api.country.is https://*.googleapis.com https://*.firebaseio.com https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com https://*.firebase.com https://firebase.googleapis.com https://accounts.google.com https://appleid.apple.com https://api.razorpay.com https://lumberjack.razorpay.com https://lumberjack-cx.razorpay.com https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com https://*.paypalobjects.com",
      "media-src 'self' data: blob: https://assets.agriguruonline.com https://assets.agriguruonline.cloud",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "frame-src 'self' https://www.youtube.com https://youtube.com https://www.google.com/recaptcha/ https://accounts.google.com https://appleid.apple.com https://api.razorpay.com https://checkout.razorpay.com https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com https://*.paypalobjects.com",
      // "require-trusted-types-for 'script'",
      // "trusted-types default nextjs nextjs#bundler 'allow-duplicates'",
      // Note: upgrade-insecure-requests intentionally omitted.
      // HTTPS is enforced via Strict-Transport-Security (HSTS) header in production.
      // Including this directive breaks mobile/LAN HTTP testing environments.
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          }
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
          },
        ],
      },
      {
        source: '/:lang/profile/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
          },
        ],
      },
      {
        source: '/:lang/profile',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow',
          },
        ],
      },
      {
        source: '/(.*).(webp|jpg|png|svg|ico|woff2|woff|ttf|css|js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/:lang/about',
        destination: '/:lang/about-us',
        permanent: true,
      },
      {
        source: '/about',
        destination: '/en/about-us',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    const tradingUrl = process.env.NEXT_PUBLIC_TRADING_API_URL || process.env.TRADING_API_URL || '';
    const cmsUrl = process.env.NEXT_PUBLIC_CMS_API_URL || process.env.CMS_API_URL || '';
    const userUrl = process.env.NEXT_PUBLIC_USER_API_URL || process.env.USER_API_URL || '';

    return [
      {
        source: '/api/proxy-trading/:path*',
        destination: `${tradingUrl.replace(/\/$/, '')}/:path*`,
      },
      {
        source: '/api/proxy-cms/:path*',
        destination: `${cmsUrl.replace(/\/$/, '')}/:path*`,
      },
      {
        source: '/api/proxy-user/:path*',
        destination: `${userUrl.replace(/\/$/, '')}/:path*`,
      }
    ]
  },
  images: {
    minimumCacheTTL: 31536000,
    formats: ['image/avif', 'image/webp'],
    qualities: [65, 75, 85, 90],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [32, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.agriguruonline.com',
      },
      {
        protocol: 'https',
        hostname: 'assets.agriguruonline.cloud',
      },
      {
        protocol: 'https',
        hostname: 'agriguruonline.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
  },
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production", // Disabled in dev due to Turbopack, enabled in prod for caching
  reloadOnOnline: true,
});

export default withSerwist(nextConfig);

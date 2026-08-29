import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizeCss: true,
    staleTimes: {
      dynamic: 300, // 5 minutes in-memory client router cache for dynamic routes
      static: 1800, // 30 minutes in-memory client router cache for static routes
    },
    optimizePackageImports: [
      '@fortawesome/fontawesome-free',
      'recharts',
      'libphonenumber-js',
      'sonner',
      'yet-another-react-lightbox',
    ],
  },
  turbopack: {},
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://assets.agriguruonline.com https://assets.agriguruonline.cloud https://agriguruonline.com https://images.unsplash.com https://www.transparenttextures.com",
      "font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com",
      "connect-src 'self' https://trading-api.agriguruonline.cloud https://cms-api.agriguruonline.cloud https://user-api.agriguruonline.cloud https://assets.agriguruonline.com https://assets.agriguruonline.cloud https://agriguruonline.com https://images.unsplash.com ws: wss:",
      "media-src 'self' data: blob: https://assets.agriguruonline.com https://assets.agriguruonline.cloud",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "require-trusted-types-for 'script'",
      "trusted-types default nextjs nextjs#bundler 'allow-duplicates'",
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
            key: 'X-XSS-Protection',
            value: '1; mode=block',
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
    ];
  },
  images: {
    minimumCacheTTL: 31536000,
    formats: ['image/avif', 'image/webp'],
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
    ],
  },
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

export default withSerwist(nextConfig);

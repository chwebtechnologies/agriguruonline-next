import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
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
    return [
      {
        source: '/(.*)',
        headers: [
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
        source: '/api/(.*)',
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
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // We use native <img> tags pointing directly to the Cloudflare CDN (assets.agriguruonline.com)
    // which already serves WebP and is cached at the edge. The Next.js image proxy is bypassed.
    unoptimized: true,
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
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Allow mobile devices on local network to access dev server only in development
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: [
      '192.168.29.*',
      '192.168.1.2',
      '192.168.1.*',
      '192.168.0.*',
      '10.0.0.*',
      '10.0.1.*',
    ],
  }),
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
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.agriguruonline.com',
      },
      {
        protocol: 'https',
        hostname: 'assets.agriguruonline.cloud',
      },
    ],
  },
};

export default nextConfig;

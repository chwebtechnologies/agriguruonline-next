import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Allow mobile devices on local network to access dev server
  allowedDevOrigins: [
    '192.168.1.2',
    '192.168.1.*',
    '192.168.0.*',
    '10.0.0.*',
    '10.0.1.*',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.agriguruonline.com',
      },
    ],
  },
};

export default nextConfig;

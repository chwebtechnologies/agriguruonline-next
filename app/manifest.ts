import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AgriGuru Online',
    short_name: 'AgriGuru',
    description: 'The premium B2B SaaS platform for global agricultural trade.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#08657e',
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZJ Card - 奇蹟卡',
    short_name: 'ZJ Card',
    description: '專屬於您的奇蹟卡管家',
    start_url: '/',
    display: 'standalone',
    background_color: '#F9FAFB',
    theme_color: '#34DA4F',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Battuta — Your Travel AI Agent',
        short_name: 'Battuta',
        description:
          "AI-powered trip planning and cultural discovery — get notified when you're near significant cultural sites.",
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#6155cc',
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // App data (Supabase/AI/Wikimedia proxies) must always be fresh — never serve stale trip/site data from cache.
            urlPattern: /\/\.netlify\/functions\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/\{?s\}?\.?tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})

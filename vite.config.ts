/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Modes:
//   default      → normal PWA build (installable, offline) in dist/
//   `--mode single` → everything inlined into one HTML file in dist-single/,
//                    used for phone preview links (no service worker).
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    // Relative paths, so the build works from any folder (e.g. GitHub Pages /repo-name/).
    base: './',
    plugins: [
      react(),
      single
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'Poker Practice Trainer',
              short_name: 'Poker Trainer',
              description: 'Practice 9-max preflop decisions by position and cards.',
              theme_color: '#0e1311',
              background_color: '#0e1311',
              display: 'standalone',
              orientation: 'portrait',
              start_url: './',
              scope: './',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png}'],
              // Cache Google Fonts so the app looks right offline after the first visit.
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
                  handler: 'StaleWhileRevalidate',
                  options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
                },
              ],
            },
          }),
    ],
    build: single ? { outDir: 'dist-single' } : undefined,
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  }
})

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
    plugins: [
      react(),
      single
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg'],
            manifest: {
              name: 'Poker Practice Trainer',
              short_name: 'Poker Trainer',
              description: 'Practice 9-max preflop decisions by position and cards.',
              theme_color: '#0f5132',
              background_color: '#0b1d14',
              display: 'standalone',
              orientation: 'portrait',
              icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
            },
          }),
    ],
    build: single ? { outDir: 'dist-single' } : undefined,
    test: {
      include: ['src/**/*.test.ts'],
    },
  }
})

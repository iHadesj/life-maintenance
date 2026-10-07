import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const INK = '#1a1b23';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
/** Deploying under a sub-path (e.g. GitHub Pages)? Build with LM_BASE=/repo-name/ */
const BASE = process.env.LM_BASE ?? '/';

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png', 'splash/*.png'],
      manifest: {
        id: BASE,
        name: 'Life Maintenance',
        short_name: 'Life/Maint',
        description: 'A preventive maintenance system for everything in your life. Works offline.',
        lang: 'en',
        dir: 'ltr',
        start_url: `${BASE}#/`,
        scope: BASE,
        display: 'standalone',
        display_override: ['standalone'],
        orientation: 'portrait',
        background_color: INK,
        theme_color: INK,
        categories: ['productivity', 'lifestyle', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Maintenance queue', short_name: 'Queue', url: `${BASE}#/queue` },
          { name: 'Maintenance log', short_name: 'Log', url: `${BASE}#/log` },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Only latin subsets ship offline; other scripts fall back to system fonts.
        globIgnores: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});

import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/dict/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // vlastní public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        // slovníková data jdou do IndexedDB, ne do SW cache
        globIgnores: ['data/**'],
        navigateFallback: '/dict/index.html',
      },
    }),
  ],
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// CodeOR build config.
// - No external runtime assets: fonts are a system stack, audio is synthesized (Web Audio API),
//   icons are generated PNGs served from /icons. Everything is precached by Workbox for offline use.
//
// `base` is configurable so the same source deploys to a GitHub Pages *project* site
// (https://<user>.github.io/<repo>/) without breaking asset paths or the PWA scope.
// Local dev defaults to '/' ; CI sets VITE_BASE=/<repo>/.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/*.png', 'favicon.svg'],
      manifest: {
        name: 'CodeOR — Crisis & Resuscitation Engine',
        short_name: 'CodeOR',
        description:
          'Operating-room cardiac arrest, perioperative crisis, and ACLS event logging. PHI-free and offline-first.',
        theme_color: '#070a11',
        background_color: '#070a11',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen'],
        orientation: 'any',
        start_url: base,
        scope: base,
        categories: ['medical', 'productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});

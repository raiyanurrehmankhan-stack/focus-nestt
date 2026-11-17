import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const splashSizes = JSON.parse(readFileSync(new URL('./scripts/splash-sizes.json', import.meta.url), 'utf8'));

/** Adds iOS splash-screen <link> tags generated from scripts/splash-sizes.json. */
const iosSplashLinks = () => ({
  name: 'focusnest-ios-splash',
  transformIndexHtml(html) {
    const links = splashSizes
      .map(([w, h, r]) => `<link rel="apple-touch-startup-image" media="screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="/splash/splash-${w * r}x${h * r}.jpg" />`)
      .join('\n    ');
    return html.replace('<!-- %SPLASH_LINKS% -->', links);
  },
});

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  plugins: [
    react(),
    iosSplashLinks(),
    VitePWA({
      // Our own service worker (src/sw.js) so we can handle Web Push and
      // notification clicks; Workbox injects the precache manifest into it.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt', // show "Update available" instead of reloading under the user
      injectRegister: false, // registered from src/services/pwa.js
      includeAssets: ['favicon.ico', 'icons/apple-touch-icon.png', 'brand/*.png', 'sounds/alarm.wav', 'demo/feed.jpg', 'offline.html'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,wav,woff2,webmanifest}'],
        globIgnores: ['splash/**', 'screenshots/**', 'icons/icon-{48,72,96,128,144,152,256,384}.png'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        id: '/',
        name: 'FocusNest — Digital Wellbeing',
        short_name: 'FocusNest',
        description: 'Track it. Control it. Replace it. Focus timers, gentle break alarms, bedtime routines and offline activities.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        theme_color: '#2A9D8F',
        background_color: '#F5F8FA',
        categories: ['health', 'productivity', 'lifestyle'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Start focus session', short_name: 'Focus', url: '/focus?start=focus&source=shortcut', icons: [{ src: '/icons/shortcut-focus.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Take a break', short_name: 'Break', url: '/focus?start=break&source=shortcut', icons: [{ src: '/icons/shortcut-break.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Daily check-in', short_name: 'Check-in', url: '/check-in?source=shortcut', icons: [{ src: '/icons/shortcut-checkin.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Bedtime mode', short_name: 'Sleep', url: '/sleep?source=shortcut', icons: [{ src: '/icons/shortcut-sleep.png', sizes: '96x96', type: 'image/png' }] },
        ],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  server: { port: 5173 },
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 900 },
});

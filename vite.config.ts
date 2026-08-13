import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // The injectManifest dev worker is not evaluated reliably by Vite's
      // dev server; use the generated worker in production instead.
      devOptions: {
        enabled: false,
      },
      manifest: false,
      workbox: {
        navigateFallback: '/index.html',
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true,
  },
});

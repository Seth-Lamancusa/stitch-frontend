import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@buttons': fileURLToPath(new URL('./src/components/buttons', import.meta.url))
    },
  },
  base: '/',
  server: {
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8081',
        ws: true,
        changeOrigin: true
      },
      '/api': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true
      },
      '/metrics': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true
      }
    },
    hmr: { overlay: true },
    logger: {
      level: 'info'
    }
  }
})

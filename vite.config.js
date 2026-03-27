import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxy /wc-api/* -> https://naturesjoystore.com/*
      // This avoids CORS errors when calling WooCommerce REST API in dev
      '/wc-api': {
        target: 'https://naturesjoystore.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/wc-api/, '')
      }
    }
  }
})

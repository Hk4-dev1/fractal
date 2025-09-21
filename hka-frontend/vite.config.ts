import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  // Use relative base so assets load correctly under /fractal/ on GitHub Pages
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
          motion: ['framer-motion'],
          charts: ['recharts'],
          forms: ['react-hook-form', 'zod'],
          web3: ['ethers', 'wagmi', 'viem'],
          notifications: ['sonner']
        }
      }
    }
  }
})
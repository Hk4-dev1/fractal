import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  // Use relative base so assets load correctly under /fractal/ on GitHub Pages
  base: './',
  plugins: [
    react(),
    // Enable bundle visualizer only when explicitly requested (ANALYZE=1)
    ...(process.env.ANALYZE === '1' ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, template: 'treemap' })] : [])
  ],
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
          // Split large web3 stack so browsers can cache selectively
          web3_wagmi: ['wagmi'],
          web3_viem: ['viem'],
          notifications: ['sonner']
        }
      }
    }
  }
})
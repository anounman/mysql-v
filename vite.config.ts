import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // No proxy needed — SQL runs in the browser via sql.js WASM
  server: { port: 5174 },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          sqljs: ['sql.js'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  assetsInclude: ['**/*.wasm'],
})


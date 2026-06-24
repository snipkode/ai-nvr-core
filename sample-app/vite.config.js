import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/stream': { target: 'https://localhost:4000', secure: false },
      '/ws':     { target: 'wss://localhost:4000',  secure: false, ws: true },
    }
  },
  build: { outDir: 'dist' }
})

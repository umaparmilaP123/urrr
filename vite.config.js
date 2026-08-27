import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      // In dev, forward /api/* to the Express backend so:
      //  • No CORS headers needed on the client
      //  • Session cookies are same-origin from the browser's perspective
      //  • VITE_API_BASE_URL can be left empty in .env
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function bypassHtmlNav(req) {
  if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
    return req.url
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/upload': {
        target: 'https://lumiere-backend-xscg.onrender.com',
        changeOrigin: true,
        bypass: bypassHtmlNav
      },
      '/train': {
        target: 'https://lumiere-backend-xscg.onrender.com',
        changeOrigin: true,
        bypass: bypassHtmlNav
      },
      '/export': {
        target: 'https://lumiere-backend-xscg.onrender.com',
        changeOrigin: true,
        bypass: bypassHtmlNav
      },
      '/process-batch': 'https://lumiere-backend-xscg.onrender.com',
      '/presets': 'https://lumiere-backend-xscg.onrender.com',
      '/photos': 'https://lumiere-backend-xscg.onrender.com',
      '/styles': 'https://lumiere-backend-xscg.onrender.com',
      '/thumbnails': 'https://lumiere-backend-xscg.onrender.com',
      '/uploads': 'https://lumiere-backend-xscg.onrender.com',
      '/health': 'https://lumiere-backend-xscg.onrender.com',
      '/workspace': 'https://lumiere-backend-xscg.onrender.com',
    },
  },
})
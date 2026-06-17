import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Bypass proxy for browser HTML navigation so React Router handles these routes.
// Without this, GET /upload (page refresh) would be proxied to FastAPI which
// only has POST /upload, causing a 405. The bypass returns the request URL
// unchanged, telling Vite to serve index.html (SPA fallback) instead.
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
      '/upload':        { target: 'http://localhost:8000', changeOrigin: true, bypass: bypassHtmlNav },
      '/train':         { target: 'http://localhost:8000', changeOrigin: true, bypass: bypassHtmlNav },
      '/export':        { target: 'http://localhost:8000', changeOrigin: true, bypass: bypassHtmlNav },
      '/process-batch': 'http://localhost:8000',
      '/presets':       'http://localhost:8000',
      '/photos':        'http://localhost:8000',
      '/styles':        'http://localhost:8000',
      '/thumbnails':    'http://localhost:8000',
      '/uploads':       'http://localhost:8000',
      '/health':        'http://localhost:8000',
      '/workspace':     'http://localhost:8000',
    },
  },
})

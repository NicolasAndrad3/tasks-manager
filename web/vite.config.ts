// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')   // lê VITE_* do .env
  const useProxy = !env.VITE_API       // se tiver VITE_API, não proxia
  const target = env.VITE_PROXY_TARGET || 'http://localhost:5043' // <-- CORRETO

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: useProxy
        ? {
            '/api': {
              target,
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
    },
  }
})

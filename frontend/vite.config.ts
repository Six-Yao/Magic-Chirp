import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, '..', '')
  const devMode = rootEnv.DEV_MODE?.toLowerCase() === 'true'
  const devApiTarget = rootEnv.DEV_API_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: devMode
      ? {
          proxy: {
            '/api': {
              target: devApiTarget,
              changeOrigin: true,
            },
            '/uploads': {
              target: devApiTarget,
              changeOrigin: true,
            },
          },
        }
      : undefined,
  }
})

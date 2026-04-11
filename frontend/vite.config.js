import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, 'config.env') })

export default defineConfig(() => {
  const apiUrl = process.env.VITE_API_URL || 'http://localhost:3000/api/v1'
  const parsedApiUrl = new URL(apiUrl)
  const apiTarget = `${parsedApiUrl.protocol}//${parsedApiUrl.host}`
  const apiBasePath = parsedApiUrl.pathname.replace(/\/$/, '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (pathValue) => pathValue.replace(/^\/api/, apiBasePath),
        },
      },
    },
  }
})

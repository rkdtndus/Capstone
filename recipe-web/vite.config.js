import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, 'API_PROXY_')
  const proxy = { '/api': env.API_PROXY_TARGET || 'http://127.0.0.1:3001' }

  return {
    plugins: [react()],
    server: {
      host: true,
      strictPort: true,
      proxy,
      fs: {
        deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.data/**'],
      },
    },
    preview: { host: true, proxy },
  }
})

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function localApiDevPlugin(): Plugin {
  return {
    name: 'local-api-dev-plugin',
    configureServer(server) {
      server.middlewares.use('/api/create-user', (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
          res.end()
          return
        }
        if (req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            success: true,
            ukey: 'GMS-DEV',
            tempPassword: 'temp-dev-password-123',
          }))
          return
        }
        res.statusCode = 405
        res.end()
      })

      server.middlewares.use('/api/recover-umail', (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
          res.end()
          return
        }
        if (req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            success: true,
            message: 'If an active account is associated with that contact email, a password recovery link has been sent.',
          }))
          return
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localApiDevPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
})

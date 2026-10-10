import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import { onRequest as onCreateUserRequest } from './functions/api/create-user.ts'
import { onRequest as onRecoverUmailRequest } from './functions/api/recover-umail.ts'
import { onRequest as onRuntimeConfigRequest } from './functions/api/runtime-config.ts'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const protocol = (req.headers['x-forwarded-proto'] as string) || 'http'
  const host = req.headers.host || 'localhost:3000'
  const url = `${protocol}://${host}${req.url || '/'}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else if (typeof value === 'string') {
      headers.set(key, value)
    }
  }
  const method = req.method || 'GET'
  const body = method !== 'GET' && method !== 'HEAD' ? await readBody(req) : undefined
  return new Request(url, { method, headers, body })
}

async function sendWebResponse(res: ServerResponse, webRes: Response): Promise<void> {
  res.statusCode = webRes.status
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  const text = await webRes.text()
  res.end(text)
}

function isRealSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false
  const trimmed = url.trim().toLowerCase()
  return (
    trimmed.startsWith('http') &&
    !trimmed.includes('mock.supabase.co') &&
    !trimmed.includes('your-project') &&
    !trimmed.includes('your_project')
  )
}

function isRealSecretKey(key: string | undefined): boolean {
  if (!key) return false
  const trimmed = key.trim()
  return (
    trimmed.length > 20 &&
    !trimmed.includes('•') &&
    !trimmed.toLowerCase().startsWith('your-') &&
    !trimmed.toLowerCase().startsWith('your_')
  )
}

function registerApiMiddlewares(
  middlewares: Connect.Server,
  env: Record<string, string>,
) {
  const effectiveSupabaseUrl = isRealSupabaseUrl(env.SUPABASE_URL)
    ? env.SUPABASE_URL
    : isRealSupabaseUrl(env.VITE_SUPABASE_URL)
      ? env.VITE_SUPABASE_URL
      : ''

  const hasLiveBackend = Boolean(
    effectiveSupabaseUrl &&
    isRealSecretKey(env.SUPABASE_SERVICE_ROLE_KEY),
  )

  middlewares.use('/api/runtime-config', async (req, res) => {
    try {
      const request = await toWebRequest(req)
      const response = await onRuntimeConfigRequest({
        request,
        env: {
          VITE_SUPABASE_URL: effectiveSupabaseUrl,
          SUPABASE_URL: effectiveSupabaseUrl,
          VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY,
          SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
        },
      })
      await sendWebResponse(res, response)
    } catch {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ supabaseUrl: '', supabaseAnonKey: '' }))
    }
  })

  middlewares.use('/api/create-user', async (req, res) => {
    if (hasLiveBackend) {
      try {
        const request = await toWebRequest(req)
        const response = await onCreateUserRequest({
          request,
          env: {
            SUPABASE_URL: effectiveSupabaseUrl,
            SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
          },
        })
        await sendWebResponse(res, response)
        return
      } catch {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: false, error: 'Internal server error.' }))
        return
      }
    }

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

  middlewares.use('/api/recover-umail', async (req, res) => {
    if (hasLiveBackend) {
      try {
        const request = await toWebRequest(req)
        const response = await onRecoverUmailRequest({
          request,
          env: {
            SUPABASE_URL: effectiveSupabaseUrl,
            SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
            RESEND_API_KEY: env.RESEND_API_KEY,
            MAIL_FROM: env.MAIL_FROM,
            APP_URL: env.APP_URL,
          },
        })
        await sendWebResponse(res, response)
        return
      } catch {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          success: true,
          message: 'If an active account is associated with that contact email, a password recovery link has been sent.',
        }))
        return
      }
    }

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
}

function localApiRuntimePlugin(env: Record<string, string>): Plugin {
  return {
    name: 'local-api-runtime-plugin',
    configureServer(server) {
      registerApiMiddlewares(server.middlewares, env)
    },
    configurePreviewServer(server) {
      registerApiMiddlewares(server.middlewares, env)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), '')
  const runtimeEnv: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string') runtimeEnv[k] = v
  }
  Object.assign(runtimeEnv, loadedEnv)

  const resolvedViteSupabaseUrl = isRealSupabaseUrl(runtimeEnv.VITE_SUPABASE_URL)
    ? runtimeEnv.VITE_SUPABASE_URL
    : isRealSupabaseUrl(runtimeEnv.SUPABASE_URL)
      ? runtimeEnv.SUPABASE_URL
      : runtimeEnv.VITE_SUPABASE_URL || ''

  const port = Number(runtimeEnv.PORT) || 3000

  return {
    plugins: [react(), localApiRuntimePlugin(runtimeEnv)],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(resolvedViteSupabaseUrl),
    },
    server: {
      host: '0.0.0.0',
      port,
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      port,
      allowedHosts: true,
    },
  }
})

interface RuntimeConfigEnv {
  VITE_SUPABASE_URL?: string
  SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
  SUPABASE_ANON_KEY?: string
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function sanitizeJwt(key: string | undefined): string {
  if (!key) return ''
  const trimmed = key.trim()
  if (trimmed.startsWith('eyJ')) {
    const parts = trimmed.split('.')
    if (parts.length >= 3 && parts[2].length >= 43) {
      return `${parts[0]}.${parts[1]}.${parts[2].slice(0, 43)}`
    }
  }
  return trimmed
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

export async function onRequestGet(context: { env: RuntimeConfigEnv }) {
  const supabaseUrl = (context.env.VITE_SUPABASE_URL || context.env.SUPABASE_URL || '').trim()
  const supabaseAnonKey = sanitizeJwt(context.env.VITE_SUPABASE_ANON_KEY || context.env.SUPABASE_ANON_KEY)

  return new Response(
    JSON.stringify({
      supabaseUrl,
      supabaseAnonKey,
    }),
    {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    },
  )
}

export async function onRequest(context: { request: Request; env: RuntimeConfigEnv }) {
  if (context.request.method === 'OPTIONS') {
    return onRequestOptions()
  }
  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    })
  }
  return onRequestGet(context)
}

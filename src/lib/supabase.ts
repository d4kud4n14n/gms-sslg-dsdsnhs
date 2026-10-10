import { createClient } from '@supabase/supabase-js'

function isPlaceholderUrl(url: string | undefined): boolean {
  if (!url) return true
  const trimmed = url.trim().toLowerCase()
  return (
    !trimmed.startsWith('http') ||
    trimmed.includes('mock.supabase.co') ||
    trimmed.includes('your-project') ||
    trimmed.includes('your_project') ||
    trimmed.includes('example.supabase.co')
  )
}

function isPlaceholderKey(key: string | undefined): boolean {
  if (!key) return true
  const trimmed = key.trim()
  return (
    trimmed === 'mock-anon-key' ||
    trimmed.includes('•') ||
    trimmed.toLowerCase().startsWith('your-') ||
    trimmed.toLowerCase().startsWith('your_')
  )
}

function sanitizeSupabaseKey(key: string | undefined): string {
  if (!key) return 'mock-anon-key'
  const trimmed = key.trim()
  // Standard HS256 Supabase JWT has 3 dot-separated base64url segments where signature is 43 chars
  if (trimmed.startsWith('eyJ')) {
    const parts = trimmed.split('.')
    if (parts.length >= 3 && parts[2].length >= 43) {
      return `${parts[0]}.${parts[1]}.${parts[2].slice(0, 43)}`
    }
  }
  return trimmed
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export let isMockClient = isPlaceholderUrl(rawUrl) || isPlaceholderKey(rawKey)

const supabaseUrl = isMockClient ? 'https://mock.supabase.co' : rawUrl.trim()
const supabaseAnonKey = isMockClient ? 'mock-anon-key' : sanitizeSupabaseKey(rawKey)

export let supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function ensureRuntimeSupabaseConfig(): Promise<void> {
  if (!isMockClient) return
  try {
    const response = await fetch('/api/runtime-config', {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return
    const cfg = (await response.json()) as { supabaseUrl?: string; supabaseAnonKey?: string }
    if (!isPlaceholderUrl(cfg.supabaseUrl) && !isPlaceholderKey(cfg.supabaseAnonKey)) {
      isMockClient = false
      supabase = createClient(cfg.supabaseUrl!.trim(), sanitizeSupabaseKey(cfg.supabaseAnonKey))
    }
  } catch {
    // Keep mock fallback if runtime-config endpoint is unavailable
  }
}


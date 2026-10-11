import { createClient } from '@supabase/supabase-js'

function sanitizeSupabaseKey(key: string | undefined): string {
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

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const rawKey = sanitizeSupabaseKey(import.meta.env.VITE_SUPABASE_ANON_KEY)

export let supabase = createClient(rawUrl, rawKey)

export async function ensureRuntimeSupabaseConfig(): Promise<void> {
  if (rawUrl && rawKey) return
  try {
    const response = await fetch('/api/runtime-config', {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return
    const cfg = (await response.json()) as { supabaseUrl?: string; supabaseAnonKey?: string }
    if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
      supabase = createClient(cfg.supabaseUrl.trim(), sanitizeSupabaseKey(cfg.supabaseAnonKey))
    }
  } catch {
    // Edge endpoint unavailable
  }
}

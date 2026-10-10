import { z } from 'zod'
import { supabase } from './supabase'
import type { Database } from './database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Role = Database['public']['Tables']['roles']['Row']
export type ProfileWithRole = Profile & { role?: Role | null }

export const umailSchema = z
  .string()
  .trim()
  .min(5, 'Contact email is required.')
  .email('Please enter a valid email address.')
  .refine((val) => !val.toLowerCase().endsWith('@sslg.gms'), {
    message: 'UMAIL must be a routable personal email, not an institutional @sslg.gms address.',
  })

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')

export const completeSetupSchema = z.object({
  umail: umailSchema,
  password: passwordSchema.optional(),
})

export type CompleteSetupInput = z.infer<typeof completeSetupSchema>

export async function getProfileByUuid(uuid: string): Promise<{ data: Profile | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uuid)
      .maybeSingle()

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to retrieve profile by UUID.') }
  }
}

export async function getProfileByUkey(ukey: string): Promise<{ data: Profile | null; error: Error | null }> {
  try {
    const normalized = ukey.trim().toUpperCase()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('ukey', normalized)
      .maybeSingle()

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to retrieve profile by UKEY.') }
  }
}

export async function getProfileByUmail(umail: string): Promise<{ data: Profile | null; error: Error | null }> {
  try {
    const parsed = umailSchema.safeParse(umail)
    if (!parsed.success) {
      return { data: null, error: new Error(parsed.error.issues[0]?.message || 'Invalid UMAIL format.') }
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('umail', parsed.data.toLowerCase())
      .maybeSingle()

    if (error) {
      return { data: null, error: new Error(error.message) }
    }

    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to retrieve profile by UMAIL.') }
  }
}

export async function completeSetup(input: CompleteSetupInput): Promise<{ data: Profile | null; error: Error | null }> {
  const parseResult = completeSetupSchema.safeParse(input)
  if (!parseResult.success) {
    return { data: null, error: new Error(parseResult.error.issues[0]?.message || 'Validation failed.') }
  }

  const { umail, password } = parseResult.data

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { data: null, error: new Error('User session not found. Please log in again.') }
    }

    // If password provided, update Supabase auth password
    if (password) {
      const { error: updateAuthError } = await supabase.auth.updateUser({ password })
      if (updateAuthError) {
        return { data: null, error: new Error(updateAuthError.message) }
      }
    }

    const normalizedUmail = umail.toLowerCase()

    const { data, error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        umail: normalizedUmail,
        setup_completed_at: new Date().toISOString(),
        status: 'active',
      })
      .eq('id', user.id)
      .select('*')
      .maybeSingle()

    if (updateProfileError) {
      // Handle Postgres unique constraint violation gracefully without leaking details
      if (
        updateProfileError.code === '23505' ||
        updateProfileError.message.includes('unique') ||
        updateProfileError.message.includes('profiles_umail_key')
      ) {
        return { data: null, error: new Error('This contact email is already registered. Please provide a different address.') }
      }
      return { data: null, error: new Error(updateProfileError.message) }
    }

    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Unexpected error completing setup.') }
  }
}

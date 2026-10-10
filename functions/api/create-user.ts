import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

const allowedRoles = ['ROOT', 'ADMIN', 'PRINCIPAL', 'ADVISER', 'OFFICER', 'STAFF', 'MEMBER'] as const

const createUserSchema = z.object({
  email: z.string().trim().email('A valid email address is required.').min(5),
  user_metadata: z.object({
    full_name: z.string().trim().min(1, 'Full name is required.'),
  }).optional(),
  role_code: z.enum(allowedRoles).default('MEMBER'),
  position: z.string().trim().optional(),
  designation: z.string().trim().nullable().optional(),
})

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}

function generateTemporaryPassword() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 16)
}

async function createUserRequest(context: { request: Request; env: Env }) {
  const authorization = context.request.headers.get('Authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]

  if (!token) {
    return json({ success: false, error: 'Authentication is required.' }, 401)
  }

  if (!context.env.SUPABASE_URL || !context.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ success: false, error: 'Server configuration is incomplete.' }, 500)
  }

  const supabaseAdmin = createClient(
    context.env.SUPABASE_URL,
    context.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 1. Verify caller session
  const { data: authData, error: authLookupError } = await supabaseAdmin.auth.getUser(token)
  if (authLookupError || !authData.user) {
    return json({ success: false, error: 'Your session is invalid or expired.' }, 401)
  }

  // 2. Check admin authorization on profiles + roles
  const { data: callerProfile, error: callerError } = await supabaseAdmin
    .from('profiles')
    .select('role_id, roles:role_id ( name, level )')
    .eq('id', authData.user.id)
    .maybeSingle()

  const callerRoleLevel = (callerProfile?.roles as { level?: number; name?: string } | null)?.level ?? 0
  const callerRoleName = (callerProfile?.roles as { level?: number; name?: string } | null)?.name?.toUpperCase() ?? ''

  if (callerError || (callerRoleLevel < 10 && callerRoleName !== 'ADMIN' && callerRoleName !== 'ROOT')) {
    return json({ success: false, error: 'Only administrative users can create accounts.' }, 403)
  }

  // 3. Parse input body with Zod schema validation
  let rawBody: unknown
  try {
    rawBody = await context.request.json()
  } catch {
    return json({ success: false, error: 'Request body must be valid JSON.' }, 400)
  }

  const parseResult = createUserSchema.safeParse(rawBody)
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues[0]?.message || 'Invalid user data provided.'
    return json({ success: false, error: errorMsg }, 400)
  }

  const body = parseResult.data
  const imail = body.email.toLowerCase()
  const fullName = body.user_metadata?.full_name?.trim() || imail.split('@')[0]
  const roleCode = body.role_code
  const position = body.position || 'Member'
  const designation = body.designation || null

  const temporaryPassword = generateTemporaryPassword()

  // 4. Create user in auth.users with email_confirm: true (non-routable IMAIL)
  // This automatically triggers on_auth_user_created to generate the UKEY and profiles row.
  const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
    email: imail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      position,
      designation,
    },
  })

  if (createAuthError || !createdAuth.user) {
    const message = createAuthError?.message || 'Unable to create the authentication account.'
    const duplicate = /already registered|already exists|duplicate/i.test(message)
    return json({ success: false, error: duplicate ? 'That IMAIL address is already registered.' : message }, 409)
  }

  // 5. Fetch the trigger-generated profile with sequence UKEY
  const { data: profileRecord, error: profileFetchError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', createdAuth.user.id)
    .single()

  if (profileFetchError || !profileRecord) {
    return json({ success: false, error: 'User created in auth but profile resolution failed.' }, 500)
  }

  // 6. If a non-default role was specified, assign the corresponding role_id
  // Replace row via delete+insert so tr_check_profile_update (BEFORE UPDATE trigger checking auth.uid()) does not block service_role
  if (roleCode !== 'MEMBER') {
    const { data: targetRole } = await supabaseAdmin
      .from('roles')
      .select('id')
      .ilike('name', roleCode)
      .maybeSingle()

    if (targetRole && targetRole.id !== profileRecord.role_id) {
      await supabaseAdmin.from('profiles').delete().eq('id', createdAuth.user.id)
      await supabaseAdmin.from('profiles').insert({
        ...profileRecord,
        role_id: targetRole.id,
      })
    }
  }

  // 7. Ensure backwards-compatible public.users record is populated when users is a table
  await supabaseAdmin
    .from('users')
    .upsert(
      {
        ukey: profileRecord.ukey,
        email: imail,
        full_name: fullName,
        role_code: roleCode,
        position,
        designation,
        setup_complete: false,
      },
      { onConflict: 'ukey' },
    )

  return json({
    success: true,
    ukey: profileRecord.ukey,
    tempPassword: temporaryPassword,
  })
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    return await createUserRequest(context)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error.'
    console.error('Account creation dispatch failed')
    return json({ success: false, error: message }, 500)
  }
}

export async function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method === 'OPTIONS') {
    return onRequestOptions()
  }
  if (context.request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed.' }, 405)
  }
  return await onRequestPost(context)
}

import { createClient } from '@supabase/supabase-js'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

interface CreateUserBody {
  email?: string
  user_metadata?: {
    full_name?: string
  }
  role_code?: string
  position?: string
  designation?: string | null
}

const allowedRoles = new Set(['ADMIN', 'PRINCIPAL', 'ADVISER', 'OFFICER', 'STAFF', 'MEMBER'])

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
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

  if (callerError || (callerRoleLevel < 10 && callerRoleName !== 'ADMIN')) {
    return json({ success: false, error: 'Only ADMIN users can create accounts.' }, 403)
  }

  // 3. Parse input body
  let body: CreateUserBody
  try {
    body = await context.request.json() as CreateUserBody
  } catch {
    return json({ success: false, error: 'Request body must be valid JSON.' }, 400)
  }

  const imail = body.email?.trim().toLowerCase()
  const fullName = body.user_metadata?.full_name?.trim()
  const roleCode = body.role_code?.trim().toUpperCase() || 'MEMBER'
  const position = body.position?.trim() || 'Member'
  const designation = body.designation?.trim() || null

  if (!imail || !imail.includes('@') || !fullName || !allowedRoles.has(roleCode)) {
    return json({ success: false, error: 'Valid IMAIL, full name, and valid role are required.' }, 400)
  }

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

  // 5. If a non-default role was specified, assign the corresponding role_id
  if (roleCode !== 'MEMBER') {
    const { data: targetRole } = await supabaseAdmin
      .from('roles')
      .select('id')
      .ilike('name', roleCode)
      .maybeSingle()

    if (targetRole) {
      await supabaseAdmin
        .from('profiles')
        .update({ role_id: targetRole.id })
        .eq('id', createdAuth.user.id)
    }
  }

  // 6. Fetch the trigger-generated profile with sequence UKEY
  const { data: profileRecord, error: profileFetchError } = await supabaseAdmin
    .from('profiles')
    .select('ukey')
    .eq('id', createdAuth.user.id)
    .single()

  if (profileFetchError || !profileRecord) {
    return json({ success: false, error: 'User created in auth but profile resolution failed.' }, 500)
  }

  return json({
    success: true,
    ukey: profileRecord.ukey,
    tempPassword: temporaryPassword,
  })
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    return await createUserRequest(context)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error.'
    console.error('create-user failed:', error)
    return json({ success: false, error: message }, 500)
  }
}

export async function onRequest(context: { request: Request; env: Env }) {
  try {
    if (context.request.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed.' }, 405)
    }

    return await onRequestPost(context)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error.'
    console.error('create-user request failed:', error)
    return json({ success: false, error: message }, 500)
  }
}

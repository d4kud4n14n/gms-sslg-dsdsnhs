import { createClient } from '@supabase/supabase-js'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

interface CreateUserBody {
  email?: string
  user_metadata?: {
    ukey?: string
    full_name?: string
  }
  role_code?: string
  position?: string
  designation?: string | null
}

const allowedRoles = new Set(['ADMIN', 'PRINCIPAL', 'ADVISER', 'OFFICER', 'STAFF'])

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

  const { data: authData, error: authLookupError } = await supabaseAdmin.auth.getUser(token)
  if (authLookupError || !authData.user) {
    return json({ success: false, error: 'Your session is invalid or expired.' }, 401)
  }

  const callerUkey = authData.user.user_metadata?.ukey
  if (!callerUkey) {
    return json({ success: false, error: 'Your account is missing a UKEY.' }, 403)
  }

  const { data: caller, error: callerError } = await supabaseAdmin
    .from('users')
    .select('role_code')
    .eq('ukey', callerUkey)
    .maybeSingle()

  if (callerError || caller?.role_code !== 'ADMIN') {
    return json({ success: false, error: 'Only ADMIN users can create accounts.' }, 403)
  }

  let body: CreateUserBody
  try {
    body = await context.request.json() as CreateUserBody
  } catch {
    return json({ success: false, error: 'Request body must be valid JSON.' }, 400)
  }

  const email = body.email?.trim().toLowerCase()
  const fullName = body.user_metadata?.full_name?.trim()
  const roleCode = body.role_code?.trim().toUpperCase()
  const position = body.position?.trim()
  const designation = body.designation?.trim() || null

  if (!email || !email.includes('@') || !fullName || !position || !roleCode || !allowedRoles.has(roleCode)) {
    return json({ success: false, error: 'Email, full name, role, and position are required.' }, 400)
  }

  const { data: latestUsers, error: latestUsersError } = await supabaseAdmin
    .from('users')
    .select('ukey')
    .like('ukey', 'GMS%')
    .order('ukey', { ascending: false })
    .limit(1)

  if (latestUsersError) {
    return json({ success: false, error: latestUsersError.message }, 500)
  }

  const latestNumber = Number(latestUsers?.[0]?.ukey?.replace(/^GMS/i, '')) || 0
  const ukey = `GMS${String(latestNumber + 1).padStart(3, '0')}`
  const temporaryPassword = generateTemporaryPassword()

  const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { ukey, full_name: fullName },
  })

  if (createAuthError || !createdAuth.user) {
    const message = createAuthError?.message || 'Unable to create the authentication account.'
    const duplicate = /already registered|already exists|duplicate/i.test(message)
    return json({ success: false, error: duplicate ? 'That email address is already registered.' : message }, 409)
  }

  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert({
      ukey,
      email,
      google_email: null,
      full_name: fullName,
      role_code: roleCode,
      position,
      designation,
      setup_complete: false,
    })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(createdAuth.user.id)
    return json({ success: false, error: `User profile creation failed: ${profileError.message}` }, 500)
  }

  return json({ success: true, ukey, tempPassword: temporaryPassword })
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

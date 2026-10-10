import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  RESEND_API_KEY?: string
  MAIL_FROM?: string
  APP_URL?: string
}

const recoverBodySchema = z.object({
  umail: z.string().trim().email(),
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

const GENERIC_RESPONSE = {
  success: true,
  message: 'If an active account is associated with that contact email, a password recovery link has been sent.',
}

async function dispatchRecoveryEmail(
  env: Env,
  umail: string,
  imail: string,
  ukey: string,
  recoveryLink: string,
) {
  if (env.RESEND_API_KEY) {
    try {
      const from = env.MAIL_FROM || 'GMS SSLG Governance <noreply@sslg.gms>'
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [umail],
          subject: 'GMS Password Reset Request',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>GMS SSLG Password Recovery</h2>
              <p>A password reset was requested for your account:</p>
              <ul>
                <li><strong>Institutional ID:</strong> ${ukey}</li>
                <li><strong>IMAIL Handle:</strong> ${imail}</li>
                <li><strong>Contact Email:</strong> ${umail}</li>
              </ul>
              <p>Click the link below to set a new password:</p>
              <p><a href="${recoveryLink}" style="display:inline-block;padding:10px 20px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
              <p style="color:#64748b;font-size:12px;">If you did not request this reset, you can safely ignore this email.</p>
            </div>
          `,
        }),
      })
    } catch {
      console.error('Outbound mail dispatch failed')
    }
  } else {
    // In development or when no third-party mailer is configured
    console.info('[RECOVERY_DISPATCH] Development recovery link created successfully')
  }
}

async function handleRecoverUmail(context: { request: Request; env: Env }) {
  if (!context.env.SUPABASE_URL || !context.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ success: false, error: 'Server configuration is incomplete.' }, 500)
  }

  let rawBody: unknown
  try {
    rawBody = await context.request.json()
  } catch {
    // Return standard generic response even on invalid body to prevent enumeration
    return json(GENERIC_RESPONSE)
  }

  const parseResult = recoverBodySchema.safeParse(rawBody)
  if (!parseResult.success) {
    return json(GENERIC_RESPONSE)
  }

  const umail = parseResult.data.umail.toLowerCase()

  const supabaseAdmin = createClient(
    context.env.SUPABASE_URL,
    context.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Look up profile by UMAIL (only active profiles with completed setup have routable umail)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, ukey, imail, umail, status, setup_completed_at')
    .eq('umail', umail)
    .eq('status', 'active')
    .maybeSingle()

  if (profileError || !profile || !profile.imail) {
    // Non-enumerating response when profile does not exist or setup is not complete
    return json(GENERIC_RESPONSE)
  }

  // Generate recovery link for the IMAIL via admin API
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: profile.imail,
    options: {
      redirectTo: `${context.env.APP_URL || new URL(context.request.url).origin}/reset-password`,
    },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('Action link generation failed')
    return json(GENERIC_RESPONSE)
  }

  // Dispatch the resulting link to UMAIL (not the unroutable IMAIL)
  await dispatchRecoveryEmail(
    context.env,
    profile.umail || umail,
    profile.imail,
    profile.ukey,
    linkData.properties.action_link,
  )

  return json(GENERIC_RESPONSE)
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    return await handleRecoverUmail(context)
  } catch {
    console.error('Account recovery request failed')
    return json(GENERIC_RESPONSE)
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

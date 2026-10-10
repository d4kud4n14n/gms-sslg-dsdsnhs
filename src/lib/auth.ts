import { supabase } from './supabase'
import {
  getProfileByUuid,
  getProfileByUkey,
  getProfileByUmail,
  completeSetup,
  type Profile,
} from './profile'

export {
  getProfileByUuid,
  getProfileByUkey,
  getProfileByUmail,
  completeSetup,
}

export const isEmailConfirmed = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser()
  return Boolean(user?.confirmed_at)
}

export const resendConfirmationEmail = async (email: string) => {
  if (!email) {
    return { error: new Error('No email address available to resend confirmation to.') }
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  })

  return { error }
}

export const getCurrentProfile = async (): Promise<{ data: Profile | null; error: Error | null }> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { data: null, error: userError || new Error('No authenticated user session found.') }
    }

    return await getProfileByUuid(user.id)
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to retrieve current profile.') }
  }
}

export const isSetupComplete = async (): Promise<boolean> => {
  const { data: profile } = await getCurrentProfile()
  return Boolean(profile && profile.setup_completed_at && profile.status === 'active')
}

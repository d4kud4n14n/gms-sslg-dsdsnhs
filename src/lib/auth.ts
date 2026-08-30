import { supabase } from './supabase'

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

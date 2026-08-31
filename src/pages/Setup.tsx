import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { resendConfirmationEmail } from '../lib/auth'

export default function Setup() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    const verifySetupStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        navigate('/login')
        return
      }

      const ukey = user.user_metadata?.ukey
      if (!ukey) {
        navigate('/dashboard')
        return
      }

      const { data: profile, error } = await supabase
        .from('users')
        .select('setup_complete')
        .eq('ukey', ukey)
        .maybeSingle()

      if (error) {
        setError('Unable to load your setup status.')
        setLoading(false)
        return
      }

      if (profile?.setup_complete === true) {
        navigate('/dashboard')
        return
      }

      setLoading(false)
    }

    verifySetupStatus()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid Gmail address.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)

    try {
      const { error: updateUserError } = await supabase.auth.updateUser({
        email: trimmedEmail,
        password,
      })

      if (updateUserError) {
        throw updateUserError
      }

      const { data: { user } } = await supabase.auth.getUser()
      const ukey = user?.user_metadata?.ukey

      if (!user || !ukey) {
        throw new Error('Unable to find your account data.')
      }

      const { error: profileError } = await supabase
        .from('users')
        .update({
          email: trimmedEmail,
          google_email: trimmedEmail,
          setup_complete: true,
        })
        .eq('ukey', ukey)

      if (profileError) {
        throw profileError
      }

      setSuccess('Your account has been set up successfully.')
      setShowConfirmation(true)
      setResent(false)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Unable to complete setup. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const resendConfirmation = async () => {
    const { error } = await resendConfirmationEmail(email.trim())

    if (error) {
      setError(error.message)
      return
    }

    setResent(true)
    setError('')
    setSuccess('A confirmation email has been sent to your new email address.')
  }

  if (loading) return (
    <div className="gms-shell flex min-h-screen items-center justify-center p-6">
      <div className="gms-panel flex items-center gap-3 px-5 py-4 text-sm font-medium text-slate-600">
        <svg className="h-5 w-5 animate-spin text-brand-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Loading account setup...
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="gms-panel w-full max-w-md p-7 sm:p-8">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-brand-600">Account Setup</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Complete Your Profile</h1>
          <p className="mt-2 text-sm text-slate-600">
            Add your personal email and set a permanent password.
          </p>
        </div>

        {showConfirmation ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
              <p>A confirmation email has been sent to <strong>{email}</strong>.</p>
              <p className="mt-1">Please click the link in that email to verify your address.</p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={resendConfirmation}
                  className="text-left font-medium text-brand-700 hover:underline"
                >
                  {resent ? 'Resent ✓' : 'Resend confirmation email'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="text-left font-medium text-brand-700 hover:underline"
                >
                  Continue to dashboard (you can confirm later)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">New Email (Gmail)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="gms-input"
                placeholder="yourname@gmail.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="gms-input"
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="gms-input"
                placeholder="Re-enter password"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-600">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="gms-button-primary w-full"
            >
              {submitting ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

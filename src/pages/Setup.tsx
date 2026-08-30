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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Complete Your Account Setup</h1>
          <p className="mt-2 text-sm text-slate-300">
            Bind your personal Gmail and set a permanent password.
          </p>
        </div>

        {showConfirmation ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-100">
              <p>A confirmation email has been sent to <strong>{email}</strong>.</p>
              <p className="mt-1">Please click the link in that email to verify your address.</p>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={resendConfirmation}
                  className="text-left text-blue-300 hover:underline"
                >
                  {resent ? 'Resent ✓' : 'Resend confirmation email'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="text-left text-blue-300 hover:underline"
                >
                  Continue to dashboard (you can confirm later)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">New Email (Gmail)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                placeholder="yourname@gmail.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                placeholder="Re-enter password"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

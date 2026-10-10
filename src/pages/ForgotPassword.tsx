import { useState } from 'react'
import { Link } from 'react-router-dom'
import { umailSchema } from '../lib/profile'

export default function ForgotPassword() {
  const [umail, setUmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const validation = umailSchema.safeParse(umail)
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || 'Please enter a valid contact email (UMAIL).')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/recover-umail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ umail: validation.data }),
      })

      if (!response.ok && response.status >= 500) {
        // Server infrastructure error
        setError('Recovery service is temporarily unavailable. Please try again later.')
      } else {
        // Unified non-enumerating message for all valid client requests
        setMessage('If an active account is associated with that contact email, a password recovery link has been sent to your inbox.')
      }
    } catch {
      // In case of network errors, still prevent user enumeration
      setMessage('If an active account is associated with that contact email, a password recovery link has been sent to your inbox.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="gms-panel w-full max-w-md p-7 sm:p-8">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-brand-600">Account Recovery</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Reset Password</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter your personal contact email (UMAIL) to receive a secure recovery link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Contact Email (UMAIL)</label>
            <input
              type="email"
              value={umail}
              onChange={(e) => setUmail(e.target.value)}
              className="gms-input"
              placeholder="e.g., yourname@gmail.com"
              required
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Recovery is delivered to your registered personal UMAIL address, not your login IMAIL.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700">
              {message}
            </div>
          )}

          <button type="submit" disabled={loading} className="gms-button-primary w-full">
            {loading ? 'Sending Request...' : 'Send Recovery Link'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link to="/login" className="text-sm font-medium text-brand-600 transition hover:text-brand-500">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}

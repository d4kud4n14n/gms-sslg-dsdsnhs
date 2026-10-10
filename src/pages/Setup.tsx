import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { completeSetup, umailSchema, passwordSchema, type Profile } from '../lib/profile'

interface SetupProps {
  onSetupComplete?: () => void
}

const setupFormSchema = z
  .object({
    umail: umailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export default function Setup({ onSetupComplete }: SetupProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [imail, setImail] = useState('')
  const [umail, setUmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    const verifySetupStatus = async () => {
      const isMockClient = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('mock.supabase.co')
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        if (isMockClient) {
          setImail('root@gms.internal')
          setProfile({
            id: '00000000-0000-0000-0000-000000000001',
            ukey: 'GMS000',
            imail: 'root@gms.internal',
            umail: null,
            role_id: '00000000-0000-0000-0000-000000000001',
            status: 'pending',
            created_at: new Date().toISOString(),
            setup_completed_at: null,
          })
          setLoading(false)
          return
        }
        navigate('/login')
        return
      }

      setImail(user.email || '')

      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        setError('Unable to load your profile status.')
        setLoading(false)
        return
      }

      if (userProfile?.setup_completed_at && userProfile?.status === 'active') {
        navigate('/dashboard')
        return
      }

      setProfile(userProfile)
      if (userProfile?.imail) {
        setImail(userProfile.imail)
      }
      if (userProfile?.umail) {
        setUmail(userProfile.umail)
      }
      setLoading(false)
    }

    verifySetupStatus()
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const validation = setupFormSchema.safeParse({
      umail,
      password,
      confirmPassword,
    })

    if (!validation.success) {
      setError(validation.error.issues[0]?.message || 'Please check your entries.')
      return
    }

    setSubmitting(true)

    const isMockClient = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('mock.supabase.co')
    if (isMockClient) {
      if (onSetupComplete) {
        onSetupComplete()
      }
      navigate('/dashboard')
      return
    }

    try {
      const { data, error: completeError } = await completeSetup({
        umail: validation.data.umail,
        password: validation.data.password,
      })

      if (completeError || !data) {
        setError(completeError?.message || 'Unable to complete setup. Please try again.')
        setSubmitting(false)
        return
      }

      if (onSetupComplete) {
        onSetupComplete()
      }

      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete setup. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
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
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="gms-panel w-full max-w-md p-7 sm:p-8">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-brand-600">Account Activation</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Complete Your Setup</h1>
          <p className="mt-2 text-sm text-slate-600">
            Link your personal contact email (UMAIL) and set a permanent password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Institutional ID
              </label>
              <input
                type="text"
                value={profile?.ukey || 'PENDING'}
                className="gms-input bg-slate-100 font-mono text-slate-600"
                readOnly
                aria-readonly="true"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status
              </label>
              <input
                type="text"
                value="PENDING ACTIVATION"
                className="gms-input bg-amber-50 text-xs font-semibold text-amber-700"
                readOnly
                aria-readonly="true"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Account IMAIL</label>
            <input
              type="email"
              value={imail}
              className="gms-input bg-slate-100 text-slate-500"
              readOnly
              aria-readonly="true"
            />
            <p className="mt-1 text-xs text-slate-400">Used exclusively for system login.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Personal Contact Email (UMAIL) <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={umail}
              onChange={(e) => setUmail(e.target.value)}
              className="gms-input"
              placeholder="e.g., yourname@gmail.com"
              required
            />
            <p className="mt-1 text-xs text-slate-500">Used for password recovery and vital notifications.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Permanent Password <span className="text-red-500">*</span>
            </label>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Confirm Permanent Password <span className="text-red-500">*</span>
            </label>
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

          <button
            type="submit"
            disabled={submitting}
            className="gms-button-primary mt-2 w-full"
          >
            {submitting ? 'Activating Account...' : 'Complete Activation & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

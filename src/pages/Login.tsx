import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, User, Lock, LogIn, Users } from 'lucide-react'
import logo from '../assets/logo-sslg.png'

export default function Login() {
  const navigate = useNavigate()
  const [ukey, setUkey] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const normalizedUkey = ukey.trim().toUpperCase()

    const { data, error: fetchError } = await supabase
      .from('users')
      .select('email, setup_complete')
      .eq('ukey', normalizedUkey)
      .maybeSingle()

    if (fetchError) {
      setError('Unable to validate your UKEY right now.')
      setLoading(false)
      return
    }

    if (!data) {
      setError('UKEY not found. Please check your UKEY.')
      setLoading(false)
      return
    }

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const signedInUkey = authData.user?.user_metadata?.ukey || normalizedUkey
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('setup_complete')
      .eq('ukey', signedInUkey)
      .maybeSingle()

    if (profileError) {
      setError('Your account could not be verified. Please contact an admin.')
      setLoading(false)
      return
    }

    if (profileData && profileData.setup_complete === false) {
      navigate('/setup')
      return
    }

    navigate('/dashboard')
    setLoading(false)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,125,246,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),transparent_28%)]" />
      <div className="absolute inset-0 opacity-25">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.5" opacity="0.12" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-[28px] border border-white/10 bg-white/8 p-7 shadow-glow backdrop-blur-xl sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-inset ring-white/15">
              <img src={logo} alt="SSLG Logo" className="h-14 w-14 object-contain" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Dr. Santiago Dakudao Sr. NHS</h1>
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-brand-200">
              <Users className="h-4 w-4" />
              <span>Supreme Secondary Learner Government</span>
            </div>
          </div>

          <div className="mb-6 text-center">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-300">Access Portal</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Governance Management System</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">UKEY</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={ukey}
                  onChange={(e) => setUkey(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-3 text-sm text-white placeholder:text-slate-400 focus:border-brand-400 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-brand-500/20 uppercase"
                  placeholder="e.g., GMS000"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-12 text-sm text-white placeholder:text-slate-400 focus:border-brand-400 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition hover:text-slate-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="gms-button-primary w-full gap-2"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </>
              )}
            </button>

            <div className="text-center">
              <Link to="/forgot-password" className="text-sm font-medium text-brand-200 transition hover:text-brand-100">
                Forgot password?
              </Link>
            </div>
          </form>

          <div className="mt-6 border-t border-white/10 pt-4 text-center text-[11px] uppercase tracking-[0.22em] text-slate-400">
            © 2026 SSLG • DSDSNHS
          </div>
        </div>
      </div>
    </div>
  )
}
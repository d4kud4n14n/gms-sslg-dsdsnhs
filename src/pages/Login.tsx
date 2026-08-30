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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent" />
        <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
        {/* Subtle geometric pattern */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" opacity="0.05" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Floating decorative elements */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl animate-pulse delay-1000" />

      <div className="w-full max-w-md relative z-10">
        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-8 transition-all duration-300 hover:shadow-blue-500/10">
          {/* Header with School Branding */}
          <div className="text-center mb-8">
            <img src={logo} alt="SSLG Logo" className="w-24 h-24 rounded-2xl shadow-lg mb-4 object-contain mx-auto" />

            <h1 className="text-xl font-bold text-white leading-snug tracking-tight">
              Dr. Santiago Dakudao Sr. NHS
            </h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <Users className="w-4 h-4 text-blue-400" />
              <p className="text-sm font-medium text-blue-300">
                Supreme Secondary Learner Government
              </p>
            </div>
            <div className="mt-4 h-px w-16 mx-auto bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-white">Governance Management System</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-blue-200/80">
                UKEY
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-blue-300/40 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                  type="text"
                  value={ukey}
                  onChange={(e) => setUkey(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:bg-white/10 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 uppercase"
                  placeholder="e.g., GMS000"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-blue-200/80">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-blue-300/40 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:bg-white/10 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-300/40 hover:text-blue-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 backdrop-blur-sm px-4 py-3 text-sm text-red-300 flex items-start gap-2 animate-shake">
                <span className="text-red-400 text-lg leading-none">⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                  Sign In
                </>
              )}
            </button>

            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 transition">
                Forgot password?
              </Link>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-blue-300/30">
              © 2026 SSLG • Dr. Santiago Dakudao Sr. National High School
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
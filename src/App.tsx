import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Setup from './pages/Setup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import SYSVER from './pages/SYSVER'
import Meetings from './pages/Meetings'
import MeetingDetail from './pages/MeetingDetail'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null)

  const checkProfileStatus = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('setup_completed_at, status')
        .eq('id', userId)
        .maybeSingle()

      return Boolean(profile?.setup_completed_at && profile?.status === 'active')
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (isMounted) {
        setSession(currentSession)
      }

      if (currentSession?.user) {
        const completed = await checkProfileStatus(currentSession.user.id)
        if (isMounted) {
          setIsSetupComplete(completed)
        }
      } else {
        if (isMounted) {
          setIsSetupComplete(null)
        }
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (isMounted) {
          setSession(newSession)
          if (newSession?.user) {
            const completed = await checkProfileStatus(newSession.user.id)
            if (isMounted) {
              setIsSetupComplete(completed)
            }
          } else {
            setIsSetupComplete(null)
          }
        }
      })

      if (isMounted) {
        setLoading(false)
      }

      return () => {
        isMounted = false
        subscription.unsubscribe()
      }
    }

    initializeAuth()
  }, [checkProfileStatus])

  if (loading) {
    return (
      <div className="gms-shell flex min-h-screen items-center justify-center p-6">
        <div className="gms-panel flex items-center gap-3 px-5 py-4 text-sm font-medium text-slate-600">
          <svg className="h-5 w-5 animate-spin text-brand-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading governance workspace...
        </div>
      </div>
    )
  }

  // Route Guard: Protected application routes requiring active setup
  const isMockClient = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('mock.supabase.co')

  const requireActive = (element: React.ReactElement) => {
    if (isMockClient) {
      return element
    }
    if (!session) {
      return <Navigate to="/login" replace />
    }
    if (!isSetupComplete) {
      return <Navigate to="/setup" replace />
    }
    return element
  }

  // Route Guard: Setup route requiring authentication, but only accessible if setup incomplete
  const renderSetup = () => {
    if (isMockClient) {
      return <Setup onSetupComplete={() => setIsSetupComplete(true)} />
    }
    if (!session) {
      return <Navigate to="/login" replace />
    }
    if (isSetupComplete) {
      return <Navigate to="/dashboard" replace />
    }
    return <Setup onSetupComplete={() => setIsSetupComplete(true)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/setup" element={renderSetup()} />
        <Route path="/dashboard" element={requireActive(<Dashboard />)} />
        <Route path="/sysver" element={requireActive(<SYSVER />)} />
        <Route path="/meetings" element={requireActive(<Meetings />)} />
        <Route path="/meetings/:id" element={requireActive(<MeetingDetail />)} />
        <Route
          path="/"
          element={
            <Navigate
              to={!session ? '/login' : isSetupComplete ? '/dashboard' : '/setup'}
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App

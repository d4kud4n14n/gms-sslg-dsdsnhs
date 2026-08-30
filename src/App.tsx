import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SYSVER from './pages/SYSVER'
import Meetings from './pages/Meetings'
import MeetingDetail from './pages/MeetingDetail'

function App() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/sysver" element={<SYSVER />} />
        <Route path="/meetings" element={session ? <Meetings /> : <Navigate to="/login" />} />
        <Route path="/meetings/:id" element={session ? <MeetingDetail /> : <Navigate to="/login" />} />
        <Route path="/" element={<Navigate to={session ? '/dashboard' : '/login'} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

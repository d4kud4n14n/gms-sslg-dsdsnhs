import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import UserManagement from '../components/UserManagement'
import WorkspaceManagement from '../components/WorkspaceManagement'
import Layout from '../components/Layout'

export default function SYSVER() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        navigate('/login')
        setLoading(false)
        return
      }

      const ukey = user.user_metadata?.ukey
      if (!ukey) {
        console.error('No UKEY in user metadata')
        navigate('/dashboard')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('role_code')
        .eq('ukey', ukey)
        .maybeSingle()

      if (error) {
        console.error('Error fetching role:', error)
        navigate('/dashboard')
        setLoading(false)
        return
      }

      if (data?.role_code === 'ADMIN') {
        setIsAdmin(true)
      } else {
        navigate('/dashboard')
      }
      setLoading(false)
    }

    checkAdmin()
  }, [navigate])

  if (loading) return <Layout><div className="gms-panel p-6 text-slate-600">Loading...</div></Layout>
  if (!isAdmin) return <Layout><div className="gms-panel p-6 text-red-600">Access denied.</div></Layout>

  return (
    <Layout userName="System Admin" userCode="SYSVER">
      <div className="space-y-6">
        <div className="gms-panel p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-brand-600">Administrative Control</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">SYSVER Manager</h1>
          <p className="mt-2 text-sm text-slate-600">Manage users, roles, workspaces, and governance configuration.</p>
        </div>

        <div className="space-y-6">
          <UserManagement />
          <WorkspaceManagement />
        </div>
      </div>
    </Layout>
  )
}

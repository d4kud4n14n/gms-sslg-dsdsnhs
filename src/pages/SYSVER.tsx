import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import UserManagement from '../components/UserManagement'
import WorkspaceManagement from '../components/WorkspaceManagement'

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

      if (data?.role_code === 'SYSTEM_ADMIN') {
        setIsAdmin(true)
      } else {
        navigate('/dashboard')
      }
      setLoading(false)
    }

    checkAdmin()
  }, [navigate])

  if (loading) return <div className="p-6">Loading...</div>
  if (!isAdmin) return <div className="p-6 text-red-500">Access denied.</div>

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-600">SYSVER Manager</h1>
        <button
          onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>
      <div className="p-6">
        <p className="text-gray-700">System administration panel.</p>
        <p className="text-gray-500">Manage users, roles, workspaces, and configuration.</p>
        <div className="mt-6 grid grid-cols-1 gap-6">
          <div className="col-span-3">
            <UserManagement />
            <WorkspaceManagement />
          </div>
        </div>
      </div>
    </div>
  )
}

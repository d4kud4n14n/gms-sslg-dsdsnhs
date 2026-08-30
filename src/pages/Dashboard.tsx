import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface UserProfile {
  ukey: string
  full_name: string
  email: string
  role_code: string
}

interface Workspace {
  id: string
  code: string
  name: string
  description: string
  is_active: boolean
}

interface Meeting {
  id: string
  title: string
  scheduled_at: string
  status: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([])
  const [recentResolutions, setRecentResolutions] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const ukey = user.user_metadata?.ukey
      if (!ukey) throw new Error('No UKEY found')

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('ukey, full_name, email, role_code')
        .eq('ukey', ukey)
        .single()

      if (profileError) throw profileError
      setUserProfile(profile)

      const { data: memberWorkspaces, error: wsError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_ukey', ukey)

      if (wsError) throw wsError

      if (memberWorkspaces && memberWorkspaces.length > 0) {
        const wsIds = memberWorkspaces.map((m) => m.workspace_id)
        const { data: workspacesData, error: workspacesError } = await supabase
          .from('workspaces')
          .select('id, code, name, description, is_active')
          .in('id', wsIds)
          .eq('is_active', true)

        if (workspacesError) throw workspacesError
        setWorkspaces(workspacesData || [])
      }

      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select('id, title, scheduled_at, status')
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_at', { ascending: true })
        .limit(5)

      if (meetingsError) throw meetingsError
      setUpcomingMeetings(meetingsData || [])

      const { data: resolutionsData, error: resolutionsError } = await supabase
        .from('resolutions')
        .select('id, title, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

      if (resolutionsError) throw resolutionsError
      setRecentResolutions(resolutionsData || [])
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) return <div className="p-6">Loading dashboard...</div>
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-600">GMS Dashboard</h1>
        <div className="flex items-center gap-4">
          <a href="/meetings" className="text-blue-600 hover:underline">Meetings</a>
          <a href="/sysver" className="text-blue-600 hover:underline">SYSVER</a>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-2xl font-bold">
            Welcome, {userProfile?.full_name || 'User'}!
          </h2>
          <p className="text-gray-600">
            Role: <span className="font-medium">{userProfile?.role_code || 'N/A'}</span>
          </p>
          <p className="text-gray-500 text-sm">UKEY: {userProfile?.ukey}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded shadow p-4">
            <h3 className="font-semibold text-gray-600">Workspaces</h3>
            <p className="text-2xl font-bold">{workspaces.length}</p>
          </div>
          <div className="bg-white rounded shadow p-4">
            <h3 className="font-semibold text-gray-600">Upcoming Meetings</h3>
            <p className="text-2xl font-bold">{upcomingMeetings.length}</p>
          </div>
          <div className="bg-white rounded shadow p-4">
            <h3 className="font-semibold text-gray-600">Recent Resolutions</h3>
            <p className="text-2xl font-bold">{recentResolutions.length}</p>
          </div>
        </div>

        <div className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Your Workspaces</h2>
          {workspaces.length === 0 ? (
            <p className="text-gray-500">You are not a member of any workspace yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workspaces.map((ws) => (
                <div key={ws.id} className="border rounded p-3 hover:shadow transition">
                  <h3 className="font-medium">
                    {ws.name} <span className="text-xs text-gray-500">({ws.code})</span>
                  </h3>
                  <p className="text-sm text-gray-600">{ws.description || 'No description'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Upcoming Meetings</h2>
          {upcomingMeetings.length === 0 ? (
            <p className="text-gray-500">No upcoming meetings scheduled.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {upcomingMeetings.map((meeting) => (
                <li key={meeting.id} className="py-2 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{meeting.title}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(meeting.scheduled_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      meeting.status === 'scheduled'
                        ? 'bg-blue-100 text-blue-800'
                        : meeting.status === 'in_progress'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {meeting.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <a href="/meetings" className="mt-2 inline-block text-blue-600 hover:underline text-sm">
            View all meetings →
          </a>
        </div>

        <div className="bg-white rounded shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Resolutions</h2>
          {recentResolutions.length === 0 ? (
            <p className="text-gray-500">No resolutions found.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {recentResolutions.map((res) => (
                <li key={res.id} className="py-2 flex justify-between items-center">
                  <span className="font-medium">{res.title}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      res.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : res.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : res.status === 'proposed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {res.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

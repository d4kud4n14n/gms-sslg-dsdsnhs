import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Icon from '../components/Icon'
import { supabase } from '../lib/supabase'

interface UserProfile {
  ukey: string
  full_name: string
  email: string
  role_code: string
}

interface Meeting {
  id: string
  title: string
  scheduled_at: string
  status: string
}

interface Resolution {
  id: string
  title: string
  status: string
  created_at?: string
}

export default function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [workspaceCount, setWorkspaceCount] = useState(0)
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([])
  const [recentResolutions, setRecentResolutions] = useState<Resolution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const ukey = user.user_metadata?.ukey
        if (!ukey) return

        const { data: profileData } = await supabase
          .from('users')
          .select('ukey, full_name, email, role_code')
          .eq('ukey', ukey)
          .single()

        setProfile(profileData)

        const { count: wsCount } = await supabase
          .from('workspace_members')
          .select('*', { count: 'exact', head: true })
          .eq('user_ukey', ukey)
        setWorkspaceCount(wsCount || 0)

        const { data: meetings } = await supabase
          .from('meetings')
          .select('id, title, scheduled_at, status')
          .in('status', ['scheduled', 'in_progress'])
          .order('scheduled_at', { ascending: true })
          .limit(3)
        setUpcomingMeetings(meetings || [])

        const { data: resolutions } = await supabase
          .from('resolutions')
          .select('id, title, status, created_at')
          .order('created_at', { ascending: false })
          .limit(3)
        setRecentResolutions(resolutions || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <Layout userName={profile?.full_name || 'Officer'} userCode={profile?.ukey || 'GMS000'}>
        <div className="p-6 text-slate-500">Loading...</div>
      </Layout>
    )
  }

  return (
    <Layout userName={profile?.full_name || 'Officer'} userCode={profile?.ukey || 'GMS000'}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-800">
            Welcome back, {profile?.full_name || 'Officer'}!
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {profile?.role_code || 'Member'} • UKEY: {profile?.ukey || 'N/A'}
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Icon name="Users" size={24} className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{workspaceCount}</p>
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Workspaces</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="rounded-lg bg-green-50 p-2 text-green-600">
              <Icon name="Calendar" size={24} className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{upcomingMeetings.length}</p>
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Upcoming Meetings</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Icon name="FileText" size={24} className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{recentResolutions.length}</p>
              <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Recent Resolutions</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">
            Recent Activity
          </h3>

          {upcomingMeetings.length === 0 && recentResolutions.length === 0 ? (
            <p className="text-sm text-slate-400">No recent activity.</p>
          ) : (
            <div className="space-y-4">
              {upcomingMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-slate-700">{meeting.title}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(meeting.scheduled_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                      meeting.status === 'scheduled'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {meeting.status}
                  </span>
                </div>
              ))}

              {recentResolutions.map((resolution) => (
                <div
                  key={resolution.id}
                  className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0"
                >
                  <p className="font-medium text-slate-700">{resolution.title}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                      resolution.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : resolution.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {resolution.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

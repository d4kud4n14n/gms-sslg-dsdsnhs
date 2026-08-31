import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

interface Meeting {
  id: string
  title: string
  agenda: string
  scheduled_at: string
  status: string
  minutes: string
  quorum_required: number
  created_by: string
  created_at: string
}

interface User {
  ukey: string
  full_name: string
  email: string
}

interface Attendance {
  user_ukey: string
  status: string
  attended_at: string | null
}

interface Resolution {
  id: string
  title: string
  description: string
  proposed_by: string
  status: string
  votes_for: number
  votes_against: number
  votes_abstain: number
  created_at: string
}

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [resolutions, setResolutions] = useState<Resolution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingMinutes, setEditingMinutes] = useState(false)
  const [minutesText, setMinutesText] = useState('')
  const [showResolutionModal, setShowResolutionModal] = useState(false)
  const [newResolution, setNewResolution] = useState({ title: '', description: '' })
  const [resolutionError, setResolutionError] = useState('')
  const [currentUserUkey, setCurrentUserUkey] = useState('')

  useEffect(() => {
    if (!id) return
    fetchData()
  }, [id])

  const fetchData = async () => {
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.user_metadata?.ukey) {
        setCurrentUserUkey(user.user_metadata.ukey)
      }

      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single()

      if (meetingError) throw meetingError
      setMeeting(meetingData)
      setMinutesText(meetingData.minutes || '')

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('ukey, full_name, email')
        .order('full_name')

      if (usersError) throw usersError
      setUsers(usersData || [])

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('meeting_attendance')
        .select('*')
        .eq('meeting_id', id)

      if (attendanceError) throw attendanceError
      setAttendance(attendanceData || [])

      const { data: resolutionsData, error: resolutionsError } = await supabase
        .from('resolutions')
        .select('*')
        .eq('meeting_id', id)
        .order('created_at', { ascending: false })

      if (resolutionsError) throw resolutionsError
      setResolutions(resolutionsData || [])
    } catch (err: any) {
      setError(err.message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const updateMeetingStatus = async (status: string) => {
    if (!meeting) return

    const { error } = await supabase
      .from('meetings')
      .update({ status })
      .eq('id', meeting.id)

    if (error) {
      alert('Failed to update status: ' + error.message)
    } else {
      setMeeting({ ...meeting, status })
    }
  }

  const updateMinutes = async () => {
    if (!meeting) return

    const { error } = await supabase
      .from('meetings')
      .update({ minutes: minutesText })
      .eq('id', meeting.id)

    if (error) {
      alert('Failed to save minutes: ' + error.message)
    } else {
      setMeeting({ ...meeting, minutes: minutesText })
      setEditingMinutes(false)
    }
  }

  const toggleAttendance = async (userUkey: string, status: string) => {
    const existing = attendance.find((a) => a.user_ukey === userUkey)

    if (existing) {
      const { error } = await supabase
        .from('meeting_attendance')
        .update({ status, attended_at: status === 'present' ? new Date().toISOString() : null })
        .eq('meeting_id', id)
        .eq('user_ukey', userUkey)

      if (error) {
        alert('Failed to update attendance: ' + error.message)
        return
      }

      setAttendance((prev) =>
        prev.map((a) =>
          a.user_ukey === userUkey
            ? { ...a, status, attended_at: status === 'present' ? new Date().toISOString() : null }
            : a,
        ),
      )
    } else {
      const { error } = await supabase
        .from('meeting_attendance')
        .insert([
          {
            meeting_id: id,
            user_ukey: userUkey,
            status,
            attended_at: status === 'present' ? new Date().toISOString() : null,
          },
        ])

      if (error) {
        alert('Failed to add attendance: ' + error.message)
        return
      }

      setAttendance((prev) => [
        ...prev,
        {
          user_ukey: userUkey,
          status,
          attended_at: status === 'present' ? new Date().toISOString() : null,
        },
      ])
    }
  }

  const createResolution = async (e: React.FormEvent) => {
    e.preventDefault()
    setResolutionError('')

    if (!meeting) return

    const { error } = await supabase
      .from('resolutions')
      .insert([
        {
          meeting_id: meeting.id,
          title: newResolution.title,
          description: newResolution.description,
          proposed_by: currentUserUkey || 'GMS000',
          status: 'proposed',
        },
      ])

    if (error) {
      setResolutionError(error.message)
    } else {
      fetchData()
      setShowResolutionModal(false)
      setNewResolution({ title: '', description: '' })
    }
  }

  const updateResolutionStatus = async (resolutionId: string, status: string) => {
    const { error } = await supabase
      .from('resolutions')
      .update({ status })
      .eq('id', resolutionId)

    if (error) {
      alert('Failed to update resolution: ' + error.message)
    } else {
      setResolutions((prev) => prev.map((r) => (r.id === resolutionId ? { ...r, status } : r)))
    }
  }

  const getAttendanceCount = () => {
    const present = attendance.filter((a) => a.status === 'present').length
    const total = users.length
    return { present, total }
  }

  if (loading) return <Layout><div className="gms-panel p-6 text-slate-600">Loading...</div></Layout>
  if (error) return <Layout><div className="gms-panel p-6 text-red-600">Error: {error}</div></Layout>
  if (!meeting) return <Layout><div className="gms-panel p-6 text-slate-600">Meeting not found.</div></Layout>

  const { present, total } = getAttendanceCount()
  const quorumMet = present >= (meeting.quorum_required || 1)

  return (
    <Layout>
      <div className="space-y-6">
        <div className="gms-panel p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-brand-600">Meeting Details</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">{meeting.title}</h1>
            </div>
            <button type="button" onClick={() => navigate('/meetings')} className="gms-button-secondary">
              ← Back to Meetings
            </button>
          </div>
        </div>

        <div className="gms-panel p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Scheduled</p>
              <p className="mt-2 text-base font-semibold text-slate-800">{new Date(meeting.scheduled_at).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</p>
              <select
                value={meeting.status}
                onChange={(e) => updateMeetingStatus(e.target.value)}
                className="gms-input mt-2"
              >
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="adjourned">Adjourned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Quorum</p>
              <p className={`mt-2 text-base font-semibold ${quorumMet ? 'text-emerald-600' : 'text-red-600'}`}>
                {present}/{meeting.quorum_required || 1} present {quorumMet ? '✅ Quorum met' : '❌ Quorum not met'}
              </p>
            </div>
          </div>

          {meeting.agenda && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Agenda</p>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">{meeting.agenda}</p>
            </div>
          )}
        </div>

        <div className="gms-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Attendance ({present}/{total})</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{present} present</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {users.map((user) => {
                  const att = attendance.find((a) => a.user_ukey === user.ukey)
                  const status = att?.status || 'absent'

                  return (
                    <tr key={user.ukey}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">{user.full_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                            status === 'present'
                              ? 'bg-emerald-100 text-emerald-700'
                              : status === 'excused'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => toggleAttendance(user.ukey, 'present')}
                            className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${status === 'present' ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-700 hover:bg-emerald-100'}`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleAttendance(user.ukey, 'excused')}
                            className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${status === 'excused' ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-700 hover:bg-amber-100'}`}
                          >
                            Excused
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleAttendance(user.ukey, 'absent')}
                            className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${status === 'absent' ? 'bg-slate-300 text-slate-800' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="gms-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Minutes</h2>
            {!editingMinutes && (
              <button type="button" onClick={() => setEditingMinutes(true)} className="gms-button-secondary">
                {meeting.minutes ? 'Edit Minutes' : 'Add Minutes'}
              </button>
            )}
          </div>

          {editingMinutes ? (
            <div>
              <textarea
                value={minutesText}
                onChange={(e) => setMinutesText(e.target.value)}
                className="gms-input min-h-[160px]"
                placeholder="Enter minutes..."
              />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={updateMinutes} className="gms-button-primary">
                  Save Minutes
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingMinutes(false); setMinutesText(meeting.minutes || '') }}
                  className="gms-button-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-slate-700">{meeting.minutes || 'No minutes recorded yet.'}</p>
          )}
        </div>

        <div className="gms-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Resolutions</h2>
            <button type="button" onClick={() => setShowResolutionModal(true)} className="gms-button-primary">
              + Propose Resolution
            </button>
          </div>

          {resolutions.length === 0 ? (
            <p className="text-sm text-slate-500">No resolutions proposed for this meeting.</p>
          ) : (
            <div className="space-y-4">
              {resolutions.map((res) => (
                <div key={res.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-slate-900">{res.title}</h3>
                      <p className="text-sm text-slate-600">{res.description}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Proposed by: {users.find((u) => u.ukey === res.proposed_by)?.full_name || res.proposed_by}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status: {res.status}</p>
                      <p className="text-xs text-slate-500">
                        For: {res.votes_for} | Against: {res.votes_against} | Abstain: {res.votes_abstain}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateResolutionStatus(res.id, 'approved')}
                        className="rounded-md bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 hover:bg-emerald-200"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => updateResolutionStatus(res.id, 'rejected')}
                        className="rounded-md bg-red-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-700 hover:bg-red-200"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showResolutionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="gms-panel w-full max-w-xl p-6">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Propose Resolution</h2>
            <form onSubmit={createResolution} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Title *</label>
                <input
                  type="text"
                  value={newResolution.title}
                  onChange={(e) => setNewResolution({ ...newResolution, title: e.target.value })}
                  className="gms-input"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={newResolution.description}
                  onChange={(e) => setNewResolution({ ...newResolution, description: e.target.value })}
                  className="gms-input min-h-[110px]"
                  rows={3}
                />
              </div>

              {resolutionError && <p className="text-sm text-red-600">{resolutionError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowResolutionModal(false)} className="gms-button-secondary">
                  Cancel
                </button>
                <button type="submit" className="gms-button-primary">
                  Propose
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}

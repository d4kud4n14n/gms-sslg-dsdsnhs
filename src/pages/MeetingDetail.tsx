import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

  if (loading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>
  if (!meeting) return <div className="p-6">Meeting not found.</div>

  const { present, total } = getAttendanceCount()
  const quorumMet = present >= (meeting.quorum_required || 1)

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-600">{meeting.title}</h1>
        <div className="flex items-center gap-4">
          <a href="/meetings" className="text-gray-600 hover:underline">← Back to Meetings</a>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-white rounded shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Scheduled</p>
              <p className="font-medium">{new Date(meeting.scheduled_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <select
                value={meeting.status}
                onChange={(e) => updateMeetingStatus(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="adjourned">Adjourned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <p className="text-sm text-gray-500">Quorum</p>
              <p className={`font-medium ${quorumMet ? 'text-green-600' : 'text-red-600'}`}>
                {present}/{meeting.quorum_required || 1} present {quorumMet ? '✅ Quorum met' : '❌ Quorum not met'}
              </p>
            </div>
          </div>

          {meeting.agenda && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Agenda</p>
              <p className="whitespace-pre-wrap">{meeting.agenda}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Attendance ({present}/{total})</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => {
                  const att = attendance.find((a) => a.user_ukey === user.ukey)
                  const status = att?.status || 'absent'

                  return (
                    <tr key={user.ukey}>
                      <td className="px-4 py-2">{user.full_name}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs ${
                            status === 'present'
                              ? 'bg-green-100 text-green-800'
                              : status === 'excused'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => toggleAttendance(user.ukey, 'present')}
                          className={`px-2 py-1 rounded text-xs mr-1 ${status === 'present' ? 'bg-green-200' : 'bg-gray-200 hover:bg-green-100'}`}
                        >
                          Present
                        </button>
                        <button
                          onClick={() => toggleAttendance(user.ukey, 'excused')}
                          className={`px-2 py-1 rounded text-xs mr-1 ${status === 'excused' ? 'bg-yellow-200' : 'bg-gray-200 hover:bg-yellow-100'}`}
                        >
                          Excused
                        </button>
                        <button
                          onClick={() => toggleAttendance(user.ukey, 'absent')}
                          className={`px-2 py-1 rounded text-xs ${status === 'absent' ? 'bg-gray-300' : 'bg-gray-200 hover:bg-gray-300'}`}
                        >
                          Absent
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Minutes</h2>
          {editingMinutes ? (
            <div>
              <textarea
                value={minutesText}
                onChange={(e) => setMinutesText(e.target.value)}
                className="w-full border rounded p-2 min-h-[150px]"
                placeholder="Enter minutes..."
              />
              <div className="mt-2 flex gap-2">
                <button onClick={updateMinutes} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Save Minutes
                </button>
                <button
                  onClick={() => { setEditingMinutes(false); setMinutesText(meeting.minutes || '') }}
                  className="border px-4 py-2 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="whitespace-pre-wrap">{meeting.minutes || 'No minutes recorded yet.'}</p>
              <button onClick={() => setEditingMinutes(true)} className="mt-2 text-blue-600 hover:underline">
                {meeting.minutes ? 'Edit Minutes' : 'Add Minutes'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Resolutions</h2>
            <button
              onClick={() => setShowResolutionModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              + Propose Resolution
            </button>
          </div>

          {resolutions.length === 0 ? (
            <p className="text-gray-500">No resolutions proposed for this meeting.</p>
          ) : (
            <div className="space-y-4">
              {resolutions.map((res) => (
                <div key={res.id} className="border rounded p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{res.title}</h3>
                      <p className="text-sm text-gray-600">{res.description}</p>
                      <p className="text-xs text-gray-500">
                        Proposed by: {users.find((u) => u.ukey === res.proposed_by)?.full_name || res.proposed_by}
                      </p>
                      <p className="text-xs text-gray-500">Status: {res.status}</p>
                      <p className="text-xs text-gray-500">
                        For: {res.votes_for} | Against: {res.votes_against} | Abstain: {res.votes_abstain}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateResolutionStatus(res.id, 'approved')}
                        className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs hover:bg-green-200"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateResolutionStatus(res.id, 'rejected')}
                        className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Propose Resolution</h2>
            <form onSubmit={createResolution}>
              <div className="mb-3">
                <label className="block text-sm font-medium">Title *</label>
                <input
                  type="text"
                  value={newResolution.title}
                  onChange={(e) => setNewResolution({ ...newResolution, title: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium">Description</label>
                <textarea
                  value={newResolution.description}
                  onChange={(e) => setNewResolution({ ...newResolution, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>

              {resolutionError && <p className="text-red-500 text-sm">{resolutionError}</p>}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowResolutionModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Propose
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

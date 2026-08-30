import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Meeting {
  id: string
  title: string
  agenda: string
  scheduled_at: string
  status: string
  minutes: string
  created_by: string
  created_at: string
}

export default function Meetings() {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    agenda: '',
    scheduled_at: '',
    quorum_required: 1,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMeetings()
  }, [])

  const fetchMeetings = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .order('scheduled_at', { ascending: false })

    if (error) {
      console.error('Error fetching meetings:', error)
    } else {
      setMeetings(data || [])
    }

    setLoading(false)
  }

  const createMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    const ukey = user?.user_metadata?.ukey || 'GMS000'

    const { error } = await supabase
      .from('meetings')
      .insert([{
        title: newMeeting.title,
        agenda: newMeeting.agenda,
        scheduled_at: newMeeting.scheduled_at,
        quorum_required: Number(newMeeting.quorum_required) || 1,
        created_by: ukey,
        status: 'scheduled',
      }])

    if (error) {
      setError(error.message)
    } else {
      fetchMeetings()
      setShowModal(false)
      setNewMeeting({ title: '', agenda: '', scheduled_at: '', quorum_required: 1 })
    }
  }

  if (loading) return <div className="p-6">Loading meetings...</div>

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-600">Plenary Meetings</h1>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-600 hover:underline">Dashboard</a>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">All Meetings</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Schedule Meeting
          </button>
        </div>

        <div className="space-y-4">
          {meetings.length === 0 ? (
            <p className="text-gray-500">No meetings scheduled yet.</p>
          ) : (
            meetings.map((meeting) => (
              <div key={meeting.id} className="bg-white p-4 rounded shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{meeting.title}</h3>
                    <p className="text-gray-600 text-sm">{meeting.agenda || 'No agenda set'}</p>
                    <p className="text-gray-500 text-sm">
                      Scheduled: {new Date(meeting.scheduled_at).toLocaleString()}
                    </p>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs mt-1 ${
                        meeting.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-800'
                          : meeting.status === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-800'
                            : meeting.status === 'adjourned'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {meeting.status}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate(`/meetings/${meeting.id}`)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Schedule Meeting</h2>
            <form onSubmit={createMeeting}>
              <div className="mb-3">
                <label className="block text-sm font-medium">Title *</label>
                <input
                  type="text"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium">Agenda</label>
                <textarea
                  value={newMeeting.agenda}
                  onChange={(e) => setNewMeeting({ ...newMeeting, agenda: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium">Date & Time *</label>
                <input
                  type="datetime-local"
                  value={newMeeting.scheduled_at}
                  onChange={(e) => setNewMeeting({ ...newMeeting, scheduled_at: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium">Quorum Required</label>
                <input
                  type="number"
                  value={newMeeting.quorum_required}
                  onChange={(e) => setNewMeeting({ ...newMeeting, quorum_required: Number(e.target.value) || 1 })}
                  className="w-full border rounded px-3 py-2"
                  min="1"
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

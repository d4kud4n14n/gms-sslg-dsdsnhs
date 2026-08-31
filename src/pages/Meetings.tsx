import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

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

  if (loading) return <Layout><div className="gms-panel p-6 text-slate-600">Loading meetings...</div></Layout>

  return (
    <Layout>
      <div className="space-y-6">
        <div className="gms-panel p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-brand-600">Governance</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">Plenary Meetings</h1>
            </div>
            <button type="button" onClick={() => setShowModal(true)} className="gms-button-primary">
              + Schedule Meeting
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="gms-panel p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Total</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{meetings.length}</p>
          </div>
          <div className="gms-panel p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Scheduled</p>
            <p className="mt-3 text-3xl font-bold text-blue-700">{meetings.filter((m) => m.status === 'scheduled').length}</p>
          </div>
          <div className="gms-panel p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">In progress</p>
            <p className="mt-3 text-3xl font-bold text-amber-600">{meetings.filter((m) => m.status === 'in_progress').length}</p>
          </div>
        </div>

        <div className="gms-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">All Meetings</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{meetings.length} total</span>
          </div>

          <div className="space-y-4">
            {meetings.length === 0 ? (
              <p className="text-sm text-slate-500">No meetings scheduled yet.</p>
            ) : (
              meetings.map((meeting) => (
                <div key={meeting.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">{meeting.title}</h3>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                            meeting.status === 'scheduled'
                              ? 'bg-blue-100 text-blue-700'
                              : meeting.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-700'
                                : meeting.status === 'adjourned'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {meeting.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{meeting.agenda || 'No agenda set'}</p>
                      <p className="text-sm text-slate-500">
                        Scheduled: {new Date(meeting.scheduled_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/meetings/${meeting.id}`)}
                      className="gms-button-secondary"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="gms-panel w-full max-w-xl p-6">
            <h2 className="mb-4 text-xl font-bold text-slate-900">Schedule Meeting</h2>
            <form onSubmit={createMeeting} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Title *</label>
                <input
                  type="text"
                  value={newMeeting.title}
                  onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                  className="gms-input"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Agenda</label>
                <textarea
                  value={newMeeting.agenda}
                  onChange={(e) => setNewMeeting({ ...newMeeting, agenda: e.target.value })}
                  className="gms-input min-h-[110px]"
                  rows={3}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Date & Time *</label>
                <input
                  type="datetime-local"
                  value={newMeeting.scheduled_at}
                  onChange={(e) => setNewMeeting({ ...newMeeting, scheduled_at: e.target.value })}
                  className="gms-input"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Quorum Required</label>
                <input
                  type="number"
                  value={newMeeting.quorum_required}
                  onChange={(e) => setNewMeeting({ ...newMeeting, quorum_required: Number(e.target.value) || 1 })}
                  className="gms-input"
                  min="1"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="gms-button-secondary">
                  Cancel
                </button>
                <button type="submit" className="gms-button-primary">
                  Create Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}

interface RoleWidgetsProps {
  roleCode?: string
  meetings: Array<{ id: string; title: string; scheduled_at: string; status: string }>
  resolutions: Array<{ id: string; title: string; status: string }>
}

const roleTitles: Record<string, string> = {
  ADMIN: 'System Administration',
  PRINCIPAL: 'School Leadership',
  ADVISER: 'Advisory Review',
  OFFICER: 'Leadership Coordination',
  STAFF: 'General Membership',
}

export default function RoleWidgets({ roleCode, meetings, resolutions }: RoleWidgetsProps) {
  const normalizedRole = roleCode || 'STAFF'

  if (normalizedRole === 'ADMIN') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Budget Overview</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">₱ 42,500</p>
          <p className="mt-1 text-sm text-emerald-600">+8.4% vs last cycle</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Pending Disbursements</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">₱ 8,150</p>
          <p className="mt-1 text-sm text-amber-600">3 approvals pending</p>
        </div>
      </div>
    )
  }

  if (normalizedRole === 'OFFICER') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Recent Minutes</h3>
        <div className="mt-4 space-y-3">
          {meetings.length > 0 ? (
            meetings.slice(0, 3).map((meeting) => (
              <div key={meeting.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div>
                  <p className="font-medium text-slate-800">{meeting.title}</p>
                  <p className="text-xs text-slate-500">{new Date(meeting.scheduled_at).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase text-blue-700">
                  {meeting.status}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No recent minutes available.</p>
          )}
        </div>
      </div>
    )
  }

  if (normalizedRole === 'ADMIN' || normalizedRole === 'PRINCIPAL' || normalizedRole === 'ADVISER') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Approval Queue</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{resolutions.filter((r) => r.status === 'proposed').length}</p>
          <p className="mt-1 text-sm text-blue-600">Awaiting review</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Next Meeting</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{meetings[0]?.title || 'No upcoming event'}</p>
          <p className="mt-1 text-sm text-slate-500">
            {meetings[0] ? new Date(meetings[0].scheduled_at).toLocaleString() : 'No schedule yet'}
          </p>
        </div>
      </div>
    )
  }

  if (normalizedRole === 'STAFF') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Announcements</p>
        <ul className="mt-3 space-y-3">
          <li className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Grade-level concerns are being reviewed by the student council.</li>
          <li className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">The next student forum is scheduled for Friday.</li>
        </ul>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">Role Summary</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{roleTitles[normalizedRole] || 'General Membership'}</p>
      <p className="mt-2 text-sm text-slate-500">No role-specific widget is assigned for this position yet.</p>
    </div>
  )
}

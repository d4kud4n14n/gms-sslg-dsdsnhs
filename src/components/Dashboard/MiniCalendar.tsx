interface MeetingItem {
  id: string
  title: string
  scheduled_at: string
  status: string
}

interface MiniCalendarProps {
  meetings: MeetingItem[]
}

export default function MiniCalendar({ meetings }: MiniCalendarProps) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const meetingDays = new Set(
    meetings
      .map((meeting) => new Date(meeting.scheduled_at).getDate())
      .filter((day) => day > 0)
  )

  const cells: Array<{ day: number | null }> = []

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ day: null })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: null })
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Calendar</h3>
        <span className="text-sm text-slate-500">
          {today.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2">
        {cells.map((cell, index) => (
          <div
            key={`${cell.day ?? 'empty'}-${index}`}
            className={`flex h-12 items-center justify-center rounded-xl border text-sm ${
              cell.day === null
                ? 'border-transparent bg-transparent text-slate-300'
                : meetingDays.has(cell.day)
                  ? 'border-blue-200 bg-blue-50 font-semibold text-blue-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            {cell.day || ''}
          </div>
        ))}
      </div>
    </div>
  )
}

import { Bell } from 'lucide-react'

interface Notification {
  id: string
  label: string
  type: 'meeting' | 'resolution' | 'approval'
}

interface NotificationBellProps {
  notifications: Notification[]
}

export default function NotificationBell({ notifications }: NotificationBellProps) {
  return (
    <div className="relative">
      <button
        type="button"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {notifications.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {notifications.length}
          </span>
        )}
      </button>

      {notifications.length > 0 && (
        <div className="absolute right-0 top-12 z-20 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 border-b border-slate-100 pb-2">
            <p className="text-sm font-semibold text-slate-800">Recent updates</p>
          </div>
          <div className="space-y-2">
            {notifications.map((item) => (
              <div key={item.id} className="rounded-xl bg-slate-50 px-2 py-2 text-sm text-slate-700">
                {item.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

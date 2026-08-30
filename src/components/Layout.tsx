import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import Icon from './Icon'
import { supabase } from '../lib/supabase'

interface LayoutProps {
  children: ReactNode
  userName?: string
  userCode?: string
}

export default function Layout({ children, userName = 'Officer', userCode = 'GMS000' }: LayoutProps) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-6">
          <h1 className="text-xl font-bold text-blue-700">GMS</h1>
          <p className="text-xs text-slate-400">Governance Management System</p>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 font-medium text-blue-700 transition hover:bg-blue-100"
          >
            <Icon name="LayoutDashboard" size={18} className="h-5 w-5" />
            Dashboard
          </Link>
          <Link
            to="/meetings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Icon name="CalendarDays" size={18} className="h-5 w-5" />
            Meetings
          </Link>
          <Link
            to="/sysver"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Icon name="Settings" size={18} className="h-5 w-5" />
            SYSVER
          </Link>
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Icon name="UserCircle" size={28} className="h-8 w-8" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-slate-700">{userName}</p>
              <p className="text-xs text-slate-400">{userCode}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 transition hover:bg-red-50 hover:text-red-700"
          >
            <Icon name="LogOut" size={16} className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}

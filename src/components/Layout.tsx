import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import type { ReactNode } from 'react'
import Icon from './Icon'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo-sslg.png'

interface LayoutProps {
  children: ReactNode
  userName?: string
  userCode?: string
}

export default function Layout({ children, userName = 'Officer', userCode = 'GMS000' }: LayoutProps) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' as const },
    { to: '/meetings', label: 'Meetings', icon: 'CalendarDays' as const },
    { to: '/sysver', label: 'SYSVER', icon: 'Settings' as const },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="gms-shell flex min-h-screen overflow-hidden">
      <aside
        className={`flex flex-col border-r border-slate-200/80 bg-slate-950 text-slate-100 transition-all duration-200 ${collapsed ? 'w-20' : 'w-72'}`}
      >
        <div className={`border-b border-white/10 ${collapsed ? 'px-2 py-4' : 'p-5'}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            >
              <Icon name={collapsed ? 'PanelRightOpen' : 'PanelLeftClose'} size={16} className="h-4 w-4" />
            </button>

            {!collapsed && (
              <div className="flex items-center gap-3">
                <img src={logo} alt="SSLG Logo" className="h-10 w-10 rounded-xl object-contain ring-1 ring-inset ring-white/15 bg-white/5" />
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-white">Governance</h1>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">SSLG</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-2 p-3">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-500/12 text-white ring-1 ring-inset ring-brand-400/30'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`
              }
              title={label}
            >
              <Icon name={icon} size={18} className={`h-5 w-5 ${collapsed ? 'text-brand-200' : 'text-brand-300'}`} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={`border-t border-white/10 ${collapsed ? 'p-2' : 'p-4'}`}>
          <div className={`mb-4 flex items-center rounded-xl bg-white/5 ${collapsed ? 'justify-center p-2' : 'gap-3 p-3'}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/15 text-brand-200">
              <Icon name="UserCircle" size={26} className="h-7 w-7" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{userName}</p>
                <p className="truncate text-[11px] uppercase tracking-[0.2em] text-slate-400">{userCode}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/10 hover:text-red-100 ${collapsed ? 'px-2' : ''}`}
            title="Logout"
          >
            <Icon name="LogOut" size={16} className="h-4 w-4" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-100/80 p-3 md:p-5 xl:p-6">
        <div className="mx-auto max-w-6xl animate-fade-up">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Operations</p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
              Governance Workspace
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

import { ArrowRight, CalendarDays, FileText, FolderKanban, PlusSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const actions = [
  {
    title: 'Schedule Meeting',
    description: 'Plan the next governance session',
    href: '/meetings',
    icon: CalendarDays,
  },
  {
    title: 'Propose Resolution',
    description: 'Raise a new motion for review',
    href: '/meetings',
    icon: FileText,
  },
  {
    title: 'View Workspaces',
    description: 'Track active governance units',
    href: '/dashboard',
    icon: FolderKanban,
  },
  {
    title: 'Create Document',
    description: 'Draft activity notes or reports',
    href: '/meetings',
    icon: PlusSquare,
  },
]

export default function QuickActions() {
  const navigate = useNavigate()

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {actions.map(({ title, description, href, icon: Icon }) => (
        <button
          key={title}
          type="button"
          onClick={() => navigate(href)}
          className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Icon className="h-5 w-5" />
            </span>
            <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-blue-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </button>
      ))}
    </div>
  )
}

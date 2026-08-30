type ApprovalItem = {
  id: string
  title: string
  status: string
  created_at?: string
}

interface PendingApprovalsProps {
  approvals: ApprovalItem[]
}

export default function PendingApprovals({ approvals }: PendingApprovalsProps) {
  if (!approvals.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Pending Approvals</h3>
        <p className="mt-3 text-sm text-slate-500">No approvals are waiting for your review right now.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Pending Approvals</h3>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
          {approvals.length} item{approvals.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {approvals.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recently submitted'}
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

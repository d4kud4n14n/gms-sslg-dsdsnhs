import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import WorkspaceMembers from './WorkspaceMembers'

interface Workspace {
  id: string
  code: string
  name: string
  description: string
  chair_ukey: string | null
  is_active: boolean
  config: any
}

export default function WorkspaceManagement() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<{ id: string; code: string } | null>(null)
  const [newWorkspace, setNewWorkspace] = useState({ code: '', name: '', description: '', chair_ukey: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('code')

    if (error) {
      console.error('Error fetching workspaces:', error)
    } else {
      setWorkspaces(data || [])
    }

    setLoading(false)
  }

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const { code, name, description, chair_ukey } = newWorkspace

    const { error } = await supabase
      .from('workspaces')
      .insert([
        {
          code,
          name,
          description,
          chair_ukey: chair_ukey || null,
          is_active: true,
        },
      ])

    if (error) {
      setError(error.message)
    } else {
      fetchWorkspaces()
      setShowModal(false)
      setNewWorkspace({ code: '', name: '', description: '', chair_ukey: '' })
    }
  }

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('workspaces')
      .update({ is_active: !current })
      .eq('id', id)

    if (error) {
      console.error('Error toggling workspace status:', error)
    }

    fetchWorkspaces()
  }

  if (loading) return <p>Loading workspaces...</p>

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Workspaces</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Add Workspace
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chair</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {workspaces.map((ws) => (
              <tr key={ws.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{ws.code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{ws.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{ws.chair_ukey || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      ws.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {ws.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => setSelectedWorkspace({ id: ws.id, code: ws.code })}
                    className="text-green-600 hover:underline mr-2"
                  >
                    Members
                  </button>
                  <button
                    onClick={() => toggleActive(ws.id, ws.is_active)}
                    className="text-blue-600 hover:underline mr-2"
                  >
                    {ws.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => {/* future: edit workspace */}}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Add Workspace</h2>
            <form onSubmit={createWorkspace}>
              <div className="mb-3">
                <label className="block text-sm font-medium">Code (e.g., OSP)</label>
                <input
                  type="text"
                  value={newWorkspace.code}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, code: e.target.value.toUpperCase() })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Name</label>
                <input
                  type="text"
                  value={newWorkspace.name}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Description</label>
                <input
                  type="text"
                  value={newWorkspace.description}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Chair UKEY (optional)</label>
                <input
                  type="text"
                  value={newWorkspace.chair_ukey}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, chair_ukey: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., GMS001"
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
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedWorkspace && (
        <WorkspaceMembers
          workspaceId={selectedWorkspace.id}
          workspaceCode={selectedWorkspace.code}
          onClose={() => setSelectedWorkspace(null)}
        />
      )}
    </div>
  )
}

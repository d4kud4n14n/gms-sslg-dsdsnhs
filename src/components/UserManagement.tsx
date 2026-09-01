import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface User {
  ukey: string
  email: string
  full_name: string
  role_code: string
  position?: string | null
  designation?: string | null
  created_at: string
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    role_code: 'STAFF',
    position: '',
    designation: '',
  })
  const [editForm, setEditForm] = useState({
    full_name: '',
    role_code: 'STAFF',
    position: '',
    designation: '',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('ukey')
    if (error) {
      console.error(error)
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  const updateRole = async (ukey: string, newRole: string) => {
    const { error } = await supabase
      .from('users')
      .update({ role_code: newRole })
      .eq('ukey', ukey)
    if (error) {
      alert('Failed to update role: ' + error.message)
    } else {
      setUsers(users.map(u => u.ukey === ukey ? { ...u, role_code: newRole } : u))
    }
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedEmail = newUser.email.trim()
    const trimmedPosition = newUser.position.trim()
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailPattern.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    if (!trimmedPosition) {
      setError('Position is required.')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Your session has expired. Please sign in again.')
        return
      }

      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          user_metadata: { full_name: newUser.full_name.trim() },
          role_code: newUser.role_code,
          position: trimmedPosition,
          designation: newUser.designation.trim() || null,
        }),
      })
      const result = await response.json() as { success?: boolean; ukey?: string; tempPassword?: string; error?: string }

      if (!response.ok || !result.success) {
        setError(result.error || 'User creation failed.')
        return
      }

      await fetchUsers()
      setShowModal(false)
      setNewUser({ email: '', full_name: '', role_code: 'STAFF', position: '', designation: '' })
      alert(`User created. UKEY: ${result.ukey}\nTemporary password: ${result.tempPassword}`)
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Unable to reach the user creation service.'
      setError(message)
    }
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setEditForm({
      full_name: user.full_name,
      role_code: user.role_code || 'STAFF',
      position: user.position || '',
      designation: user.designation || '',
    })
    setShowEditModal(true)
  }

  const saveUserEdits = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    const trimmedPosition = editForm.position.trim()
    if (!trimmedPosition) {
      alert('Position is required.')
      return
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        full_name: editForm.full_name.trim(),
        role_code: editForm.role_code,
        position: trimmedPosition,
        designation: editForm.designation.trim() || null,
      })
      .eq('ukey', editingUser.ukey)

    if (updateError) {
      alert('Failed to update user: ' + updateError.message)
      return
    }

    setUsers((current) =>
      current.map((user) =>
        user.ukey === editingUser.ukey
          ? {
              ...user,
              full_name: editForm.full_name.trim(),
              role_code: editForm.role_code,
              position: trimmedPosition,
              designation: editForm.designation.trim() || null,
            }
          : user,
      ),
    )
    setShowEditModal(false)
    setEditingUser(null)
  }

  const deleteUser = async (user: User) => {
    const confirmed = window.confirm(`Delete ${user.full_name} (${user.ukey})? This will remove their access record from the system.`)
    if (!confirmed) return

    setError('')

    try {
      const { data: deletedUsers, error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('ukey', user.ukey)
        .select('ukey')

      if (deleteError) {
        setError(`Failed to delete ${user.ukey}: ${deleteError.message}`)
        return
      }

      if (!deletedUsers || deletedUsers.length !== 1) {
        setError(`Failed to delete ${user.ukey}: the record was not removed. Check ADMIN permissions.`)
        return
      }

      setUsers((current) => current.filter((item) => item.ukey !== user.ukey))
      await fetchUsers()
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Unexpected database error.'
      setError(`Failed to delete ${user.ukey}: ${message}`)
    }
  }

  if (loading) return <p>Loading users...</p>

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Users</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Add User
        </button>
      </div>
      {error && <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">UKEY</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.ukey}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{user.ukey}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{user.full_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <select
                    value={user.role_code}
                    onChange={(e) => updateRole(user.ukey, e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="PRINCIPAL">Principal</option>
                    <option value="ADVISER">Adviser</option>
                    <option value="OFFICER">Officer</option>
                    <option value="STAFF">Staff</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="font-medium text-slate-700">{user.position || 'Staff Member'}</div>
                  {user.designation && <div className="text-xs text-slate-500">{user.designation}</div>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => openEditModal(user)}
                    className="mr-2 text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteUser(user)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
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
            <h2 className="text-xl font-bold mb-4">Add New User</h2>
            <form onSubmit={createUser}>
              <div className="mb-3">
                <label className="block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Role</label>
                <select
                  value={newUser.role_code}
                  onChange={(e) => setNewUser({ ...newUser, role_code: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                  <option value="PRINCIPAL">Principal</option>
                  <option value="ADVISER">Adviser</option>
                  <option value="OFFICER">Officer</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Position</label>
                <input
                  type="text"
                  value={newUser.position}
                  onChange={(e) => setNewUser({ ...newUser, position: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g. President, Grade 7 Representative"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Designation (optional)</label>
                <input
                  type="text"
                  value={newUser.designation}
                  onChange={(e) => setNewUser({ ...newUser, designation: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g. Grade 7, Finance Committee"
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
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Edit User</h2>
            <form onSubmit={saveUserEdits}>
              <div className="mb-3">
                <label className="block text-sm font-medium">UKEY</label>
                <input value={editingUser.ukey} className="w-full border rounded px-3 py-2 bg-gray-100" disabled />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Role</label>
                <select
                  value={editForm.role_code}
                  onChange={(e) => setEditForm({ ...editForm, role_code: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="PRINCIPAL">Principal</option>
                  <option value="ADVISER">Adviser</option>
                  <option value="OFFICER">Officer</option>
                  <option value="STAFF">Staff</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Position</label>
                <input
                  type="text"
                  value={editForm.position}
                  onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g. President, Grade 7 Representative"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Designation (optional)</label>
                <input
                  type="text"
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g. Grade 7, Finance Committee"
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingUser(null)
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

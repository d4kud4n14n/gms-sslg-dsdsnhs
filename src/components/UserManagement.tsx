import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface User {
  ukey: string
  email: string
  full_name: string
  role_code: string
  created_at: string
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', full_name: '', role_code: 'MEMBER' })
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
    const { email, full_name, role_code } = newUser
    const tempPassword = Math.random().toString(36).slice(-8)
    const nextUkey = `GMS${String(users.length + 1).padStart(3, '0')}`

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: tempPassword,
      options: {
        data: { ukey: nextUkey, full_name: full_name }
      }
    })

    if (authError) {
      setError(authError.message)
      return
    }

    if (!authData.user) {
      setError('User creation failed.')
      return
    }

    const { error: insertError } = await supabase
      .from('users')
      .insert([{ 
        ukey: nextUkey,
        email,
        full_name,
        role_code,
      }])

    if (insertError) {
      setError(insertError.message)
      return
    }

    fetchUsers()
    setShowModal(false)
    setNewUser({ email: '', full_name: '', role_code: 'MEMBER' })
    alert(`User created. Temporary password: ${tempPassword}`)
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

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">UKEY</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
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
                    <option value="SYSTEM_ADMIN">System Admin</option>
                    <option value="SCHOOL_HEAD">School Head</option>
                    <option value="ADVISER">Adviser</option>
                    <option value="PRESIDENT">President</option>
                    <option value="VICE_PRESIDENT">Vice President</option>
                    <option value="SECRETARY">Secretary</option>
                    <option value="TREASURER">Treasurer</option>
                    <option value="AUDITOR">Auditor</option>
                    <option value="PIO">PIO</option>
                    <option value="PROTOCOL">Protocol</option>
                    <option value="GRADE_REP">Grade Representative</option>
                    <option value="MEMBER">Member</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => {/* future: edit user */}}
                    className="text-blue-600 hover:underline mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {/* future: delete user */}}
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
                  <option value="MEMBER">Member</option>
                  <option value="SYSTEM_ADMIN">System Admin</option>
                  <option value="SCHOOL_HEAD">School Head</option>
                  <option value="ADVISER">Adviser</option>
                  <option value="PRESIDENT">President</option>
                  <option value="VICE_PRESIDENT">Vice President</option>
                  <option value="SECRETARY">Secretary</option>
                  <option value="TREASURER">Treasurer</option>
                  <option value="AUDITOR">Auditor</option>
                  <option value="PIO">PIO</option>
                  <option value="PROTOCOL">Protocol</option>
                  <option value="GRADE_REP">Grade Representative</option>
                </select>
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
    </div>
  )
}

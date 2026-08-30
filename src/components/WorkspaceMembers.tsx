import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface User {
  ukey: string
  full_name: string
  email: string
}

export default function WorkspaceMembers({ workspaceId, workspaceCode, onClose }: { workspaceId: string; workspaceCode: string; onClose: () => void }) {
  const [members, setMembers] = useState<User[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [workspaceId])

  const fetchData = async () => {
    setLoading(true)

    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('ukey, full_name, email')
      .order('full_name')

    if (usersError) {
      setError(usersError.message)
      setLoading(false)
      return
    }

    setAllUsers(usersData || [])

    const { data: membersData, error: membersError } = await supabase
      .from('workspace_members')
      .select('user_ukey')
      .eq('workspace_id', workspaceId)

    if (membersError) {
      setError(membersError.message)
    } else {
      const memberUkeys = (membersData || []).map((m) => m.user_ukey)
      const memberUsers = (usersData || []).filter((u) => memberUkeys.includes(u.ukey))
      setMembers(memberUsers)
    }

    setLoading(false)
  }

  const toggleMember = async (userUkey: string, isCurrentlyMember: boolean) => {
    if (isCurrentlyMember) {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_ukey', userUkey)

      if (error) {
        alert('Failed to remove member: ' + error.message)
        return
      }

      setMembers((prev) => prev.filter((m) => m.ukey !== userUkey))
    } else {
      const { error } = await supabase
        .from('workspace_members')
        .insert([{ workspace_id: workspaceId, user_ukey: userUkey, role_in_workspace: 'member' }])

      if (error) {
        alert('Failed to add member: ' + error.message)
        return
      }

      const user = allUsers.find((u) => u.ukey === userUkey)
      if (user) {
        setMembers((prev) => [...prev, user])
      }
    }
  }

  if (loading) return <div>Loading members...</div>

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Manage Members – {workspaceCode}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">&times;</button>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <ul className="divide-y divide-gray-200">
          {allUsers.map((user) => {
            const isMember = members.some((m) => m.ukey === user.ukey)

            return (
              <li key={user.ukey} className="py-2 flex justify-between items-center">
                <div>
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <button
                  onClick={() => toggleMember(user.ukey, isMember)}
                  className={`px-3 py-1 rounded text-sm ${
                    isMember
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {isMember ? 'Remove' : 'Add'}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          id: string
          imail: string
          role_id: string
          setup_completed_at: string | null
          status: 'pending' | 'active' | 'suspended'
          ukey: string
          umail: string | null
        }
        Insert: {
          created_at?: string
          id: string
          imail: string
          role_id: string
          setup_completed_at?: string | null
          status?: 'pending' | 'active' | 'suspended'
          ukey: string
          umail?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          imail?: string
          role_id?: string
          setup_completed_at?: string | null
          status?: 'pending' | 'active' | 'suspended'
          ukey?: string
          umail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedSchema: 'auth'
          },
          {
            foreignKeyName: 'profiles_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'roles'
            referencedSchema: 'public'
          }
        ]
      }
      roles: {
        Row: {
          id: string
          level: number
          name: string
          permissions: string[]
        }
        Insert: {
          id?: string
          level: number
          name: string
          permissions?: string[]
        }
        Update: {
          id?: string
          level?: number
          name?: string
          permissions?: string[]
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          id: string
          code: string
          name: string
          description: string
          chair_ukey: string | null
          is_active: boolean
          config: Json
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string
          chair_ukey?: string | null
          is_active?: boolean
          config?: Json
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string
          chair_ukey?: string | null
          is_active?: boolean
          config?: Json
          created_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_ukey: string
          role: string
          joined_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_ukey: string
          role?: string
          joined_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_ukey?: string
          role?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedSchema: 'public'
          }
        ]
      }
      meetings: {
        Row: {
          id: string
          title: string
          agenda: string
          scheduled_at: string
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          minutes: string
          quorum_required: number
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          agenda?: string
          scheduled_at: string
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          minutes?: string
          quorum_required?: number
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          agenda?: string
          scheduled_at?: string
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          minutes?: string
          quorum_required?: number
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      meeting_attendance: {
        Row: {
          id: string
          meeting_id: string
          user_ukey: string
          status: 'present' | 'absent' | 'excused'
          signed_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          user_ukey: string
          status?: 'present' | 'absent' | 'excused'
          signed_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          user_ukey?: string
          status?: 'present' | 'absent' | 'excused'
          signed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'meeting_attendance_meeting_id_fkey'
            columns: ['meeting_id']
            isOneToOne: false
            referencedRelation: 'meetings'
            referencedSchema: 'public'
          }
        ]
      }
      resolutions: {
        Row: {
          id: string
          meeting_id: string | null
          title: string
          description: string
          status: 'proposed' | 'approved' | 'rejected' | 'tabled'
          author_ukey: string | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id?: string | null
          title: string
          description?: string
          status?: 'proposed' | 'approved' | 'rejected' | 'tabled'
          author_ukey?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string | null
          title?: string
          description?: string
          status?: 'proposed' | 'approved' | 'rejected' | 'tabled'
          author_ukey?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'resolutions_meeting_id_fkey'
            columns: ['meeting_id']
            isOneToOne: false
            referencedRelation: 'meetings'
            referencedSchema: 'public'
          }
        ]
      }
    }
    Views: {
      users: {
        Row: {
          id: string
          ukey: string
          email: string
          umail: string | null
          status: 'pending' | 'active' | 'suspended'
          role_code: string | null
          full_name: string
          position: string | null
          designation: string | null
          created_at: string
          setup_completed_at: string | null
        }
      }
    }
    Functions: {
      is_officer: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] &
        PublicSchema['Views'])
    ? (PublicSchema['Tables'] &
        PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

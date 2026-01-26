export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: 'student' | 'teacher' | 'admin'
          first_name: string
          last_name: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          role: 'student' | 'teacher' | 'admin'
          first_name: string
          last_name: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'student' | 'teacher' | 'admin'
          first_name?: string
          last_name?: string
          created_at?: string
        }
      }
      students: {
        Row: {
          id: string
          user_id: string
          student_number: string
          date_of_birth: string | null
          created_at: string
        }
      }
      // ... autres tables
    }
  }
}
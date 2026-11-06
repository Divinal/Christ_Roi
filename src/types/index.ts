export type UserRole = 'student' | 'teacher' | 'admin' | 'finance_admin' | 'academic_admin' | 'admin_secretaire';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName?: string;     
  lastName?: string;      
  first_name?: string;    
  last_name?: string;    
  phone?: string;
  mustChangePassword?: boolean;
}

export interface Student {
  id: string;
  userId: string;
  studentNumber: string;
  dateOfBirth?: string;
  address?: string;
  parentPhone?: string;
  enrollmentDate: string;
  status: 'active' | 'inactive' | 'suspended';
}

export interface Teacher {
  id: string;
  userId: string;
  teacherNumber: string;
  specialization?: string;
  hireDate?: string;
  department?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  coefficient: number;
}

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  teacherId?: string;
  levelId?: string;
  gradeValue: number;
  gradeType: string;
  coefficient: number;
  examDate?: string;
  comment?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientType: 'individual' | 'class' | 'all_students' | 'all_teachers' | 'all';
  recipientId?: string;
  subject: string;
  content: string;
  isRead: boolean;
  sentAt: string;
}

export interface Announcement {
  id: string;
  authorId: string;
  title: string;
  content: string;
  targetAudience: 'students' | 'teachers' | 'all';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  publishedAt: string;
  expiresAt?: string;
}

export interface Schedule {
  id: string;
  levelId: string;
  subjectId: string;
  teacherId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  academicYear: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  subjectId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  reason?: string;
  recordedBy?: string;
  recordedAt: string;
}
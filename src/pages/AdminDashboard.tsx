// src/pages/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  Home, Users, BookOpen, Plus, Edit, Trash2, Search, 
  Calendar, FileText, MessageSquare, X, Save, Bell, Clock,
  ChevronLeft, ChevronRight, Filter, Menu
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface User {
  id: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface Student {
  id: string;
  user_id: string;
  student_number: string;
  date_of_birth?: string;
  address?: string;
  status: string;
  users?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface Teacher {
  id: string;
  user_id: string;
  teacher_number: string;
  specialization?: string;
  department?: string;
  users?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface Class {
  id: string;
  name: string;
  level: string;
  academic_year: string;
  max_students: number;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  coefficient: number;
}

interface Course {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  is_approved: boolean;
  uploaded_at: string;
  teacher_id: string;
  subject_id: string;
}

interface Schedule {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: number; // 1=Lundi, 2=Mardi, etc.
  start_time: string;
  end_time: string;
  room?: string;
  academic_year: string;
}

interface ScheduleDetailed extends Schedule {
  classes?: { name: string };
  subjects?: { name: string };
  teachers?: { users?: { first_name: string; last_name: string } };
}

interface Announcement {
  id: string;
  author_id: string;
  title: string;
  content: string;
  target_audience: 'students' | 'teachers' | 'all';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  published_at: string;
  expires_at?: string;
}

interface AdminDashboardProps {
  user: User | null;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [schedules, setSchedules] = useState<ScheduleDetailed[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'student' | 'teacher' | 'class' | 'subject' | 'schedule' | 'announcement'>('student');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [studentClassAssignments, setStudentClassAssignments] = useState<any[]>([]);
  const [teacherClassAssignments, setTeacherClassAssignments] = useState<any[]>([]);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assignModalType, setAssignModalType] = useState<'student' | 'teacher'>('student');
  // ==================== ÉTATS PAGINATION ET FILTRES ====================
  const [currentPageStudents, setCurrentPageStudents] = useState<number>(1);
  const [currentPageTeachers, setCurrentPageTeachers] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  // États pour la gestion des notes
    const [selectedStudentForGrades, setSelectedStudentForGrades] = useState<string>('');
    const [studentGrades, setStudentGrades] = useState<any[]>([]);
    const [editingGrade, setEditingGrade] = useState<any | null>(null);
    const [showGradeModal, setShowGradeModal] = useState<boolean>(false);
    const [gradeForm, setGradeForm] = useState({
      gradeValue: 0,
      gradeType: 'Examen',
      coefficient: 1,
      examDate: '',
      comment: ''
    });

  const [studentAssignForm, setStudentAssignForm] = useState({
    studentId: '',
    classId: '',
    academicYear: '2025-2026'
  });

  const [teacherAssignForm, setTeacherAssignForm] = useState({
    teacherId: '',
    subjectId: '',
    classId: '',
    academicYear: '2025-2026'
  });

  // Formulaires
  const [studentForm, setStudentForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    studentNumber: '', dateOfBirth: '', address: ''
  });

  const [teacherForm, setTeacherForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    teacherNumber: '', specialization: '', department: ''
  });

  const [classForm, setClassForm] = useState({
    name: '', level: '', academicYear: '2025-2026', maxStudents: 30
  });

  const [subjectForm, setSubjectForm] = useState({
    name: '', code: '', coefficient: 1
  });

  const [scheduleForm, setScheduleForm] = useState({
    classId: '',
    subjectId: '',
    teacherId: '',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '10:00',
    room: '',
    academicYear: '2025-2026'
  });

  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    targetAudience: 'all' as 'students' | 'teachers' | 'all',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    expiresAt: ''
  });

  const [selectedClassForSchedule, setSelectedClassForSchedule] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // ==================== CHARGEMENT DONNÉES ====================
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStudents(),
        loadTeachers(),
        loadClasses(),
        loadSubjects(),
        loadCourses(),
        loadSchedules(),
        loadAnnouncements(),
        loadStudentClassAssignments(),      // ← NOUVEAU
        loadTeacherClassAssignments()  
      ]);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentClassAssignments = async () => {
  const { data, error } = await supabase
    .from('student_classes')
    .select(`*, students( id, student_number, users(first_name, last_name, email)),
      classes(id, name, level)`)
    .eq('academic_year', '2025-2026')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Erreur chargement affectations étudiants:', error);
  } else {
    setStudentClassAssignments(data || []);
  }
};

const loadTeacherClassAssignments = async () => {
  const { data, error } = await supabase
    .from('teacher_subject_classes')
    .select(`*, teachers(id, teacher_number, users(first_name, last_name, email)),
      subjects(id, name, code),
      classes(id, name, level)
    `)
    .eq('academic_year', '2025-2026')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Erreur chargement affectations enseignants:', error);
  } else {
    setTeacherClassAssignments(data || []);
  }
};

  const loadStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*, users(first_name, last_name, email)')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erreur chargement étudiants:', error);
    } else {
      setStudents(data || []);
    }
  };

  const loadTeachers = async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select('*, users(first_name, last_name, email)')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erreur chargement enseignants:', error);
    } else {
      setTeachers(data || []);
    }
  };

  const loadClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('level', { ascending: true });
    
    if (error) {
      console.error('Erreur chargement classes:', error);
    } else {
      setClasses(data || []);
    }
  };

  const loadSubjects = async () => {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Erreur chargement matières:', error);
    } else {
      setSubjects(data || []);
    }
  };

  const loadCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('Erreur chargement cours:', error);
    } else {
      setCourses(data || []);
    }
  };

  const loadSchedules = async () => {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        classes(name),
        subjects(name),
        teachers(users(first_name, last_name))
      `)
      .order('day_of_week', { ascending: true });
    
    if (error) {
      console.error('Erreur chargement emplois du temps:', error);
    } else {
      setSchedules(data || []);
    }
  };

  const loadAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('published_at', { ascending: false });
    
    if (error) {
      console.error('Erreur chargement annonces:', error);
    } else {
      setAnnouncements(data || []);
    }
  };

          // ==================== CHARGEMENT DES NOTES ====================
    const loadStudentGrades = async (studentId: string) => {
      if (!studentId) {
        setStudentGrades([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('grades')
          .select(`
            *,
            subjects (name, code),
            teachers (users(first_name, last_name)),
            classes (name)
          `)
          .eq('student_id', studentId)
          .order('exam_date', { ascending: false });

        if (error) throw error;
        setStudentGrades(data || []);
      } catch (error: any) {
        console.error('Erreur chargement notes:', error);
        alert(`❌ Erreur: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    // ==================== MODIFICATION NOTE ====================
    const handleEditGrade = (grade: any) => {
      setEditingGrade(grade);
      setGradeForm({
        gradeValue: grade.grade_value,
        gradeType: grade.grade_type,
        coefficient: grade.coefficient,
        examDate: grade.exam_date || '',
        comment: grade.comment || ''
      });
      setShowGradeModal(true);
    };

    const handleUpdateGrade = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingGrade) return;

      setLoading(true);
      try {
        const { error } = await supabase
          .from('grades')
          .update({
            grade_value: gradeForm.gradeValue,
            grade_type: gradeForm.gradeType,
            coefficient: gradeForm.coefficient,
            exam_date: gradeForm.examDate || null,
            comment: gradeForm.comment || null
          })
          .eq('id', editingGrade.id);

        if (error) throw error;

        alert('✅ Note modifiée avec succès !');
        setShowGradeModal(false);
        setEditingGrade(null);
        loadStudentGrades(selectedStudentForGrades);
      } catch (error: any) {
        alert(`❌ Erreur: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    // ==================== SUPPRESSION NOTE ====================
    const handleDeleteGrade = async (gradeId: string) => {
      if (!window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer cette note ?')) return;

      try {
        const { error } = await supabase
          .from('grades')
          .delete()
          .eq('id', gradeId);

        if (error) throw error;
        alert('✅ Note supprimée');
        loadStudentGrades(selectedStudentForGrades);
      } catch (error: any) {
        alert(`❌ Erreur: ${error.message}`);
      }
    };
      // ==================== GESTION FORMULAIRES ====================
      const handleAssignStudentToClass = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!studentAssignForm.studentId || !studentAssignForm.classId) {
        alert('⚠️ Veuillez sélectionner un étudiant et une classe');
        return;
      }

      setLoading(true);
      try {
        const { error } = await supabase
          .from('student_classes')
          .insert({
            student_id: studentAssignForm.studentId,
            class_id: studentAssignForm.classId,
            academic_year: studentAssignForm.academicYear
          });

        if (error) {
          if (error.code === '23505') {
            alert('⚠️ Cet étudiant est déjà affecté à cette classe');
          } else {
            throw error;
          }
        } else {
          alert('✅ Étudiant affecté à la classe avec succès !');
          setShowAssignModal(false);
          setStudentAssignForm({ studentId: '', classId: '', academicYear: '2025-2026' });
          loadStudentClassAssignments();
        }
      } catch (error: any) {
        alert(`❌ Erreur: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

const handleAssignTeacherToClass = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!teacherAssignForm.teacherId || !teacherAssignForm.subjectId || !teacherAssignForm.classId) {
    alert('⚠️ Veuillez remplir tous les champs');
    return;
  }

  setLoading(true);
  try {
    const { error } = await supabase
      .from('teacher_subject_classes')
      .insert({
        teacher_id: teacherAssignForm.teacherId,
        subject_id: teacherAssignForm.subjectId,
        class_id: teacherAssignForm.classId,
        academic_year: teacherAssignForm.academicYear
      });

    if (error) {
      if (error.code === '23505') {
        alert('⚠️ Cet enseignant est déjà affecté à cette matière pour cette classe');
      } else {
        throw error;
      }
    } else {
      alert('✅ Enseignant affecté avec succès !');
      setShowAssignModal(false);
      setTeacherAssignForm({ 
        teacherId: '', 
        subjectId: '', 
        classId: '', 
        academicYear: '2025-2026' 
      });
      loadTeacherClassAssignments();
    }
  } catch (error: any) {
    alert(`❌ Erreur: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

const handleRemoveStudentFromClass = async (assignmentId: string) => {
  if (!window.confirm('⚠️ Retirer cet étudiant de cette classe ?')) return;

  try {
    const { error } = await supabase
      .from('student_classes')
      .delete()
      .eq('id', assignmentId);

    if (error) throw error;
    alert('✅ Étudiant retiré de la classe');
    loadStudentClassAssignments();
  } catch (error: any) {
    alert(`❌ Erreur: ${error.message}`);
  }
};

const handleRemoveTeacherFromClass = async (assignmentId: string) => {
  if (!window.confirm('⚠️ Retirer cet enseignant de cette affectation ?')) return;

  try {
    const { error } = await supabase
      .from('teacher_subject_classes')
      .delete()
      .eq('id', assignmentId);

    if (error) throw error;
    alert('✅ Enseignant retiré de l\'affectation');
    loadTeacherClassAssignments();
  } catch (error: any) {
    alert(`❌ Erreur: ${error.message}`);
  }
};

  // ==================== AJOUT ÉTUDIANT ====================
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userId = crypto.randomUUID();

      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: studentForm.email,
          password_hash: 'TEMP_PASSWORD_TO_BE_SET',
          role: 'student',
          first_name: studentForm.firstName,
          last_name: studentForm.lastName,
          phone: studentForm.phone || null
        });

      if (userError) throw userError;

      const { error: studentError } = await supabase
        .from('students')
        .insert({
          user_id: userId,
          student_number: studentForm.studentNumber,
          date_of_birth: studentForm.dateOfBirth || null,
          address: studentForm.address || null,
          status: 'active'
        });

      if (studentError) throw studentError;

      alert('✅ Étudiant ajouté avec succès !');
      setShowModal(false);
      resetStudentForm();
      loadStudents();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== AJOUT ENSEIGNANT ====================
  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userId = crypto.randomUUID();

      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: teacherForm.email,
          password_hash: 'TEMP_PASSWORD_TO_BE_SET',
          role: 'teacher',
          first_name: teacherForm.firstName,
          last_name: teacherForm.lastName,
          phone: teacherForm.phone || null
        });

      if (userError) throw userError;

      const { error: teacherError } = await supabase
        .from('teachers')
        .insert({
          user_id: userId,
          teacher_number: teacherForm.teacherNumber,
          specialization: teacherForm.specialization || null,
          department: teacherForm.department || null
        });

      if (teacherError) throw teacherError;

      alert('✅ Enseignant ajouté avec succès !');
      setShowModal(false);
      resetTeacherForm();
      loadTeachers();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== AJOUT CLASSE ====================
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('classes')
        .insert({
          name: classForm.name,
          level: classForm.level,
          academic_year: classForm.academicYear,
          max_students: classForm.maxStudents
        });

      if (error) throw error;

      alert('✅ Classe créée avec succès !');
      setShowModal(false);
      resetClassForm();
      loadClasses();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== AJOUT MATIÈRE ====================
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('subjects')
        .insert({
          name: subjectForm.name,
          code: subjectForm.code,
          coefficient: subjectForm.coefficient
        });

      if (error) throw error;

      alert('✅ Matière créée avec succès !');
      setShowModal(false);
      resetSubjectForm();
      loadSubjects();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== GESTION EMPLOI DU TEMPS ====================
  const handleAddOrUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const scheduleData = {
        class_id: scheduleForm.classId,
        subject_id: scheduleForm.subjectId,
        teacher_id: scheduleForm.teacherId,
        day_of_week: scheduleForm.dayOfWeek,
        start_time: scheduleForm.startTime,
        end_time: scheduleForm.endTime,
        room: scheduleForm.room || null,
        academic_year: scheduleForm.academicYear
      };

      if (editingSchedule) {
        // Mise à jour
        const { error } = await supabase
          .from('schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id);

        if (error) throw error;
        alert('✅ Emploi du temps modifié avec succès !');
      } else {
        // Création
        const { error } = await supabase
          .from('schedules')
          .insert(scheduleData);

        if (error) throw error;
        alert('✅ Emploi du temps créé avec succès !');
      }

      setShowModal(false);
      resetScheduleForm();
      setEditingSchedule(null);
      loadSchedules();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSchedule = (schedule: ScheduleDetailed) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      classId: schedule.class_id,
      subjectId: schedule.subject_id,
      teacherId: schedule.teacher_id,
      dayOfWeek: schedule.day_of_week,
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      room: schedule.room || '',
      academicYear: schedule.academic_year
    });
    setModalType('schedule');
    setShowModal(true);
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer ce créneau ?')) return;

    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;
      alert('✅ Créneau supprimé');
      loadSchedules();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  // ==================== GESTION ANNONCES ====================
  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('announcements')
        .insert({
          author_id: user?.id,
          title: announcementForm.title,
          content: announcementForm.content,
          target_audience: announcementForm.targetAudience,
          priority: announcementForm.priority,
          expires_at: announcementForm.expiresAt || null
        });

      if (error) throw error;

      alert('✅ Annonce publiée avec succès !');
      setShowModal(false);
      resetAnnouncementForm();
      loadAnnouncements();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer cette annonce ?')) return;

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId);

      if (error) throw error;
      alert('✅ Annonce supprimée');
      loadAnnouncements();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  // ==================== SUPPRESSION ====================
  const handleDeleteStudent = async (studentId: string) => {
    if (!window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer cet étudiant ?')) return;

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);

      if (error) throw error;
      alert('✅ Étudiant supprimé');
      loadStudents();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer cet enseignant ?')) return;

    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacherId);

      if (error) throw error;
      alert('✅ Enseignant supprimé');
      loadTeachers();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer cette classe ?')) return;

    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId);

      if (error) throw error;
      alert('✅ Classe supprimée');
      loadClasses();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer cette matière ?')) return;

    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId);

      if (error) throw error;
      alert('✅ Matière supprimée');
      loadSubjects();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  // ==================== APPROBATION COURS ====================
  const handleApproveCourse = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ 
          is_approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', courseId);

      if (error) throw error;
      alert('✅ Cours approuvé !');
      loadCourses();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  // ==================== RESET FORMS ====================
  const resetStudentForm = () => {
    setStudentForm({
      firstName: '', lastName: '', email: '', phone: '',
      studentNumber: '', dateOfBirth: '', address: ''
    });
  };

  const resetTeacherForm = () => {
    setTeacherForm({
      firstName: '', lastName: '', email: '', phone: '',
      teacherNumber: '', specialization: '', department: ''
    });
  };

  const resetClassForm = () => {
    setClassForm({
      name: '', level: '', academicYear: '2025-2026', maxStudents: 30
    });
  };

  const resetSubjectForm = () => {
    setSubjectForm({
      name: '', code: '', coefficient: 1
    });
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      classId: '',
      subjectId: '',
      teacherId: '',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '10:00',
      room: '',
      academicYear: '2025-2026'
    });
  };

  const resetAnnouncementForm = () => {
    setAnnouncementForm({
      title: '',
      content: '',
      targetAudience: 'all',
      priority: 'normal',
      expiresAt: ''
    });
  };

// ==================== FILTRES ====================
    const filteredStudents = students.filter(s => {
      const matchesSearch = (s.student_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.users?.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.users?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.users?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtrer par classe
      const studentClass = studentClassAssignments.find(sc => sc.student_id === s.id);
      const matchesClass = classFilter === 'all' || studentClass?.class_id === classFilter;
      
      return matchesSearch && matchesClass;
    });

      // Pagination étudiants
      const totalPagesStudents = Math.ceil(filteredStudents.length / itemsPerPage);
      const startIndexStudents = (currentPageStudents - 1) * itemsPerPage;
      const paginatedStudents = filteredStudents.slice(startIndexStudents, startIndexStudents + itemsPerPage);

    const filteredTeachers = teachers.filter(t => {
      const matchesSearch = (t.teacher_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.users?.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.users?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.users?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDepartment = departmentFilter === 'all' || t.department === departmentFilter;
      
      return matchesSearch && matchesDepartment;
    });

        // Pagination enseignants
        const totalPagesTeachers = Math.ceil(filteredTeachers.length / itemsPerPage);
        const startIndexTeachers = (currentPageTeachers - 1) * itemsPerPage;
        const paginatedTeachers = filteredTeachers.slice(startIndexTeachers, startIndexTeachers + itemsPerPage);

// Départements uniques
        const uniqueDepartments = Array.from(new Set(teachers.map(t => t.department).filter(Boolean)));

  // Filtrer les emplois du temps par classe sélectionnée
  const filteredSchedules = selectedClassForSchedule
    ? schedules.filter(s => s.class_id === selectedClassForSchedule)
    : schedules;

  // Grouper les emplois du temps par jour et créer une grille
  const getScheduleGrid = () => {
    const grid: { [key: string]: ScheduleDetailed[] } = {
      '1': [], '2': [], '3': [], '4': [], '5': []
    };

    filteredSchedules.forEach(schedule => {
      if (schedule.day_of_week >= 1 && schedule.day_of_week <= 5) {
        grid[schedule.day_of_week.toString()].push(schedule);
      }
    });

    return grid;
  };

  const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAVBAR */}
      <nav className="bg-purple-600 text-white p-3 md:p-4 shadow-lg fixed top-0 left-0 right-0 z-40">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Bouton menu mobile */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-purple-700 rounded"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg md:text-2xl font-bold truncate">📚 Administration</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-xs md:text-sm hidden sm:inline">👤 {user?.first_name} {user?.last_name}</span>
            <button
              onClick={onLogout}
              className="bg-purple-700 px-3 py-1.5 md:px-4 md:py-2 rounded hover:bg-purple-800 transition text-sm"
            >
              <span className="hidden sm:inline">Déconnexion</span>
              <span className="sm:hidden">×</span>
            </button>
          </div>
        </div>
      </nav>

     {/* OVERLAY MOBILE */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

     {/* LAYOUT AVEC SIDEBAR */}
<div className="flex pt-14 md:pt-16">
  {/* SIDEBAR VERTICAL */}
  <aside className={`
    w-64 bg-white shadow-lg fixed left-0 top-14 md:top-16 bottom-0 overflow-y-auto z-30
    transform transition-transform duration-300 ease-in-out
    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
    lg:translate-x-0
  `}>
    <div className="p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">Menu Principal</h2>
      <nav className="space-y-1">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Home },
          { id: 'students', label: 'Étudiants', icon: Users },
          { id: 'teachers', label: 'Enseignants', icon: BookOpen },
          { id: 'classes', label: 'Classes', icon: Calendar },
          { id: 'subjects', label: 'Matières', icon: FileText },
          { id: 'courses', label: 'Cours', icon: FileText },
          { id: 'schedules', label: 'Emplois du temps', icon: Clock },
          { id: 'announcements', label: 'Annonces', icon: Bell },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition text-left ${
                activeTab === tab.id
                  ? 'bg-purple-100 text-purple-700 font-semibold shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <span className="ml-auto w-1.5 h-8 bg-purple-600 rounded-l"></span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t mt-4 pt-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">Gestion Avancée</h2>
        <nav className="space-y-1">
          {[
            { id: 'assign-students', label: 'Affecter Étudiants', icon: Users },
            { id: 'assign-teachers', label: 'Affecter Enseignants', icon: BookOpen },
            { id: 'grades', label: 'Gestion des notes', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition text-left ${
                  activeTab === tab.id
                    ? 'bg-purple-100 text-purple-700 font-semibold shadow-sm'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{tab.label}</span>
                {activeTab === tab.id && (
                  <span className="ml-auto w-1.5 h-8 bg-purple-600 rounded-l"></span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* STATISTIQUES RAPIDES */}
      <div className="border-t mt-4 pt-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">Statistiques</h2>
        <div className="space-y-2">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-600">Étudiants</p>
            <p className="text-2xl font-bold text-blue-700">{students.length}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-xs text-green-600">Enseignants</p>
            <p className="text-2xl font-bold text-green-700">{teachers.length}</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg">
            <p className="text-xs text-purple-600">Classes</p>
            <p className="text-2xl font-bold text-purple-700">{classes.length}</p>
          </div>
        </div>
      </div>
    </div>
  </aside>

  {/* CONTENU PRINCIPAL */}
  <div className="flex-1 lg:ml-64 p-3 md:p-6">

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
              <div className="bg-blue-50 p-4 md:p-6 rounded-lg">
                <p className="text-2xl md:text-4xl font-bold text-blue-600">{students.length}</p>
                <p className="text-xs md:text-base text-gray-600">Étudiants</p>
              </div>
              <div className="bg-green-50 p-4 md:p-6 rounded-lg">
                <p className="text-2xl md:text-4xl font-bold text-green-600">{teachers.length}</p>
                <p className="text-xs md:text-base text-gray-600">Enseignants</p>
              </div>
              <div className="bg-purple-50 p-4 md:p-6 rounded-lg">
                <p className="text-2xl md:text-4xl font-bold text-purple-600">{classes.length}</p>
                <p className="text-xs md:text-base text-gray-600">Classes</p>
              </div>
              <div className="bg-orange-50 p-4 md:p-6 rounded-lg">
                <p className="text-2xl md:text-4xl font-bold text-orange-600">{subjects.length}</p>
                <p className="text-xs md:text-base text-gray-600">Matières</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-bold mb-4">Actions rapides</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <button
                  onClick={() => { setModalType('student'); setShowModal(true); }}
                  className="flex items-center gap-2 p-3 md:p-4 border rounded-lg hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                  <span className="text-xs md:text-base">Ajouter étudiant</span>
                </button>
                <button
                  onClick={() => { setModalType('teacher'); setShowModal(true); }}
                  className="flex items-center gap-2 p-3 md:p-4 border rounded-lg hover:bg-green-50"
                >
                  <Plus className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                  <span className="text-xs md:text-base">Ajouter enseignant</span>
                </button>
                <button
                  onClick={() => { setModalType('class'); setShowModal(true); }}
                  className="flex items-center gap-2 p-3 md:p-4 border rounded-lg hover:bg-purple-50"
                >
                  <Plus className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
                  <span className="text-xs md:text-base">Créer classe</span>
                </button>
                <button
                  onClick={() => { setModalType('subject'); setShowModal(true); }}
                  className="flex items-center gap-2 p-3 md:p-4 border rounded-lg hover:bg-orange-50"
                >
                  <Plus className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
                  <span className="text-xs md:text-base">Créer matière</span>
                </button>
                <button
                  onClick={() => { setModalType('schedule'); setShowModal(true); }}
                  className="flex items-center gap-2 p-3 md:p-4 border rounded-lg hover:bg-indigo-50"
                >
                  <Plus className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                  <span className="text-xs md:text-base">Ajouter créneau</span>
                </button>
                <button
                  onClick={() => { setModalType('announcement'); setShowModal(true); }}
                  className="flex items-center gap-2 p-3 md:p-4 border rounded-lg hover:bg-pink-50"
                >
                  <Plus className="w-4 h-4 md:w-5 md:h-5 text-pink-600" />
                  <span className="text-xs md:text-base">Publier annonce</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB GESTION DES NOTES */}
      {activeTab === 'grades' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-6">Gestion des Notes</h2>

          {/* Sélection étudiant */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <label className="block text-sm font-medium mb-2">
              Sélectionner un étudiant pour voir ses notes *
            </label>
            <select
              value={selectedStudentForGrades}
              onChange={(e) => {
                setSelectedStudentForGrades(e.target.value);
                loadStudentGrades(e.target.value);
              }}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">-- Choisir un étudiant --</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.student_number} - {student.users?.first_name} {student.users?.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Affichage des notes */}
          {selectedStudentForGrades ? (
            loading ? (
              <p className="text-center py-8">Chargement des notes...</p>
            ) : studentGrades.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl text-gray-500">Aucune note pour cet étudiant</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left">Matière</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-center">Note /20</th>
                      <th className="px-4 py-3 text-center">Coef.</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Enseignant</th>
                      <th className="px-4 py-3 text-left">Commentaire</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentGrades.map((grade) => (
                      <tr key={grade.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold">{grade.subjects?.name}</td>
                        <td className="px-4 py-3">{grade.grade_type}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xl font-bold ${
                            grade.grade_value >= 15 ? 'text-green-600' :
                            grade.grade_value >= 10 ? 'text-blue-600' : 'text-red-600'
                          }`}>
                            {grade.grade_value.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {grade.coefficient}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {grade.exam_date ? new Date(grade.exam_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {grade.teachers?.users?.first_name} {grade.teachers?.users?.last_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {grade.comment || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditGrade(grade)}
                              className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteGrade(grade.id)}
                              className="text-red-600 hover:bg-red-50 p-2 rounded"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Statistiques */}
                <div className="mt-6 grid md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800">Nombre de notes</p>
                    <p className="text-3xl font-bold text-blue-600">{studentGrades.length}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-800">Moyenne générale</p>
                    <p className="text-3xl font-bold text-green-600">
                      {(studentGrades.reduce((sum, g) => sum + (g.grade_value * g.coefficient), 0) / 
                        studentGrades.reduce((sum, g) => sum + g.coefficient, 0)).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-purple-800">Meilleure note</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {Math.max(...studentGrades.map(g => g.grade_value)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-xl text-gray-500">Sélectionnez un étudiant pour voir ses notes</p>
            </div>
          )}
        </div>
      )}

       {/* STUDENTS TAB */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <h2 className="text-xl md:text-2xl font-bold">Étudiants ({filteredStudents.length})</h2>
            <button
              onClick={() => { setModalType('student'); setShowModal(true); }}
              className="bg-purple-600 text-white px-3 py-2 md:px-4 rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm md:text-base w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              Ajouter
            </button>
          </div>

          {/* FILTRES ET RECHERCHE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-2">Rechercher</label>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nom, matricule, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 pl-10 text-sm md:text-base"
                />
              </div>
            </div>

           <div>
              <label className="block text-sm font-medium mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Classe
              </label>
              <select 
                value={classFilter} 
                onChange={(e) => setClassFilter(e.target.value)} 
                className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
              >
                <option value="all">Toutes les classes</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Par page</label>
              <select 
                value={itemsPerPage} 
                onChange={(e) => { 
                  setItemsPerPage(Number(e.target.value)); 
                  setCurrentPageStudents(1); 
                }} 
                className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          {/* TABLE */}
          {loading ? (
            <p className="text-center py-8">Chargement...</p>
          ) : paginatedStudents.length === 0 ? (
            <p className="text-center py-8 text-gray-500">Aucun étudiant trouvé</p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm">Matricule</th>
                      <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm">Nom</th>
                      <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm hidden md:table-cell">Email</th>
                      <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm">Statut</th>
                      <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((student) => (
                      <tr key={student.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 md:px-4 py-3 font-medium text-xs md:text-sm">{student.student_number}</td>
                        <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{student.users?.first_name} {student.users?.last_name}</td>
                        <td className="px-3 md:px-4 py-3 text-xs md:text-sm hidden md:table-cell">{student.users?.email}</td>
                        <td className="px-3 md:px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="px-3 md:px-4 py-3">
                          <button
                            onClick={() => handleDeleteStudent(student.id)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
                <p className="text-xs md:text-sm text-gray-600">
                  Affichage {startIndexStudents + 1} à {Math.min(startIndexStudents + itemsPerPage, filteredStudents.length)} sur {filteredStudents.length}
                </p>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPageStudents(prev => Math.max(1, prev - 1))}
                    disabled={currentPageStudents === 1}
                    className="px-2 md:px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <span className="px-3 md:px-4 py-1 border rounded bg-gray-50 text-xs md:text-sm">
                    {currentPageStudents} / {totalPagesStudents}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPageStudents(prev => Math.min(totalPagesStudents, prev + 1))}
                    disabled={currentPageStudents === totalPagesStudents}
                    className="px-2 md:px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

        {/* TEACHERS TAB */}
        {activeTab === 'teachers' && (
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <h2 className="text-xl md:text-2xl font-bold">Enseignants ({filteredTeachers.length})</h2>
              <button
                onClick={() => { setModalType('teacher'); setShowModal(true); }}
                className="bg-purple-600 text-white px-3 py-2 md:px-4 rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm md:text-base w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                Ajouter
              </button>
            </div>

            {/* FILTRES ET RECHERCHE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-2">Rechercher</label>
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Nom, matricule, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 pl-10 text-sm md:text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <Filter className="w-4 h-4 inline mr-1" />
                  Département
                </label>
                <select 
                  value={departmentFilter} 
                  onChange={(e) => setDepartmentFilter(e.target.value)} 
                  className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                >
                  <option value="all">Tous</option>
                  {uniqueDepartments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Par page</label>
                <select 
                  value={itemsPerPage} 
                  onChange={(e) => { 
                    setItemsPerPage(Number(e.target.value)); 
                    setCurrentPageTeachers(1); 
                  }} 
                  className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>
            </div>

            {/* TABLE */}
            {loading ? (
              <p className="text-center py-8">Chargement...</p>
            ) : paginatedTeachers.length === 0 ? (
              <p className="text-center py-8 text-gray-500">Aucun enseignant trouvé</p>
            ) : (
              <>
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm">Matricule</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm">Nom</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm hidden md:table-cell">Email</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm hidden lg:table-cell">Spécialité</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm hidden lg:table-cell">Département</th>
                        <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTeachers.map((teacher) => (
                        <tr key={teacher.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 md:px-4 py-3 font-medium text-xs md:text-sm">{teacher.teacher_number}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{teacher.users?.first_name} {teacher.users?.last_name}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm hidden md:table-cell">{teacher.users?.email}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm hidden lg:table-cell">{teacher.specialization || '-'}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm hidden lg:table-cell">{teacher.department || '-'}</td>
                          <td className="px-3 md:px-4 py-3">
                            <button
                              onClick={() => handleDeleteTeacher(teacher.id)}
                              className="text-red-600 hover:bg-red-50 p-2 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
                  <p className="text-xs md:text-sm text-gray-600">
                    Affichage {startIndexTeachers + 1} à {Math.min(startIndexTeachers + itemsPerPage, filteredTeachers.length)} sur {filteredTeachers.length}
                  </p>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPageTeachers(prev => Math.max(1, prev - 1))}
                      disabled={currentPageTeachers === 1}
                      className="px-2 md:px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <span className="px-3 md:px-4 py-1 border rounded bg-gray-50 text-xs md:text-sm">
                      {currentPageTeachers} / {totalPagesTeachers}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPageTeachers(prev => Math.min(totalPagesTeachers, prev + 1))}
                      disabled={currentPageTeachers === totalPagesTeachers}
                      className="px-2 md:px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* CLASSES TAB */}
        {activeTab === 'classes' && (
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <h2 className="text-xl md:text-2xl font-bold">Classes ({classes.length})</h2>
              <button
                onClick={() => { setModalType('class'); setShowModal(true); }}
                className="bg-purple-600 text-white px-3 py-2 md:px-4 rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm md:text-base w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                Créer
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {classes.map((cls) => (
                <div key={cls.id} className="border rounded-lg p-3 md:p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-base md:text-lg">{cls.name}</h3>
                      <p className="text-xs md:text-sm text-gray-600">{cls.level}</p>
                      <p className="text-xs text-gray-500">{cls.academic_year}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteClass(cls.id)}
                      className="text-red-600 hover:bg-red-50 p-2 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs md:text-sm text-gray-600">Max: {cls.max_students} étudiants</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBJECTS TAB */}
        {activeTab === 'subjects' && (
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <h2 className="text-xl md:text-2xl font-bold">Matières ({subjects.length})</h2>
              <button
                onClick={() => { setModalType('subject'); setShowModal(true); }}
                className="bg-purple-600 text-white px-3 py-2 md:px-4 rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm md:text-base w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                Créer
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {subjects.map((subject) => (
                <div key={subject.id} className="border rounded-lg p-3 md:p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-base md:text-lg">{subject.name}</h3>
                      <p className="text-xs md:text-sm text-gray-600">Code: {subject.code}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteSubject(subject.id)}
                      className="text-red-600 hover:bg-red-50 p-2 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs md:text-sm text-gray-600">Coefficient: {subject.coefficient}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COURSES TAB */}
        {activeTab === 'courses' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Cours à approuver ({courses.filter(c => !c.is_approved).length})</h2>

            <div className="space-y-4">
              {courses.map((course) => (
                <div key={course.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{course.title}</h3>
                      <p className="text-sm text-gray-600">{course.description}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(course.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!course.is_approved && (
                        <button
                          onClick={() => handleApproveCourse(course.id)}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                          Approuver
                        </button>
                      )}
                      <span className={`px-3 py-1 rounded text-sm ${
                        course.is_approved 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {course.is_approved ? 'Approuvé' : 'En attente'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCHEDULES TAB - EMPLOIS DU TEMPS */}
        {activeTab === 'schedules' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Emplois du temps</h2>
              <div className="flex gap-3">
                <select
                  value={selectedClassForSchedule}
                  onChange={(e) => setSelectedClassForSchedule(e.target.value)}
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="">Toutes les classes</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => { 
                    setEditingSchedule(null);
                    resetScheduleForm();
                    setModalType('schedule'); 
                    setShowModal(true); 
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Ajouter un créneau
                </button>
              </div>
            </div>

            {/* Grille emploi du temps */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-4 py-2">Heure</th>
                    {dayNames.map((day, idx) => (
                      <th key={idx} className="border px-4 py-2">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Lignes de temps (simplifié) */}
                  {['08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00'].map((timeSlot) => (
                    <tr key={timeSlot}>
                      <td className="border px-4 py-2 font-medium bg-gray-50">{timeSlot}</td>
                      {[1, 2, 3, 4, 5].map((day) => {
                        const daySchedules = filteredSchedules.filter(s => 
                          s.day_of_week === day && 
                          `${s.start_time.substring(0, 5)}-${s.end_time.substring(0, 5)}` === timeSlot
                        );
                        
                        return (
                          <td key={day} className="border px-2 py-2">
                            {daySchedules.map(schedule => (
                              <div key={schedule.id} className="bg-blue-100 p-2 rounded mb-1 text-sm">
                                <p className="font-semibold">{schedule.subjects?.name}</p>
                                <p className="text-xs text-gray-600">{schedule.classes?.name}</p>
                                <p className="text-xs text-gray-600">
                                  {schedule.teachers?.users?.first_name} {schedule.teachers?.users?.last_name}
                                </p>
                                <p className="text-xs text-gray-500">{schedule.room}</p>
                                <div className="flex gap-1 mt-1">
                                  <button
                                    onClick={() => handleEditSchedule(schedule)}
                                    className="text-blue-600 hover:bg-blue-200 p-1 rounded"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSchedule(schedule.id)}
                                    className="text-red-600 hover:bg-red-200 p-1 rounded"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ANNOUNCEMENTS TAB - ANNONCES */}
        {activeTab === 'announcements' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Annonces ({announcements.length})</h2>
              <button
                onClick={() => { setModalType('announcement'); setShowModal(true); }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Publier
              </button>
            </div>

            <div className="space-y-4">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="border-2 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg">{announcement.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          announcement.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          announcement.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          announcement.priority === 'normal' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {announcement.priority}
                        </span>
                        <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700">
                          {announcement.target_audience === 'all' ? 'Tous' :
                           announcement.target_audience === 'students' ? 'Étudiants' : 'Enseignants'}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-2">{announcement.content}</p>
                      <p className="text-xs text-gray-500">
                        Publié le {new Date(announcement.published_at).toLocaleDateString()}
                        {announcement.expires_at && ` • Expire le ${new Date(announcement.expires_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                      className="text-red-600 hover:bg-red-50 p-2 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {announcements.length === 0 && (
                <p className="text-center py-8 text-gray-500">Aucune annonce publiée</p>
              )}
            </div>
          </div>
        )}

        {/* MODAL D'AFFECTATION */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">
                  {assignModalType === 'student' 
                    ? 'Affecter un étudiant à une classe' 
                    : 'Affecter un enseignant à une matière/classe'}
                </h3>
                <button 
                  onClick={() => setShowAssignModal(false)} 
                  className="text-3xl hover:text-red-600"
                >
                  ×
                </button>
              </div>

              {/* FORMULAIRE ÉTUDIANT */}
              {assignModalType === 'student' && (
                <form onSubmit={handleAssignStudentToClass} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Étudiant *</label>
                    <select
                      value={studentAssignForm.studentId}
                      onChange={(e) => setStudentAssignForm({
                        ...studentAssignForm, 
                        studentId: e.target.value
                      })}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="">Sélectionner un étudiant...</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.student_number} - {student.users?.first_name} {student.users?.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Classe *</label>
                    <select
                      value={studentAssignForm.classId}
                      onChange={(e) => setStudentAssignForm({
                        ...studentAssignForm, 
                        classId: e.target.value
                      })}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="">Sélectionner une classe...</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} ({cls.level})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Année académique</label>
                    <input
                      type="text"
                      value={studentAssignForm.academicYear}
                      onChange={(e) => setStudentAssignForm({
                        ...studentAssignForm, 
                        academicYear: e.target.value
                      })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAssignModal(false)}
                      className="px-6 py-2 border rounded hover:bg-gray-100"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Affectation...' : 'Affecter'}
                    </button>
                  </div>
                </form>
              )}

              {/* FORMULAIRE ENSEIGNANT */}
              {assignModalType === 'teacher' && (
                <form onSubmit={handleAssignTeacherToClass} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Enseignant *</label>
                    <select
                      value={teacherAssignForm.teacherId}
                      onChange={(e) => setTeacherAssignForm({
                        ...teacherAssignForm, 
                        teacherId: e.target.value
                      })}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="">Sélectionner un enseignant...</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.teacher_number} - {teacher.users?.first_name} {teacher.users?.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Matière *</label>
                    <select
                      value={teacherAssignForm.subjectId}
                      onChange={(e) => setTeacherAssignForm({
                        ...teacherAssignForm, 
                        subjectId: e.target.value
                      })}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="">Sélectionner une matière...</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.code} - {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Classe *</label>
                    <select
                      value={teacherAssignForm.classId}
                      onChange={(e) => setTeacherAssignForm({
                        ...teacherAssignForm, 
                        classId: e.target.value
                      })}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="">Sélectionner une classe...</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} ({cls.level})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Année académique</label>
                    <input
                      type="text"
                      value={teacherAssignForm.academicYear}
                      onChange={(e) => setTeacherAssignForm({
                        ...teacherAssignForm, 
                        academicYear: e.target.value
                      })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAssignModal(false)}
                      className="px-6 py-2 border rounded hover:bg-gray-100"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading ? 'Affectation...' : 'Affecter'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TAB AFFECTATION ÉTUDIANTS → CLASSES */}
      {activeTab === 'assign-students' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Affectation Étudiants → Classes</h2>
            <button
              onClick={() => {
                setAssignModalType('student');
                setShowAssignModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Affecter un étudiant
            </button>
          </div>

          {loading ? (
            <p className="text-center py-8">Chargement...</p>
          ) : studentClassAssignments.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-xl text-gray-500">Aucune affectation</p>
              <p className="text-sm text-gray-400 mt-2">
                Cliquez sur "Affecter un étudiant" pour commencer
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Matricule</th>
                    <th className="px-4 py-3 text-left">Étudiant</th>
                    <th className="px-4 py-3 text-left">Classe</th>
                    <th className="px-4 py-3 text-left">Niveau</th>
                    <th className="px-4 py-3 text-left">Année</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studentClassAssignments.map((assignment: any) => (
                    <tr key={assignment.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {assignment.students?.student_number}
                      </td>
                      <td className="px-4 py-3">
                        {assignment.students?.users?.first_name} {assignment.students?.users?.last_name}
                      </td>
                      <td className="px-4 py-3 font-semibold text-blue-600">
                        {assignment.classes?.name}
                      </td>
                      <td className="px-4 py-3">{assignment.classes?.level}</td>
                      <td className="px-4 py-3">{assignment.academic_year}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRemoveStudentFromClass(assignment.id)}
                          className="text-red-600 hover:bg-red-50 p-2 rounded"
                          title="Retirer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

        {/* TAB AFFECTATION ENSEIGNANTS → MATIÈRES → CLASSES */}
        {activeTab === 'assign-teachers' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Affectation Enseignants → Matières → Classes</h2>
              <button
                onClick={() => {
                  setAssignModalType('teacher');
                  setShowAssignModal(true);
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Affecter un enseignant
              </button>
            </div>

            {loading ? (
              <p className="text-center py-8">Chargement...</p>
            ) : teacherClassAssignments.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl text-gray-500">Aucune affectation</p>
                <p className="text-sm text-gray-400 mt-2">
                  Cliquez sur "Affecter un enseignant" pour commencer
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left">Matricule</th>
                      <th className="px-4 py-3 text-left">Enseignant</th>
                      <th className="px-4 py-3 text-left">Matière</th>
                      <th className="px-4 py-3 text-left">Classe</th>
                      <th className="px-4 py-3 text-left">Année</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherClassAssignments.map((assignment: any) => (
                      <tr key={assignment.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {assignment.teachers?.teacher_number}
                        </td>
                        <td className="px-4 py-3">
                          {assignment.teachers?.users?.first_name} {assignment.teachers?.users?.last_name}
                        </td>
                        <td className="px-4 py-3 font-semibold text-purple-600">
                          {assignment.subjects?.name}
                        </td>
                        <td className="px-4 py-3 font-semibold text-blue-600">
                          {assignment.classes?.name}
                        </td>
                        <td className="px-4 py-3">{assignment.academic_year}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleRemoveTeacherFromClass(assignment.id)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded"
                            title="Retirer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">
                {modalType === 'student' && 'Ajouter un étudiant'}
                {modalType === 'teacher' && 'Ajouter un enseignant'}
                {modalType === 'class' && 'Créer une classe'}
                {modalType === 'subject' && 'Créer une matière'}
                {modalType === 'schedule' && (editingSchedule ? 'Modifier le créneau' : 'Ajouter un créneau')}
                {modalType === 'announcement' && 'Publier une annonce'}
              </h3>
              <button onClick={() => { setShowModal(false); setEditingSchedule(null); }} className="text-3xl">×</button>
            </div>

            {/* STUDENT FORM */}
            {modalType === 'student' && (
              <form onSubmit={handleAddStudent} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Prénom *</label>
                    <input
                      type="text"
                      value={studentForm.firstName}
                      onChange={(e) => setStudentForm({...studentForm, firstName: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Nom *</label>
                    <input
                      type="text"
                      value={studentForm.lastName}
                      onChange={(e) => setStudentForm({...studentForm, lastName: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email *</label>
                  <input
                    type="email"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({...studentForm, email: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Matricule *</label>
                    <input
                      type="text"
                      value={studentForm.studentNumber}
                      onChange={(e) => setStudentForm({...studentForm, studentNumber: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={studentForm.phone}
                      onChange={(e) => setStudentForm({...studentForm, phone: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Date de naissance</label>
                  <input
                    type="date"
                    value={studentForm.dateOfBirth}
                    onChange={(e) => setStudentForm({...studentForm, dateOfBirth: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Adresse</label>
                  <textarea
                    value={studentForm.address}
                    onChange={(e) => setStudentForm({...studentForm, address: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    rows={2}
                  />
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 border rounded"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}

            {/* TEACHER FORM */}
            {modalType === 'teacher' && (
              <form onSubmit={handleAddTeacher} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Prénom *</label>
                    <input
                      type="text"
                      value={teacherForm.firstName}
                      onChange={(e) => setTeacherForm({...teacherForm, firstName: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Nom *</label>
                    <input
                      type="text"
                      value={teacherForm.lastName}
                      onChange={(e) => setTeacherForm({...teacherForm, lastName: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email *</label>
                  <input
                    type="email"
                    value={teacherForm.email}
                    onChange={(e) => setTeacherForm({...teacherForm, email: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Matricule *</label>
                    <input
                      type="text"
                      value={teacherForm.teacherNumber}
                      onChange={(e) => setTeacherForm({...teacherForm, teacherNumber: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={teacherForm.phone}
                      onChange={(e) => setTeacherForm({...teacherForm, phone: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Spécialité</label>
                    <input
                      type="text"
                      value={teacherForm.specialization}
                      onChange={(e) => setTeacherForm({...teacherForm, specialization: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Département</label>
                    <input
                      type="text"
                      value={teacherForm.department}
                      onChange={(e) => setTeacherForm({...teacherForm, department: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 border rounded"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}

            {/* CLASS FORM */}
            {modalType === 'class' && (
              <form onSubmit={handleAddClass} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nom de la classe *</label>
                  <input
                    type="text"
                    value={classForm.name}
                    onChange={(e) => setClassForm({...classForm, name: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Ex: L1 - Groupe A"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Niveau *</label>
                  <select
                    value={classForm.level}
                    onChange={(e) => setClassForm({...classForm, level: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    <option value="">Sélectionner...</option>
                    <option value="Licence 1">Technicien</option>
                    <option value="Licence 2">TS1</option>
                    <option value="Licence 3">TS2</option>
                    <option value="Master 1">Bachelor</option>
                    <option value="Master 2">Master 1</option>
                    <option value="Master 2">Master 2</option>
                  </select>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Année académique *</label>
                    <input
                      type="text"
                      value={classForm.academicYear}
                      onChange={(e) => setClassForm({...classForm, academicYear: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Max étudiants</label>
                    <input
                      type="number"
                      value={classForm.maxStudents}
                      onChange={(e) => setClassForm({...classForm, maxStudents: parseInt(e.target.value)})}
                      className="w-full border rounded px-3 py-2"
                      min="1"
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 border rounded"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Création...' : 'Créer'}
                  </button>
                </div>
              </form>
            )}

            {/* SUBJECT FORM */}
            {modalType === 'subject' && (
              <form onSubmit={handleAddSubject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nom de la matière *</label>
                  <input
                    type="text"
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({...subjectForm, name: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Ex: Mathématiques"
                    required
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Code *</label>
                    <input
                      type="text"
                      value={subjectForm.code}
                      onChange={(e) => setSubjectForm({...subjectForm, code: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ex: MATH101"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Coefficient</label>
                    <input
                      type="number"
                      value={subjectForm.coefficient}
                      onChange={(e) => setSubjectForm({...subjectForm, coefficient: parseInt(e.target.value)})}
                      className="w-full border rounded px-3 py-2"
                      min="1"
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 border rounded"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Création...' : 'Créer'}
                  </button>
                </div>
              </form>
            )}

            {/* SCHEDULE FORM */}
            {modalType === 'schedule' && (
              <form onSubmit={handleAddOrUpdateSchedule} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Classe *</label>
                    <select
                      value={scheduleForm.classId}
                      onChange={(e) => setScheduleForm({...scheduleForm, classId: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Matière *</label>
                    <select
                      value={scheduleForm.subjectId}
                      onChange={(e) => setScheduleForm({...scheduleForm, subjectId: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {subjects.map(subject => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Enseignant *</label>
                  <select
                    value={scheduleForm.teacherId}
                    onChange={(e) => setScheduleForm({...scheduleForm, teacherId: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.users?.first_name} {teacher.users?.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Jour *</label>
                    <select
                      value={scheduleForm.dayOfWeek}
                      onChange={(e) => setScheduleForm({...scheduleForm, dayOfWeek: parseInt(e.target.value)})}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="1">Lundi</option>
                      <option value="2">Mardi</option>
                      <option value="3">Mercredi</option>
                      <option value="4">Jeudi</option>
                      <option value="5">Vendredi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Heure début *</label>
                    <input
                      type="time"
                      value={scheduleForm.startTime}
                      onChange={(e) => setScheduleForm({...scheduleForm, startTime: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Heure fin *</label>
                    <input
                      type="time"
                      value={scheduleForm.endTime}
                      onChange={(e) => setScheduleForm({...scheduleForm, endTime: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Salle</label>
                    <input
                      type="text"
                      value={scheduleForm.room}
                      onChange={(e) => setScheduleForm({...scheduleForm, room: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ex: A101"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Année académique *</label>
                    <input
                      type="text"
                      value={scheduleForm.academicYear}
                      onChange={(e) => setScheduleForm({...scheduleForm, academicYear: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setEditingSchedule(null); }}
                    className="px-6 py-2 border rounded"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Enregistrement...' : editingSchedule ? 'Modifier' : 'Créer'}
                  </button>
                </div>
              </form>
            )}

            {/* ANNOUNCEMENT FORM */}
            {modalType === 'announcement' && (
              <form onSubmit={handleAddAnnouncement} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Titre *</label>
                  <input
                    type="text"
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Titre de l'annonce"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Contenu *</label>
                  <textarea
                    value={announcementForm.content}
                    onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    rows={5}
                    placeholder="Contenu de l'annonce..."
                    required
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Destinataires *</label>
                    <select
                      value={announcementForm.targetAudience}
                      onChange={(e) => setAnnouncementForm({...announcementForm, targetAudience: e.target.value as any})}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="all">Tous (Étudiants + Enseignants)</option>
                      <option value="students">Étudiants uniquement</option>
                      <option value="teachers">Enseignants uniquement</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Priorité *</label>
                    <select
                      value={announcementForm.priority}
                      onChange={(e) => setAnnouncementForm({...announcementForm, priority: e.target.value as any})}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="low">Basse</option>
                      <option value="normal">Normale</option>
                      <option value="high">Élevée</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Date d'expiration (optionnel)</label>
                  <input
                    type="date"
                    value={announcementForm.expiresAt}
                    onChange={(e) => setAnnouncementForm({...announcementForm, expiresAt: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 border rounded"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Publication...' : 'Publier'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}


      {/* MODAL MODIFICATION NOTE - DÉPLACÉE ICI */}
      {showGradeModal && editingGrade && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">Modifier la note</h3>
              <button 
                onClick={() => {
                  setShowGradeModal(false);
                  setEditingGrade(null);
                }} 
                className="text-3xl hover:text-red-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpdateGrade} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Matière</label>
                <input
                  type="text"
                  value={editingGrade.subjects?.name}
                  disabled
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Note /20 *</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.25"
                    value={gradeForm.gradeValue}
                    onChange={(e) => setGradeForm({...gradeForm, gradeValue: parseFloat(e.target.value)})}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Coefficient *</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={gradeForm.coefficient}
                    onChange={(e) => setGradeForm({...gradeForm, coefficient: parseInt(e.target.value)})}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Type *</label>
                  <select
                    value={gradeForm.gradeType}
                    onChange={(e) => setGradeForm({...gradeForm, gradeType: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    <option>Examen</option>
                    <option>Devoir</option>
                    <option>TP</option>
                    <option>Contrôle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Date</label>
                  <input
                    type="date"
                    value={gradeForm.examDate}
                    onChange={(e) => setGradeForm({...gradeForm, examDate: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Commentaire</label>
                <textarea
                  value={gradeForm.comment}
                  onChange={(e) => setGradeForm({...gradeForm, comment: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowGradeModal(false);
                    setEditingGrade(null);
                  }}
                  className="px-6 py-2 border rounded hover:bg-gray-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  {loading ? 'Modification...' : 'Modifier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
    </div>
    
  );
};

export default AdminDashboard;
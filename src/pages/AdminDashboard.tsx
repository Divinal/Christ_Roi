// src/pages/AdminDashboard.tsx - V2 avec Emplois du temps et Annonces
import React, { useState, useEffect } from 'react';
import { 
  Home, Users, BookOpen, Plus, Edit, Trash2, Search, 
  Calendar, FileText, MessageSquare, X, Save, Bell, Clock
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
        loadAnnouncements()
      ]);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
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
  const filteredStudents = students.filter(s =>
    (s.student_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.users?.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.users?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTeachers = teachers.filter(t =>
    (t.teacher_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.users?.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.users?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <nav className="bg-purple-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Administration</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">Admin: {user?.first_name}</span>
            <button
              onClick={onLogout}
              className="bg-purple-700 px-4 py-2 rounded hover:bg-purple-800"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      {/* TABS */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 overflow-x-auto">
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
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="grid md:grid-cols-4 gap-6 mb-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <p className="text-4xl font-bold text-blue-600">{students.length}</p>
                <p className="text-gray-600">Étudiants</p>
              </div>
              <div className="bg-green-50 p-6 rounded-lg">
                <p className="text-4xl font-bold text-green-600">{teachers.length}</p>
                <p className="text-gray-600">Enseignants</p>
              </div>
              <div className="bg-purple-50 p-6 rounded-lg">
                <p className="text-4xl font-bold text-purple-600">{classes.length}</p>
                <p className="text-gray-600">Classes</p>
              </div>
              <div className="bg-orange-50 p-6 rounded-lg">
                <p className="text-4xl font-bold text-orange-600">{subjects.length}</p>
                <p className="text-gray-600">Matières</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Actions rapides</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <button
                  onClick={() => { setModalType('student'); setShowModal(true); }}
                  className="flex items-center gap-2 p-4 border rounded-lg hover:bg-blue-50"
                >
                  <Plus className="w-5 h-5 text-blue-600" />
                  <span>Ajouter un étudiant</span>
                </button>
                <button
                  onClick={() => { setModalType('teacher'); setShowModal(true); }}
                  className="flex items-center gap-2 p-4 border rounded-lg hover:bg-green-50"
                >
                  <Plus className="w-5 h-5 text-green-600" />
                  <span>Ajouter un enseignant</span>
                </button>
                <button
                  onClick={() => { setModalType('class'); setShowModal(true); }}
                  className="flex items-center gap-2 p-4 border rounded-lg hover:bg-purple-50"
                >
                  <Plus className="w-5 h-5 text-purple-600" />
                  <span>Créer une classe</span>
                </button>
                <button
                  onClick={() => { setModalType('subject'); setShowModal(true); }}
                  className="flex items-center gap-2 p-4 border rounded-lg hover:bg-orange-50"
                >
                  <Plus className="w-5 h-5 text-orange-600" />
                  <span>Créer une matière</span>
                </button>
                <button
                  onClick={() => { setModalType('schedule'); setShowModal(true); }}
                  className="flex items-center gap-2 p-4 border rounded-lg hover:bg-indigo-50"
                >
                  <Plus className="w-5 h-5 text-indigo-600" />
                  <span>Ajouter un créneau</span>
                </button>
                <button
                  onClick={() => { setModalType('announcement'); setShowModal(true); }}
                  className="flex items-center gap-2 p-4 border rounded-lg hover:bg-pink-50"
                >
                  <Plus className="w-5 h-5 text-pink-600" />
                  <span>Publier une annonce</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'students' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Étudiants ({filteredStudents.length})</h2>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border rounded-lg px-3 py-2 pl-10"
                  />
                </div>
                <button
                  onClick={() => { setModalType('student'); setShowModal(true); }}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Ajouter
                </button>
              </div>
            </div>

            {loading ? (
              <p className="text-center py-8">Chargement...</p>
            ) : filteredStudents.length === 0 ? (
              <p className="text-center py-8 text-gray-500">Aucun étudiant trouvé</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left">Matricule</th>
                      <th className="px-4 py-3 text-left">Nom complet</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Statut</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{student.student_number}</td>
                        <td className="px-4 py-3">{student.users?.first_name} {student.users?.last_name}</td>
                        <td className="px-4 py-3">{student.users?.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            student.status === 'active' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
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
            )}
          </div>
        )}

        {/* TEACHERS TAB */}
        {activeTab === 'teachers' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Enseignants ({filteredTeachers.length})</h2>
              <button
                onClick={() => { setModalType('teacher'); setShowModal(true); }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Ajouter
              </button>
            </div>

            {loading ? (
              <p className="text-center py-8">Chargement...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left">Matricule</th>
                      <th className="px-4 py-3 text-left">Nom</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Spécialité</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeachers.map((teacher) => (
                      <tr key={teacher.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{teacher.teacher_number}</td>
                        <td className="px-4 py-3">{teacher.users?.first_name} {teacher.users?.last_name}</td>
                        <td className="px-4 py-3">{teacher.users?.email}</td>
                        <td className="px-4 py-3">{teacher.specialization || '-'}</td>
                        <td className="px-4 py-3">
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
            )}
          </div>
        )}

        {/* CLASSES TAB */}
        {activeTab === 'classes' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Classes ({classes.length})</h2>
              <button
                onClick={() => { setModalType('class'); setShowModal(true); }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Créer
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls) => (
                <div key={cls.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{cls.name}</h3>
                      <p className="text-sm text-gray-600">{cls.level}</p>
                      <p className="text-xs text-gray-500">{cls.academic_year}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteClass(cls.id)}
                      className="text-red-600 hover:bg-red-50 p-2 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">Max: {cls.max_students} étudiants</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBJECTS TAB */}
        {activeTab === 'subjects' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Matières ({subjects.length})</h2>
              <button
                onClick={() => { setModalType('subject'); setShowModal(true); }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Créer
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map((subject) => (
                <div key={subject.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{subject.name}</h3>
                      <p className="text-sm text-gray-600">Code: {subject.code}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteSubject(subject.id)}
                      className="text-red-600 hover:bg-red-50 p-2 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">Coefficient: {subject.coefficient}</p>
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
      </div>

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
                    <option value="Licence 1">Licence 1</option>
                    <option value="Licence 2">Licence 2</option>
                    <option value="Licence 3">Licence 3</option>
                    <option value="Master 1">Master 1</option>
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
    </div>
  );
};

export default AdminDashboard;
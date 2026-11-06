// src/pages/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  Home, Users, BookOpen, Plus, Edit, Trash2, Search,
  FileText, Bell, Clock, Eye, MessageSquare, GraduationCap,
  ChevronLeft, ChevronRight, Filter, DollarSign, Shield,
  KeyRound, Link2, Printer
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { callAdminUsers } from '../lib/adminUsers';
import AppShell, { NavGroup } from '../components/ui/AppShell';
import { confirmDialog, infoDialog, notify } from '../components/ui/feedback';
import AdminHome, { QuickAddType } from '../components/admin/AdminHome';
import GradesManagement from '../components/grades/GradesManagement';
import FinanceManagement from '../components/finance/FinanceManagement';
import LevelSelect from '../components/levels/LevelSelect';
import LevelsManagement from '../components/levels/LevelsManagement';
import StudentListPrint from '../components/levels/StudentListPrint';
import TeacherDetail, { TeacherRecord, TeacherTab } from '../components/teachers/TeacherDetail';
import { Announcement, PRIORITY_CLASSES, PRIORITY_LABELS } from '../lib/announcements';
import { CURRENT_ACADEMIC_YEAR, CYCLES, Level, SchoolCycle, fetchLevels } from '../lib/levels';
import { timeSlotOf, timeSlotsOf } from '../lib/schedule';
import { useHashTab } from '../lib/useHashTab';

interface User {
  id: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

interface Student {
  id: string;
  user_id: string;
  student_number: string;
  level_id?: string | null;
  date_of_birth?: string;
  address?: string;
  status: string;
  annual_tuition_fee?: number | null;
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  levels?: {
    id: string;
    name: string;
    cycle: SchoolCycle;
  };
}

type Teacher = TeacherRecord;

interface Subject {
  id: string;
  name: string;
  code: string;
  coefficient: number;
}

interface Schedule {
  id: string;
  level_id: string | null;
  subject_id: string;
  teacher_id: string;
  day_of_week: number; // 1=Lundi, 2=Mardi, etc.
  start_time: string;
  end_time: string;
  room?: string;
  academic_year: string;
}

interface ScheduleDetailed extends Schedule {
  levels?: { name: string };
  subjects?: { name: string };
  teachers?: { profiles?: { first_name: string; last_name: string } };
}

// Onglets visibles selon le rôle connecté (la vraie barrière reste les
// policies RLS côté base ; ceci n'est qu'un filtrage d'affichage)
const ROLE_TABS: Record<string, string[]> = {
  admin: ['dashboard', 'students', 'teachers', 'levels', 'subjects', 'schedules', 'announcements', 'assign-teachers', 'grades', 'finance', 'admins'],
  academic_admin: ['dashboard', 'students', 'teachers', 'levels', 'subjects', 'schedules', 'announcements', 'assign-teachers', 'grades'],
  finance_admin: ['dashboard', 'students', 'teachers', 'levels', 'finance'],
  admin_secretaire: ['dashboard', 'students', 'teachers', 'levels', 'subjects', 'schedules', 'assign-teachers'],
};
// Une seule navigation pour tous les rôles admin : chacun n'en voit que ce que
// ROLE_TABS lui autorise.
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Général',
    items: [{ id: 'dashboard', label: 'Tableau de bord', icon: Home }],
  },
  {
    label: 'Scolarité',
    items: [
      { id: 'students', label: 'Étudiants', icon: Users },
      { id: 'levels', label: 'Cycles & Niveaux', icon: GraduationCap },
      { id: 'grades', label: 'Notes', icon: FileText },
    ],
  },
  {
    label: 'Pédagogie',
    items: [
      { id: 'teachers', label: 'Enseignants', icon: BookOpen },
      { id: 'assign-teachers', label: 'Affectations', icon: Link2 },
      { id: 'subjects', label: 'Matières', icon: FileText },
      { id: 'schedules', label: 'Emplois du temps', icon: Clock },
    ],
  },
  {
    label: 'Communication',
    items: [{ id: 'announcements', label: 'Annonces', icon: Bell }],
  },
  {
    label: 'Administration',
    items: [
      { id: 'finance', label: 'Finances', icon: DollarSign },
      { id: 'admins', label: 'Comptes admin', icon: Shield },
    ],
  },
];

const fullNameOf = (person?: { profiles?: { first_name?: string; last_name?: string } | null } | null): string =>
  `${person?.profiles?.first_name || ''} ${person?.profiles?.last_name || ''}`.trim();
// Rôles gérables depuis l'onglet "Comptes Admin" (admin général uniquement)
const ADMIN_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin Général',
  academic_admin: 'Admin Pédagogique',
  finance_admin: 'Admin Financier',
  admin_secretaire: 'Admin Secrétaire',
};

interface AdminDashboardProps {
  user: User | null;
  onLogout: () => void;
  onChangePassword: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onChangePassword }) => {
  const allowedTabs = ROLE_TABS[user?.role || ''] || ['dashboard'];
  const [activeTab, navigateTab] = useHashTab(allowedTabs, 'dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<ScheduleDetailed[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'student' | 'teacher' | 'subject' | 'schedule' | 'announcement' | 'admin'>('student');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  // ==================== ÉTATS PAGINATION ET FILTRES ====================
  const [currentPageStudents, setCurrentPageStudents] = useState<number>(1);
  const [currentPageTeachers, setCurrentPageTeachers] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [cycleFilter, setCycleFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [selectedLevelForSubjects, setSelectedLevelForSubjects] = useState<string>('');
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [gradesStudentId, setGradesStudentId] = useState<string>('');
  const [printLevelId, setPrintLevelId] = useState<string>('');

  const [teacherAssignForm, setTeacherAssignForm] = useState({
    teacherId: '',
    subjectId: '',
    levelId: ''
  });

  // Formulaires
  const [studentForm, setStudentForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    studentNumber: '', dateOfBirth: '', address: '', levelId: ''
  });

  const [teacherForm, setTeacherForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    teacherNumber: '', specialization: '', department: ''
  });

  const [adminForm, setAdminForm] = useState({
    firstName: '', lastName: '', email: '', role: 'academic_admin'
  });

  const [subjectForm, setSubjectForm] = useState({
    name: '', code: '', coefficient: 1,
    selectedLevels: [] as string[]
  });



  const [scheduleForm, setScheduleForm] = useState({
    levelId: '',
    subjectId: '',
    teacherId: '',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '10:30',
    room: '',
    academicYear: CURRENT_ACADEMIC_YEAR
  });

  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    targetAudience: 'all' as 'students' | 'teachers' | 'all',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    expiresAt: ''
  });

  const [selectedLevelForSchedule, setSelectedLevelForSchedule] = useState<string>('');
  const [viewingTeacher, setViewingTeacher] = useState<{ id: string; tab: TeacherTab } | null>(null);

  // La fiche enseignant (modifier, supprimer, messages...) est réservée à
  // l'admin général, comme la suppression du compte de connexion associé.
  const canManageTeachers = user?.role === 'admin';
  // Mêmes rôles que la policy RLS d'écriture sur la table levels.
  const canManageLevels = user?.role === 'admin' || user?.role === 'academic_admin';
  // Mêmes rôles que la fonction serveur admin-users.
  const canDeleteStudents = user?.role === 'admin' || user?.role === 'academic_admin';
  const canResetStudentPassword = canDeleteStudents || user?.role === 'admin_secretaire';

  const handleSelectTab = (tab: string) => {
    navigateTab(tab);
    setViewingTeacher(null);
    setSearchTerm('');
  };

  const openQuickAdd = (type: QuickAddType) => {
    setEditingSubject(null);
    setEditingSchedule(null);
    setModalType(type);
    setShowModal(true);
  };

  const showCredentials = (title: string, email: string, password: string) => {
    infoDialog({
      title,
      message: `Email de connexion : ${email}\n\nMot de passe temporaire à lui transmettre. Il ne sera plus affiché, et devra être changé à la première connexion :`,
      secret: password,
    });
  };

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
        loadLevels(),
        loadSubjects(),
        loadSchedules(),
        loadAnnouncements(),
        loadTeacherAssignments(),
        loadSubjectLevelLinks(),
        ...(user?.role === 'admin' ? [loadAdminAccounts()] : [])
      ]);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

const loadTeacherAssignments = async () => {
  const { data, error } = await supabase
    .from('teacher_levels')
    .select(`*, teachers(id, teacher_number, profiles(first_name, last_name, email)),
      subjects(id, name, code),
      levels(id, name, cycle)
    `);

  if (error) {
    console.error('Erreur chargement affectations enseignants:', error);
  } else {
    setTeacherAssignments(data || []);
  }
};

  const loadStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*, profiles(first_name, last_name, email), levels(id, name, cycle)')
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
      .select('*, profiles(first_name, last_name, email)')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erreur chargement enseignants:', error);
    } else {
      setTeachers(data || []);
    }
  };

  const loadAdminAccounts = async () => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('id, user_id, role, profiles(first_name, last_name, email)')
      .in('role', ['admin', 'academic_admin', 'finance_admin', 'admin_secretaire'])
      .order('role', { ascending: true });

    if (error) {
      console.error('Erreur chargement comptes admin:', error);
    } else {
      setAdminAccounts(data || []);
    }
  };

  const loadLevels = async () => {
    setLevels(await fetchLevels());
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

  const [subjectLevelLinks, setSubjectLevelLinks] = useState<any[]>([]);
    const loadSubjectLevelLinks = async () => {
      const { data, error } = await supabase
        .from('subject_levels')
        .select('level_id, subject_id');

      if (error) {
        console.error('Erreur chargement liens matières-niveaux:', error);
      } else {
        setSubjectLevelLinks(data || []);
      }
    };

  const loadSchedules = async () => {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        levels(name),
        subjects(name),
        teachers(profiles(first_name, last_name))
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

      // ==================== GESTION FORMULAIRES ====================
      const handleChangeStudentLevel = async (studentId: string, levelId: string) => {
        const { data, error } = await supabase
          .from('students')
          .update({ level_id: levelId || null })
          .eq('id', studentId)
          .select('id');

        if (error) {
          notify(`❌ Erreur: ${error.message}`);
        } else if (!data?.length) {
          notify("❌ Modification refusée : vous n'avez pas les droits nécessaires.");
        } else {
          loadStudents();
        }
      };

const handleAssignTeacherToLevel = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!teacherAssignForm.teacherId || !teacherAssignForm.subjectId || !teacherAssignForm.levelId) {
    notify('⚠️ Veuillez remplir tous les champs');
    return;
  }

  setLoading(true);
  try {
    const { error } = await supabase
      .from('teacher_levels')
      .insert({
        teacher_id: teacherAssignForm.teacherId,
        subject_id: teacherAssignForm.subjectId,
        level_id: teacherAssignForm.levelId
      });

    if (error) {
      if (error.code === '23505') {
        notify('⚠️ Cet enseignant est déjà affecté à cette matière pour ce niveau');
      } else {
        throw error;
      }
    } else {
      notify('✅ Enseignant affecté avec succès !');
      setShowAssignModal(false);
      setTeacherAssignForm({ teacherId: '', subjectId: '', levelId: '' });
      loadTeacherAssignments();
    }
  } catch (error: any) {
    notify(`❌ Erreur: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

const handleRemoveTeacherAssignment = async (assignmentId: string) => {
  if (!await confirmDialog('⚠️ Retirer cet enseignant de cette affectation ?')) return;

  try {
    const { error } = await supabase
      .from('teacher_levels')
      .delete()
      .eq('id', assignmentId);

    if (error) throw error;
    notify('✅ Enseignant retiré de l\'affectation');
    loadTeacherAssignments();
  } catch (error: any) {
    notify(`❌ Erreur: ${error.message}`);
  }
};

    // ==================== COMPTES DE CONNEXION (fonction serveur admin-users) ====================
    const handleAddStudent = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const email = studentForm.email.trim();
        const { temporary_password } = await callAdminUsers<{ temporary_password: string }>('create_student', {
          email,
          first_name: studentForm.firstName,
          last_name: studentForm.lastName,
          phone: studentForm.phone,
          student_number: studentForm.studentNumber,
          level_id: studentForm.levelId,
          date_of_birth: studentForm.dateOfBirth,
          address: studentForm.address,
        });
        setShowModal(false);
        resetStudentForm();
        await loadStudents();
        showCredentials('Étudiant créé', email, temporary_password);
      } catch (error: any) {
        notify(`❌ ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    const handleAddTeacher = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const email = teacherForm.email.trim();
        const { temporary_password } = await callAdminUsers<{ temporary_password: string }>('create_teacher', {
          email,
          first_name: teacherForm.firstName,
          last_name: teacherForm.lastName,
          phone: teacherForm.phone,
          teacher_number: teacherForm.teacherNumber,
          specialization: teacherForm.specialization,
          department: teacherForm.department,
        });
        setShowModal(false);
        resetTeacherForm();
        await loadTeachers();
        showCredentials('Enseignant créé', email, temporary_password);
      } catch (error: any) {
        notify(`❌ ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    const handleAddAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const email = adminForm.email.trim();
        const { temporary_password } = await callAdminUsers<{ temporary_password: string }>('create_admin', {
          email,
          first_name: adminForm.firstName,
          last_name: adminForm.lastName,
          role: adminForm.role,
        });
        setShowModal(false);
        setAdminForm({ firstName: '', lastName: '', email: '', role: 'academic_admin' });
        await loadAdminAccounts();
        showCredentials(`Compte ${ADMIN_ROLE_LABELS[adminForm.role]} créé`, email, temporary_password);
      } catch (error: any) {
        notify(`❌ ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    const handleResetStudentPassword = async (student: Student) => {
      const name = fullNameOf(student) || student.student_number;
      const confirmed = await confirmDialog(
        `Générer un nouveau mot de passe temporaire pour ${name} ?\n\nSon mot de passe actuel ne fonctionnera plus.`,
        { title: 'Réinitialiser le mot de passe', confirmLabel: 'Réinitialiser' },
      );
      if (!confirmed) return;

      try {
        const { temporary_password } = await callAdminUsers<{ temporary_password: string }>(
          'reset_student_password',
          { student_id: student.id },
        );
        showCredentials(`Nouveau mot de passe de ${name}`, student.profiles?.email || '', temporary_password);
      } catch (error: any) {
        notify(`❌ ${error.message}`);
      }
    };

    const handleRemoveAdminRole = async (assignmentId: string, targetUserId: string) => {
      if (targetUserId === user?.id) {
        notify("⚠️ Vous ne pouvez pas retirer votre propre rôle.");
        return;
      }
      if (!await confirmDialog("⚠️ Retirer ce rôle d'administration à cette personne ?")) return;

      try {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('id', assignmentId);

        if (error) throw error;
        notify('✅ Rôle retiré');
        loadAdminAccounts();
      } catch (error: any) {
        notify(`❌ Erreur: ${error.message}`);
      }
    };

  // ==================== AJOUT MATIÈRE ====================
    // Ligne ~588 - Dans handleAddSubject
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Créer la matière
      const { data: newSubject, error: subjectError } = await supabase
        .from('subjects')
        .insert({
          name: subjectForm.name,
          code: subjectForm.code,
          coefficient: subjectForm.coefficient
        })
        .select()
        .single();

      if (subjectError) throw subjectError;

      // 2. Associer les niveaux sélectionnés (s'il y en a)
      if (subjectForm.selectedLevels.length > 0) {
        const links = subjectForm.selectedLevels.map(levelId => ({
          subject_id: newSubject.id,
          level_id: levelId
        }));

        const { error: linkError } = await supabase
          .from('subject_levels')
          .insert(links);

        if (linkError) throw linkError;
      }

      notify('✅ Matière créée avec succès !');
      setShowModal(false);
      resetSubjectForm();
      loadSubjects();
      loadSubjectLevelLinks();
    } catch (error: any) {
      notify(`❌ Erreur: ${error.message}`);
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
        level_id: scheduleForm.levelId,
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
        notify('✅ Emploi du temps modifié avec succès !');
      } else {
        // Création
        const { error } = await supabase
          .from('schedules')
          .insert(scheduleData);

        if (error) throw error;
        notify('✅ Emploi du temps créé avec succès !');
      }

      setShowModal(false);
      resetScheduleForm();
      setEditingSchedule(null);
      loadSchedules();
    } catch (error: any) {
      notify(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSchedule = (schedule: ScheduleDetailed) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      levelId: schedule.level_id || '',
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
    if (!await confirmDialog('⚠️ Êtes-vous sûr de vouloir supprimer ce créneau ?')) return;

    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;
      notify('✅ Créneau supprimé');
      loadSchedules();
    } catch (error: any) {
      notify(`❌ Erreur: ${error.message}`);
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

      notify('✅ Annonce publiée avec succès !');
      setShowModal(false);
      resetAnnouncementForm();
      loadAnnouncements();
    } catch (error: any) {
      notify(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!await confirmDialog('⚠️ Êtes-vous sûr de vouloir supprimer cette annonce ?')) return;

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId);

      if (error) throw error;
      notify('✅ Annonce supprimée');
      loadAnnouncements();
    } catch (error: any) {
      notify(`❌ Erreur: ${error.message}`);
    }
  };

  // ==================== SUPPRESSION ====================
  const handleDeleteStudent = async (student: Student) => {
    const name = fullNameOf(student) || student.student_number;
    const confirmed = await confirmDialog(
      `⚠️ Supprimer définitivement ${name} ?\n\nSeront supprimés : son compte de connexion, ses notes et ses paiements de scolarité, qui sortiront des totaux financiers.`,
      { title: "Supprimer l'étudiant", confirmLabel: 'Supprimer' },
    );
    if (!confirmed) return;

    try {
      const { login_deleted, reason } = await callAdminUsers<{ login_deleted: boolean; reason?: string }>(
        'delete_student',
        { student_id: student.id },
      );
      if (login_deleted || reason === 'other_roles') {
        notify('✅ Étudiant supprimé');
      } else {
        notify("⚠️ La fiche est supprimée, mais pas le compte de connexion. Réessayez ou contactez le support.");
      }
      loadStudents();
    } catch (error: any) {
      notify(`❌ ${error.message}`);
    }
  };

  const handleDeleteTeacher = async (teacher: Teacher) => {
    const name = fullNameOf(teacher) || teacher.teacher_number;

    const { count: payslipCount } = await supabase
      .from('teacher_payslips')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacher.id);

    const payslipWarning = payslipCount
      ? `\n- ses ${payslipCount} bulletin(s) de paie, qui sortiront aussi du suivi financier`
      : '';
    const confirmed = await confirmDialog(
      `⚠️ Supprimer définitivement ${name} ?\n\nSeront supprimés :\n- son compte de connexion\n- ses affectations${payslipWarning}\n\nSes notes et créneaux sont conservés, sans enseignant.`,
      { title: "Supprimer l'enseignant", confirmLabel: 'Supprimer' },
    );
    if (!confirmed) return;

    try {
      const { login_deleted, reason } = await callAdminUsers<{ login_deleted: boolean; reason?: string }>(
        'delete_teacher',
        { teacher_id: teacher.id },
      );
      if (login_deleted || reason === 'other_roles') {
        notify('✅ Enseignant supprimé');
      } else {
        notify("⚠️ La fiche est supprimée, mais pas le compte de connexion. Réessayez ou contactez le support.");
      }
      setViewingTeacher(null);
      loadTeachers();
      loadTeacherAssignments();
      loadSchedules();
    } catch (error: any) {
      notify(`❌ ${error.message}`);
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!await confirmDialog('⚠️ Êtes-vous sûr de vouloir supprimer cette matière ?')) return;

    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId);

      if (error) throw error;
      notify('✅ Matière supprimée');
      loadSubjects();
    } catch (error: any) {
      notify(`❌ Erreur: ${error.message}`);
    }
  };

  // ==================== MODIFICATION MATIÈRE ====================
      const handleEditSubject = async (subject: Subject) => {
      setEditingSubject(subject);
      
      // Charger les niveaux déjà associés
      const { data: linkedLevels } = await supabase
        .from('subject_levels')
        .select('level_id')
        .eq('subject_id', subject.id);

      setSubjectForm({
        name: subject.name,
        code: subject.code,
        coefficient: subject.coefficient,
        selectedLevels: linkedLevels?.map(l => l.level_id) || []
      });
      
      setModalType('subject');
      setShowModal(true);
    };

    const handleUpdateSubject = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingSubject) return;

      setLoading(true);
      try {
        // 1. Mettre à jour la matière
        const { error: updateError } = await supabase
          .from('subjects')
          .update({
            name: subjectForm.name,
            code: subjectForm.code,
            coefficient: subjectForm.coefficient
          })
          .eq('id', editingSubject.id);

        if (updateError) throw updateError;

        // 2. Mettre à jour les associations (supprimer puis recréer)
        const { error: unlinkError } = await supabase
          .from('subject_levels')
          .delete()
          .eq('subject_id', editingSubject.id);

        if (unlinkError) throw unlinkError;

        if (subjectForm.selectedLevels.length > 0) {
          const links = subjectForm.selectedLevels.map(levelId => ({
            subject_id: editingSubject.id,
            level_id: levelId
          }));

          const { error: linkError } = await supabase
            .from('subject_levels')
            .insert(links);

          if (linkError) throw linkError;
        }

        notify('✅ Matière modifiée avec succès !');
        setShowModal(false);
        setEditingSubject(null);
        resetSubjectForm();
        loadSubjects();
        loadSubjectLevelLinks();
      } catch (error: any) {
        notify(`❌ Erreur: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

  // ==================== RESET FORMS ====================
  const resetStudentForm = () => {
    setStudentForm({
      firstName: '', lastName: '', email: '', phone: '',
      studentNumber: '', dateOfBirth: '', address: '', levelId: ''
    });
  };

  const resetTeacherForm = () => {
    setTeacherForm({
      firstName: '', lastName: '', email: '', phone: '',
      teacherNumber: '', specialization: '', department: ''
    });
  };

  const resetSubjectForm = () => {
    setSubjectForm({
      name: '', code: '', coefficient: 1,
       selectedLevels: []
    });
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      levelId: '',
      subjectId: '',
      teacherId: '',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:30',
      room: '',
      academicYear: CURRENT_ACADEMIC_YEAR
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
const filteredSubjects = subjects.filter(subject => {
  const matchesSearch = subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       subject.code.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!selectedLevelForSubjects) {
          return matchesSearch;
        }

        const isInSelectedLevel = subjectLevelLinks.some(
          link => link.subject_id === subject.id && link.level_id === selectedLevelForSubjects
        );

        return matchesSearch && isInSelectedLevel;
      });
    const filteredStudents = students.filter(s => {
      const matchesSearch = (s.student_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.profiles?.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.profiles?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.profiles?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtrer par cycle et niveau ("none" : étudiants pas encore inscrits)
      const matchesLevel =
        cycleFilter === 'none' ? !s.level_id :
        levelFilter ? s.level_id === levelFilter :
        cycleFilter === 'all' || s.levels?.cycle === cycleFilter;

      return matchesSearch && matchesLevel;
    });

      // Pagination étudiants
      const totalPagesStudents = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
      // Évite une page vide quand un filtre ou une suppression réduit la liste.
      const pageStudents = Math.min(currentPageStudents, totalPagesStudents);
      const startIndexStudents = (pageStudents - 1) * itemsPerPage;
      const paginatedStudents = filteredStudents.slice(startIndexStudents, startIndexStudents + itemsPerPage);
      const levelToPrint = levels.find(level => level.id === printLevelId);

    const filteredTeachers = teachers.filter(t => {
      const matchesSearch = (t.teacher_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.profiles?.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.profiles?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.profiles?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDepartment = departmentFilter === 'all' || t.department === departmentFilter;
      
      return matchesSearch && matchesDepartment;
    });

        // Pagination enseignants
        const totalPagesTeachers = Math.max(1, Math.ceil(filteredTeachers.length / itemsPerPage));
        const pageTeachers = Math.min(currentPageTeachers, totalPagesTeachers);
        const startIndexTeachers = (pageTeachers - 1) * itemsPerPage;
        const paginatedTeachers = filteredTeachers.slice(startIndexTeachers, startIndexTeachers + itemsPerPage);

        // Départements uniques
                const uniqueDepartments = Array.from(new Set(teachers.map(t => t.department).filter(Boolean))) as string[];

            const filteredSchedules = schedules.filter(schedule => {
            // Filtre par niveau
            const matchesClass = !selectedLevelForSchedule || schedule.level_id === selectedLevelForSchedule;
            
            // Filtre par recherche (enseignant, matière, salle)
            const matchesSearch = !searchTerm || 
              (schedule.subjects?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
              (schedule.teachers?.profiles?.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
              (schedule.teachers?.profiles?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
              (schedule.room || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            return matchesClass && matchesSearch;
          });

          const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
          const openedTeacher = viewingTeacher ? teachers.find(t => t.id === viewingTeacher.id) : undefined;

  // ==================== RENDER ====================
  return (
    <AppShell
      spaceLabel="Administration"
      groups={NAV_GROUPS.map(group => ({
        ...group,
        items: group.items
          .filter(item => allowedTabs.includes(item.id))
          .map(item => item.id === 'levels'
            ? { ...item, badge: students.filter(student => !student.level_id).length }
            : item),
      }))}
      activeId={activeTab}
      onSelect={(tab) => {
        setGradesStudentId('');
        handleSelectTab(tab);
      }}
      userName={`${user?.first_name || ''} ${user?.last_name || ''}`.trim()}
      roleLabel={ADMIN_ROLE_LABELS[user?.role || ''] || 'Administration'}
      onLogout={onLogout}
      onChangePassword={onChangePassword}
    >

        {/* TABLEAU DE BORD */}
        {activeTab === 'dashboard' && (
          <AdminHome
            students={students}
            teacherCount={teachers.length}
            subjectCount={subjects.length}
            levels={levels}
            announcements={announcements}
            allowedTabs={allowedTabs}
            onNavigate={handleSelectTab}
            onQuickAdd={openQuickAdd}
          />
        )}

        {/* NOTES */}
        {activeTab === 'grades' && (
          <GradesManagement levels={levels} canEdit initialStudentId={gradesStudentId || undefined} />
        )}

      {/* FINANCE TAB - GESTION FINANCIÈRE */}
      {activeTab === 'finance' && <FinanceManagement />}

       {/* STUDENTS TAB */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-xl shadow p-4 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <h2 className="text-xl md:text-2xl font-bold">Étudiants ({filteredStudents.length})</h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={() => setPrintLevelId(levelFilter)}
                disabled={!levelFilter}
                title={levelFilter ? 'Imprimer la liste de ce niveau' : "Choisissez d'abord un niveau dans les filtres"}
                className="border px-3 py-2 md:px-4 rounded-lg hover:bg-gray-100 flex items-center gap-2 text-sm md:text-base justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4 md:w-5 md:h-5" />
                Imprimer la liste
              </button>
              <button
                onClick={() => openQuickAdd('student')}
                className="bg-indigo-600 text-white px-3 py-2 md:px-4 rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm md:text-base justify-center"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                Ajouter
              </button>
            </div>
          </div>

          {/* FILTRES ET RECHERCHE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-2">Rechercher</label>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nom, matricule, email..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPageStudents(1); }}
                  className="w-full border rounded-lg px-3 py-2 pl-10 text-sm md:text-base"
                />
              </div>
            </div>

           <div>
              <label htmlFor="student-cycle-filter" className="block text-sm font-medium mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Cycle
              </label>
              <select
                id="student-cycle-filter"
                value={cycleFilter}
                onChange={(e) => {
                  setCycleFilter(e.target.value);
                  setLevelFilter('');
                  setCurrentPageStudents(1);
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
              >
                <option value="all">Tous les cycles</option>
                {CYCLES.map(cycle => (
                  <option key={cycle.id} value={cycle.id}>{cycle.label}</option>
                ))}
                <option value="none">Non inscrits</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Niveau</label>
              <LevelSelect
                levels={levels}
                value={levelFilter}
                onChange={(levelId) => {
                  setLevelFilter(levelId);
                  setCurrentPageStudents(1);
                }}
                placeholder="Tous les niveaux"
                cycle={cycleFilter === 'all' || cycleFilter === 'none' ? 'all' : (cycleFilter as SchoolCycle)}
                disabled={cycleFilter === 'none'}
                className="w-full border rounded-lg px-3 py-2 text-sm md:text-base disabled:opacity-50"
                ariaLabel="Filtrer par niveau"
              />
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
                      <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm">Niveau</th>
                      <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm">Statut</th>
                      <th className="px-3 md:px-4 py-3 text-left text-xs md:text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((student) => (
                      <tr key={student.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 md:px-4 py-3 font-medium text-xs md:text-sm">{student.student_number}</td>
                        <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{student.profiles?.first_name} {student.profiles?.last_name}</td>
                        <td className="px-3 md:px-4 py-3 text-xs md:text-sm hidden md:table-cell">{student.profiles?.email}</td>
                        <td className="px-3 md:px-4 py-3">
                          <LevelSelect
                            levels={levels}
                            value={student.level_id || ''}
                            onChange={(levelId) => handleChangeStudentLevel(student.id, levelId)}
                            placeholder="À inscrire..."
                            className="border rounded px-2 py-1 text-xs md:text-sm max-w-[11rem]"
                            ariaLabel={`Niveau de ${student.profiles?.first_name} ${student.profiles?.last_name}`}
                          />
                        </td>
                        <td className="px-3 md:px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {student.status === 'active' ? 'Actif' : student.status === 'suspended' ? 'Suspendu' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-3 md:px-4 py-3">
                          <div className="flex gap-1">
                            {allowedTabs.includes('grades') && (
                              <button
                                onClick={() => { handleSelectTab('grades'); setGradesStudentId(student.id); }}
                                className="text-gray-700 hover:bg-gray-100 p-2 rounded"
                                title="Voir ses notes"
                                aria-label={`Voir les notes de ${fullNameOf(student)}`}
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
                            {canResetStudentPassword && (
                              <button
                                onClick={() => handleResetStudentPassword(student)}
                                className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                                title="Réinitialiser le mot de passe"
                                aria-label={`Réinitialiser le mot de passe de ${fullNameOf(student)}`}
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>
                            )}
                            {canDeleteStudents && (
                              <button
                                onClick={() => handleDeleteStudent(student)}
                                className="text-red-600 hover:bg-red-50 p-2 rounded"
                                title="Supprimer"
                                aria-label={`Supprimer ${fullNameOf(student)}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
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
                    onClick={() => setCurrentPageStudents(pageStudents - 1)}
                    disabled={pageStudents === 1}
                    className="px-2 md:px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <span className="px-3 md:px-4 py-1 border rounded bg-gray-50 text-xs md:text-sm">
                    {pageStudents} / {totalPagesStudents}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPageStudents(pageStudents + 1)}
                    disabled={pageStudents === totalPagesStudents}
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

        {/* FICHE ENSEIGNANT */}
        {activeTab === 'teachers' && openedTeacher && viewingTeacher && (
          <TeacherDetail
            key={openedTeacher.id}
            teacher={openedTeacher}
            levels={levels}
            subjects={subjects}
            currentUserId={user?.id}
            initialTab={viewingTeacher.tab}
            onBack={() => setViewingTeacher(null)}
            onUpdated={loadTeachers}
            onAssignmentsChanged={loadTeacherAssignments}
            onDelete={handleDeleteTeacher}
          />
        )}

        {/* TEACHERS TAB */}
        {activeTab === 'teachers' && !openedTeacher && (
          <div className="bg-white rounded-xl shadow p-4 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <h2 className="text-xl md:text-2xl font-bold">Enseignants ({filteredTeachers.length})</h2>
              <button
                onClick={() => openQuickAdd('teacher')}
                className="bg-indigo-600 text-white px-3 py-2 md:px-4 rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm md:text-base w-full sm:w-auto justify-center"
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
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPageTeachers(1); }}
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
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm">{teacher.profiles?.first_name} {teacher.profiles?.last_name}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm hidden md:table-cell">{teacher.profiles?.email}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm hidden lg:table-cell">{teacher.specialization || '-'}</td>
                          <td className="px-3 md:px-4 py-3 text-xs md:text-sm hidden lg:table-cell">{teacher.department || '-'}</td>
                          <td className="px-3 md:px-4 py-3">
                            {canManageTeachers ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setViewingTeacher({ id: teacher.id, tab: 'assignments' })}
                                  className="text-gray-700 hover:bg-gray-100 p-2 rounded"
                                  title="Ouvrir la fiche"
                                  aria-label={`Ouvrir la fiche de ${teacher.profiles?.first_name} ${teacher.profiles?.last_name}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setViewingTeacher({ id: teacher.id, tab: 'profile' })}
                                  className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                                  title="Modifier"
                                  aria-label={`Modifier ${teacher.profiles?.first_name} ${teacher.profiles?.last_name}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setViewingTeacher({ id: teacher.id, tab: 'messages' })}
                                  className="text-green-600 hover:bg-green-50 p-2 rounded"
                                  title="Envoyer un message"
                                  aria-label={`Envoyer un message à ${teacher.profiles?.first_name} ${teacher.profiles?.last_name}`}
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTeacher(teacher)}
                                  className="text-red-600 hover:bg-red-50 p-2 rounded"
                                  title="Supprimer"
                                  aria-label={`Supprimer ${teacher.profiles?.first_name} ${teacher.profiles?.last_name}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
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
                      onClick={() => setCurrentPageTeachers(pageTeachers - 1)}
                      disabled={pageTeachers === 1}
                      className="px-2 md:px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <span className="px-3 md:px-4 py-1 border rounded bg-gray-50 text-xs md:text-sm">
                      {pageTeachers} / {totalPagesTeachers}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPageTeachers(pageTeachers + 1)}
                      disabled={pageTeachers === totalPagesTeachers}
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

        {/* CYCLES & NIVEAUX */}
        {activeTab === 'levels' && (
          <LevelsManagement
            levels={levels}
            students={students}
            canManageLevels={canManageLevels}
            onLevelsChanged={loadLevels}
            onStudentsChanged={loadStudents}
          />
        )}

        {/* SUBJECTS TAB */}
          {activeTab === 'subjects' && (
            <div className="bg-white rounded-xl shadow p-4 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                <h2 className="text-xl md:text-2xl font-bold">Matières ({subjects.length})</h2>
                <button
                  onClick={() => { 
                    setModalType('subject'); 
                    setEditingSubject(null);
                    resetSubjectForm();
                    setShowModal(true); 
                  }}
                  className="bg-indigo-600 text-white px-3 py-2 md:px-4 rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm md:text-base w-full sm:w-auto justify-center"
                >
                  <Plus className="w-4 h-4 md:w-5 md:h-5" />
                  Créer
                </button>
              </div>

              {/* FILTRES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Filtre par niveau */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Filter className="w-4 h-4 inline mr-1" />
                    Filtrer par niveau
                  </label>
                  <LevelSelect
                    levels={levels}
                    value={selectedLevelForSubjects}
                    onChange={setSelectedLevelForSubjects}
                    placeholder="Tous les niveaux"
                    className="w-full border rounded-lg px-3 py-2"
                    ariaLabel="Filtrer les matières par niveau"
                  />
                </div>

                {/* Barre de recherche */}
                <div>
                  <label className="block text-sm font-medium mb-2">Rechercher</label>
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Nom ou code de matière..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Grille des matières */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {filteredSubjects.map((subject) => (
                  <div key={subject.id} className="border rounded-lg p-3 md:p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-base md:text-lg">{subject.name}</h3>
                        <p className="text-xs md:text-sm text-gray-600">Code: {subject.code}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSubject(subject)}
                          className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSubject(subject.id)}
                          className="text-red-600 hover:bg-red-50 p-2 rounded"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs md:text-sm text-gray-600">Coefficient: {subject.coefficient}</p>
                  </div>
                ))}
              </div>

              {filteredSubjects.length === 0 && (
                <p className="text-center py-8 text-gray-500">Aucune matière trouvée</p>
              )}
            </div>
          )}

        {/* SCHEDULES TAB - EMPLOIS DU TEMPS */}
        {activeTab === 'schedules' && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold">Emplois du temps</h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <LevelSelect
                  levels={levels}
                  value={selectedLevelForSchedule}
                  onChange={setSelectedLevelForSchedule}
                  placeholder="Tous les niveaux"
                  className="border rounded-lg px-3 py-2"
                  ariaLabel="Filtrer l'emploi du temps par niveau"
                />
                <button
                  onClick={() => { 
                    setEditingSchedule(null);
                    resetScheduleForm();
                    setModalType('schedule'); 
                    setShowModal(true); 
                  }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Ajouter un créneau
                </button>
              </div>
            </div>
            {/* Barre de recherche emploi du temps */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher enseignant, matière, salle..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 pl-10"
                    />
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
                    {timeSlotsOf(filteredSchedules).map((timeSlot) => (                    <tr key={timeSlot}>
                      <td className="border px-4 py-2 font-medium bg-gray-50">{timeSlot}</td>
                      {[1, 2, 3, 4, 5, 6].map((day) => {
                        const daySchedules = filteredSchedules.filter(s =>
                          s.day_of_week === day && timeSlotOf(s) === timeSlot
                        );
                        
                        return (
                          <td key={day} className="border px-2 py-2">
                            {daySchedules.map(schedule => (
                              <div key={schedule.id} className="bg-blue-100 p-2 rounded mb-1 text-sm">
                                <p className="font-semibold">{schedule.subjects?.name}</p>
                                <p className="text-xs text-gray-600">{schedule.levels?.name || 'Sans niveau'}</p>
                                <p className="text-xs text-gray-600">
                                  {schedule.teachers?.profiles?.first_name} {schedule.teachers?.profiles?.last_name}
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
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Annonces ({announcements.length})</h2>
              <button
                onClick={() => openQuickAdd('announcement')}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
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
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${PRIORITY_CLASSES[announcement.priority]}`}>
                          {PRIORITY_LABELS[announcement.priority]}
                        </span>
                        <span className="px-2 py-1 rounded text-xs bg-indigo-100 text-indigo-700">
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
                <h3 className="text-2xl font-bold">Affecter un enseignant à une matière et un niveau</h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-3xl hover:text-red-600"
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAssignTeacherToLevel} className="space-y-4">
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
                        {teacher.teacher_number} - {teacher.profiles?.first_name} {teacher.profiles?.last_name}
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
                  <label className="block text-sm font-medium mb-2">Niveau *</label>
                  <LevelSelect
                    levels={levels}
                    value={teacherAssignForm.levelId}
                    onChange={(levelId) => setTeacherAssignForm({ ...teacherAssignForm, levelId })}
                    ariaLabel="Niveau"
                    required
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
                    className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Affectation...' : 'Affecter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB COMPTES ADMIN */}
        {activeTab === 'admins' && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Comptes Admin</h2>
              <button
                onClick={() => {
                  setModalType('admin');
                  setShowModal(true);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Ajouter un admin
              </button>
            </div>

            {loading ? (
              <p className="text-center py-8">Chargement...</p>
            ) : adminAccounts.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl text-gray-500">Aucun compte admin</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left">Nom</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Rôle</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminAccounts.map((account: any) => (
                      <tr key={account.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {account.profiles?.first_name} {account.profiles?.last_name}
                          {account.user_id === user?.id && (
                            <span className="ml-2 text-xs text-gray-400">(vous)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{account.profiles?.email}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-indigo-100 text-indigo-700">
                            {ADMIN_ROLE_LABELS[account.role] || account.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {account.user_id !== user?.id && (
                            <button
                              onClick={() => handleRemoveAdminRole(account.id, account.user_id)}
                              className="text-red-600 hover:bg-red-50 p-2 rounded"
                              title="Retirer ce rôle"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB AFFECTATION ENSEIGNANTS → MATIÈRES → NIVEAUX */}
            {activeTab === 'assign-teachers' && (
              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Affectation Enseignants → Matières → Niveaux</h2>
                  {/* Barre de recherche */}

                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Affecter un enseignant
                  </button>                  
                </div>
                   <div className="mb-4 flex-1 max-w-md mx-4">
                      <div className="relative">
                        <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Rechercher enseignant, matière, niveau..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 pl-10"
                        />
                      </div>
                    </div>
                {loading ? (
                  <p className="text-center py-8">Chargement...</p>
                ) : teacherAssignments.length === 0 ? (
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
                          <th className="px-4 py-3 text-left">Niveau</th>
                          <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                      </thead>
                        <tbody>
                       {Object.entries(
                        // Grouper par enseignant (avec filtre de recherche)
                        teacherAssignments
                          .filter(assignment => {
                            // Si pas de recherche, afficher tout
                            if (!searchTerm) return true;
                            
                            // Sinon, filtrer par recherche
                            const matchesSearch = 
                              (assignment.teachers?.teacher_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (assignment.teachers?.profiles?.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (assignment.teachers?.profiles?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (assignment.subjects?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (assignment.levels?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
                            
                            return matchesSearch;
                            })
                            .reduce((acc: any, assignment: any) => {
                              const teacherId = assignment.teacher_id;
                              if (!acc[teacherId]) {
                                acc[teacherId] = {
                                  teacher: assignment.teachers,
                                  assignments: []
                                };
                              }
                              acc[teacherId].assignments.push(assignment);
                              return acc;
                            }, {})
                        ).map(([teacherId, data]: any) => (
                          <tr key={teacherId} className="border-b hover:bg-gray-50">
                            {/* Matricule */}
                            <td className="px-4 py-3 font-medium">
                              {data.teacher?.teacher_number}
                            </td>                            
                            {/* Nom (rowspan pour fusionner les lignes) */}
                            <td className="px-4 py-3">
                              {data.teacher?.profiles?.first_name} {data.teacher?.profiles?.last_name}
                            </td>                            
                            {/* Matières (liste) */}
                            <td className="px-4 py-3">
                              {data.assignments.map((a: any, idx: number) => (
                                <div key={idx} className="mb-1">
                                  <span className="font-semibold text-indigo-600">{a.subjects?.name}</span>
                                </div>
                              ))}
                            </td>                            
                            {/* Niveaux (liste) */}
                            <td className="px-4 py-3">
                              {data.assignments.map((a: any, idx: number) => (
                                <div key={idx} className="mb-1">
                                  <span className="font-semibold text-blue-600">{a.levels?.name}</span>
                                </div>
                              ))}
                            </td>
                            
                            {/* Actions (supprimer toutes les affectations de cet enseignant) */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                {data.assignments.map((a: any) => (
                                  <button
                                    key={a.id}
                                    onClick={() => handleRemoveTeacherAssignment(a.id)}
                                    className="text-red-600 hover:bg-red-50 p-1 rounded text-xs"
                                    title={`Retirer ${a.subjects?.name} - ${a.levels?.name}`}
                                  >
                                    <Trash2 className="w-3 h-3 inline mr-1" />
                                    {a.subjects?.code}
                                  </button>
                                ))}
                              </div>
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
                {modalType === 'subject' && (editingSubject ? 'Modifier la matière' : 'Créer une matière')}
                {modalType === 'schedule' && (editingSchedule ? 'Modifier le créneau' : 'Ajouter un créneau')}
                {modalType === 'announcement' && 'Publier une annonce'}
                {modalType === 'admin' && 'Ajouter un compte admin'}
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
                  <label className="block text-sm font-medium mb-2">Niveau d'inscription *</label>
                  <LevelSelect
                    levels={levels}
                    value={studentForm.levelId}
                    onChange={(levelId) => setStudentForm({...studentForm, levelId})}
                    ariaLabel="Niveau d'inscription"
                    required
                  />
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
                    className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
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
                    className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}

            {/* SUBJECT FORM */}
            {modalType === 'subject' && (
            <form onSubmit={editingSubject ? handleUpdateSubject : handleAddSubject} className="space-y-4">
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
                  <div>
                    <label className="block text-sm font-medium mb-2">Niveaux concernés (optionnel)</label>
                    <select
                      multiple
                      value={subjectForm.selectedLevels}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setSubjectForm({...subjectForm, selectedLevels: selected});
                      }}
                      aria-label="Niveaux concernés"
                      className="w-full border rounded px-3 py-2 h-32"
                    >
                      {CYCLES.map(cycle => (
                        <optgroup key={cycle.id} label={cycle.label}>
                          {levels.filter(level => level.cycle === cycle.id).map(level => (
                            <option key={level.id} value={level.id}>{level.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Maintenez Ctrl (ou Cmd) pour sélectionner plusieurs niveaux
                    </p>
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
                    className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? (editingSubject ? 'Modification...' : 'Création...') : (editingSubject ? 'Modifier' : 'Créer')}
                  </button>
                </div>
              </form>
            )}

            {/* SCHEDULE FORM */}
            {modalType === 'schedule' && (
              <form onSubmit={handleAddOrUpdateSchedule} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Niveau *</label>
                    <LevelSelect
                      levels={levels}
                      value={scheduleForm.levelId}
                      onChange={(levelId) => setScheduleForm({...scheduleForm, levelId})}
                      ariaLabel="Niveau"
                      required
                    />
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
                     {subjects.filter(subject => {
                          // Si aucun niveau sélectionné, afficher toutes les matières
                          if (!scheduleForm.levelId) return true;
                          // Sinon, afficher uniquement les matières liées au niveau
                          return subjectLevelLinks.some(
                            link => link.subject_id === subject.id && link.level_id === scheduleForm.levelId
                          );})
                        .map(subject => (
                          <option key={subject.id} value={subject.id}>{subject.name}</option>
                        ))
                      }
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
                        {teacher.profiles?.first_name} {teacher.profiles?.last_name}
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
                      <option value="6">Samedi</option>
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
                    className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
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
                    className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Publication...' : 'Publier'}
                  </button>
                </div>
              </form>
            )}

            {/* ADMIN FORM */}
            {modalType === 'admin' && (
              <form onSubmit={handleAddAdmin} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Prénom *</label>
                    <input
                      type="text"
                      value={adminForm.firstName}
                      onChange={(e) => setAdminForm({...adminForm, firstName: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Nom *</label>
                    <input
                      type="text"
                      value={adminForm.lastName}
                      onChange={(e) => setAdminForm({...adminForm, lastName: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email *</label>
                  <input
                    type="email"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({...adminForm, email: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <p className="text-sm text-gray-600">
                  Un mot de passe temporaire sera généré et affiché une seule fois après la création.
                </p>
                <div>
                  <label className="block text-sm font-medium mb-2">Rôle *</label>
                  <select
                    value={adminForm.role}
                    onChange={(e) => setAdminForm({...adminForm, role: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    {Object.entries(ADMIN_ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
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
                    className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}


      {levelToPrint && (
        <StudentListPrint level={levelToPrint} students={students} onClose={() => setPrintLevelId('')} />
      )}
    </AppShell>
  );
};

export default AdminDashboard;
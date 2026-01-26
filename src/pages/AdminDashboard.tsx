// src/pages/admin/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Home, Users, BookOpen, Plus, Edit, Trash2, Search, Bell, MessageSquare } from 'lucide-react';
import Navbar from '../components/Navbar';
import TabNavigation from '../components/TabNavigation';
import { User, Student, Teacher } from '../types';
import { supabase } from '../lib/supabaseClient';

interface AdminDashboardProps {
  user: User | null;
  onLogout: () => void;
}

interface StudentWithUser extends Student {
  users?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface TeacherWithUser extends Teacher {
  users?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [students, setStudents] = useState<StudentWithUser[]>([]);
  const [teachers, setTeachers] = useState<TeacherWithUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'student' | 'teacher' | 'announcement'>('student');
  
  // Formulaire étudiant
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    dateOfBirth: '',
    studentNumber: '',
    class: '',
  });

  // Formulaire enseignant
  const [teacherForm, setTeacherForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    teacherNumber: '',
    specialization: '',
    department: '',
  });

  // Formulaire annonce
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    targetAudience: 'all' as 'students' | 'teachers' | 'all',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
  });

  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Charger les étudiants avec leurs infos utilisateur
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*, users(first_name, last_name, email)')
        .order('enrollment_date', { ascending: false });

      if (studentsError) throw studentsError;
      if (studentsData) setStudents(studentsData);

      // Charger les enseignants avec leurs infos utilisateur
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('*, users(first_name, last_name, email)')
        .order('hire_date', { ascending: false });

      if (teachersError) throw teachersError;
      if (teachersData) setTeachers(teachersData);

    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Créer l'utilisateur dans auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: studentForm.email,
        password: studentForm.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // 2. Créer l'enregistrement dans users
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: studentForm.email,
            role: 'student',
            first_name: studentForm.firstName,
            last_name: studentForm.lastName,
          });

        if (userError) throw userError;

        // 3. Créer l'enregistrement étudiant
        const { error: studentError } = await supabase
          .from('students')
          .insert({
            user_id: authData.user.id,
            student_number: studentForm.studentNumber,
            date_of_birth: studentForm.dateOfBirth,
            status: 'active',
          });

        if (studentError) throw studentError;

        alert('Étudiant ajouté avec succès !');
        setShowModal(false);
        resetStudentForm();
        loadAdminData();
      }
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: teacherForm.email,
        password: teacherForm.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: teacherForm.email,
            role: 'teacher',
            first_name: teacherForm.firstName,
            last_name: teacherForm.lastName,
          });

        if (userError) throw userError;

        const { error: teacherError } = await supabase
          .from('teachers')
          .insert({
            user_id: authData.user.id,
            teacher_number: teacherForm.teacherNumber,
            specialization: teacherForm.specialization,
            department: teacherForm.department,
          });

        if (teacherError) throw teacherError;

        alert('Enseignant ajouté avec succès !');
        setShowModal(false);
        resetTeacherForm();
        loadAdminData();
      }
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
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
        });

      if (error) throw error;

      alert('Annonce envoyée avec succès !');
      setShowModal(false);
      resetAnnouncementForm();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet étudiant ?')) return;

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);

      if (error) throw error;

      alert('Étudiant supprimé avec succès');
      loadAdminData();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet enseignant ?')) return;

    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacherId);

      if (error) throw error;

      alert('Enseignant supprimé avec succès');
      loadAdminData();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    }
  };

  const resetStudentForm = () => {
    setStudentForm({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      dateOfBirth: '',
      studentNumber: '',
      class: '',
    });
  };

  const resetTeacherForm = () => {
    setTeacherForm({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      teacherNumber: '',
      specialization: '',
      department: '',
    });
  };

  const resetAnnouncementForm = () => {
    setAnnouncementForm({
      title: '',
      content: '',
      targetAudience: 'all',
      priority: 'normal',
    });
  };

  const openModal = (type: 'student' | 'teacher' | 'announcement') => {
    setModalType(type);
    setShowModal(true);
  };

  const filteredStudents = students.filter(student =>
    student.studentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.users?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.users?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.users?.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTeachers = teachers.filter(teacher =>
    teacher.teacherNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.users?.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.users?.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.users?.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderDashboard = () => (
    <>
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-blue-50 p-6 rounded-lg">
          <p className="text-4xl font-bold text-blue-600">{students.length}</p>
          <p className="text-gray-600">Étudiants</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg">
          <p className="text-4xl font-bold text-green-600">{teachers.length}</p>
          <p className="text-gray-600">Enseignants</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg">
          <p className="text-4xl font-bold text-purple-600">38</p>
          <p className="text-gray-600">Cours actifs</p>
        </div>
        <div className="bg-orange-50 p-6 rounded-lg">
          <p className="text-4xl font-bold text-orange-600">12</p>
          <p className="text-gray-600">Classes</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">Gestion Étudiants</h3>
          <div className="space-y-2">
            <button 
              onClick={() => openModal('student')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter un étudiant
            </button>
            <button 
              onClick={() => setActiveTab('students')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Liste des étudiants
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">Gestion Enseignants</h3>
          <div className="space-y-2">
            <button 
              onClick={() => openModal('teacher')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter un enseignant
            </button>
            <button 
              onClick={() => setActiveTab('teachers')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Liste des enseignants
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">Communications</h3>
          <div className="space-y-2">
            <button 
              onClick={() => openModal('announcement')}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
            >
              <Bell className="w-4 h-4" />
              Envoyer une annonce
            </button>
            <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Messages groupés
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Activités récentes</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <p className="text-sm">Nouvel étudiant inscrit</p>
            <span className="text-xs text-gray-500 ml-auto">Il y a 2h</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <p className="text-sm">Cours publié</p>
            <span className="text-xs text-gray-500 ml-auto">Il y a 5h</span>
          </div>
        </div>
      </div>
    </>
  );

  const renderStudents = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Liste des étudiants</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-2 pl-10"
            />
          </div>
          <button 
            onClick={() => openModal('student')}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Ajouter
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Chargement...</p>
      ) : filteredStudents.length === 0 ? (
        <p className="text-center text-gray-500">Aucun étudiant trouvé</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Matricule</th>
                <th className="px-4 py-2 text-left">Nom complet</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{student.studentNumber}</td>
                  <td className="px-4 py-3">
                    {student.users?.first_name} {student.users?.last_name}
                  </td>
                  <td className="px-4 py-3">{student.users?.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      student.status === 'active' 
                        ? 'bg-green-100 text-green-700'
                        : student.status === 'inactive'
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {student.status === 'active' ? 'Actif' : 
                       student.status === 'inactive' ? 'Inactif' : 'Suspendu'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-blue-600 hover:underline" title="Modifier">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteStudent(student.id)}
                        className="text-red-600 hover:underline" 
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
        </div>
      )}
    </div>
  );

  const renderTeachers = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Liste des enseignants</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border rounded px-3 py-2 pl-10"
            />
          </div>
          <button 
            onClick={() => openModal('teacher')}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Ajouter
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Chargement...</p>
      ) : filteredTeachers.length === 0 ? (
        <p className="text-center text-gray-500">Aucun enseignant trouvé</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Matricule</th>
                <th className="px-4 py-2 text-left">Nom complet</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Spécialité</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((teacher) => (
                <tr key={teacher.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{teacher.teacherNumber}</td>
                  <td className="px-4 py-3">
                    {teacher.users?.first_name} {teacher.users?.last_name}
                  </td>
                  <td className="px-4 py-3">{teacher.users?.email}</td>
                  <td className="px-4 py-3">{teacher.specialization || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-blue-600 hover:underline" title="Modifier">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTeacher(teacher.id)}
                        className="text-red-600 hover:underline" 
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
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'students': return renderStudents();
      case 'teachers': return renderTeachers();
      default: return renderDashboard();
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'students', label: 'Étudiants', icon: Users },
    { id: 'teachers', label: 'Enseignants', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Espace Administrateur" user={user} onLogout={onLogout} bgColor="bg-purple-600" />
      
      <div className="container mx-auto px-4 py-8">
        <TabNavigation 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          activeColor="bg-purple-600"
        />
        
        {renderContent()}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {modalType === 'student' && 'Ajouter un étudiant'}
                {modalType === 'teacher' && 'Ajouter un enseignant'}
                {modalType === 'announcement' && 'Nouvelle annonce'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                ×
              </button>
            </div>

            {modalType === 'student' && (
              <form onSubmit={handleAddStudent} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Prénom *</label>
                    <input 
                      type="text" 
                      value={studentForm.firstName}
                      onChange={(e) => setStudentForm({...studentForm, firstName: e.target.value})}
                      className="w-full border rounded px-3 py-2" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nom *</label>
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
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input 
                    type="email" 
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({...studentForm, email: e.target.value})}
                    className="w-full border rounded px-3 py-2" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Mot de passe *</label>
                  <input 
                    type="password" 
                    value={studentForm.password}
                    onChange={(e) => setStudentForm({...studentForm, password: e.target.value})}
                    className="w-full border rounded px-3 py-2" 
                    required 
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Matricule *</label>
                    <input 
                      type="text" 
                      value={studentForm.studentNumber}
                      onChange={(e) => setStudentForm({...studentForm, studentNumber: e.target.value})}
                      className="w-full border rounded px-3 py-2" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Date de naissance</label>
                    <input 
                      type="date" 
                      value={studentForm.dateOfBirth}
                      onChange={(e) => setStudentForm({...studentForm, dateOfBirth: e.target.value})}
                      className="w-full border rounded px-3 py-2" 
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)} 
                    className="px-4 py-2 border rounded hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}

            {modalType === 'teacher' && (
              <form onSubmit={handleAddTeacher} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Prénom *</label>
                    <input 
                      type="text" 
                      value={teacherForm.firstName}
                      onChange={(e) => setTeacherForm({...teacherForm, firstName: e.target.value})}
                      className="w-full border rounded px-3 py-2" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nom *</label>
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
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input 
                    type="email" 
                    value={teacherForm.email}
                    onChange={(e) => setTeacherForm({...teacherForm, email: e.target.value})}
                    className="w-full border rounded px-3 py-2" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Mot de passe *</label>
                  <input 
                    type="password" 
                    value={teacherForm.password}
                    onChange={(e) => setTeacherForm({...teacherForm, password: e.target.value})}
                    className="w-full border rounded px-3 py-2" 
                    required 
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Matricule *</label>
                    <input 
                      type="text" 
                      value={teacherForm.teacherNumber}
                      onChange={(e) => setTeacherForm({...teacherForm, teacherNumber: e.target.value})}
                      className="w-full border rounded px-3 py-2" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Spécialité</label>
                    <input 
                      type="text" 
                      value={teacherForm.specialization}
                      <function_results>
                      <error>Validation error: parameter 'content' is too long (69913 characters, max 65536 characters)</error>
                      </function_results>
                    // Continuation du AdminDashboard.tsx (partie formulaire)

                      onChange={(e) => setTeacherForm({...teacherForm, specialization: e.target.value})}
                      className="w-full border rounded px-3 py-2" 
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)} 
                    className="px-4 py-2 border rounded hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            )}

            {modalType === 'announcement' && (
              <form onSubmit={handleSendAnnouncement} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Titre *</label>
                  <input 
                    type="text" 
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                    className="w-full border rounded px-3 py-2" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Destinataires *</label>
                  <select 
                    value={announcementForm.targetAudience}
                    onChange={(e) => setAnnouncementForm({...announcementForm, targetAudience: e.target.value as any})}
                    className="w-full border rounded px-3 py-2" 
                    required
                  >
                    <option value="all">Tous</option>
                    <option value="students">Étudiants uniquement</option>
                    <option value="teachers">Enseignants uniquement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Priorité</label>
                  <select 
                    value={announcementForm.priority}
                    onChange={(e) => setAnnouncementForm({...announcementForm, priority: e.target.value as any})}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="low">Faible</option>
                    <option value="normal">Normale</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Message *</label>
                  <textarea 
                    value={announcementForm.content}
                    onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})}
                    className="w-full border rounded px-3 py-2 h-32" 
                    required
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)} 
                    className="px-4 py-2 border rounded hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? 'Envoi...' : 'Envoyer'}
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
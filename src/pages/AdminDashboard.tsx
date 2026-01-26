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
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    dateOfBirth: '',
    studentNumber: '',
    class: '',
  });

  const [teacherForm, setTeacherForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    teacherNumber: '',
    specialization: '',
    department: '',
  });

  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    targetAudience: 'all' as 'students' | 'teachers' | 'all',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
  });

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*, users(first_name, last_name, email)')
        .order('enrollment_date', { ascending: false });

      if (studentsError) throw studentsError;
      if (studentsData) setStudents(studentsData);

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

  // NOUVELLE APPROCHE : Création sans email de confirmation
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Générer un UUID unique
      const userId = crypto.randomUUID();

      // 1. Insérer directement dans la table users avec un hash temporaire
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: studentForm.email,
          password_hash: 'TEMP_PASSWORD_TO_BE_SET', // Hash temporaire
          role: 'student',
          first_name: studentForm.firstName,
          last_name: studentForm.lastName,
        });

      if (userError) throw userError;

      // 2. Créer l'enregistrement étudiant
      const { error: studentError } = await supabase
        .from('students')
        .insert({
          user_id: userId,
          student_number: studentForm.studentNumber,
          date_of_birth: studentForm.dateOfBirth || null,
          status: 'active',
        });

      if (studentError) throw studentError;

      alert('✅ Étudiant ajouté avec succès !\n\nNote: L\'utilisateur devra définir son mot de passe lors de sa première connexion via "Mot de passe oublié".');
      setShowModal(false);
      resetStudentForm();
      loadAdminData();
    } catch (error: any) {
      console.error('Erreur complète:', error);
      alert(`❌ Erreur: ${error.message}\n\nVérifiez que:\n- L'email n'existe pas déjà\n- Le matricule est unique\n- Les politiques RLS sont configurées`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Générer un UUID unique
      const userId = crypto.randomUUID();

      // 1. Insérer directement dans la table users avec un hash temporaire
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: teacherForm.email,
          password_hash: 'TEMP_PASSWORD_TO_BE_SET', // Hash temporaire
          role: 'teacher',
          first_name: teacherForm.firstName,
          last_name: teacherForm.lastName,
        });

      if (userError) throw userError;

      // 2. Créer l'enregistrement enseignant
      const { error: teacherError } = await supabase
        .from('teachers')
        .insert({
          user_id: userId,
          teacher_number: teacherForm.teacherNumber,
          specialization: teacherForm.specialization || null,
          department: teacherForm.department || null,
        });

      if (teacherError) throw teacherError;

      alert('✅ Enseignant ajouté avec succès !\n\nNote: L\'utilisateur devra définir son mot de passe lors de sa première connexion via "Mot de passe oublié".');
      setShowModal(false);
      resetTeacherForm();
      loadAdminData();
    } catch (error: any) {
      console.error('Erreur complète:', error);
      alert(`❌ Erreur: ${error.message}`);
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

      alert('✅ Annonce envoyée avec succès !');
      setShowModal(false);
      resetAnnouncementForm();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer cet étudiant ?')) return;

    try {
      const { error } = await supabase.from('students').delete().eq('id', studentId);
      if (error) throw error;
      alert('✅ Étudiant supprimé avec succès');
      loadAdminData();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer cet enseignant ?')) return;

    try {
      const { error } = await supabase.from('teachers').delete().eq('id', teacherId);
      if (error) throw error;
      alert('✅ Enseignant supprimé avec succès');
      loadAdminData();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const resetStudentForm = () => {
    setStudentForm({
      firstName: '', lastName: '', email: '', password: '',
      dateOfBirth: '', studentNumber: '', class: '',
    });
  };

  const resetTeacherForm = () => {
    setTeacherForm({
      firstName: '', lastName: '', email: '', password: '',
      teacherNumber: '', specialization: '', department: '',
    });
  };

  const resetAnnouncementForm = () => {
    setAnnouncementForm({
      title: '', content: '', targetAudience: 'all', priority: 'normal',
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

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'students', label: 'Étudiants', icon: Users },
    { id: 'teachers', label: 'Enseignants', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Espace Administrateur" user={user} onLogout={onLogout} bgColor="bg-purple-600" />
      
      <div className="container mx-auto px-4 py-8">
        <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} activeColor="bg-purple-600" />
        
        {activeTab === 'dashboard' && (
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
                  <button onClick={() => openModal('student')} className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2">
                    <Plus className="w-4 h-4" />Ajouter un étudiant
                  </button>
                  <button onClick={() => setActiveTab('students')} className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2">
                    <Users className="w-4 h-4" />Liste des étudiants
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-4">Gestion Enseignants</h3>
                <div className="space-y-2">
                  <button onClick={() => openModal('teacher')} className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2">
                    <Plus className="w-4 h-4" />Ajouter un enseignant
                  </button>
                  <button onClick={() => setActiveTab('teachers')} className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2">
                    <Users className="w-4 h-4" />Liste des enseignants
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-4">Communications</h3>
                <div className="space-y-2">
                  <button onClick={() => openModal('announcement')} className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2">
                    <Bell className="w-4 h-4" />Envoyer une annonce
                  </button>
                  <button className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />Messages groupés
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'students' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Liste des étudiants</h2>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
                  <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border rounded px-3 py-2 pl-10" />
                </div>
                <button onClick={() => openModal('student')} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2">
                  <Plus className="w-5 h-5" />Ajouter
                </button>
              </div>
            </div>
            {loading ? <p className="text-center text-gray-500">Chargement...</p> : filteredStudents.length === 0 ? <p className="text-center text-gray-500">Aucun étudiant trouvé</p> : (
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
                        <td className="px-4 py-3">{student.users?.first_name} {student.users?.last_name}</td>
                        <td className="px-4 py-3">{student.users?.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {student.status === 'active' ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button className="text-blue-600"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteStudent(student.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
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

        {activeTab === 'teachers' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Liste des enseignants</h2>
              <button onClick={() => openModal('teacher')} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2">
                <Plus className="w-5 h-5" />Ajouter
              </button>
            </div>
            {loading ? <p className="text-center">Chargement...</p> : (
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Matricule</th>
                    <th className="px-4 py-2 text-left">Nom</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="border-b">
                      <td className="px-4 py-3">{teacher.teacherNumber}</td>
                      <td className="px-4 py-3">{teacher.users?.first_name} {teacher.users?.last_name}</td>
                      <td className="px-4 py-3">{teacher.users?.email}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDeleteTeacher(teacher.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {modalType === 'student' && 'Ajouter un étudiant'}
                {modalType === 'teacher' && 'Ajouter un enseignant'}
                {modalType === 'announcement' && 'Nouvelle annonce'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-2xl">×</button>
            </div>

            {modalType === 'student' && (
              <form onSubmit={handleAddStudent} className="space-y-4">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    ℹ️ <strong>Note:</strong> L'utilisateur créé devra définir son mot de passe via "Mot de passe oublié" lors de sa première connexion.
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="block text-sm mb-1">Prénom *</label><input type="text" value={studentForm.firstName} onChange={(e) => setStudentForm({...studentForm, firstName: e.target.value})} className="w-full border rounded px-3 py-2" required /></div>
                  <div><label className="block text-sm mb-1">Nom *</label><input type="text" value={studentForm.lastName} onChange={(e) => setStudentForm({...studentForm, lastName: e.target.value})} className="w-full border rounded px-3 py-2" required /></div>
                </div>
                <div><label className="block text-sm mb-1">Email *</label><input type="email" value={studentForm.email} onChange={(e) => setStudentForm({...studentForm, email: e.target.value})} className="w-full border rounded px-3 py-2" required /></div>
                <div><label className="block text-sm mb-1">Matricule *</label><input type="text" value={studentForm.studentNumber} onChange={(e) => setStudentForm({...studentForm, studentNumber: e.target.value})} className="w-full border rounded px-3 py-2" required /></div>
                <div><label className="block text-sm mb-1">Date de naissance</label><input type="date" value={studentForm.dateOfBirth} onChange={(e) => setStudentForm({...studentForm, dateOfBirth: e.target.value})} className="w-full border rounded px-3 py-2" /></div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Annuler</button>
                  <button type="submit" disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded">{loading ? 'Enregistrement...' : 'Enregistrer'}</button>
                </div>
              </form>
            )}

            {modalType === 'teacher' && (
              <form onSubmit={handleAddTeacher} className="space-y-4">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    ℹ️ <strong>Note:</strong> L'utilisateur créé devra définir son mot de passe via "Mot de passe oublié" lors de sa première connexion.
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="block text-sm mb-1">Prénom *</label><input type="text" value={teacherForm.firstName} onChange={(e) => setTeacherForm({...teacherForm, firstName: e.target.value})} className="w-full border rounded px-3 py-2" required /></div>
                  <div><label className="block text-sm mb-1">Nom *</label><input type="text" value={teacherForm.lastName} onChange={(e) => setTeacherForm({...teacherForm, lastName: e.target.value})} className="w-full border rounded px-3 py-2" required /></div>
                </div>
                <div><label className="block text-sm mb-1">Email *</label><input type="email" value={teacherForm.email} onChange={(e) => setTeacherForm({...teacherForm, email: e.target.value})} className="w-full border rounded px-3 py-2" required /></div>
                <div><label className="block text-sm mb-1">Matricule *</label><input type="text" value={teacherForm.teacherNumber} onChange={(e) => setTeacherForm({...teacherForm, teacherNumber: e.target.value})} className="w-full border rounded px-3 py-2" required /></div>
                <div><label className="block text-sm mb-1">Spécialité</label><input type="text" value={teacherForm.specialization} onChange={(e) => setTeacherForm({...teacherForm, specialization: e.target.value})} className="w-full border rounded px-3 py-2" /></div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Annuler</button>
                  <button type="submit" disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded">{loading ? 'Enregistrement...' : 'Enregistrer'}</button>
                </div>
              </form>
            )}

            {modalType === 'announcement' && (
              <form onSubmit={handleSendAnnouncement} className="space-y-4">
                <div><label className="block text-sm mb-1">Titre *</label><input type="text" value={announcementForm.title} onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})} className="w-full border rounded px-3 py-2" required /></div>
                <div><label className="block text-sm mb-1">Message *</label><textarea value={announcementForm.content} onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})} className="w-full border rounded px-3 py-2 h-32" required /></div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Annuler</button>
                  <button type="submit" disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded">{loading ? 'Envoi...' : 'Envoyer'}</button>
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
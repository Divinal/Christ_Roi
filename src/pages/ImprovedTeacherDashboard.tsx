// src/pages/ImprovedTeacherDashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  Home, BookOpen, FileText, Upload, Trash2, Save,
  Calendar, MessageSquare, Users, Download, Plus, CheckCircle, X
} from 'lucide-react';
import Navbar from '../components/Navbar';
import TabNavigation from '../components/TabNavigation';
import { User, Course } from '../types';
import { supabase } from '../lib/supabaseClient';

interface TeacherDashboardProps {
  user: User | null;
  onLogout: () => void;
}

interface Student {
  id: string;
  student_number: string;
  class: string;
  user: {
    first_name: string;
    last_name: string;
  };
}

interface GradeEntry {
  student_id: string;
  note1: number | null;
  note2: number | null;
  comment?: string;
}

const ImprovedTeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'course' | 'grade'>('course');
  
  // États pour l'upload de cours
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    subject: 'Mathématiques',
    classLevel: 'L1',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  
  // États pour saisie de notes
  const [selectedClass, setSelectedClass] = useState<string>('L1 - Groupe A');
  const [selectedSubject, setSelectedSubject] = useState<string>('Mathématiques');
  const [gradeEntries, setGradeEntries] = useState<{ [key: string]: GradeEntry }>({});
  const [savingGrades, setSavingGrades] = useState<boolean>(false);

  // Informations enseignant
  const teacherInfo = {
    name: user?.firstName + ' ' + user?.lastName,
    specialization: 'Mathématiques',
    department: 'Sciences',
  };

  useEffect(() => {
    if (user) {
      loadTeacherData();
    }
  }, [user]);

  const loadTeacherData = async () => {
    setLoading(true);
    try {
      // Récupérer l'ID enseignant
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (teacherData) {
        // Charger les cours
        const { data: coursesData } = await supabase
          .from('courses')
          .select('*')
          .eq('teacher_id', teacherData.id)
          .order('uploaded_at', { ascending: false });
        if (coursesData) setCourses(coursesData);
      }

      // Charger les étudiants (simulé par classe)
      const { data: studentsData } = await supabase
        .from('students')
        .select('*, users(first_name, last_name)')
        .limit(30);
      if (studentsData) setStudents(studentsData);
    } catch (error) {
      console.error('Error loading teacher data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      alert('Veuillez sélectionner un fichier PDF');
    }
  };

  const handleUploadCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !courseForm.title) return;

    setUploading(true);
    try {
      // Upload du fichier
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `courses/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('courses')
        .upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      // Obtenir l'URL publique
      const { data: urlData } = supabase.storage
        .from('courses')
        .getPublicUrl(filePath);

      // Récupérer l'ID enseignant
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      // Créer l'enregistrement du cours
      const { error: insertError } = await supabase
        .from('courses')
        .insert({
          title: courseForm.title,
          description: courseForm.description,
          teacher_id: teacherData?.id,
          file_url: urlData.publicUrl,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          subject: courseForm.subject,
          class_level: courseForm.classLevel,
          is_approved: false, // En attente d'approbation admin
        });

      if (insertError) throw insertError;

      alert('✅ Cours téléchargé avec succès ! En attente d\'approbation par l\'administration.');
      setCourseForm({ title: '', description: '', subject: 'Mathématiques', classLevel: 'L1' });
      setSelectedFile(null);
      setShowModal(false);
      loadTeacherData();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleGradeChange = (studentId: string, field: 'note1' | 'note2' | 'comment', value: any) => {
    setGradeEntries(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        student_id: studentId,
        [field]: value,
      }
    }));
  };

  const handleSaveAllGrades = async () => {
    setSavingGrades(true);
    try {
      const gradesToSave = Object.values(gradeEntries).filter(
        entry => entry.note1 !== null || entry.note2 !== null
      );

      // Récupérer l'ID enseignant
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      for (const gradeEntry of gradesToSave) {
        const { error } = await supabase
          .from('notes')
          .upsert({
            student_id: gradeEntry.student_id,
            teacher_id: teacherData?.id,
            subject: selectedSubject,
            class: selectedClass,
            note1: gradeEntry.note1,
            note2: gradeEntry.note2,
            comment: gradeEntry.comment,
          });
        if (error) throw error;
      }

      alert(`✅ ${gradesToSave.length} notes enregistrées avec succès !`);
      setGradeEntries({});
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setSavingGrades(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer ce cours ?')) return;
    try {
      const { error } = await supabase.from('courses').delete().eq('id', courseId);
      if (error) throw error;
      alert('✅ Cours supprimé');
      loadTeacherData();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'grades', label: 'Saisie notes', icon: FileText },
    { id: 'courses', label: 'Mes cours', icon: BookOpen },
    { id: 'schedule', label: 'Emploi du temps', icon: Calendar },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-cyan-50">
      <Navbar title="Espace Enseignant" user={user} onLogout={onLogout} bgColor="bg-gradient-to-r from-green-600 to-teal-600" />
      
      <div className="container mx-auto px-4 py-8">
        <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} activeColor="bg-green-600" />
        
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Carte de bienvenue */}
            <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-2xl shadow-2xl p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Bienvenue, Prof. {teacherInfo.name} 👋</h2>
                  <p className="text-green-100 text-lg">{teacherInfo.specialization} • Département {teacherInfo.department}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-6 backdrop-blur">
                  <p className="text-sm text-green-100 mb-1">Cours publiés</p>
                  <p className="text-4xl font-bold">{courses.length}</p>
                </div>
              </div>
            </div>

            {/* Actions rapides */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
                <div className="flex items-center mb-4">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <FileText className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold ml-3">Saisir des notes</h3>
                </div>
                <p className="text-gray-600 mb-4">Enregistrez les notes de vos étudiants par classe</p>
                <button 
                  onClick={() => setActiveTab('grades')}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg hover:shadow-lg transition font-semibold"
                >
                  Accéder à la saisie
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
                <div className="flex items-center mb-4">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Upload className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold ml-3">Télécharger un cours</h3>
                </div>
                <p className="text-gray-600 mb-4">Partagez vos supports de cours en PDF</p>
                <button 
                  onClick={() => {
                    setModalType('course');
                    setShowModal(true);
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg hover:shadow-lg transition font-semibold"
                >
                  Télécharger
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition">
                <div className="flex items-center mb-4">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <Calendar className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold ml-3">Mon emploi du temps</h3>
                </div>
                <p className="text-gray-600 mb-4">Consultez votre planning hebdomadaire</p>
                <button 
                  onClick={() => setActiveTab('schedule')}
                  className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 rounded-lg hover:shadow-lg transition font-semibold"
                >
                  Voir mon planning
                </button>
              </div>
            </div>

            {/* Statistiques */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-6">Mes statistiques</h3>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-l-4 border-blue-600">
                  <Users className="w-10 h-10 text-blue-600 mb-2" />
                  <p className="text-4xl font-bold text-blue-600">{students.length}</p>
                  <p className="text-gray-700 font-medium">Étudiants</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border-l-4 border-purple-600">
                  <BookOpen className="w-10 h-10 text-purple-600 mb-2" />
                  <p className="text-4xl font-bold text-purple-600">{courses.length}</p>
                  <p className="text-gray-700 font-medium">Cours publiés</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-l-4 border-green-600">
                  <CheckCircle className="w-10 h-10 text-green-600 mb-2" />
                  <p className="text-4xl font-bold text-green-600">158</p>
                  <p className="text-gray-700 font-medium">Notes saisies</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border-l-4 border-orange-600">
                  <Calendar className="w-10 h-10 text-orange-600 mb-2" />
                  <p className="text-4xl font-bold text-orange-600">5</p>
                  <p className="text-gray-700 font-medium">Classes gérées</p>
                </div>
              </div>
            </div>

            {/* Dernières activités */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Dernières activités</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="font-semibold">Notes saisies - L1 Groupe A</p>
                    <p className="text-sm text-gray-600">Mathématiques • Il y a 2 heures</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <Upload className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="font-semibold">Cours téléchargé - Algèbre linéaire</p>
                    <p className="text-sm text-gray-600">En attente d'approbation • Hier</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                  <MessageSquare className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="font-semibold">Message de l'administration</p>
                    <p className="text-sm text-gray-600">Réunion pédagogique vendredi • Il y a 3 jours</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GRADES TAB - SAISIE DES NOTES */}
        {activeTab === 'grades' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <FileText className="text-blue-600" />
              Saisie des Notes
            </h2>
            
            {/* Sélection classe et matière */}
            <div className="grid md:grid-cols-3 gap-4 mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
              <div>
                <label className="block text-sm font-bold mb-2">Classe</label>
                <select 
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full border-2 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option>L1 - Groupe A</option>
                  <option>L1 - Groupe B</option>
                  <option>L2 - Groupe A</option>
                  <option>L2 - Groupe B</option>
                  <option>L3 - Groupe A</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Matière</label>
                <select 
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full border-2 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option>Mathématiques</option>
                  <option>Physique</option>
                  <option>Informatique</option>
                  <option>Algorithmique</option>
                  <option>Anglais</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">Nombre d'étudiants</label>
                <div className="bg-white border-2 rounded-lg px-4 py-3 font-bold text-blue-600 text-xl">
                  {students.filter(s => s.class === selectedClass).length || 25} étudiants
                </div>
              </div>
            </div>

            {/* Tableau de saisie */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-100 to-indigo-100">
                    <th className="border-2 px-4 py-3 text-left font-bold">N°</th>
                    <th className="border-2 px-4 py-3 text-left font-bold">Matricule</th>
                    <th className="border-2 px-4 py-3 text-left font-bold">Nom complet</th>
                    <th className="border-2 px-4 py-3 text-center font-bold">Contrôle 1 /20</th>
                    <th className="border-2 px-4 py-3 text-center font-bold">Contrôle 2 /20</th>
                    <th className="border-2 px-4 py-3 text-center font-bold">Moyenne</th>
                    <th className="border-2 px-4 py-3 text-left font-bold">Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {students.slice(0, 25).map((student, index) => {
                    const entry = gradeEntries[student.id] || { note1: null, note2: null, comment: '' };
                    const moyenne = entry.note1 && entry.note2 ? ((entry.note1 + entry.note2) / 2).toFixed(2) : '-';
                    
                    return (
                      <tr key={student.id} className="hover:bg-blue-50 transition">
                        <td className="border-2 px-4 py-3 font-semibold text-center">{index + 1}</td>
                        <td className="border-2 px-4 py-3 font-medium text-blue-600">{student.student_number}</td>
                        <td className="border-2 px-4 py-3 font-medium">
                          {student.user?.first_name} {student.user?.last_name}
                        </td>
                        <td className="border-2 px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.25"
                            value={entry.note1 ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'note1', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full border-2 rounded-lg px-3 py-2 text-center font-bold text-lg focus:border-blue-500 focus:outline-none"
                            placeholder="0-20"
                          />
                        </td>
                        <td className="border-2 px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.25"
                            value={entry.note2 ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'note2', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full border-2 rounded-lg px-3 py-2 text-center font-bold text-lg focus:border-blue-500 focus:outline-none"
                            placeholder="0-20"
                          />
                        </td>
                        <td className="border-2 px-4 py-3 text-center">
                          <span className={`text-xl font-bold ${
                            moyenne !== '-' && parseFloat(moyenne) >= 10 ? 'text-green-600' : 
                            moyenne !== '-' ? 'text-red-600' : 'text-gray-400'
                          }`}>
                            {moyenne}
                          </span>
                        </td>
                        <td className="border-2 px-4 py-3">
                          <input
                            type="text"
                            value={entry.comment ?? ''}
                            onChange={(e) => handleGradeChange(student.id, 'comment', e.target.value)}
                            className="w-full border-2 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                            placeholder="Optionnel"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bouton d'enregistrement */}
            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setGradeEntries({})}
                className="px-6 py-3 border-2 rounded-lg hover:bg-gray-50 transition font-semibold flex items-center gap-2"
              >
                <X className="w-5 h-5" />
                Réinitialiser
              </button>
              <button 
                onClick={handleSaveAllGrades}
                disabled={savingGrades || Object.keys(gradeEntries).length === 0}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:shadow-lg transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                {savingGrades ? 'Enregistrement...' : `Enregistrer toutes les notes (${Object.keys(gradeEntries).length})`}
              </button>
            </div>
          </div>
        )}

        {/* COURSES TAB */}
        {activeTab === 'courses' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="text-purple-600" />
                Mes Cours ({courses.length})
              </h2>
              <button 
                onClick={() => {
                  setModalType('course');
                  setShowModal(true);
                }}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition font-semibold flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nouveau cours
              </button>
            </div>

            {loading ? (
              <p className="text-center text-gray-500 py-8">Chargement...</p>
            ) : courses.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl text-gray-500">Aucun cours téléchargé</p>
                <p className="text-sm text-gray-400 mt-2">Commencez par télécharger votre premier cours</p>
              </div>
            ) : (
              <div className="space-y-4">
                {courses.map((course) => (
                  <div key={course.id} className="border-2 rounded-lg p-5 hover:shadow-lg transition">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <FileText className="text-purple-600 w-8 h-8" />
                          <div>
                            <h3 className="font-bold text-lg">{course.title}</h3>
                            <p className="text-sm text-gray-600">{course.description}</p>
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm mt-3">
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                            📚 Matière
                          </span>
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
                            🎓 Niveau
                          </span>
                          <span className={`px-3 py-1 rounded-full font-semibold ${
                            course.isPublished 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {course.isPublished ? '✓ Publié' : '⏳ En attente'}
                          </span>
                          <span className="text-gray-500">
                            📅 {new Date(course.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {course.fileUrl && (
                          <a
                            href={course.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:bg-blue-50 p-3 rounded-lg transition"
                            title="Télécharger"
                          >
                            <Download className="w-5 h-5" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDeleteCourse(course.id)}
                          className="text-red-600 hover:bg-red-50 p-3 rounded-lg transition"
                          title="Supprimer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'schedule' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Calendar className="text-orange-600" />
              Mon Emploi du Temps
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-orange-100 to-yellow-100">
                    <th className="border-2 px-4 py-3 font-bold">Heure</th>
                    <th className="border-2 px-4 py-3 font-bold">Lundi</th>
                    <th className="border-2 px-4 py-3 font-bold">Mardi</th>
                    <th className="border-2 px-4 py-3 font-bold">Mercredi</th>
                    <th className="border-2 px-4 py-3 font-bold">Jeudi</th>
                    <th className="border-2 px-4 py-3 font-bold">Vendredi</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { time: '08:00-10:00', mon: 'L1-A', tue: 'L2-A', wed: '', thu: 'L1-B', fri: 'L3-A' },
                    { time: '10:00-12:00', mon: 'L1-B', tue: 'L3-B', wed: '', thu: 'L2-B', fri: '' },
                    { time: '14:00-16:00', mon: '', tue: 'L1-A', wed: '', thu: '', fri: 'L2-A' },
                  ].map((row, idx) => (
                    <tr key={idx}>
                      <td className="border-2 px-4 py-3 font-bold bg-gray-50 text-center">{row.time}</td>
                      {['mon', 'tue', 'wed', 'thu', 'fri'].map((day) => {
                        const classValue = row[day as keyof typeof row];
                        return (
                          <td key={day} className="border-2 px-4 py-3">
                            {classValue && (
                              <div className="bg-gradient-to-br from-green-100 to-teal-100 p-4 rounded-lg hover:shadow-md transition">
                                <p className="font-bold text-green-800 text-lg">Mathématiques</p>
                                <p className="text-sm text-green-600">Classe: {classValue}</p>
                                <p className="text-xs text-gray-600 mt-1">Salle A101</p>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <p className="font-semibold text-green-800 mb-1">📌 Note</p>
              <p className="text-sm text-green-700">Votre emploi du temps pour le semestre en cours. Contactez l'administration pour toute modification.</p>
            </div>
          </div>
        )}

        {/* MESSAGES TAB */}
        {activeTab === 'messages' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <MessageSquare className="text-purple-600" />
              Mes Messages
            </h2>
            
            <div className="space-y-4">
              <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 w-10 h-10 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Réunion pédagogique</h3>
                      <p className="text-xs text-gray-500">De: Administration • Il y a 2 heures</p>
                    </div>
                  </div>
                  <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold">Nouveau</span>
                </div>
                <p className="text-gray-700 mb-3">Réunion obligatoire ce vendredi à 14h pour discuter du programme du prochain trimestre. Merci de confirmer votre présence.</p>
              </div>

              <div className="border-2 rounded-lg p-5 hover:shadow-md transition cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-gray-400 w-10 h-10 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Rappel - Saisie des notes</h3>
                      <p className="text-xs text-gray-500">De: Administration • Hier</p>
                    </div>
                  </div>
                </div>
                <p className="text-gray-700">N'oubliez pas de saisir les notes du dernier contrôle avant vendredi prochain.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL - UPLOAD COURSE */}
      {showModal && modalType === 'course' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">📤 Télécharger un cours</h3>
              <button onClick={() => setShowModal(false)} className="text-3xl hover:text-red-600 transition">×</button>
            </div>

            <form onSubmit={handleUploadCourse} className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-sm text-blue-800">
                  ℹ️ <strong>Note:</strong> Le cours sera soumis à l'administration pour approbation avant d'être visible par les étudiants.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Titre du cours *</label>
                <input
                  type="text"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({...courseForm, title: e.target.value})}
                  className="w-full border-2 rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
                  placeholder="Ex: Chapitre 5 - Algèbre linéaire"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Description</label>
                <textarea
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({...courseForm, description: e.target.value})}
                  className="w-full border-2 rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
                  placeholder="Description du contenu du cours..."
                  rows={3}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Matière *</label>
                  <select
                    value={courseForm.subject}
                    onChange={(e) => setCourseForm({...courseForm, subject: e.target.value})}
                    className="w-full border-2 rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
                    required
                  >
                    <option>Mathématiques</option>
                    <option>Physique</option>
                    <option>Informatique</option>
                    <option>Algorithmique</option>
                    <option>Anglais</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Niveau *</label>
                  <select
                    value={courseForm.classLevel}
                    onChange={(e) => setCourseForm({...courseForm, classLevel: e.target.value})}
                    className="w-full border-2 rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
                    required
                  >
                    <option value="L1">Licence 1</option>
                    <option value="L2">Licence 2</option>
                    <option value="L3">Licence 3</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Fichier PDF *</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="w-full border-2 rounded-lg px-4 py-3 focus:border-purple-500 focus:outline-none"
                  required
                />
                {selectedFile && (
                  <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {selectedFile.name}
                  </p>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 border-2 rounded-lg hover:bg-gray-50 transition font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  {uploading ? 'Téléchargement...' : 'Télécharger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImprovedTeacherDashboard;
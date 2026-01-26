// src/pages/teacher/TeacherDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Home, BookOpen, FileText, Upload, Edit, Trash2, Save } from 'lucide-react';
import Navbar from '../components/Navbar';
import TabNavigation from '../components/TabNavigation';
import StatCard from '../components/StatCard';
import { User, Course, Grade, Student } from '../types';
import { supabase } from '../lib/supabaseClient';

interface TeacherDashboardProps {
  user: User | null;
  onLogout: () => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  // États pour l'upload de cours
  const [courseTitle, setCourseTitle] = useState<string>('');
  const [courseDescription, setCourseDescription] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  
  // États pour saisie de notes
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [gradeType, setGradeType] = useState<string>('Examen');

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

      // Charger les étudiants (simplification)
      const { data: studentsData } = await supabase
        .from('students')
        .select('*, users(first_name, last_name, email)')
        .limit(50);
      
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
    if (!selectedFile || !courseTitle) return;

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
          title: courseTitle,
          description: courseDescription,
          teacher_id: teacherData?.id,
          file_url: urlData.publicUrl,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          is_published: true,
        });

      if (insertError) throw insertError;

      alert('Cours téléchargé avec succès !');
      setCourseTitle('');
      setCourseDescription('');
      setSelectedFile(null);
      loadTeacherData();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce cours ?')) return;

    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      alert('Cours supprimé avec succès');
      loadTeacherData();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    }
  };

  const renderDashboard = () => (
    <>
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <FileText className="w-8 h-8 text-green-600 mr-3" />
            <h3 className="text-xl font-bold">Saisie des notes</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Matière</label>
              <select className="w-full border rounded px-3 py-2">
                <option>Mathématiques</option>
                <option>Physique</option>
                <option>Informatique</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Classe</label>
              <select className="w-full border rounded px-3 py-2">
                <option>L1 - Groupe A</option>
                <option>L2 - Groupe B</option>
              </select>
            </div>
            <button 
              onClick={() => setActiveTab('grades')}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
            >
              Accéder à la saisie
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Upload className="w-8 h-8 text-blue-600 mr-3" />
            <h3 className="text-xl font-bold">Upload rapide</h3>
          </div>
          <button 
            onClick={() => setActiveTab('courses')}
            className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700"
          >
            Télécharger un nouveau cours
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Mes statistiques</h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <p className="text-3xl font-bold text-blue-600">{students.length}</p>
            <p className="text-gray-600">Étudiants</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <p className="text-3xl font-bold text-green-600">{courses.length}</p>
            <p className="text-gray-600">Cours publiés</p>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <p className="text-3xl font-bold text-purple-600">0</p>
            <p className="text-gray-600">Notes saisies</p>
          </div>
          <div className="bg-orange-50 p-4 rounded">
            <p className="text-3xl font-bold text-orange-600">3</p>
            <p className="text-gray-600">Classes</p>
          </div>
        </div>
      </div>
    </>
  );

  const renderCourses = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">Gestion des cours</h2>
      
      {/* Formulaire d'upload */}
      <form onSubmit={handleUploadCourse} className="mb-8 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-bold mb-4">Télécharger un nouveau cours</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Titre du cours</label>
            <input
              type="text"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Ex: Chapitre 5 - Algèbre linéaire"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Description (optionnel)</label>
            <textarea
              value={courseDescription}
              onChange={(e) => setCourseDescription(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Description du cours..."
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Fichier PDF</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full border rounded px-3 py-2"
              required
            />
            {selectedFile && (
              <p className="text-sm text-green-600 mt-2">✓ {selectedFile.name}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Téléchargement...' : 'Télécharger le cours'}
          </button>
        </div>
      </form>

      {/* Liste des cours */}
      <div className="overflow-x-auto">
        <h3 className="text-lg font-bold mb-4">Mes cours</h3>
        {loading ? (
          <p className="text-center text-gray-500">Chargement...</p>
        ) : courses.length === 0 ? (
          <p className="text-center text-gray-500">Aucun cours téléchargé</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Titre</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{course.title}</td>
                  <td className="px-4 py-3">
                    {new Date(course.uploadedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      course.isPublished 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {course.isPublished ? 'Publié' : 'Brouillon'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button 
                        className="text-blue-600 hover:underline"
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCourse(course.id)}
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
        )}
      </div>
    </div>
  );

  const renderGrades = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">Saisie des notes</h2>
      
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Matière</label>
          <select 
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Sélectionner...</option>
            <option>Mathématiques</option>
            <option>Physique</option>
            <option>Informatique</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Classe</label>
          <select 
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Sélectionner...</option>
            <option>L1 - Groupe A</option>
            <option>L2 - Groupe B</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Type d'évaluation</label>
          <select 
            value={gradeType}
            onChange={(e) => setGradeType(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option>Examen</option>
            <option>Devoir</option>
            <option>TP</option>
            <option>Contrôle</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Étudiant</th>
              <th className="px-4 py-2 text-left">Note /20</th>
              <th className="px-4 py-2 text-left">Commentaire</th>
              <th className="px-4 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {students.slice(0, 10).map((student) => (
              <tr key={student.id} className="border-b">
                <td className="px-4 py-3">{student.studentNumber}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.25"
                    className="w-24 border rounded px-2 py-1"
                    placeholder="0-20"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1"
                    placeholder="Optionnel"
                  />
                </td>
                <td className="px-4 py-3">
                  <button className="text-green-600 hover:underline flex items-center gap-1">
                    <Save className="w-4 h-4" />
                    Enregistrer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <button className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
          Enregistrer toutes les notes
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'courses': return renderCourses();
      case 'grades': return renderGrades();
      default: return renderDashboard();
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'courses', label: 'Mes cours', icon: BookOpen },
    { id: 'grades', label: 'Saisie notes', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Espace Enseignant" user={user} onLogout={onLogout} bgColor="bg-green-600" />
      
      <div className="container mx-auto px-4 py-8">
        <TabNavigation 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          activeColor="bg-green-600"
        />
        
        {renderContent()}
      </div>
    </div>
  );
};

export default TeacherDashboard;
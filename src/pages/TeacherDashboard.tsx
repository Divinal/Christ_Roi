// src/pages/TeacherDashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  Home, BookOpen, FileText, Upload, Calendar, MessageSquare, 
  Save, Send, Eye, Download, Trash2, Check, X, Search, LogOut
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface User {
  id: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
}

interface TeacherDashboardProps {
  user: User | null;
  onLogout: () => void;
}

interface TeacherClass {
  id: string;
  name: string;
  level: string;
  subject_name: string;
  subject_id: string;
}

interface StudentGrade {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  grade_value?: number;
  comment?: string;
}

interface Course {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  uploaded_at: string;
  is_approved: boolean;
  subject_name?: string;
}

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_name: string;
  class_name: string;
  room?: string;
}

interface Message {
  id: string;
  subject: string;
  content: string;
  sent_at: string;
  sender_name?: string;
  is_read: boolean;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [teacherId, setTeacherId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // États pour les données
  const [myClasses, setMyClasses] = useState<TeacherClass[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [mySchedule, setMySchedule] = useState<Schedule[]>([]);
  const [myMessages, setMyMessages] = useState<Message[]>([]);

  // États pour la saisie de notes
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [gradeType, setGradeType] = useState<string>('Examen');
  const [coefficient, setCoefficient] = useState<number>(1);
  const [examDate, setExamDate] = useState<string>('');
  const [studentsGrades, setStudentsGrades] = useState<StudentGrade[]>([]);

  // États pour l'upload de cours
  const [courseTitle, setCourseTitle] = useState<string>('');
  const [courseDescription, setCourseDescription] = useState<string>('');
  const [courseSubject, setCourseSubject] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
    // États pour visualiser les notes saisies
  const [selectedStudentForView, setSelectedStudentForView] = useState<string>('');
  const [viewStudentGrades, setViewStudentGrades] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadTeacherData();
    }
  }, [user]);

  const loadTeacherData = async () => {
    setLoading(true);
    try {
      // 1. Récupérer l'ID enseignant
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!teacherData) {
        alert('Profil enseignant non trouvé');
        return;
      }

      setTeacherId(teacherData.id);

      // 2. Charger les classes assignées avec matières
      const { data: classesData } = await supabase
        .from('teacher_subject_classes')
        .select(`
          id,
          class_id,
          subject_id,
          classes (id, name, level),
          subjects (id, name, code)
        `)
        .eq('teacher_id', teacherData.id)
        .eq('academic_year', '2025-2026');

      if (classesData) {
        const formattedClasses = classesData.map((item: any) => ({
          id: item.class_id,
          name: item.classes.name,
          level: item.classes.level,
          subject_id: item.subject_id,
          subject_name: item.subjects.name
        }));
        setMyClasses(formattedClasses);
      }

      // 3. Charger les cours uploadés
      const { data: coursesData } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          description,
          file_url,
          uploaded_at,
          is_approved,
          subjects (name)
        `)
        .eq('teacher_id', teacherData.id)
        .order('uploaded_at', { ascending: false });

      if (coursesData) {
        const formattedCourses = coursesData.map((c: any) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          file_url: c.file_url,
          uploaded_at: c.uploaded_at,
          is_approved: c.is_approved,
          subject_name: c.subjects?.name
        }));
        setMyCourses(formattedCourses);
      }

      // 4. Charger l'emploi du temps
      const { data: scheduleData } = await supabase
        .from('schedules')
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          room,
          classes (name),
          subjects (name)
        `)
        .eq('teacher_id', teacherData.id)
        .eq('academic_year', '2025-2026')
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (scheduleData) {
        const formattedSchedule = scheduleData.map((s: any) => ({
          id: s.id,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          room: s.room,
          class_name: s.classes?.name,
          subject_name: s.subjects?.name
        }));
        setMySchedule(formattedSchedule);
      }

      // 5. Charger les messages reçus
      const { data: messagesData } = await supabase
        .from('messages')
        .select(`
          id,
          subject,
          content,
          sent_at,
          sender_id,
          users!messages_sender_id_fkey (first_name, last_name)
        `)
        .or(`recipient_type.eq.all_teachers,recipient_type.eq.all,and(recipient_type.eq.individual,recipient_id.eq.${user?.id})`)
        .order('sent_at', { ascending: false })
        .limit(20);

      if (messagesData) {
        const formattedMessages = messagesData.map((m: any) => ({
          id: m.id,
          subject: m.subject,
          content: m.content,
          sent_at: m.sent_at,
          sender_name: m.users ? `${m.users.first_name} ${m.users.last_name}` : 'Système',
          is_read: false
        }));
        setMyMessages(formattedMessages);
      }

    } catch (error) {
      console.error('Error loading teacher data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ==================== CHARGEMENT ÉTUDIANTS POUR SAISIE NOTES ====================
  const loadStudentsForGrading = async () => {
    if (!selectedClass || !selectedSubject) {
      alert('Veuillez sélectionner une classe et une matière');
      return;
    }

    setLoading(true);
    try {
      // Récupérer les étudiants de la classe sélectionnée
      const { data: studentsData } = await supabase
        .from('student_classes')
        .select(`
          student_id,
          students (
            id,
            student_number,
            users (first_name, last_name)
          )
        `)
        .eq('class_id', selectedClass)
        .eq('academic_year', '2025-2026');

      if (studentsData) {
        const formattedStudents = studentsData.map((item: any) => ({
          student_id: item.students.id,
          student_number: item.students.student_number,
          first_name: item.students.users?.first_name || '',
          last_name: item.students.users?.last_name || '',
          grade_value: undefined,
          comment: ''
        }));
        setStudentsGrades(formattedStudents);
      }
    } catch (error) {
      console.error('Error loading students:', error);
      alert('Erreur lors du chargement des étudiants');
    } finally {
      setLoading(false);
    }
  };

  // ==================== SAISIE DES NOTES ====================
  const updateGrade = (studentId: string, field: 'grade_value' | 'comment', value: any) => {
    setStudentsGrades(prev =>
      prev.map(s =>
        s.student_id === studentId ? { ...s, [field]: value } : s
      )
    );
  };

  const saveGrade = async (studentId: string) => {
    const student = studentsGrades.find(s => s.student_id === studentId);
    if (!student || student.grade_value === undefined) {
      alert('Veuillez saisir une note');
      return;
    }

    try {
      const { error } = await supabase.from('grades').insert({
        student_id: studentId,
        subject_id: selectedSubject,
        teacher_id: teacherId,
        class_id: selectedClass,
        grade_value: student.grade_value,
        grade_type: gradeType,
        coefficient: coefficient,
        exam_date: examDate || null,
        comment: student.comment || null
      });

      if (error) throw error;
      alert('✅ Note enregistrée avec succès');
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const saveAllGrades = async () => {
    const gradesToSave = studentsGrades.filter(s => s.grade_value !== undefined);
    
    if (gradesToSave.length === 0) {
      alert('Aucune note à enregistrer');
      return;
    }

    if (!window.confirm(`Enregistrer ${gradesToSave.length} note(s) ?`)) return;

    setLoading(true);
    try {
      const gradesData = gradesToSave.map(s => ({
        student_id: s.student_id,
        subject_id: selectedSubject,
        teacher_id: teacherId,
        class_id: selectedClass,
        grade_value: s.grade_value,
        grade_type: gradeType,
        coefficient: coefficient,
        exam_date: examDate || null,
        comment: s.comment || null
      }));

      const { error } = await supabase.from('grades').insert(gradesData);
      if (error) throw error;

      alert(`✅ ${gradesToSave.length} note(s) enregistrée(s) avec succès !`);
      setStudentsGrades([]);
      setSelectedClass('');
      setSelectedSubject('');
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

    // ==================== VISUALISATION DES NOTES SAISIES ====================
    const loadGradesForStudent = async (studentId: string) => {
      if (!studentId) {
        setViewStudentGrades([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('grades')
          .select(`
            *,
            subjects (name, code),
            classes (name)
          `)
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .order('exam_date', { ascending: false });

        if (error) throw error;
        setViewStudentGrades(data || []);
      } catch (error: any) {
        console.error('Erreur chargement notes:', error);
        alert(`❌ Erreur: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

  // ==================== UPLOAD DE COURS ====================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      alert('⚠️ Veuillez sélectionner un fichier PDF');
    }
  };

  const handleUploadCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !courseTitle || !courseSubject) {
      alert('⚠️ Veuillez remplir tous les champs et sélectionner un fichier');
      return;
    }

    setUploading(true);
    try {
      // 1. Upload du fichier dans Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}_${teacherId}.${fileExt}`;
      const filePath = `courses/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('courses')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // 2. Obtenir l'URL publique
      const { data: urlData } = supabase.storage
        .from('courses')
        .getPublicUrl(filePath);

      // 3. Créer l'enregistrement du cours (en attente d'approbation)
      const { error: insertError } = await supabase.from('courses').insert({
        title: courseTitle,
        description: courseDescription,
        subject_id: courseSubject,
        teacher_id: teacherId,
        file_url: urlData.publicUrl,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        is_approved: false // En attente d'approbation par l'admin
      });

      if (insertError) throw insertError;

      alert('✅ Cours envoyé avec succès ! En attente d\'approbation par l\'administration.');
      setCourseTitle('');
      setCourseDescription('');
      setCourseSubject('');
      setSelectedFile(null);
      loadTeacherData();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm('⚠️ Supprimer ce cours ?')) return;

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
    { id: 'messages', label: 'Messages', icon: MessageSquare }
  ];

  const getDayName = (day: number) => {
    const days = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    return days[day] || '';
  };

  // Grouper les emplois du temps par jour
  const getSchedulesByDay = () => {
    const byDay: { [key: number]: Schedule[] } = {
      1: [], 2: [], 3: [], 4: [], 5: []
    };
    mySchedule.forEach(schedule => {
      if (schedule.day_of_week >= 1 && schedule.day_of_week <= 5) {
        byDay[schedule.day_of_week].push(schedule);
      }
    });
    return byDay;
  };

  // ==================== RENDUS ====================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAVBAR */}
      <nav className="bg-green-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Espace Enseignant</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">Prof. {user?.first_name} {user?.last_name}</span>
            <button
              onClick={onLogout}
              className="bg-green-700 px-4 py-2 rounded hover:bg-green-800 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </nav>
      
      <div className="container mx-auto px-4 py-8">
        {/* TABS */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TABLEAU DE BORD */}
        {activeTab === 'dashboard' && (
          <>
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="bg-blue-50 p-6 rounded-lg">
                <p className="text-4xl font-bold text-blue-600">{myClasses.length}</p>
                <p className="text-gray-600">Classes assignées</p>
              </div>
              <div className="bg-green-50 p-6 rounded-lg">
                <p className="text-4xl font-bold text-green-600">{myCourses.length}</p>
                <p className="text-gray-600">Cours uploadés</p>
              </div>
              <div className="bg-purple-50 p-6 rounded-lg">
                <p className="text-4xl font-bold text-purple-600">{myCourses.filter(c => c.is_approved).length}</p>
                <p className="text-gray-600">Cours approuvés</p>
              </div>
              <div className="bg-orange-50 p-6 rounded-lg">
                <p className="text-4xl font-bold text-orange-600">{myMessages.length}</p>
                <p className="text-gray-600">Messages reçus</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> Mes Classes
                </h3>
                {myClasses.length === 0 ? (
                  <p className="text-gray-500 text-center">Aucune classe assignée</p>
                ) : (
                  <div className="space-y-2">
                    {myClasses.map((cls) => (
                      <div key={cls.id} className="p-3 border rounded hover:bg-gray-50">
                        <p className="font-semibold">{cls.name} - {cls.level}</p>
                        <p className="text-sm text-gray-600">{cls.subject_name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" /> Prochains cours
                </h3>
                {mySchedule.length === 0 ? (
                  <p className="text-gray-500 text-center">Aucun cours planifié</p>
                ) : (
                  <div className="space-y-2">
                    {mySchedule.slice(0, 5).map((sch) => (
                      <div key={sch.id} className="p-3 border rounded">
                        <p className="font-semibold">{sch.subject_name}</p>
                        <p className="text-sm text-gray-600">
                          {getDayName(sch.day_of_week)} • {sch.class_name} • {sch.start_time.slice(0, 5)} - {sch.end_time.slice(0, 5)}
                          {sch.room && ` • Salle ${sch.room}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

       {/* SAISIE DES NOTES */}
        {activeTab === 'grades' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Saisie des notes</h2>

            {/* SAISIE */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-4 text-green-700">➕ Saisir de nouvelles notes</h3>
              
              <div className="grid md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium mb-2">Classe *</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Sélectionner...</option>
                    {myClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} - {cls.subject_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Matière *</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Sélectionner...</option>
                    {myClasses
                      .filter(c => c.id === selectedClass)
                      .map((cls) => (
                        <option key={cls.subject_id} value={cls.subject_id}>
                          {cls.subject_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Type d'évaluation *</label>
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

                <div>
                  <label className="block text-sm font-medium mb-2">Coefficient *</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={coefficient}
                    onChange={(e) => setCoefficient(parseInt(e.target.value))}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Date de l'examen</label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="md:col-span-2 flex items-end">
                  <button
                    onClick={loadStudentsForGrading}
                    disabled={!selectedClass || !selectedSubject}
                    className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Charger les étudiants
                  </button>
                </div>
              </div>

              {studentsGrades.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left">Matricule</th>
                          <th className="px-4 py-3 text-left">Nom complet</th>
                          <th className="px-4 py-3 text-left">Note /20</th>
                          <th className="px-4 py-3 text-left">Commentaire</th>
                          <th className="px-4 py-3 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentsGrades.map((student) => (
                          <tr key={student.student_id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{student.student_number}</td>
                            <td className="px-4 py-3">{student.first_name} {student.last_name}</td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                step="0.25"
                                value={student.grade_value || ''}
                                onChange={(e) => updateGrade(student.student_id, 'grade_value', parseFloat(e.target.value))}
                                className="w-24 border rounded px-2 py-1"
                                placeholder="0-20"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={student.comment || ''}
                                onChange={(e) => updateGrade(student.student_id, 'comment', e.target.value)}
                                className="w-full border rounded px-2 py-1"
                                placeholder="Optionnel"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => saveGrade(student.student_id)}
                                disabled={student.grade_value === undefined}
                                className="text-green-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                              >
                                <Save className="w-4 h-4" />
                                Enregistrer
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => setStudentsGrades([])}
                      className="px-6 py-2 border rounded hover:bg-gray-100"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={saveAllGrades}
                      disabled={loading}
                      className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading ? 'Enregistrement...' : 'Enregistrer toutes les notes'}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* SÉPARATEUR */}
            <div className="border-t-2 border-gray-300 my-8"></div>

            {/* VISUALISATION */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-blue-700">👁️ Consulter les notes saisies</h3>
              
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <label className="block text-sm font-medium mb-2">
                  Sélectionner un étudiant pour voir ses notes
                </label>
                <select
                  value={selectedStudentForView}
                  onChange={(e) => {
                    setSelectedStudentForView(e.target.value);
                    loadGradesForStudent(e.target.value);
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">-- Choisir un étudiant --</option>
                  {myClasses.flatMap(cls => 
                    studentsGrades
                      .filter(s => s.student_id)
                      .map(s => (
                        <option key={s.student_id} value={s.student_id}>
                          {s.student_number} - {s.first_name} {s.last_name}
                        </option>
                      ))
                  )}
                </select>
              </div>

              {selectedStudentForView ? (
                loading ? (
                  <p className="text-center py-8">Chargement...</p>
                ) : viewStudentGrades.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">Aucune note saisie pour cet étudiant</p>
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
                          <th className="px-4 py-3 text-left">Commentaire</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewStudentGrades.map((grade) => (
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
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {grade.comment || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <p className="text-center py-8 text-gray-500">
                  Sélectionnez un étudiant pour voir ses notes
                </p>
              )}
            </div>
          </div>
        )}
        {/* MES COURS */}
        {activeTab === 'courses' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Gestion des cours</h2>

            {/* Formulaire d'upload */}
            <form onSubmit={handleUploadCourse} className="mb-8 p-6 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-bold mb-4">📤 Télécharger un nouveau cours</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Titre du cours *</label>
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
                  <label className="block text-sm font-medium mb-2">Matière *</label>
                  <select
                    value={courseSubject}
                    onChange={(e) => setCourseSubject(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {Array.from(new Set(myClasses.map(c => c.subject_id))).map(subjectId => {
                      const cls = myClasses.find(c => c.subject_id === subjectId);
                      return (
                        <option key={subjectId} value={subjectId}>
                          {cls?.subject_name}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Description (optionnel)</label>
                  <textarea
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Description du cours..."
                    rows={3}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Fichier PDF *</label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                  {selectedFile && (
                    <p className="text-sm text-green-600 mt-2">✓ {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-5 h-5" />
                    {uploading ? 'Téléchargement en cours...' : 'Télécharger le cours'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    ℹ️ Le cours sera envoyé à l'administration pour approbation avant d'être visible par les étudiants
                  </p>
                </div>
              </div>
            </form>

            {/* Liste des cours uploadés */}
            <h3 className="text-lg font-bold mb-4">📚 Mes cours uploadés</h3>
            {myCourses.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucun cours uploadé</p>
            ) : (
              <div className="space-y-4">
                {myCourses.map((course) => (
                  <div key={course.id} className="border rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-lg">{course.title}</h4>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            course.is_approved 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {course.is_approved ? '✓ Approuvé' : '⏳ En attente'}
                          </span>
                        </div>
                        {course.description && (
                          <p className="text-sm text-gray-600 mb-2">{course.description}</p>
                        )}
                        <div className="flex gap-4 text-sm text-gray-500">
                          <span>📚 {course.subject_name}</span>
                          <span>📅 {new Date(course.uploaded_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={course.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                          title="Voir"
                        >
                          <Eye className="w-5 h-5" />
                        </a>
                        <button
                          onClick={() => handleDeleteCourse(course.id)}
                          className="text-red-600 hover:bg-red-50 p-2 rounded"
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

        {/* EMPLOI DU TEMPS */}
        {activeTab === 'schedule' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Mon Emploi du Temps</h2>
            
            {mySchedule.length === 0 ? (
              <p className="text-center text-gray-500 py-12">Aucun cours planifié</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-green-100 to-teal-100">
                      <th className="border-2 px-4 py-3 font-bold">Heure</th>
                      {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].map((day, idx) => (
                        <th key={idx} className="border-2 px-4 py-3 font-bold">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00'].map((timeSlot) => (
                      <tr key={timeSlot}>
                        <td className="border-2 px-4 py-3 font-bold bg-gray-50">{timeSlot}</td>
                        {[1, 2, 3, 4, 5].map((day) => {
                          const daySchedules = mySchedule.filter(s => 
                            s.day_of_week === day && 
                            `${s.start_time.substring(0, 5)}-${s.end_time.substring(0, 5)}` === timeSlot
                          );
                          
                          return (
                            <td key={day} className="border-2 px-2 py-2">
                              {daySchedules.map(schedule => (
                                <div key={schedule.id} className="bg-green-100 p-3 rounded-lg hover:bg-green-200 transition mb-1">
                                  <p className="font-semibold text-green-800">{schedule.subject_name}</p>
                                  <p className="text-xs text-green-600">{schedule.class_name}</p>
                                  {schedule.room && <p className="text-xs text-gray-600">Salle {schedule.room}</p>}
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
            )}

            <div className="mt-6 bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <p className="font-semibold text-green-800 mb-1">📌 Note</p>
              <p className="text-sm text-green-700">
                Votre emploi du temps pour le semestre en cours. Contactez l'administration pour toute modification.
              </p>
            </div>
          </div>
        )}

        {/* MESSAGES */}
        {activeTab === 'messages' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Mes Messages ({myMessages.length})</h2>
            
            {myMessages.length === 0 ? (
              <p className="text-center text-gray-500 py-12">Aucun message</p>
            ) : (
              <div className="space-y-4">
                {myMessages.map((msg) => (
                  <div key={msg.id} className="p-5 border-2 rounded-lg hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-lg">{msg.subject}</p>
                        <p className="text-sm text-gray-500">
                          De: {msg.sender_name} • {new Date(msg.sent_at).toLocaleString()}
                        </p>
                      </div>
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                        Nouveau
                      </span>
                    </div>
                    <p className="text-gray-700">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
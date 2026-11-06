// src/pages/TeacherDashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  Home, BookOpen, FileText, Calendar, MessageSquare,
  Save, LogOut, DollarSign
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { timeSlotOf, timeSlotsOf } from '../lib/schedule';
import PayslipHistoryTable from '../components/finance/PayslipHistoryTable';

interface User {
  id: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
}

interface TeacherDashboardProps {
  user: User | null;
  onLogout: () => void;
}

interface TeacherLevel {
  id: string;
  name: string;
  subject_name: string;
  subject_id: string;
  subject_coefficient: number;
}

interface StudentGrade {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  grade_value?: number;
  comment?: string;
}

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_name: string;
  level_name: string;
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
  const [myLevels, setMyLevels] = useState<TeacherLevel[]>([]);
  const [mySchedule, setMySchedule] = useState<Schedule[]>([]);
  const [myMessages, setMyMessages] = useState<Message[]>([]);

  // États pour la saisie de notes
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [gradeType, setGradeType] = useState<string>('CC1');
  const [coefficient, setCoefficient] = useState<number>(1);
  const [examDate, setExamDate] = useState<string>('');
  const [studentsGrades, setStudentsGrades] = useState<StudentGrade[]>([]);

    // États pour visualiser les notes saisies
  const [selectedStudentForView, setSelectedStudentForView] = useState<string>('');
  const [viewStudentGrades, setViewStudentGrades] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadTeacherData();
    }
  }, [user]);

  // À l'ouverture de la messagerie, les messages personnels passent à "lu"
  // (les messages collectifs n'ont pas de statut par destinataire).
  const [messagesSeen, setMessagesSeen] = useState<boolean>(false);
  const unreadCount = messagesSeen ? 0 : myMessages.filter(m => !m.is_read).length;

  useEffect(() => {
    if (activeTab !== 'messages' || messagesSeen || !user) return;
    const unreadIds = myMessages.filter(m => !m.is_read).map(m => m.id);
    if (unreadIds.length === 0) return;

    setMessagesSeen(true);
    supabase
      .from('messages')
      .update({ is_read: true })
      .in('id', unreadIds)
      .eq('recipient_id', user.id)
      .then(({ error }) => {
        if (error) console.error('Erreur marquage messages lus:', error);
      });
  }, [activeTab, messagesSeen, myMessages, user]);

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

      // 2. Charger les niveaux assignés avec matières
      const { data: levelsData } = await supabase
        .from('teacher_levels')
        .select(`
          id,
          level_id,
          subject_id,
          levels (id, name),
          subjects (id, name, code, coefficient)
        `)
        .eq('teacher_id', teacherData.id);

      if (levelsData) {
        const formattedLevels = levelsData.map((item: any) => ({
          id: item.level_id,
          name: item.levels.name,
          subject_id: item.subject_id,
          subject_name: item.subjects.name,
          subject_coefficient: item.subjects.coefficient || 1
        }));
        setMyLevels(formattedLevels);
      }

      // 3. Charger l'emploi du temps
      const { data: scheduleData } = await supabase
        .from('schedules')
        .select(`
          id,
          day_of_week,
          start_time,
          end_time,
          room,
          levels (name),
          subjects (name)
        `)
        .eq('teacher_id', teacherData.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (scheduleData) {
        const formattedSchedule = scheduleData.map((s: any) => ({
          id: s.id,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          room: s.room,
          level_name: s.levels?.name,
          subject_name: s.subjects?.name
        }));
        setMySchedule(formattedSchedule);
      }

      // 4. Charger les messages reçus. L'expéditeur est lu à part : messages
      // référence auth.users, qui n'est pas exposée par l'API (pas de jointure).
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('id, subject, content, sent_at, sender_id, is_read, recipient_type')
        .or(`recipient_type.eq.all_teachers,recipient_type.eq.all,and(recipient_type.eq.individual,recipient_id.eq.${user?.id})`)
        .order('sent_at', { ascending: false })
        .limit(20);

      if (messagesError) {
        console.error('Erreur chargement messages:', messagesError);
      } else if (messagesData) {
        const senderIds = Array.from(new Set(messagesData.map((m) => m.sender_id)));
        const { data: senders } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', senderIds);

        const senderName = (id: string) => {
          const sender = senders?.find((s) => s.user_id === id);
          return sender ? `${sender.first_name} ${sender.last_name}`.trim() : 'Administration';
        };

        setMyMessages(messagesData.map((m) => ({
          id: m.id,
          subject: m.subject,
          content: m.content,
          sent_at: m.sent_at,
          sender_name: senderName(m.sender_id),
          is_read: m.recipient_type !== 'individual' || Boolean(m.is_read)
        })));
      }

    } catch (error) {
      console.error('Error loading teacher data:', error);
    } finally {
      setLoading(false);
    }
  };

      const handleLogout = () => {
      const confirmed = window.confirm("Voulez-vous vous déconnecter ?");
      if (confirmed) {
        onLogout();
      }
    };

  // ==================== CHARGEMENT ÉTUDIANTS POUR SAISIE NOTES ====================
  const loadStudentsForGrading = async () => {
    if (!selectedLevel || !selectedSubject) {
      alert('Veuillez sélectionner un niveau et une matière');
      return;
    }

    setLoading(true);
    try {
      // Récupérer les étudiants du niveau sélectionné
      const { data: studentsData } = await supabase
        .from('students')
        .select(`
          id,
          student_number,
          profiles (first_name, last_name)
        `)
        .eq('level_id', selectedLevel);

      if (studentsData) {
        const formattedStudents = studentsData.map((item: any) => ({
          student_id: item.id,
          student_number: item.student_number,
          first_name: item.profiles?.first_name || '',
          last_name: item.profiles?.last_name || '',
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
        level_id: selectedLevel,
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
        level_id: selectedLevel,
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
      setSelectedLevel('');
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
            subjects (name, code, coefficient)
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

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'grades', label: 'Saisie notes', icon: FileText },
    { id: 'schedule', label: 'Emploi du temps', icon: Calendar },
    { id: 'messages', label: unreadCount > 0 ? `Messages (${unreadCount})` : 'Messages', icon: MessageSquare },
    { id: 'payslips', label: 'Mes Bulletins de Paie', icon: DollarSign }
  ];

  const getDayName = (day: number) => {
    const days = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    return days[day] || '';
  };

  // ==================== RENDUS ====================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAVBAR */}
      <nav className="bg-green-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Espace Enseignant</h1>
          <div className="flex items-center gap-4">
            <span className="text-xs md:text-sm hidden sm:inline">Prof : 👤 {user?.first_name} {user?.last_name}</span>
          <button
            onClick={handleLogout}
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
                <p className="text-4xl font-bold text-blue-600">{new Set(myLevels.map(l => l.id)).size}</p>
                <p className="text-gray-600">Niveaux assignés</p>
              </div>
              <div className="bg-green-50 p-6 rounded-lg">
                <p className="text-4xl font-bold text-green-600">{new Set(myLevels.map(l => l.subject_id)).size}</p>
                <p className="text-gray-600">Matières enseignées</p>
              </div>
              <div className="bg-purple-50 p-6 rounded-lg">
                <p className="text-4xl font-bold text-purple-600">{mySchedule.length}</p>
                <p className="text-gray-600">Créneaux par semaine</p>
              </div>
              <div className="bg-orange-50 p-6 rounded-lg">
                <p className="text-4xl font-bold text-orange-600">{unreadCount}</p>
                <p className="text-gray-600">Messages non lus</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> Mes Niveaux
                </h3>
                {myLevels.length === 0 ? (
                  <p className="text-gray-500 text-center">Aucun niveau assigné</p>
                ) : (
                  <div className="space-y-2">
                    {myLevels.map((level) => (
                      <div key={`${level.id}-${level.subject_id}`} className="p-3 border rounded hover:bg-gray-50">
                        <p className="font-semibold">{level.name}</p>
                        <p className="text-sm text-gray-600">{level.subject_name}</p>
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
                          {getDayName(sch.day_of_week)} • {sch.level_name} • {sch.start_time.slice(0, 5)} - {sch.end_time.slice(0, 5)}
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
                  <label htmlFor="grade-level" className="block text-sm font-medium mb-2">Niveau *</label>
                  <select
                    id="grade-level"
                    value={selectedLevel}
                    onChange={(e) => {
                      setSelectedLevel(e.target.value);
                      setSelectedSubject('');
                    }}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Sélectionner...</option>
                    {Array.from(new Map(myLevels.map((level) => [level.id, level.name]))).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Matière *</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      const subjectId = e.target.value;
                      setSelectedSubject(subjectId);
                      const level = myLevels.find(l => l.id === selectedLevel && l.subject_id === subjectId);
                      setCoefficient(level?.subject_coefficient || 1);
                    }}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Sélectionner...</option>
                    {myLevels
                      .filter(l => l.id === selectedLevel)
                      .map((level) => (
                        <option key={level.subject_id} value={level.subject_id}>
                          {level.subject_name}
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
                    <option value="CC1">CC1 (Contrôle Continu 1)</option>
                    <option value="CC2">CC2 (Contrôle Continu 2)</option>
                    <option value="CC3">CC3 (Contrôle Continu 3)</option>
                    <option value="E.Théorique">Examen Théorique</option>
                    <option value="E.Pratique">Examen Pratique</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Coefficient (UF) *</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={coefficient}
                    disabled
                    title="Le coefficient est défini au niveau de l'Unité de Formation (onglet Matières)"
                    className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
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
                    disabled={!selectedLevel || !selectedSubject}
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
                  {studentsGrades.map(s => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.student_number} - {s.first_name} {s.last_name}
                    </option>
                  ))}
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
                                {grade.subjects?.coefficient || grade.coefficient}
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
                      {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map((day, idx) => (
                        <th key={idx} className="border-2 px-4 py-3 font-bold">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                  {timeSlotsOf(mySchedule).map((timeSlot) => (                      <tr key={timeSlot}>
                        <td className="border-2 px-4 py-3 font-bold bg-gray-50">{timeSlot}</td>
                        {[1, 2, 3, 4, 5, 6].map((day) => {
                          const daySchedules = mySchedule.filter(s =>
                            s.day_of_week === day && timeSlotOf(s) === timeSlot
                          );
                          
                          return (
                            <td key={day} className="border-2 px-2 py-2">
                              {daySchedules.map(schedule => (
                                <div key={schedule.id} className="bg-green-100 p-3 rounded-lg hover:bg-green-200 transition mb-1">
                                  <p className="font-semibold text-green-800">{schedule.subject_name}</p>
                                  <p className="text-xs text-green-600">{schedule.level_name}</p>
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
                      {!msg.is_read && (
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                          Nouveau
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BULLETINS DE PAIE */}
        {activeTab === 'payslips' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Mes Bulletins de Paie</h2>
            {teacherId ? (
              <PayslipHistoryTable teacherId={teacherId} academicYear="2026-2027" showTeacherName={false} />
            ) : (
              <p className="text-center text-gray-500 py-12">Chargement...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
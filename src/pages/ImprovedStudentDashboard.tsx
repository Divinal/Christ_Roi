// src/pages/ImprovedStudentDashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  Home, BookOpen, FileText, Calendar, MessageSquare, Download, 
  Award, TrendingUp, AlertCircle
} from 'lucide-react';
import Navbar from '../components/Navbar';
import TabNavigation from '../components/TabNavigation';
import { User, Course, Message } from '../types';
import { supabase } from '../lib/supabaseClient';

interface StudentDashboardProps {
  user: User | null;
  onLogout: () => void;
}

interface StudentGrade {
  id: string;
  subject: string;
  grade: number;
  exam_type: string;
  date: string;
  coefficient: number;
}

const ImprovedStudentDashboard: React.FC<StudentDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Données de l'étudiant (à adapter selon votre BDD)
  const studentInfo = {
    name: user?.firstName + ' ' + user?.lastName,
    class: 'L1 - Groupe A',
    studentNumber: 'STU2024001',
    level: 'Licence 1',
  };

  useEffect(() => {
    if (user) {
      loadStudentData();
    }
  }, [user]);

  const loadStudentData = async () => {
    setLoading(true);
    try {
      // Charger les cours publiés pour la classe de l'étudiant
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true);
      if (coursesData) setCourses(coursesData);

      // Charger les notes de l'étudiant
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (studentData) {
        const { data: gradesData } = await supabase
          .from('grades')
          .select('*')
          .eq('student_id', studentData.id);
        if (gradesData) setGrades(gradesData);
      }

      // Charger les messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .or(`recipient_id.eq.${user?.id},target_audience.eq.students,target_audience.eq.all`)
        .order('sent_at', { ascending: false });
      if (messagesData) setMessages(messagesData);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAverage = (): number => {
    if (grades.length === 0) return 0;
    const total = grades.reduce((sum, grade) => sum + (grade.grade * (grade.coefficient || 1)), 0);
    const totalCoef = grades.reduce((sum, grade) => sum + (grade.coefficient || 1), 0);
    return totalCoef > 0 ? total / totalCoef : 0;
  };

  const getGradesBySubject = () => {
    const subjects: { [key: string]: StudentGrade[] } = {};
    grades.forEach(grade => {
      if (!subjects[grade.subject]) {
        subjects[grade.subject] = [];
      }
      subjects[grade.subject].push(grade);
    });
    return subjects;
  };

  const calculateSubjectAverage = (subjectGrades: StudentGrade[]): number => {
    if (subjectGrades.length === 0) return 0;
    const total = subjectGrades.reduce((sum, g) => sum + (g.grade * (g.coefficient || 1)), 0);
    const totalCoef = subjectGrades.reduce((sum, g) => sum + (g.coefficient || 1), 0);
    return totalCoef > 0 ? total / totalCoef : 0;
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId);
      loadStudentData();
    } catch (error) {
      console.error('Erreur marquage message:', error);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Home },
    { id: 'grades', label: 'Mes Notes', icon: FileText },
    { id: 'courses', label: 'Mes Cours', icon: BookOpen },
    { id: 'schedule', label: 'Emploi du temps', icon: Calendar },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Navbar title="Espace Étudiant" user={user} onLogout={onLogout} bgColor="bg-gradient-to-r from-blue-600 to-indigo-600" />
      
      <div className="container mx-auto px-4 py-8">
        <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} activeColor="bg-blue-600" />
        
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Carte de bienvenue */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-2xl p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Bienvenue, {studentInfo.name} 👋</h2>
                  <p className="text-blue-100 text-lg">{studentInfo.class} • Matricule: {studentInfo.studentNumber}</p>
                </div>
                <div className="text-right">
                  <div className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur">
                    <p className="text-sm text-blue-100">Moyenne générale</p>
                    <p className="text-4xl font-bold">{calculateAverage().toFixed(2)}/20</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistiques rapides */}
            <div className="grid md:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-3">
                  <Award className="w-10 h-10 text-blue-600" />
                  <span className={`text-2xl font-bold ${calculateAverage() >= 10 ? 'text-green-600' : 'text-red-600'}`}>
                    {calculateAverage().toFixed(2)}
                  </span>
                </div>
                <p className="text-gray-600 font-medium">Moyenne générale</p>
                <p className="text-xs text-gray-500 mt-1">{grades.length} notes enregistrées</p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition border-l-4 border-purple-500">
                <div className="flex items-center justify-between mb-3">
                  <BookOpen className="w-10 h-10 text-purple-600" />
                  <span className="text-2xl font-bold text-purple-600">{courses.length}</span>
                </div>
                <p className="text-gray-600 font-medium">Cours disponibles</p>
                <p className="text-xs text-gray-500 mt-1">Consultez vos documents</p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition border-l-4 border-orange-500">
                <div className="flex items-center justify-between mb-3">
                  <MessageSquare className="w-10 h-10 text-orange-600" />
                  <span className="text-2xl font-bold text-orange-600">
                    {messages.filter(m => !m.isRead).length}
                  </span>
                </div>
                <p className="text-gray-600 font-medium">Nouveaux messages</p>
                <p className="text-xs text-gray-500 mt-1">Messages non lus</p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition border-l-4 border-green-500">
                <div className="flex items-center justify-between mb-3">
                  <TrendingUp className="w-10 h-10 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">+12%</span>
                </div>
                <p className="text-gray-600 font-medium">Progression</p>
                <p className="text-xs text-gray-500 mt-1">Par rapport au trim. précédent</p>
              </div>
            </div>

            {/* Dernières notes et annonces */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText className="text-blue-600" />
                  Dernières notes
                </h3>
                <div className="space-y-3">
                  {grades.slice(0, 5).map((grade) => (
                    <div key={grade.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                      <div>
                        <p className="font-semibold">{grade.subject}</p>
                        <p className="text-sm text-gray-500">{grade.exam_type}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-bold ${
                          grade.grade >= 15 ? 'text-green-600' : 
                          grade.grade >= 10 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {grade.grade.toFixed(2)}
                        </span>
                        <p className="text-xs text-gray-500">/20</p>
                      </div>
                    </div>
                  ))}
                  {grades.length === 0 && (
                    <p className="text-center text-gray-500 py-8">Aucune note disponible</p>
                  )}
                </div>
                <button 
                  onClick={() => setActiveTab('grades')}
                  className="w-full mt-4 text-blue-600 font-semibold hover:bg-blue-50 py-2 rounded-lg transition"
                >
                  Voir toutes mes notes →
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <MessageSquare className="text-purple-600" />
                  Derniers messages
                </h3>
                <div className="space-y-3">
                  {messages.slice(0, 4).map((msg) => (
                    <div 
                      key={msg.id}
                      className={`p-3 rounded-lg border-l-4 cursor-pointer hover:shadow-md transition ${
                        !msg.isRead ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-300'
                      }`}
                      onClick={() => {
                        setSelectedMessage(msg);
                        if (!msg.isRead) markMessageAsRead(msg.id);
                      }}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-sm">{msg.subject}</p>
                        {!msg.isRead && (
                          <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">Nouveau</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{msg.content}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(msg.sentAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setActiveTab('messages')}
                  className="w-full mt-4 text-purple-600 font-semibold hover:bg-purple-50 py-2 rounded-lg transition"
                >
                  Voir tous les messages →
                </button>
              </div>
            </div>

            {/* Prochains événements */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Calendar className="text-orange-600" />
                Événements à venir
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-red-50 to-orange-50 p-4 rounded-lg border-l-4 border-red-500">
                  <p className="text-xs text-red-600 font-semibold mb-1">15 FÉV 2026</p>
                  <p className="font-bold">Examen Mathématiques</p>
                  <p className="text-sm text-gray-600">8h00 - Amphi A</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border-l-4 border-blue-500">
                  <p className="text-xs text-blue-600 font-semibold mb-1">18 FÉV 2026</p>
                  <p className="font-bold">TP Informatique</p>
                  <p className="text-sm text-gray-600">14h00 - Salle Info 2</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-teal-50 p-4 rounded-lg border-l-4 border-green-500">
                  <p className="text-xs text-green-600 font-semibold mb-1">20 FÉV 2026</p>
                  <p className="font-bold">Rendu Projet</p>
                  <p className="text-sm text-gray-600">Avant 23h59</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GRADES TAB - RELEVÉ DE NOTES */}
        {activeTab === 'grades' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="text-blue-600" />
                  Mon Relevé de Notes
                </h2>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Télécharger PDF
                </button>
              </div>

              {/* Carte moyenne générale */}
              <div className="bg-gradient-to-r from-blue-100 to-indigo-100 p-6 rounded-lg mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-blue-800 mb-1">Moyenne Générale</p>
                    <p className={`text-5xl font-bold ${
                      calculateAverage() >= 15 ? 'text-green-600' : 
                      calculateAverage() >= 10 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {calculateAverage().toFixed(2)}/20
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-800 mb-1">Statut</p>
                    <span className={`text-lg font-bold ${
                      calculateAverage() >= 10 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {calculateAverage() >= 10 ? '✓ Admis' : '✗ À rattraper'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes par matière */}
              {loading ? (
                <p className="text-center text-gray-500 py-8">Chargement...</p>
              ) : grades.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-xl text-gray-500">Aucune note disponible pour le moment</p>
                  <p className="text-sm text-gray-400 mt-2">Les notes seront affichées dès qu'elles seront saisies par vos enseignants</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(getGradesBySubject()).map(([subject, subjectGrades]) => {
                    const avg = calculateSubjectAverage(subjectGrades);
                    return (
                      <div key={subject} className="border-2 rounded-lg overflow-hidden">
                        <div className={`p-4 font-bold text-lg flex justify-between items-center ${
                          avg >= 10 ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                          <span>📚 {subject}</span>
                          <span className={`text-2xl ${avg >= 10 ? 'text-green-600' : 'text-red-600'}`}>
                            {avg.toFixed(2)}/20
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-4 py-3 text-left">Type d'évaluation</th>
                                <th className="px-4 py-3 text-center">Note</th>
                                <th className="px-4 py-3 text-center">Coefficient</th>
                                <th className="px-4 py-3 text-left">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subjectGrades.map((grade) => (
                                <tr key={grade.id} className="border-b hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium">{grade.exam_type}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`text-xl font-bold ${
                                      grade.grade >= 15 ? 'text-green-600' : 
                                      grade.grade >= 10 ? 'text-blue-600' : 'text-red-600'
                                    }`}>
                                      {grade.grade.toFixed(2)}/20
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                                      {grade.coefficient || 1}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">
                                    {new Date(grade.date).toLocaleDateString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* COURSES TAB */}
        {activeTab === 'courses' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <BookOpen className="text-purple-600" />
              Mes Cours - {studentInfo.class}
            </h2>
            
            {loading ? (
              <p className="text-center text-gray-500 py-8">Chargement...</p>
            ) : courses.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl text-gray-500">Aucun cours disponible</p>
                <p className="text-sm text-gray-400 mt-2">Les cours seront publiés par vos enseignants</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course) => (
                  <div key={course.id} className="border-2 rounded-lg p-5 hover:shadow-xl transition group cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition">
                        <FileText className="w-8 h-8 text-purple-600" />
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                        PDF
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-2 group-hover:text-purple-600 transition">
                      {course.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{course.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                      <span>📖 Cours</span>
                      <span>{new Date(course.uploadedAt).toLocaleDateString()}</span>
                    </div>
                    {course.fileUrl && (
                      <a 
                        href={course.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2 rounded-lg hover:shadow-lg transition flex items-center justify-center gap-2 font-semibold"
                      >
                        <Download className="w-4 h-4" />
                        Télécharger
                      </a>
                    )}
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
              Mon Emploi du Temps - {studentInfo.class}
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
                    { time: '08:00-10:00', mon: 'Mathématiques', tue: 'Physique', wed: '', thu: 'Informatique', fri: 'Mathématiques' },
                    { time: '10:00-12:00', mon: 'Physique', tue: 'Informatique', wed: '', thu: 'Mathématiques', fri: 'TP Informatique' },
                    { time: '14:00-16:00', mon: 'Algorithmique', tue: '', wed: 'Projet', thu: '', fri: 'Physique' },
                    { time: '16:00-18:00', mon: 'TP Physique', tue: 'Anglais', wed: '', thu: 'Français', fri: '' },
                  ].map((row, idx) => (
                    <tr key={idx}>
                      <td className="border-2 px-4 py-3 font-bold bg-gray-50">{row.time}</td>
                      <td className="border-2 px-4 py-3">
                        {row.mon && (
                          <div className="bg-blue-100 p-3 rounded-lg hover:bg-blue-200 transition">
                            <p className="font-semibold text-blue-800">{row.mon}</p>
                            <p className="text-xs text-blue-600">Salle A101</p>
                          </div>
                        )}
                      </td>
                      <td className="border-2 px-4 py-3">
                        {row.tue && (
                          <div className="bg-green-100 p-3 rounded-lg hover:bg-green-200 transition">
                            <p className="font-semibold text-green-800">{row.tue}</p>
                            <p className="text-xs text-green-600">Salle B202</p>
                          </div>
                        )}
                      </td>
                      <td className="border-2 px-4 py-3 bg-gray-50">
                        {row.wed && (
                          <div className="bg-purple-100 p-3 rounded-lg hover:bg-purple-200 transition">
                            <p className="font-semibold text-purple-800">{row.wed}</p>
                            <p className="text-xs text-purple-600">Salle C303</p>
                          </div>
                        )}
                      </td>
                      <td className="border-2 px-4 py-3">
                        {row.thu && (
                          <div className="bg-orange-100 p-3 rounded-lg hover:bg-orange-200 transition">
                            <p className="font-semibold text-orange-800">{row.thu}</p>
                            <p className="text-xs text-orange-600">Salle A101</p>
                          </div>
                        )}
                      </td>
                      <td className="border-2 px-4 py-3">
                        {row.fri && (
                          <div className="bg-pink-100 p-3 rounded-lg hover:bg-pink-200 transition">
                            <p className="font-semibold text-pink-800">{row.fri}</p>
                            <p className="text-xs text-pink-600">Labo Info</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="font-semibold text-blue-800 mb-1">📌 Note importante</p>
              <p className="text-sm text-blue-700">Cet emploi du temps est valable pour le semestre en cours. Consultez régulièrement pour les mises à jour.</p>
            </div>
          </div>
        )}

        {/* MESSAGES TAB */}
        {activeTab === 'messages' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <MessageSquare className="text-purple-600" />
              Mes Messages ({messages.filter(m => !m.isRead).length} non lus)
            </h2>
            
            {loading ? (
              <p className="text-center text-gray-500 py-8">Chargement...</p>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl text-gray-500">Aucun message</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`p-5 border-2 rounded-lg cursor-pointer hover:shadow-lg transition ${
                      !msg.isRead ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'
                    }`}
                    onClick={() => {
                      setSelectedMessage(msg);
                      if (!msg.isRead) markMessageAsRead(msg.id);
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          !msg.isRead ? 'bg-blue-600' : 'bg-gray-400'
                        }`}>
                          <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{msg.subject}</p>
                          <p className="text-xs text-gray-500">{new Date(msg.sentAt).toLocaleString()}</p>
                        </div>
                      </div>
                      {!msg.isRead && (
                        <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
                          Nouveau
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 mb-2">{msg.content}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">
                        De: Administration
                      </span>
                    </div>
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

export default ImprovedStudentDashboard;
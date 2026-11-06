// src/pages/StudentDashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  Home, FileText, Calendar, GraduationCap,
  Bell, Award, TrendingUp, LogOut, DollarSign
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { cycleLabel, SchoolCycle } from '../lib/levels';
import { timeSlotOf, timeSlotsOf } from '../lib/schedule';
import TuitionHistoryTable from '../components/finance/TuitionHistoryTable';

interface User {
  id: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
}

interface Student {
  id: string;
  user_id: string;
  student_number: string;
  level_id?: string | null;
  levels?: { name: string; cycle: SchoolCycle } | null;
  date_of_birth?: string;
  status: string;
  annual_tuition_fee?: number | null;
}

interface Grade {
  id: string;
  student_id: string;
  subject_id: string;
  grade_value: number;
  grade_type: string;
  coefficient: number;
  exam_date?: string;
  comment?: string;
  subjects?: {
    name: string;
    code: string;
    coefficient?: number;
  };
}

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room?: string;
  subjects?: {
    name: string;
  };
  teachers?: {
    profiles?: {
      first_name: string;
      last_name: string;
    };
  };
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  published_at: string;
  expires_at?: string;
}

interface StudentDashboardProps {
  user: User | null;
  onLogout: () => void;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      loadStudentData();
    }
  }, [user]);

  const loadStudentData = async () => {
    setLoading(true);
    try {
      // 1. Charger les infos de l'étudiant
      const { data: studentInfo, error: studentError } = await supabase
        .from('students')
        .select('*, levels(name, cycle)')
        .eq('user_id', user?.id)
        .single();

      if (studentError) {
        console.error('Erreur chargement étudiant:', studentError);
      } else {
        setStudentData(studentInfo);

        // 2. Charger l'emploi du temps du niveau de l'étudiant
        if (studentInfo.level_id) {
          loadSchedules(studentInfo.level_id);
        }

        // 3. Charger les notes
        loadGrades(studentInfo.id);

        // 4. Charger les annonces
        loadAnnouncements();
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGrades = async (studentId: string) => {
    const { data, error } = await supabase
      .from('grades')
      .select('*, subjects(name, code, coefficient)')
      .eq('student_id', studentId)
      .order('exam_date', { ascending: false });

    if (error) {
      console.error('Erreur chargement notes:', error);
    } else {
      setGrades(data || []);
    }
  };

  const loadSchedules = async (levelId: string) => {
    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        subjects(name),
        teachers(profiles(first_name, last_name))
      `)
      .eq('level_id', levelId)
      .order('day_of_week', { ascending: true });

    if (error) {
      console.error('Erreur chargement emploi du temps:', error);
    } else {
      setSchedules(data || []);
    }
  };

  const loadAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .in('target_audience', ['students', 'all'])
      .order('published_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Erreur chargement annonces:', error);
    } else {
      setAnnouncements(data || []);
    }
  };

  // Le coefficient officiel est celui de la matière (Unité de Formation),
  // le coefficient stocké sur la note peut être obsolète si la matière a été modifiée depuis
  const getEffectiveCoefficient = (grade: Grade): number =>
    grade.subjects?.coefficient || grade.coefficient;

  // Calculer la moyenne générale
  const calculateAverage = (): number => {
    if (grades.length === 0) return 0;
    const total = grades.reduce((sum, grade) => sum + (grade.grade_value * getEffectiveCoefficient(grade)), 0);
    const totalCoef = grades.reduce((sum, grade) => sum + getEffectiveCoefficient(grade), 0);
    return totalCoef > 0 ? total / totalCoef : 0;
  };

   const handleLogout = () => {
      const confirmed = window.confirm("Voulez-vous vous déconnecter ?");
      if (confirmed) {
        onLogout();
      }
    };

  const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAVBAR */}
      <nav className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Espace Étudiant</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">Bienvenue, {user?.first_name} {user?.last_name}</span>
           <button
             onClick={handleLogout}
              className="bg-green-700 px-4 py-2 rounded hover:bg-green-800 flex items-center gap-2">
              <LogOut className="w-4 h-4" />
               Déconnexion
            </button>
          </div>
        </div>
      </nav>

      {/* TABS */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Tableau de bord', icon: Home },
            { id: 'schedule', label: 'Emploi du temps', icon: Calendar },
            { id: 'announcements', label: 'Annonces', icon: Bell },
            { id: 'payments', label: 'Mes Paiements', icon: DollarSign },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
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
            {/* Carte de bienvenue */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    Bienvenue, {user?.first_name} {user?.last_name} 👋
                  </h2>
                  <p className="text-blue-100">
                    Matricule: {studentData?.student_number}
                    {studentData?.levels && ` • ${studentData.levels.name}`}
                  </p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur">
                  <p className="text-sm text-blue-100">Moyenne générale</p>
                  <p className="text-3xl font-bold">{calculateAverage().toFixed(2)}/20</p>
                </div>
              </div>
            </div>

            {/* Statistiques */}
            <div className="grid md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                <Award className="w-10 h-10 text-blue-600 mb-3" />
                <p className="text-3xl font-bold text-blue-600">
                  {calculateAverage().toFixed(2)}
                </p>
                <p className="text-gray-600">Moyenne générale</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                <GraduationCap className="w-10 h-10 text-purple-600 mb-3" />
                <p className="text-3xl font-bold text-purple-600">{studentData?.levels?.name || 'À inscrire'}</p>
                <p className="text-gray-600">
                  {studentData?.levels ? cycleLabel(studentData.levels.cycle) : "Contactez l'administration"}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
                <Bell className="w-10 h-10 text-orange-600 mb-3" />
                <p className="text-3xl font-bold text-orange-600">{announcements.length}</p>
                <p className="text-gray-600">Annonces</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                <TrendingUp className="w-10 h-10 text-green-600 mb-3" />
                <p className="text-3xl font-bold text-green-600">
                  {calculateAverage() >= 10 ? '+' : '-'}
                  {Math.abs(calculateAverage() - 10).toFixed(1)}
                </p>
                <p className="text-gray-600">Par rapport à 10/20</p>
              </div>
            </div>

            {/* Dernières notes et annonces */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText className="text-blue-600" />
                  Dernières notes
                </h3>
                <div className="space-y-3">
                  {grades.slice(0, 5).map((grade) => (
                    <div key={grade.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-semibold">{grade.subjects?.name}</p>
                        <p className="text-sm text-gray-500">{grade.grade_type}</p>
                      </div>
                      <span className={`text-2xl font-bold ${
                        grade.grade_value >= 15 ? 'text-green-600' : 
                        grade.grade_value >= 10 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {grade.grade_value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {grades.length === 0 && (
                    <p className="text-center text-gray-500 py-8">Aucune note disponible</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Bell className="text-orange-600" />
                  Dernières annonces
                </h3>
                <div className="space-y-3">
                  {announcements.slice(0, 4).map((announcement) => (
                    <div key={announcement.id} className="p-3 border-l-4 border-orange-500 bg-orange-50 rounded">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-sm">{announcement.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          announcement.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          announcement.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {announcement.priority}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{announcement.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(announcement.published_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setActiveTab('announcements')}
                  className="w-full mt-4 text-orange-600 font-semibold hover:bg-orange-50 py-2 rounded-lg"
                >
                  Voir toutes les annonces →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCHEDULE TAB - EMPLOI DU TEMPS */}
        {activeTab === 'schedule' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Mon Emploi du Temps</h2>
            
            {schedules.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl text-gray-500">Aucun emploi du temps disponible</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-100 to-indigo-100">
                      <th className="border-2 px-4 py-3 font-bold">Heure</th>
                      {dayNames.map((day, idx) => (
                        <th key={idx} className="border-2 px-4 py-3 font-bold">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlotsOf(schedules).map((timeSlot) => (                      <tr key={timeSlot}>
                        <td className="border-2 px-4 py-3 font-bold bg-gray-50">{timeSlot}</td>
                        {[1, 2, 3, 4, 5, 6].map((day) => {
                          const daySchedules = schedules.filter(s =>
                            s.day_of_week === day && timeSlotOf(s) === timeSlot
                          );
                          
                          return (
                            <td key={day} className="border-2 px-2 py-2">
                              {daySchedules.map(schedule => (
                                <div key={schedule.id} className="bg-blue-100 p-3 rounded-lg hover:bg-blue-200 transition">
                                  <p className="font-semibold text-blue-800">{schedule.subjects?.name}</p>
                                  <p className="text-xs text-blue-600">
                                    {schedule.teachers?.profiles?.first_name} {schedule.teachers?.profiles?.last_name}
                                  </p>
                                  <p className="text-xs text-gray-600">{schedule.room}</p>
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

            <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="font-semibold text-blue-800 mb-1">📌 Note importante</p>
              <p className="text-sm text-blue-700">
                Cet emploi du temps est valable pour le semestre en cours. Consultez régulièrement pour les mises à jour.
              </p>
            </div>
          </div>
        )}

        {/* ANNOUNCEMENTS TAB - ANNONCES */}
        {activeTab === 'announcements' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Annonces ({announcements.length})</h2>
            
            {loading ? (
              <p className="text-center py-8">Chargement...</p>
            ) : announcements.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl text-gray-500">Aucune annonce</p>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div 
                    key={announcement.id} 
                    className="p-5 border-2 rounded-lg hover:shadow-lg transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          announcement.priority === 'urgent' ? 'bg-red-600' :
                          announcement.priority === 'high' ? 'bg-orange-600' :
                          'bg-blue-600'
                        }`}>
                          <Bell className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{announcement.title}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(announcement.published_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        announcement.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        announcement.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        announcement.priority === 'normal' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {announcement.priority}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-2">{announcement.content}</p>
                    {announcement.expires_at && (
                      <p className="text-xs text-gray-500">
                        Expire le {new Date(announcement.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MES PAIEMENTS - FRAIS DE SCOLARITÉ */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Mes Paiements</h2>
            {studentData ? (
              <TuitionHistoryTable
                studentId={studentData.id}
                annualFee={studentData.annual_tuition_fee}
                academicYear="2026-2027"
                showStudentName={false}
              />
            ) : (
              <p className="text-center text-gray-500 py-12">Chargement...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
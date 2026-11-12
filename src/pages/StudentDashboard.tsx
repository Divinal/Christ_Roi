// src/pages/StudentDashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  Home, FileText, Calendar, GraduationCap,
  Bell, Award, ClipboardCheck, DollarSign, Hash, MessageSquare, Printer
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Announcement, PRIORITY_CLASSES, PRIORITY_LABELS, fetchActiveAnnouncements } from '../lib/announcements';
import { GradeRow, TERMS, formatGrade, gradeToneClass, termLabel, usesTerms, weightedAverage } from '../lib/grades';
import { CURRENT_ACADEMIC_YEAR, cycleLabel, SchoolCycle } from '../lib/levels';
import { useInbox } from '../lib/messages';
import { timeSlotOf, timeSlotsOf } from '../lib/schedule';
import { useHashTab } from '../lib/useHashTab';
import AppShell, { NavGroup } from '../components/ui/AppShell';
import { EmptyState, Panel, StatTile } from '../components/ui/primitives';
import AnnouncementList from '../components/announcements/AnnouncementList';
import MyFollowUp from '../components/followup/MyFollowUp';
import GradeReportPrint from '../components/grades/GradeReportPrint';
import StudentGradesTable from '../components/grades/StudentGradesTable';
import MessageInbox from '../components/messages/MessageInbox';
import TuitionHistoryTable from '../components/finance/TuitionHistoryTable';
import { t, locale } from '../i18n';

const NAV_GROUPS: NavGroup[] = [
  { label: t("Général"), items: [{ id: 'dashboard', label: t("Tableau de bord"), icon: Home }] },
  {
    label: t("Ma scolarité"),
    items: [
      { id: 'grades', label: t("Mes notes"), icon: FileText },
      { id: 'followup', label: t("Mon suivi"), icon: ClipboardCheck },
      { id: 'schedule', label: t("Emploi du temps"), icon: Calendar },
      { id: 'payments', label: t("Mes paiements"), icon: DollarSign },
    ],
  },
  {
    label: t("Communication"),
    items: [
      { id: 'messages', label: t("Messages"), icon: MessageSquare },
      { id: 'announcements', label: t("Annonces"), icon: Bell },
    ],
  },
];
const TABS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.id));

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

interface StudentDashboardProps {
  user: User | null;
  onLogout: () => void;
  onChangePassword: () => void;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, onLogout, onChangePassword }) => {
  const [activeTab, setActiveTab] = useHashTab(TABS, 'dashboard');
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [printing, setPrinting] = useState<boolean>(false);
  const [termFilter, setTermFilter] = useState<string>('');
  const { messages, unreadCount, loading: loadingMessages } = useInbox(user?.id, 'students', activeTab === 'messages');

  useEffect(() => {
    if (user) {
      loadStudentData();
    }
  }, [user]);

  const loadStudentData = async () => {
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
        setAnnouncements(await fetchActiveAnnouncements('students'));
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const loadGrades = async (studentId: string) => {
    const { data, error } = await supabase
      .from('grades')
      .select('*, subjects(name, code, coefficient), teachers(profiles(first_name, last_name))')
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

  const average = weightedAverage(grades);
  // Un relevé par trimestre : le filtre s'applique au tableau comme à l'impression.
  const showTerms = usesTerms(studentData?.levels?.cycle);
  const termGrades = termFilter ? grades.filter((grade) => String(grade.term) === termFilter) : grades;

  const dayNames = [t("Lundi"), t("Mardi"), t("Mercredi"), t("Jeudi"), t("Vendredi"), t("Samedi")];

  return (
    <AppShell
      spaceLabel={t("Espace étudiant")}
      userId={user?.id}
      groups={NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.map((item) => (item.id === 'messages' ? { ...item, badge: unreadCount } : item)),
      }))}
      activeId={activeTab}
      onSelect={setActiveTab}
      userName={`${user?.first_name || ''} ${user?.last_name || ''}`.trim()}
      roleLabel={studentData?.levels ? t("Étudiant • {0}", [studentData.levels.name]) : t("Étudiant")}
      onLogout={onLogout}
      onChangePassword={onChangePassword}
    >

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Carte de bienvenue */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    {t("Bienvenue,")} {user?.first_name} {user?.last_name} 👋
                  </h2>
                  <p className="text-blue-100">
                    {t("Matricule:")} {studentData?.student_number}
                    {studentData?.levels && ` • ${studentData.levels.name}`}
                  </p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur shrink-0">
                  <p className="text-sm text-blue-100">{t("Moyenne générale")}</p>
                  <p className="text-3xl font-bold">{average === null ? '-' : `${formatGrade(average)}/20`}</p>
                </div>
              </div>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              <StatTile
                icon={Award}
                tone="blue"
                label={t("Moyenne générale")}
                value={formatGrade(average)}
                valueClassName={gradeToneClass(average)}
              />
              <StatTile
                icon={GraduationCap}
                tone="indigo"
                label={studentData?.levels ? cycleLabel(studentData.levels.cycle) : t("Contactez l'administration")}
                value={studentData?.levels?.name || t("À inscrire")}
              />
              <StatTile icon={Hash} tone="green" label={t("Notes")} value={grades.length} />
              <StatTile icon={Bell} tone="orange" label={t("Annonces")} value={announcements.length} />
            </div>

            {/* Dernières notes et annonces */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText className="text-blue-600" />
                  {t("Dernières notes")}
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
                    <p className="text-center text-gray-500 py-8">{t("Aucune note disponible")}</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Bell className="text-orange-600" />
                  {t("Dernières annonces")}
                </h3>
                <div className="space-y-3">
                  {announcements.slice(0, 4).map((announcement) => (
                    <div key={announcement.id} className="p-3 border-s-4 border-orange-500 bg-orange-50 rounded">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-sm">{announcement.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_CLASSES[announcement.priority]}`}>
                          {PRIORITY_LABELS[announcement.priority]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{announcement.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(announcement.published_at).toLocaleDateString(locale())}
                      </p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setActiveTab('announcements')}
                  className="w-full mt-4 text-orange-600 font-semibold hover:bg-orange-50 py-2 rounded-lg"
                >
                  {t("Voir toutes les annonces →")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MES NOTES */}
        {activeTab === 'grades' && (
          <Panel
            title={t("Mes notes")}
            description={t("Moyenne générale : {0} / 20", [formatGrade(average)])}
            actions={
              <>
                {showTerms && grades.length > 0 && (
                  <select
                    value={termFilter}
                    onChange={(event) => setTermFilter(event.target.value)}
                    aria-label={t("Trimestre")}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="">{t("Toute l'année")}</option>
                    {TERMS.map((term) => (
                      <option key={term} value={term}>{termLabel(term)}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => setPrinting(true)}
                  disabled={termGrades.length === 0}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Printer className="h-4 w-4" /> {t("Imprimer mon relevé")}
                </button>
              </>
            }
          >
            {termGrades.length === 0 ? (
              <EmptyState icon={FileText} title={t("Aucune note disponible")} hint={t("Vos notes apparaîtront ici dès que vos enseignants les auront saisies.")} />
            ) : (
              <StudentGradesTable grades={termGrades} />
            )}
          </Panel>
        )}
        {printing && studentData && (
          <GradeReportPrint
            studentName={`${user?.first_name || ''} ${user?.last_name || ''}`.trim()}
            studentNumber={studentData.student_number}
            levelName={studentData.levels?.name}
            grades={termGrades}
            termText={termFilter ? termLabel(Number(termFilter)) : undefined}
            onClose={() => setPrinting(false)}
          />
        )}
        {/* SCHEDULE TAB - EMPLOI DU TEMPS */}
        {activeTab === 'schedule' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-2xl font-bold mb-6">{t("Mon Emploi du Temps")}</h2>
            
            {schedules.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-xl text-gray-500">{t("Aucun emploi du temps disponible")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border-2 px-4 py-3 font-bold">{t("Heure")}</th>
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

            <div className="mt-6 bg-blue-50 border-s-4 border-blue-500 p-4 rounded">
              <p className="font-semibold text-blue-800 mb-1">{t("📌 Note importante")}</p>
              <p className="text-sm text-blue-700">
                {t("Cet emploi du temps est valable pour le semestre en cours. Consultez régulièrement pour les mises à jour.")}
              </p>
            </div>
          </div>
        )}

        {/* MON SUIVI */}
        {activeTab === 'followup' && studentData && (
          <MyFollowUp
            studentId={studentData.id}
            studentName={`${user?.first_name || ''} ${user?.last_name || ''}`.trim()}
          />
        )}

        {/* MESSAGES */}
        {activeTab === 'messages' && <MessageInbox messages={messages} loading={loadingMessages} />}

        {/* ANNONCES */}
        {activeTab === 'announcements' && (
          <Panel title={t("Annonces ({0})", [announcements.length])}>
            <AnnouncementList announcements={announcements} />
          </Panel>
        )}

        {/* MES PAIEMENTS - FRAIS DE SCOLARITÉ */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-2xl font-bold mb-6">{t("Mes Paiements")}</h2>
            {studentData ? (
              <TuitionHistoryTable
                studentId={studentData.id}
                annualFee={studentData.annual_tuition_fee}
                academicYear={CURRENT_ACADEMIC_YEAR}
                showStudentName={false}
              />
            ) : (
              <p className="text-center text-gray-500 py-12">{t("Chargement...")}</p>
            )}
          </div>
        )}
    </AppShell>
  );
};

export default StudentDashboard;
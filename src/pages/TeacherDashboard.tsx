// src/pages/TeacherDashboard.tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  Bell, BookOpen, Calendar, CheckCircle2, ClipboardCheck, ClipboardList, DollarSign, FileText, Home,
  MessageSquare, Save
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Announcement, fetchActiveAnnouncements } from '../lib/announcements';
import { CURRENT_ACADEMIC_YEAR, Level, SchoolCycle } from '../lib/levels';
import {
  SINGLE_PER_TERM,
  TERMS,
  TERMS_MIGRATION_MESSAGE,
  Term,
  currentTerm,
  gradeTypesFor,
  isTermsMigrationMissing,
  termLabel,
  usesTerms,
} from '../lib/grades';
import { useInbox } from '../lib/messages';
import { timeSlotOf, timeSlotsOf } from '../lib/schedule';
import { useHashTab } from '../lib/useHashTab';
import AppShell, { NavGroup } from '../components/ui/AppShell';
import { confirmDialog, notify } from '../components/ui/feedback';
import { Panel, StatTile } from '../components/ui/primitives';
import AnnouncementList from '../components/announcements/AnnouncementList';
import StudentFollowUp from '../components/followup/StudentFollowUp';
import GradesManagement from '../components/grades/GradesManagement';
import MessageInbox from '../components/messages/MessageInbox';
import PayslipHistoryTable from '../components/finance/PayslipHistoryTable';
import { t } from '../i18n';

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
  onChangePassword: () => void;
}

interface TeacherLevel {
  id: string;
  name: string;
  cycle: SchoolCycle;
  position: number;
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
  saved?: boolean;
  // Composition ou devoir départemental déjà saisi pour ce trimestre.
  existing?: boolean;
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

const TABS = ['dashboard', 'grades', 'my-grades', 'followup', 'schedule', 'announcements', 'messages', 'payslips'];

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout, onChangePassword }) => {
  const [activeTab, setActiveTab] = useHashTab(TABS, 'dashboard');
  const [teacherId, setTeacherId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // États pour les données
  const [myLevels, setMyLevels] = useState<TeacherLevel[]>([]);
  const [mySchedule, setMySchedule] = useState<Schedule[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // États pour la saisie de notes
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [gradeType, setGradeType] = useState<string>('');
  const [term, setTerm] = useState<Term>(currentTerm());
  const [coefficient, setCoefficient] = useState<number>(1);
  const [examDate, setExamDate] = useState<string>('');
  const [studentsGrades, setStudentsGrades] = useState<StudentGrade[]>([]);

  // Le cycle du niveau choisi décide des évaluations proposées : un enseignant
  // du collège ne voit que devoirs et compositions, jamais les CC du supérieur.
  const selectedCycle = myLevels.find((level) => level.id === selectedLevel)?.cycle;
  const typeOptions = selectedLevel ? gradeTypesFor(selectedCycle) : [];
  const selectedTerm: Term | null = usesTerms(selectedCycle) ? term : null;


  useEffect(() => {
    if (user) {
      loadTeacherData();
    }
  }, [user]);

  const { messages: myMessages, unreadCount, loading: loadingMessages } = useInbox(user?.id, 'teachers', activeTab === 'messages');

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
        notify(t("Profil enseignant non trouvé"));
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
          levels (id, name, cycle, position),
          subjects (id, name, code, coefficient)
        `)
        .eq('teacher_id', teacherData.id);

      if (levelsData) {
        const formattedLevels = levelsData.map((item: any) => ({
          id: item.level_id,
          name: item.levels.name,
          cycle: item.levels.cycle,
          position: item.levels.position,
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

      // 4. Charger les annonces
      setAnnouncements(await fetchActiveAnnouncements('teachers'));
    } catch (error) {
      console.error('Error loading teacher data:', error);
    } finally {
      setLoading(false);
    }
  };


  // ==================== CHARGEMENT ÉTUDIANTS POUR SAISIE NOTES ====================
  const loadStudentsForGrading = async () => {
    if (!selectedLevel || !selectedSubject) {
      notify(t("Veuillez sélectionner un niveau et une matière"));
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
        // Une composition (ou un devoir départemental) par trimestre : celles déjà saisies sont verrouillées.
        const existing = new Map<string, number>();
        if (selectedTerm !== null && SINGLE_PER_TERM.includes(gradeType) && studentsData.length) {
          const { data: existingRows, error: existingError } = await supabase
            .from('grades')
            .select('student_id, grade_value')
            .eq('subject_id', selectedSubject)
            .eq('grade_type', gradeType)
            .eq('term', selectedTerm)
            .eq('academic_year', CURRENT_ACADEMIC_YEAR)
            .in('student_id', studentsData.map((item: any) => item.id));
          if (isTermsMigrationMissing(existingError)) {
            notify(`❌ ${t(TERMS_MIGRATION_MESSAGE)}`);
            return;
          }
          (existingRows || []).forEach((row: any) => existing.set(row.student_id, Number(row.grade_value)));
        }

        const formattedStudents = studentsData.map((item: any) => ({
          student_id: item.id,
          student_number: item.student_number,
          first_name: item.profiles?.first_name || '',
          last_name: item.profiles?.last_name || '',
          grade_value: existing.get(item.id),
          comment: '',
          saved: existing.has(item.id),
          existing: existing.has(item.id),
        }));
        setStudentsGrades(
          formattedStudents.sort((a, b) =>
            `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'fr'),
          ),
        );
      }
    } catch (error) {
      console.error('Error loading students:', error);
      notify(t("Erreur lors du chargement des étudiants"));
    } finally {
      setLoading(false);
    }
  };

  // ==================== SAISIE DES NOTES ====================
  const updateGrade = (studentId: string, field: 'grade_value' | 'comment', value: string) => {
    const parsed = field === 'grade_value' ? (value === '' ? undefined : parseFloat(value)) : value;
    setStudentsGrades(prev =>
      prev.map(s =>
        s.student_id === studentId ? { ...s, [field]: parsed, saved: false } : s
      )
    );
  };

  const isValidGrade = (value?: number): value is number =>
    value !== undefined && !Number.isNaN(value) && value >= 0 && value <= 20;

  const gradeRowFor = (student: StudentGrade) => ({
    student_id: student.student_id,
    subject_id: selectedSubject,
    teacher_id: teacherId,
    level_id: selectedLevel,
    grade_value: student.grade_value,
    grade_type: gradeType,
    term: selectedTerm,
    academic_year: CURRENT_ACADEMIC_YEAR,
    coefficient: coefficient,
    exam_date: examDate || null,
    comment: student.comment || null
  });

  const gradeErrorMessage = (error: { code?: string; message: string }): string => {
    if (isTermsMigrationMissing(error)) return `❌ ${t(TERMS_MIGRATION_MESSAGE)}`;
    if (error.code === '23505') return t("❌ Cette note existe déjà pour ce trimestre : modifiez-la dans « Notes saisies ».");
    return `❌ Erreur: ${t(error.message)}`;
  };

  const saveGrade = async (studentId: string) => {
    const student = studentsGrades.find(s => s.student_id === studentId);
    if (!student || !isValidGrade(student.grade_value)) {
      notify(t("⚠️ Saisissez une note comprise entre 0 et 20."));
      return;
    }

    const { error } = await supabase.from('grades').insert(gradeRowFor(student));
    if (error) {
      notify(gradeErrorMessage(error));
      return;
    }
    // Marquée enregistrée : "Enregistrer toutes" ne doit pas la créer une seconde fois.
    setStudentsGrades(prev => prev.map(s => (s.student_id === studentId ? { ...s, saved: true } : s)));
    notify(t("✅ Note enregistrée"));
  };

  const saveAllGrades = async () => {
    const gradesToSave = studentsGrades.filter(s => s.grade_value !== undefined && !s.saved);

    if (gradesToSave.length === 0) {
      notify(t("Aucune nouvelle note à enregistrer"));
      return;
    }
    if (!gradesToSave.every(s => isValidGrade(s.grade_value))) {
      notify(t("⚠️ Toutes les notes doivent être comprises entre 0 et 20."));
      return;
    }

    if (!(await confirmDialog(t("Enregistrer {0} note(s) ?", [gradesToSave.length]), { confirmLabel: t("Enregistrer") }))) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('grades').insert(gradesToSave.map(gradeRowFor));
      if (error) throw error;

      notify(t("✅ {0} note(s) enregistrée(s)", [gradesToSave.length]));
      setStudentsGrades([]);
      setSelectedLevel('');
      setSelectedSubject('');
    } catch (error: any) {
      notify(gradeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };


  const navGroups: NavGroup[] = [
    { label: t("Général"), items: [{ id: 'dashboard', label: t("Tableau de bord"), icon: Home }] },
    {
      label: t("Enseignement"),
      items: [
        { id: 'grades', label: t("Saisie des notes"), icon: ClipboardList },
        { id: 'my-grades', label: t("Notes saisies"), icon: FileText },
        { id: 'followup', label: t("Suivi des étudiants"), icon: ClipboardCheck },
        { id: 'schedule', label: t("Emploi du temps"), icon: Calendar },
      ],
    },
    {
      label: t("Communication"),
      items: [
        { id: 'announcements', label: t("Annonces"), icon: Bell },
        { id: 'messages', label: t("Messages"), icon: MessageSquare, badge: unreadCount },
      ],
    },
    { label: t("Mon compte"), items: [{ id: 'payslips', label: t("Bulletins de paie"), icon: DollarSign }] },
  ];

  // Niveaux affectés, sans doublon si plusieurs matières sur un même niveau.
  const assignedLevels = useMemo<Level[]>(() => {
    const unique = new Map<string, Level>();
    myLevels.forEach(({ id, name, cycle, position }) => unique.set(id, { id, name, cycle, position }));
    return Array.from(unique.values());
  }, [myLevels]);

  const getDayName = (day: number) => {
    const days = ['', t("Lundi"), t("Mardi"), t("Mercredi"), t("Jeudi"), t("Vendredi"), t("Samedi"), t("Dimanche")];
    return days[day] || '';
  };

  // ==================== RENDUS ====================
  return (
    <AppShell
      spaceLabel={t("Espace enseignant")}
      userId={user?.id}
      groups={navGroups}
      activeId={activeTab}
      onSelect={setActiveTab}
      userName={`${user?.first_name || ''} ${user?.last_name || ''}`.trim()}
      roleLabel={t("Enseignant")}
      onLogout={onLogout}
      onChangePassword={onChangePassword}
    >

        {/* TABLEAU DE BORD */}
        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              <StatTile icon={BookOpen} tone="blue" label={t("Niveaux assignés")} value={assignedLevels.length} />
              <StatTile icon={FileText} tone="green" label={t("Matières enseignées")} value={new Set(myLevels.map(l => l.subject_id)).size} />
              <StatTile icon={Calendar} tone="indigo" label={t("Créneaux par semaine")} value={mySchedule.length} />
              <StatTile icon={MessageSquare} tone="orange" label={t("Messages non lus")} value={unreadCount} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> {t("Mes Niveaux")}
                </h3>
                {myLevels.length === 0 ? (
                  <p className="text-gray-500 text-center">{t("Aucun niveau assigné")}</p>
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

              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" /> {t("Prochains créneaux")}
                </h3>
                {mySchedule.length === 0 ? (
                  <p className="text-gray-500 text-center">{t("Aucun créneau planifié")}</p>
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
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-2xl font-bold mb-6">{t("Saisie des notes")}</h2>

            {/* SAISIE */}
            <div className="mb-8">
              <h3 className="text-lg font-bold mb-4 text-indigo-700">{t("➕ Saisir de nouvelles notes")}</h3>
              
              <div className="grid md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label htmlFor="grade-level" className="block text-sm font-medium mb-2">{t("Niveau *")}</label>
                  <select
                    id="grade-level"
                    value={selectedLevel}
                    onChange={(e) => {
                      const levelId = e.target.value;
                      setSelectedLevel(levelId);
                      setSelectedSubject('');
                      setStudentsGrades([]);
                      const cycle = myLevels.find((level) => level.id === levelId)?.cycle;
                      setGradeType(levelId ? gradeTypesFor(cycle)[0].value : '');
                    }}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">{t("Sélectionner...")}</option>
                    {Array.from(new Map(myLevels.map((level) => [level.id, level.name]))).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t("Matière *")}</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      const subjectId = e.target.value;
                      setSelectedSubject(subjectId);
                      setStudentsGrades([]);
                      const level = myLevels.find(l => l.id === selectedLevel && l.subject_id === subjectId);
                      setCoefficient(level?.subject_coefficient || 1);
                    }}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">{t("Sélectionner...")}</option>
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
                  <label htmlFor="grade-type" className="block text-sm font-medium mb-2">{t("Type d'évaluation *")}</label>
                  <select
                    id="grade-type"
                    value={gradeType}
                    onChange={(e) => {
                      setGradeType(e.target.value);
                      setStudentsGrades([]);
                    }}
                    disabled={!selectedLevel}
                    className="w-full border rounded px-3 py-2 disabled:opacity-50"
                  >
                    {!selectedLevel && <option value="">{t("Choisissez d'abord un niveau")}</option>}
                    {typeOptions.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {selectedTerm !== null && (
                  <div>
                    <label htmlFor="grade-term" className="block text-sm font-medium mb-2">{t("Trimestre *")}</label>
                    <select
                      id="grade-term"
                      value={term}
                      onChange={(e) => {
                        setTerm(Number(e.target.value) as Term);
                        setStudentsGrades([]);
                      }}
                      className="w-full border rounded px-3 py-2"
                    >
                      {TERMS.map((value) => (
                        <option key={value} value={value}>{termLabel(value)}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedLevel && (
                  <p className="md:col-span-4 text-sm text-gray-600" data-testid="grade-type-hint">
                    {gradeType === 'Devoir'
                      ? t("Nombre de devoirs libre : leur moyenne forme la « moyenne de classe » du bulletin.")
                      : SINGLE_PER_TERM.includes(gradeType)
                        ? t("Une seule note de ce type par élève, par matière et par trimestre.")
                        : t("Évaluations du supérieur : contrôles continus et examens.")}
                  </p>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">{t("Coefficient (UF) *")}</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={coefficient}
                    disabled
                    title={t("Le coefficient est défini au niveau de l'Unité de Formation (onglet Matières)")}
                    className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t("Date de l'examen")}</label>
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
                    disabled={!selectedLevel || !selectedSubject || !gradeType}
                    className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("Charger les étudiants")}
                  </button>
                </div>
              </div>

              {studentsGrades.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-start">{t("Matricule")}</th>
                          <th className="px-4 py-3 text-start">{t("Nom complet")}</th>
                          <th className="px-4 py-3 text-start">{t("Note /20")}</th>
                          <th className="px-4 py-3 text-start">{t("Commentaire")}</th>
                          <th className="px-4 py-3 text-start">{t("Action")}</th>
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
                                value={student.grade_value ?? ''}
                                onChange={(e) => updateGrade(student.student_id, 'grade_value', e.target.value)}
                                disabled={student.saved}
                                className="w-24 border rounded px-2 py-1 disabled:opacity-60"
                                placeholder="0-20"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={student.comment || ''}
                                onChange={(e) => updateGrade(student.student_id, 'comment', e.target.value)}
                                disabled={student.saved}
                                className="w-full border rounded px-2 py-1 disabled:opacity-60"
                                placeholder={student.existing ? '' : t("Optionnel")}
                              />
                            </td>
                            <td className="px-4 py-3">
                              {student.saved ? (
                                <span
                                  className="text-green-600 flex items-center gap-1"
                                  title={student.existing ? t("Pour la corriger, passez par « Notes saisies ».") : undefined}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  {student.existing ? t("Déjà saisie") : t("Enregistrée")}
                                </span>
                              ) : (
                                <button
                                  onClick={() => saveGrade(student.student_id)}
                                  disabled={student.grade_value === undefined}
                                  className="text-indigo-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                                >
                                  <Save className="w-4 h-4" />
                                  {t("Enregistrer")}
                                </button>
                              )}
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
                      {t("Annuler")}
                    </button>
                    <button
                      onClick={saveAllGrades}
                      disabled={loading}
                      className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {loading ? t("Enregistrement...") : t("Enregistrer toutes les notes")}
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        )}

        {/* NOTES SAISIES */}
        {activeTab === 'my-grades' && teacherId && (
          <GradesManagement levels={assignedLevels} canEdit canPrint={false} teacherId={teacherId} />
        )}

        {/* SUIVI DES ÉTUDIANTS */}
        {activeTab === 'followup' && (
          <StudentFollowUp levels={assignedLevels} currentUserId={user?.id} teacherMode canDeleteAny={false} />
        )}

        {/* ANNONCES */}
        {activeTab === 'announcements' && (
          <Panel title={t("Annonces")}>
            <AnnouncementList announcements={announcements} />
          </Panel>
        )}
        {/* EMPLOI DU TEMPS */}
        {activeTab === 'schedule' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-2xl font-bold mb-6">{t("Mon Emploi du Temps")}</h2>
            
            {mySchedule.length === 0 ? (
              <p className="text-center text-gray-500 py-12">{t("Aucun créneau planifié")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border-2 px-4 py-3 font-bold">{t("Heure")}</th>
                      {[t("Lundi"), t("Mardi"), t("Mercredi"), t("Jeudi"), t("Vendredi"), t("Samedi")].map((day, idx) => (
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
                                <div key={schedule.id} className="bg-indigo-100 p-3 rounded-lg hover:bg-indigo-200 transition mb-1">
                                  <p className="font-semibold text-indigo-800">{schedule.subject_name}</p>
                                  <p className="text-xs text-indigo-600">{schedule.level_name}</p>
                                  {schedule.room && <p className="text-xs text-gray-600">{t("Salle")} {schedule.room}</p>}
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

            <div className="mt-6 bg-indigo-50 border-s-4 border-indigo-500 p-4 rounded">
              <p className="font-semibold text-indigo-800 mb-1">{t("📌 Note")}</p>
              <p className="text-sm text-indigo-700">
                {t("Votre emploi du temps pour le semestre en cours. Contactez l'administration pour toute modification.")}
              </p>
            </div>
          </div>
        )}

        {/* MESSAGES */}
        {activeTab === 'messages' && (
          <MessageInbox messages={myMessages} loading={loadingMessages} />
        )}

        {/* BULLETINS DE PAIE */}
        {activeTab === 'payslips' && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-2xl font-bold mb-6">{t("Mes Bulletins de Paie")}</h2>
            {teacherId ? (
              <PayslipHistoryTable teacherId={teacherId} academicYear={CURRENT_ACADEMIC_YEAR} showTeacherName={false} />
            ) : (
              <p className="text-center text-gray-500 py-12">{t("Chargement...")}</p>
            )}
          </div>
        )}
    </AppShell>
  );
};

export default TeacherDashboard;
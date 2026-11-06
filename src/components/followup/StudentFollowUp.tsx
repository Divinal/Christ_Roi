import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarCheck, CalendarX, CheckCheck, ClipboardCheck, Clock3, Printer, Save, Trash2, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { Level } from '../../lib/levels';
import {
  ATTENDANCE_CLASSES,
  ATTENDANCE_LABELS,
  CONDUCT_CLASSES,
  CONDUCT_LABELS,
  DailyReport,
  FollowUpNotActivatedError,
  daysAgoLocal,
  fetchReports,
  todayLocal,
} from '../../lib/followup';
import { formatDate } from '../../lib/grades';
import { StudentOption, fetchStudentOptions, matchesStudent, studentFullName } from '../../lib/students';
import LevelSelect from '../levels/LevelSelect';
import { confirmDialog, notify } from '../ui/feedback';
import { EmptyState, Panel, StatTile } from '../ui/primitives';
import FollowUpPrint from './FollowUpPrint';

interface StudentFollowUpProps {
  levels: Level[];
  currentUserId?: string;
  // Enseignant : seulement ses niveaux affectés (voir aussi les policies RLS).
  teacherMode?: boolean;
  canDeleteAny: boolean;
}

interface Draft {
  attendance: string;
  conduct: string;
  activities: string;
  observations: string;
  reportId?: string;
  dirty: boolean;
}

const EMPTY_DRAFT: Draft = { attendance: '', conduct: '', activities: '', observations: '', dirty: false };

const isBlank = (draft: Draft): boolean =>
  !draft.attendance && !draft.conduct && !draft.activities.trim() && !draft.observations.trim();

const Badge: React.FC<{ value: string | null; labels: Record<string, string>; classes: Record<string, string> }> = ({
  value,
  labels,
  classes,
}) =>
  value ? (
    <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${classes[value]}`}>{labels[value]}</span>
  ) : (
    <span className="text-gray-500">-</span>
  );

const StudentFollowUp: React.FC<StudentFollowUpProps> = ({ levels, currentUserId, teacherMode, canDeleteAny }) => {
  const [view, setView] = useState<'day' | 'history'>('day');
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [notActivated, setNotActivated] = useState(false);

  // Rapport du jour
  const [date, setDate] = useState(todayLocal());
  const [levelId, setLevelId] = useState('');
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [dayReports, setDayReports] = useState<DailyReport[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printingDay, setPrintingDay] = useState(false);
  const dayRequest = useRef(0);

  // Historique
  const [historyLevelId, setHistoryLevelId] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyStudentId, setHistoryStudentId] = useState('');
  const [from, setFrom] = useState(daysAgoLocal(30));
  const [to, setTo] = useState(todayLocal());
  const [history, setHistory] = useState<DailyReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [printingHistory, setPrintingHistory] = useState(false);
  const historyRequest = useRef(0);

  useEffect(() => {
    fetchStudentOptions()
      .then(setStudents)
      .catch((error) => notify(`❌ Erreur: ${error.message}`));
  }, []);

  const allowedStudents = useMemo(
    () => (teacherMode ? students.filter((s) => levels.some((l) => l.id === s.level_id)) : students),
    [students, levels, teacherMode],
  );
  const levelStudents = useMemo(
    () => allowedStudents.filter((student) => student.level_id === levelId),
    [allowedStudents, levelId],
  );
  const selectedLevel = levels.find((level) => level.id === levelId);

  const handleLoadError = (error: unknown) => {
    if (error instanceof FollowUpNotActivatedError) setNotActivated(true);
    else notify(`❌ Erreur: ${(error as Error).message}`);
  };

  const loadDay = useCallback(async () => {
    const request = ++dayRequest.current;
    if (!levelId || levelStudents.length === 0) {
      setDrafts(new Map());
      setDayReports([]);
      setLoadingDay(false);
      return;
    }

    setLoadingDay(true);
    try {
      const reports = await fetchReports(levelStudents.map((s) => s.id), date, date);
      if (request !== dayRequest.current) return;

      const next = new Map<string, Draft>();
      levelStudents.forEach((student) => {
        const mine = reports.find((r) => r.student_id === student.id && r.author_id === currentUserId);
        next.set(
          student.id,
          mine
            ? {
                attendance: mine.attendance || '',
                conduct: mine.conduct || '',
                activities: mine.activities || '',
                observations: mine.observations || '',
                reportId: mine.id,
                dirty: false,
              }
            : { ...EMPTY_DRAFT },
        );
      });
      setDrafts(next);
      setDayReports(reports);
    } catch (error) {
      if (request === dayRequest.current) handleLoadError(error);
    } finally {
      if (request === dayRequest.current) setLoadingDay(false);
    }
  }, [levelId, levelStudents, date, currentUserId]);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  const dirtyCount = Array.from(drafts.values()).filter((draft) => draft.dirty).length;

  // Changer de niveau ou de date rechargerait le tableau et effacerait la saisie.
  const confirmDiscard = async (): Promise<boolean> =>
    dirtyCount === 0 ||
    confirmDialog(`⚠️ ${dirtyCount} ligne(s) ne sont pas enregistrées. Les abandonner ?`, {
      title: 'Saisie non enregistrée',
      confirmLabel: 'Abandonner',
    });

  const updateDraft = (studentId: string, patch: Partial<Draft>) => {
    setDrafts((previous) => {
      const next = new Map(previous);
      next.set(studentId, { ...(previous.get(studentId) || EMPTY_DRAFT), ...patch, dirty: true });
      return next;
    });
  };

  const markAllPresent = () => {
    setDrafts((previous) => {
      const next = new Map(previous);
      next.forEach((draft, id) => {
        if (!draft.attendance) next.set(id, { ...draft, attendance: 'present', dirty: true });
      });
      return next;
    });
  };

  const saveDay = async () => {
    const dirty = Array.from(drafts.entries()).filter(([, draft]) => draft.dirty);
    if (dirty.length === 0) {
      notify('Aucune modification à enregistrer');
      return;
    }

    const toUpsert = dirty
      .filter(([, draft]) => !isBlank(draft))
      .map(([studentId, draft]) => ({
        student_id: studentId,
        level_id: levelId,
        report_date: date,
        attendance: draft.attendance || null,
        conduct: draft.conduct || null,
        activities: draft.activities.trim() || null,
        observations: draft.observations.trim() || null,
        author_id: currentUserId,
      }));
    // Une ligne déjà enregistrée puis entièrement vidée : le rapport est retiré.
    const toDelete = dirty
      .filter(([, draft]) => isBlank(draft) && draft.reportId)
      .map(([, draft]) => draft.reportId as string);

    setSaving(true);
    try {
      if (toUpsert.length > 0) {
        const { error } = await supabase
          .from('student_daily_reports')
          .upsert(toUpsert, { onConflict: 'student_id,report_date,author_id' });
        if (error) throw error;
      }
      if (toDelete.length > 0) {
        const { error } = await supabase.from('student_daily_reports').delete().in('id', toDelete);
        if (error) throw error;
      }
      notify(`✅ Rapport du ${formatDate(date)} enregistré`);
      await loadDay();
    } catch (error: any) {
      if (error?.code === 'PGRST205') setNotActivated(true);
      else notify(`❌ Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteReport = async (report: DailyReport) => {
    const name = `${report.students?.profiles?.first_name || ''} ${report.students?.profiles?.last_name || ''}`.trim();
    const confirmed = await confirmDialog(
      `⚠️ Supprimer le rapport du ${formatDate(report.report_date)} pour ${name} ?`,
      { title: 'Supprimer le rapport', confirmLabel: 'Supprimer' },
    );
    if (!confirmed) return;

    const { data, error } = await supabase.from('student_daily_reports').delete().eq('id', report.id).select('id');
    if (error) {
      notify(`❌ Erreur: ${error.message}`);
    } else if (!data?.length) {
      notify("❌ Suppression refusée : vous n'avez pas les droits nécessaires.");
    } else {
      notify('✅ Rapport supprimé');
      loadDay();
      loadHistory();
    }
  };

  const historyOptions = useMemo(
    () =>
      allowedStudents
        .filter((student) => !historyLevelId || student.level_id === historyLevelId)
        .filter((student) => !historySearch.trim() || matchesStudent(student, historySearch)),
    [allowedStudents, historyLevelId, historySearch],
  );
  const historyStudent = allowedStudents.find((student) => student.id === historyStudentId);
  const historyLevel = levels.find((level) => level.id === historyLevelId);

  const historyTargets = useMemo(() => {
    if (historyStudentId) return [historyStudentId];
    if (historyLevelId) return allowedStudents.filter((s) => s.level_id === historyLevelId).map((s) => s.id);
    return [];
  }, [historyStudentId, historyLevelId, allowedStudents]);

  const loadHistory = useCallback(async () => {
    const request = ++historyRequest.current;
    if (historyTargets.length === 0 || from > to) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    try {
      const reports = await fetchReports(historyTargets, from, to);
      if (request === historyRequest.current) setHistory(reports);
    } catch (error) {
      if (request === historyRequest.current) handleLoadError(error);
    } finally {
      if (request === historyRequest.current) setLoadingHistory(false);
    }
  }, [historyTargets, from, to]);

  useEffect(() => {
    if (view === 'history') loadHistory();
  }, [view, loadHistory]);

  const historySubject = historyStudent ? studentFullName(historyStudent) : historyLevel?.name || '';
  const canDelete = (report: DailyReport): boolean => canDeleteAny || report.author_id === currentUserId;

  if (notActivated) {
    return (
      <Panel>
        <EmptyState
          icon={ClipboardCheck}
          title="Le suivi n'est pas encore activé sur le serveur"
          hint="La table des rapports journaliers doit d'abord être créée dans Supabase : contactez l'administrateur du site."
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex gap-2 overflow-x-auto border-b">
        {([['day', 'Rapport du jour'], ['history', 'Historique']] as ['day' | 'history', string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            aria-current={view === id ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-4 py-2 font-medium transition ${
              view === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'day' && (
        <>
          <Panel>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="followup-date" className="mb-2 block text-sm font-medium">Date</label>
                <input
                  id="followup-date"
                  type="date"
                  value={date}
                  max={todayLocal()}
                  onChange={async (event) => {
                    const value = event.target.value;
                    if (value && (await confirmDiscard())) setDate(value);
                  }}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="followup-level" className="mb-2 block text-sm font-medium">Niveau</label>
                <LevelSelect
                  id="followup-level"
                  levels={levels}
                  value={levelId}
                  onChange={async (id) => {
                    if (await confirmDiscard()) setLevelId(id);
                  }}
                  placeholder="Choisir un niveau..."
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
          </Panel>

          {!levelId ? (
            <Panel>
              <EmptyState
                icon={ClipboardCheck}
                title="Choisissez un niveau pour saisir le rapport du jour"
                hint="Présence, conduite, activités et observations de chaque étudiant."
              />
            </Panel>
          ) : levelStudents.length === 0 ? (
            <Panel>
              <EmptyState icon={Users} title="Aucun étudiant inscrit dans ce niveau" />
            </Panel>
          ) : (
            <Panel
              title={`${selectedLevel?.name} — ${formatDate(date)}`}
              description="Seules les lignes remplies sont enregistrées. L'étudiant voit ces rapports dans son espace et en est prévenu."
              actions={
                <>
                  <button
                    onClick={markAllPresent}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <CheckCheck className="h-4 w-4" /> Tous présents
                  </button>
                  <button
                    onClick={() => setPrintingDay(true)}
                    disabled={dayReports.length === 0}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Printer className="h-4 w-4" /> Imprimer
                  </button>
                  <button
                    onClick={saveDay}
                    disabled={saving || dirtyCount === 0}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Enregistrement...' : dirtyCount > 0 ? `Enregistrer (${dirtyCount})` : 'Enregistrer'}
                  </button>
                </>
              }
            >
              {loadingDay && drafts.size === 0 ? (
                <p className="py-8 text-center text-gray-500">Chargement...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-600">
                      <tr>
                        <th className="px-3 py-2">Étudiant</th>
                        <th className="px-3 py-2">Présence</th>
                        <th className="px-3 py-2">Conduite</th>
                        <th className="px-3 py-2">Activités du jour</th>
                        <th className="px-3 py-2">Observations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelStudents.map((student) => {
                        const draft = drafts.get(student.id) || EMPTY_DRAFT;
                        const name = studentFullName(student);
                        return (
                          <tr key={student.id} className="border-t align-top">
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-900">
                                {student.profiles?.last_name} {student.profiles?.first_name}
                              </p>
                              <p className="text-xs text-gray-500">{student.student_number}</p>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                aria-label={`Présence de ${name}`}
                                value={draft.attendance}
                                onChange={(event) => updateDraft(student.id, { attendance: event.target.value })}
                                className="w-36 rounded border px-2 py-1.5"
                              >
                                <option value="">-</option>
                                {Object.entries(ATTENDANCE_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                aria-label={`Conduite de ${name}`}
                                value={draft.conduct}
                                onChange={(event) => updateDraft(student.id, { conduct: event.target.value })}
                                className="w-32 rounded border px-2 py-1.5"
                              >
                                <option value="">-</option>
                                {Object.entries(CONDUCT_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <textarea
                                aria-label={`Activités de ${name}`}
                                rows={2}
                                value={draft.activities}
                                onChange={(event) => updateDraft(student.id, { activities: event.target.value })}
                                className="w-full min-w-[180px] rounded border px-2 py-1.5"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <textarea
                                aria-label={`Observations sur ${name}`}
                                rows={2}
                                value={draft.observations}
                                onChange={(event) => updateDraft(student.id, { observations: event.target.value })}
                                className="w-full min-w-[180px] rounded border px-2 py-1.5"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {dayReports.some((report) => report.author_id !== currentUserId) && (
            <Panel title="Rapports des autres auteurs ce jour-là">
              <ReportsTable reports={dayReports.filter((r) => r.author_id !== currentUserId)} canDelete={canDelete} onDelete={deleteReport} />
            </Panel>
          )}
        </>
      )}

      {view === 'history' && (
        <>
          <Panel>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label htmlFor="history-level" className="mb-2 block text-sm font-medium">Niveau</label>
                <LevelSelect
                  id="history-level"
                  levels={levels}
                  value={historyLevelId}
                  onChange={(id) => {
                    setHistoryLevelId(id);
                    setHistoryStudentId('');
                  }}
                  placeholder="Tous les niveaux"
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="history-search" className="mb-2 block text-sm font-medium">Rechercher</label>
                <input
                  id="history-search"
                  type="text"
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Nom, matricule..."
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="history-student" className="mb-2 block text-sm font-medium">Étudiant ({historyOptions.length})</label>
                <select
                  id="history-student"
                  value={historyStudentId}
                  onChange={(event) => setHistoryStudentId(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">{historyLevelId ? 'Tout le niveau' : 'Choisir...'}</option>
                  {historyOptions.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.profiles?.last_name} {student.profiles?.first_name} — {student.student_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="history-from" className="mb-2 block text-sm font-medium">Du</label>
                <input
                  id="history-from"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(event) => event.target.value && setFrom(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="history-to" className="mb-2 block text-sm font-medium">Au</label>
                <input
                  id="history-to"
                  type="date"
                  value={to}
                  min={from}
                  max={todayLocal()}
                  onChange={(event) => event.target.value && setTo(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
          </Panel>

          {historyTargets.length === 0 ? (
            <Panel>
              <EmptyState icon={ClipboardCheck} title="Choisissez un niveau ou un étudiant pour voir son historique" />
            </Panel>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
                <StatTile icon={CalendarCheck} tone="blue" label="Jours renseignés" value={new Set(history.map((r) => r.report_date)).size} />
                <StatTile icon={CalendarX} tone="red" label="Absences" value={history.filter((r) => r.attendance === 'absent').length} />
                <StatTile icon={Clock3} tone="orange" label="Retards" value={history.filter((r) => r.attendance === 'late').length} />
                <StatTile icon={AlertTriangle} tone="red" label="Conduite à surveiller" value={history.filter((r) => r.conduct === 'concern').length} />
              </div>
              <Panel
                title={`Rapports — ${historySubject}`}
                description={`Du ${formatDate(from)} au ${formatDate(to)}`}
                actions={
                  <button
                    onClick={() => setPrintingHistory(true)}
                    disabled={history.length === 0}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Printer className="h-4 w-4" /> Imprimer
                  </button>
                }
              >
                {loadingHistory && history.length === 0 ? (
                  <p className="py-8 text-center text-gray-500">Chargement...</p>
                ) : history.length === 0 ? (
                  <EmptyState icon={ClipboardCheck} title="Aucun rapport sur cette période" />
                ) : (
                  <ReportsTable reports={history} canDelete={canDelete} onDelete={deleteReport} />
                )}
              </Panel>
            </>
          )}
        </>
      )}

      {printingDay && selectedLevel && (
        <FollowUpPrint
          title="Rapport journalier"
          subtitle={selectedLevel.name}
          meta={[
            ['Date', formatDate(date)],
            ['Rapports', dayReports.length],
            ['Édité le', new Date().toLocaleDateString('fr-FR')],
          ]}
          reports={dayReports}
          onClose={() => setPrintingDay(false)}
        />
      )}
      {printingHistory && (
        <FollowUpPrint
          title="Suivi administratif"
          subtitle={historySubject}
          meta={[
            ['Période', `${formatDate(from)} - ${formatDate(to)}`],
            ['Absences', history.filter((r) => r.attendance === 'absent').length],
            ['Retards', history.filter((r) => r.attendance === 'late').length],
          ]}
          reports={history}
          onClose={() => setPrintingHistory(false)}
        />
      )}
    </div>
  );
};

export const ReportsTable: React.FC<{
  reports: DailyReport[];
  canDelete?: (report: DailyReport) => boolean;
  onDelete?: (report: DailyReport) => void;
  hideStudent?: boolean;
}> = ({ reports, canDelete, onDelete, hideStudent }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[860px] text-sm">
      <thead className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-600">
        <tr>
          <th className="px-3 py-2">Date</th>
          {!hideStudent && <th className="px-3 py-2">Étudiant</th>}
          <th className="px-3 py-2">Présence</th>
          <th className="px-3 py-2">Conduite</th>
          <th className="px-3 py-2">Activités</th>
          <th className="px-3 py-2">Observations</th>
          <th className="px-3 py-2">Auteur</th>
          {onDelete && <th className="px-3 py-2"><span className="sr-only">Actions</span></th>}
        </tr>
      </thead>
      <tbody>
        {reports.map((report) => (
          <tr key={report.id} className="border-t align-top hover:bg-gray-50">
            <td className="whitespace-nowrap px-3 py-2">{formatDate(report.report_date)}</td>
            {!hideStudent && (
              <td className="px-3 py-2 font-medium">
                {report.students?.profiles?.last_name} {report.students?.profiles?.first_name}
              </td>
            )}
            <td className="px-3 py-2"><Badge value={report.attendance} labels={ATTENDANCE_LABELS} classes={ATTENDANCE_CLASSES} /></td>
            <td className="px-3 py-2"><Badge value={report.conduct} labels={CONDUCT_LABELS} classes={CONDUCT_CLASSES} /></td>
            <td className="whitespace-pre-wrap px-3 py-2 text-gray-700">{report.activities || '-'}</td>
            <td className="whitespace-pre-wrap px-3 py-2 text-gray-700">{report.observations || '-'}</td>
            <td className="px-3 py-2 text-gray-600">{report.author_name}</td>
            {onDelete && (
              <td className="px-3 py-2">
                {canDelete?.(report) && (
                  <button
                    onClick={() => onDelete(report)}
                    title="Supprimer"
                    aria-label={`Supprimer le rapport du ${formatDate(report.report_date)}`}
                    className="rounded p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default StudentFollowUp;

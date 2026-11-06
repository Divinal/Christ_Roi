import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, BookOpen, ChevronLeft, ChevronRight, FileText, Hash, Printer, Search, TrendingUp, Users, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { fetchAllRows } from '../../lib/fetchAll';
import { Level } from '../../lib/levels';
import { StudentOption, fetchStudentOptions, matchesStudent, studentFullName as fullName } from '../../lib/students';
import {
  GRADE_TYPES,
  GradeRow,
  effectiveCoefficient,
  formatGrade,
  gradeToneClass,
  weightedAverage,
} from '../../lib/grades';
import LevelSelect from '../levels/LevelSelect';
import { confirmDialog, notify } from '../ui/feedback';
import { EmptyState, Panel, StatTile } from '../ui/primitives';
import StudentGradesTable from './StudentGradesTable';
import GradeReportPrint from './GradeReportPrint';

interface OverviewRow {
  count: number;
  average: number | null;
}

interface GradesManagementProps {
  levels: Level[];
  canEdit: boolean;
  // Le relevé imprimable est un document de l'administration et de l'étudiant.
  canPrint?: boolean;
  // Renseigné pour un enseignant : seules ses propres notes sont affichées.
  teacherId?: string;
  initialStudentId?: string;
}

const CHUNK_SIZE = 100; // garde l'URL de la requête .in() à une taille raisonnable

const GradesManagement: React.FC<GradesManagementProps> = ({ levels, canEdit, canPrint = true, teacherId, initialStudentId }) => {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [levelId, setLevelId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('');

  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [overview, setOverview] = useState<Map<string, OverviewRow>>(new Map());
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [editing, setEditing] = useState<GradeRow | null>(null);
  const [form, setForm] = useState({ gradeValue: '', gradeType: '', examDate: '', comment: '' });
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Une réponse lente ne doit pas écraser celle d'une sélection plus récente.
  const gradesRequest = useRef(0);
  const overviewRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sorted = await fetchStudentOptions();
        if (cancelled) return;
        setStudents(sorted);

        const initial = sorted.find((student) => student.id === initialStudentId);
        if (initial) {
          setLevelId(initial.level_id || '');
          setStudentId(initial.id);
        }
      } catch (error: any) {
        notify(`❌ Erreur: ${error.message}`);
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialStudentId]);

  // Un enseignant ne voit que les étudiants des niveaux qui lui sont affectés.
  const allowedStudents = useMemo(
    () => (teacherId ? students.filter((s) => levels.some((l) => l.id === s.level_id)) : students),
    [students, levels, teacherId],
  );
  const levelStudents = useMemo(
    () => allowedStudents.filter((student) => student.level_id === levelId),
    [allowedStudents, levelId],
  );
  const selectedStudent = allowedStudents.find((student) => student.id === studentId);
  const selectedLevel = levels.find((level) => level.id === levelId);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return allowedStudents.filter((student) => matchesStudent(student, search)).slice(0, 8);
  }, [search, allowedStudents]);

  const loadGrades = async (id: string) => {
    const request = ++gradesRequest.current;
    setLoadingGrades(true);
    let query = supabase
      .from('grades')
      .select('*, subjects(name, code, coefficient), teachers(profiles(first_name, last_name))')
      .eq('student_id', id);
    if (teacherId) query = query.eq('teacher_id', teacherId);

    const { data, error } = await query.order('exam_date', { ascending: false });
    if (request !== gradesRequest.current) return;
    setLoadingGrades(false);
    if (error) {
      notify(`❌ Erreur: ${error.message}`);
      return;
    }
    setGrades((data || []) as GradeRow[]);
  };

  useEffect(() => {
    setSubjectFilter('');
    if (studentId) loadGrades(studentId);
    else {
      gradesRequest.current++;
      setGrades([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Vue d'ensemble du niveau, tant qu'aucun étudiant n'est choisi.
  useEffect(() => {
    const request = ++overviewRequest.current;
    if (!levelId || studentId || levelStudents.length === 0) {
      setOverview(new Map());
      setLoadingOverview(false);
      return;
    }

    setLoadingOverview(true);
    (async () => {
      try {
        const ids = levelStudents.map((student) => student.id);
        const rows: any[] = [];
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          const chunk = ids.slice(i, i + CHUNK_SIZE);
          rows.push(
            ...(await fetchAllRows((from, to) => {
              let query = supabase
                .from('grades')
                .select('id, student_id, grade_value, coefficient, subjects(coefficient)')
                .in('student_id', chunk);
              if (teacherId) query = query.eq('teacher_id', teacherId);
              return query.order('id', { ascending: true }).range(from, to) as any;
            })),
          );
        }
        if (request !== overviewRequest.current) return;

        const next = new Map<string, OverviewRow>();
        ids.forEach((id) => {
          const own = rows.filter((row) => row.student_id === id);
          next.set(id, { count: own.length, average: weightedAverage(own) });
        });
        setOverview(next);
      } catch (error: any) {
        if (request === overviewRequest.current) notify(`❌ Erreur: ${error.message}`);
      } finally {
        if (request === overviewRequest.current) setLoadingOverview(false);
      }
    })();
  }, [levelId, studentId, levelStudents, teacherId]);

  const pickStudent = (student: StudentOption) => {
    setLevelId(student.level_id || '');
    setStudentId(student.id);
    setSearch('');
    setSearchOpen(false);
  };

  const openEdit = (grade: GradeRow) => {
    setEditing(grade);
    setForm({
      gradeValue: String(grade.grade_value),
      gradeType: grade.grade_type,
      examDate: grade.exam_date || '',
      comment: grade.comment || '',
    });
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    const value = parseFloat(form.gradeValue);
    if (Number.isNaN(value) || value < 0 || value > 20) {
      notify('⚠️ La note doit être comprise entre 0 et 20.');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from('grades')
      .update({
        grade_value: value,
        grade_type: form.gradeType,
        exam_date: form.examDate || null,
        comment: form.comment.trim() || null,
      })
      .eq('id', editing.id)
      .select('id');
    setSaving(false);

    if (error) {
      notify(`❌ Erreur: ${error.message}`);
    } else if (!data?.length) {
      notify("❌ Modification refusée : vous n'avez pas les droits nécessaires.");
    } else {
      notify('✅ Note modifiée');
      setEditing(null);
      loadGrades(editing.student_id);
    }
  };

  const deleteGrade = async (grade: GradeRow) => {
    const confirmed = await confirmDialog(
      `⚠️ Supprimer la note ${grade.grade_type} de ${grade.subjects?.name || 'cette matière'} (${formatGrade(grade.grade_value)}/20) ?`,
      { title: 'Supprimer la note', confirmLabel: 'Supprimer' },
    );
    if (!confirmed) return;

    const { data, error } = await supabase.from('grades').delete().eq('id', grade.id).select('id');
    if (error) {
      notify(`❌ Erreur: ${error.message}`);
    } else if (!data?.length) {
      notify("❌ Suppression refusée : vous n'avez pas les droits nécessaires.");
    } else {
      notify('✅ Note supprimée');
      loadGrades(grade.student_id);
    }
  };

  const subjects = useMemo(() => {
    const names = new Map<string, string>();
    grades.forEach((grade) => names.set(grade.subject_id, grade.subjects?.name || 'Matière inconnue'));
    return Array.from(names.entries()).sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  }, [grades]);

  const visibleGrades = subjectFilter ? grades.filter((grade) => grade.subject_id === subjectFilter) : grades;
  const generalAverage = weightedAverage(grades);
  const bestGrade = grades.length ? Math.max(...grades.map((grade) => Number(grade.grade_value))) : null;

  const position = levelStudents.findIndex((student) => student.id === studentId);
  const previousStudent = position > 0 ? levelStudents[position - 1] : null;
  const nextStudent = position >= 0 && position < levelStudents.length - 1 ? levelStudents[position + 1] : null;

  const typeOptions = editing && !GRADE_TYPES.some((type) => type.value === editing.grade_type)
    ? [{ value: editing.grade_type, label: editing.grade_type }, ...GRADE_TYPES]
    : GRADE_TYPES;

  return (
    <div className="space-y-4 md:space-y-6">
      <Panel>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="grades-level" className="mb-2 block text-sm font-medium">Niveau</label>
            <LevelSelect
              id="grades-level"
              levels={levels}
              value={levelId}
              onChange={(id) => {
                setLevelId(id);
                setStudentId('');
              }}
              placeholder="Choisir un niveau..."
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="grades-student" className="mb-2 block text-sm font-medium">
              Étudiant{levelId ? ` (${levelStudents.length})` : ''}
            </label>
            <select
              id="grades-student"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              disabled={!levelId || levelStudents.length === 0}
              className="w-full rounded-lg border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {!levelId ? "Choisissez d'abord un niveau" : levelStudents.length ? 'Vue du niveau' : 'Aucun étudiant'}
              </option>
              {levelStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.profiles?.last_name} {student.profiles?.first_name} — {student.student_number}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <label htmlFor="grades-search" className="mb-2 block text-sm font-medium">Rechercher un étudiant</label>
            <Search className="pointer-events-none absolute left-3 top-[2.65rem] h-5 w-5 text-gray-400" />
            <input
              id="grades-search"
              type="text"
              value={search}
              autoComplete="off"
              placeholder="Nom, matricule, email..."
              onChange={(event) => {
                setSearch(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
              className="w-full rounded-lg border py-2 pl-10 pr-3"
            />
            {searchOpen && search.trim() && (
              <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg bg-white shadow-lg">
                {searchResults.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-500">Aucun étudiant trouvé</li>
                ) : (
                  searchResults.map((student) => (
                    <li key={student.id}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pickStudent(student)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                      >
                        <span className="font-medium">{fullName(student)}</span>
                        <span className="block text-xs text-gray-500">
                          {student.student_number} • {student.levels?.name || 'Non inscrit'}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
      </Panel>

      {!levelId && !selectedStudent && (
        <Panel>
          <EmptyState
            icon={FileText}
            title={loadingStudents ? 'Chargement des étudiants...' : 'Choisissez un niveau pour commencer'}
            hint="La liste de ses étudiants se charge, puis sélectionnez un étudiant pour afficher son tableau de notes. Vous pouvez aussi le rechercher directement."
          />
        </Panel>
      )}

      {levelId && !selectedStudent && (
        <Panel
          title={`Notes — ${selectedLevel?.name || ''}`}
          description="Cliquez sur un étudiant pour ouvrir son tableau de notes."
        >
          {levelStudents.length === 0 ? (
            <EmptyState icon={Users} title="Aucun étudiant inscrit dans ce niveau" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-3 py-2">Matricule</th>
                    <th className="px-3 py-2">Étudiant</th>
                    <th className="px-3 py-2 text-center">Notes</th>
                    <th className="px-3 py-2 text-center">Moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  {levelStudents.map((student) => {
                    const row = overview.get(student.id);
                    return (
                      <tr
                        key={student.id}
                        onClick={() => setStudentId(student.id)}
                        className="cursor-pointer border-t hover:bg-gray-50"
                      >
                        <td className="px-3 py-2 font-medium">{student.student_number}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setStudentId(student.id)}
                            className="text-left font-medium text-indigo-600 hover:underline"
                          >
                            {student.profiles?.last_name} {student.profiles?.first_name}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-center">{loadingOverview ? '…' : row?.count ?? 0}</td>
                        <td className={`px-3 py-2 text-center font-bold ${gradeToneClass(row?.average)}`}>
                          {loadingOverview ? '…' : formatGrade(row?.average)}
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

      {selectedStudent && (
        <>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <StatTile
              icon={TrendingUp}
              tone="indigo"
              label="Moyenne générale"
              value={formatGrade(generalAverage)}
              valueClassName={gradeToneClass(generalAverage)}
            />
            <StatTile icon={Hash} tone="blue" label="Notes" value={grades.length} />
            <StatTile icon={BookOpen} tone="orange" label="Matières" value={subjects.length} />
            <StatTile icon={Award} tone="green" label="Meilleure note" value={formatGrade(bestGrade)} />
          </div>

          <Panel
            title={fullName(selectedStudent)}
            description={`${selectedStudent.student_number} • ${selectedStudent.levels?.name || 'Non inscrit'}`}
            actions={
              <>
                {position >= 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => previousStudent && setStudentId(previousStudent.id)}
                      disabled={!previousStudent}
                      aria-label="Étudiant précédent"
                      className="rounded-lg border p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 text-xs text-gray-600">{position + 1} / {levelStudents.length}</span>
                    <button
                      onClick={() => nextStudent && setStudentId(nextStudent.id)}
                      disabled={!nextStudent}
                      aria-label="Étudiant suivant"
                      className="rounded-lg border p-2 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {canPrint && (
                  <button
                    onClick={() => setPrinting(true)}
                    disabled={grades.length === 0}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Printer className="h-4 w-4" /> Imprimer le relevé
                  </button>
                )}
                <button
                  onClick={() => setStudentId('')}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100"
                >
                  <X className="h-4 w-4" /> Fermer
                </button>
              </>
            }
          >
            {subjects.length > 1 && (
              <div className="mb-4 max-w-xs">
                <label htmlFor="grades-subject" className="mb-2 block text-sm font-medium">Matière</label>
                <select
                  id="grades-subject"
                  value={subjectFilter}
                  onChange={(event) => setSubjectFilter(event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="">Toutes les matières</option>
                  {subjects.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {loadingGrades ? (
              <p className="py-8 text-center text-gray-500">Chargement des notes...</p>
            ) : grades.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Aucune note pour cet étudiant"
                hint={teacherId ? "Vous n'avez pas encore saisi de note pour cet étudiant." : 'Les notes apparaîtront ici dès que ses enseignants les auront saisies.'}
              />
            ) : (
              <StudentGradesTable
                grades={visibleGrades}
                onEdit={canEdit ? openEdit : undefined}
                onDelete={canEdit ? deleteGrade : undefined}
              />
            )}
          </Panel>
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <form
            onSubmit={saveEdit}
            role="dialog"
            aria-modal="true"
            aria-label="Modifier la note"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
          >
            <h3 className="text-lg font-semibold">Modifier la note</h3>
            <p className="mb-4 text-sm text-gray-600">
              {editing.subjects?.name} • coefficient {effectiveCoefficient(editing)} (défini dans Matières)
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium">
                Note /20 *
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.25"
                  required
                  value={form.gradeValue}
                  onChange={(event) => setForm({ ...form, gradeValue: event.target.value })}
                  className="mt-2 w-full rounded-lg border px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-medium">
                Type *
                <select
                  required
                  value={form.gradeType}
                  onChange={(event) => setForm({ ...form, gradeType: event.target.value })}
                  className="mt-2 w-full rounded-lg border px-3 py-2 font-normal"
                >
                  {typeOptions.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium md:col-span-2">
                Date
                <input
                  type="date"
                  value={form.examDate}
                  onChange={(event) => setForm({ ...form, examDate: event.target.value })}
                  className="mt-2 w-full rounded-lg border px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-medium md:col-span-2">
                Commentaire
                <textarea
                  rows={3}
                  value={form.comment}
                  onChange={(event) => setForm({ ...form, comment: event.target.value })}
                  className="mt-2 w-full rounded-lg border px-3 py-2 font-normal"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100">
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {printing && selectedStudent && (
        <GradeReportPrint
          studentName={fullName(selectedStudent)}
          studentNumber={selectedStudent.student_number}
          levelName={selectedStudent.levels?.name}
          grades={grades}
          onClose={() => setPrinting(false)}
        />
      )}
    </div>
  );
};

export default GradesManagement;

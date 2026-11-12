// Bulletin trimestriel (modèle collège-lycée) : calcul des moyennes et chargement des données.
import { supabase } from './supabaseClient';
import { fetchAllRows } from './fetchAll';
import { CURRENT_ACADEMIC_YEAR } from './levels';
import { HOMEWORK_TYPES, TERMS_MIGRATION_MESSAGE, Term, isTermsMigrationMissing } from './grades';
import { t } from '../i18n';

export interface ReportSubject {
  id: string;
  name: string;
  coefficient: number;
  teacherName: string;
}

export interface ReportGrade {
  student_id: string;
  subject_id: string;
  grade_type: string;
  grade_value: number;
  teacher_id?: string | null;
}

export interface ReportLine {
  subject: ReportSubject;
  // Moyenne de classe : somme des devoirs (devoir départemental compris) divisée par leur nombre.
  classAverage: number | null;
  compositionAverage: number | null;
  // Moyenne de classe + moyenne de composition.
  total: number | null;
  // Moyenne de la discipline sur 20 : moyenne des deux parties disponibles.
  average: number | null;
  // Colonne « Moyenne générale » : moyenne de la discipline multipliée par son coefficient.
  points: number | null;
  appreciation: string;
}

export interface ReportCardResult {
  lines: ReportLine[];
  totalCoefficient: number;
  totalPoints: number;
  termAverage: number | null;
}

const mean = (values: number[]): number | null =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export const appreciationFor = (average: number | null): string => {
  if (average === null) return '';
  if (average >= 16) return t("Très bien");
  if (average >= 14) return t("Bien");
  if (average >= 12) return t("Assez bien");
  if (average >= 10) return t("Passable");
  if (average >= 8) return t("Insuffisant");
  return t("Faible");
};

// Une discipline sans aucune note reste sur le bulletin mais ne compte pas dans la moyenne.
export const computeReportCard = (subjects: ReportSubject[], grades: ReportGrade[]): ReportCardResult => {
  const lines = subjects.map((subject) => {
    const own = grades.filter((grade) => grade.subject_id === subject.id);
    const classAverage = mean(own.filter((g) => HOMEWORK_TYPES.includes(g.grade_type)).map((g) => Number(g.grade_value)));
    const compositionAverage = mean(own.filter((g) => g.grade_type === 'Composition').map((g) => Number(g.grade_value)));
    const parts = [classAverage, compositionAverage].filter((value): value is number => value !== null);
    const average = mean(parts);
    return {
      subject,
      classAverage,
      compositionAverage,
      total: parts.length ? parts.reduce((sum, value) => sum + value, 0) : null,
      average,
      points: average === null ? null : average * subject.coefficient,
      appreciation: appreciationFor(average),
    };
  });

  const graded = lines.filter((line) => line.points !== null);
  const totalCoefficient = graded.reduce((sum, line) => sum + line.subject.coefficient, 0);
  const totalPoints = graded.reduce((sum, line) => sum + (line.points as number), 0);
  return {
    lines,
    totalCoefficient,
    totalPoints,
    termAverage: totalCoefficient ? totalPoints / totalCoefficient : null,
  };
};

// Rang dans le niveau : les ex aequo partagent le même rang ; un élève sans moyenne n'est pas classé.
export const rankOf = (averages: Map<string, number | null>, studentId: string): number | null => {
  const own = averages.get(studentId);
  if (own === null || own === undefined) return null;
  return 1 + Array.from(averages.values()).filter((value) => value !== null && value !== undefined && value > own).length;
};

export const formatRank = (rank: number | null): string => {
  if (rank === null) return '-';
  return rank === 1 ? t("1er") : t("{0}e", [rank]);
};

// Fenêtre du trimestre pour compter les absences du suivi journalier.
export const termWindow = (term: Term, academicYear = CURRENT_ACADEMIC_YEAR): [string, string] => {
  const start = Number(academicYear.slice(0, 4));
  if (term === 1) return [`${start}-09-01`, `${start}-12-31`];
  if (term === 2) return [`${start + 1}-01-01`, `${start + 1}-03-31`];
  return [`${start + 1}-04-01`, `${start + 1}-08-31`];
};

export interface ReportCardData {
  subjects: ReportSubject[];
  gradesByStudent: Map<string, ReportGrade[]>;
  absences: Map<string, { total: number; excused: number }>;
}

const CHUNK_SIZE = 100; // garde l'URL de la requête .in() à une taille raisonnable

const personName = (profile?: { first_name?: string; last_name?: string } | null): string =>
  profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '';

const chunks = <T,>(items: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) out.push(items.slice(i, i + CHUNK_SIZE));
  return out;
};

// studentIds : tous les élèves du niveau, nécessaires au classement.
export const loadReportCardData = async (levelId: string, studentIds: string[], term: Term): Promise<ReportCardData> => {
  const [subjectLinks, assignments] = await Promise.all([
    supabase.from('subject_levels').select('subject_id').eq('level_id', levelId),
    supabase
      .from('teacher_levels')
      .select('subject_id, teachers(profiles(first_name, last_name))')
      .eq('level_id', levelId),
  ]);
  if (subjectLinks.error) throw subjectLinks.error;
  if (assignments.error) throw assignments.error;

  const grades: ReportGrade[] = [];
  for (const chunk of chunks(studentIds)) {
    try {
      grades.push(
        ...(await fetchAllRows<ReportGrade>((from, to) =>
          supabase
            .from('grades')
            .select('id, student_id, subject_id, grade_type, grade_value, teacher_id')
            .in('student_id', chunk)
            .eq('term', term)
            .eq('academic_year', CURRENT_ACADEMIC_YEAR)
            .order('id', { ascending: true })
            .range(from, to) as any,
        )),
      );
    } catch (error: any) {
      if (isTermsMigrationMissing(error)) throw new Error(t(TERMS_MIGRATION_MESSAGE));
      throw error;
    }
  }

  // Les disciplines du bulletin : celles du niveau, celles qui ont un enseignant affecté et celles déjà notées.
  const subjectIds = new Set<string>([
    ...(subjectLinks.data || []).map((row: any) => row.subject_id),
    ...(assignments.data || []).map((row: any) => row.subject_id),
    ...grades.map((grade) => grade.subject_id),
  ]);
  const teacherOf = new Map<string, string>();
  (assignments.data || []).forEach((row: any) => {
    const name = personName(row.teachers?.profiles);
    if (name && !teacherOf.has(row.subject_id)) teacherOf.set(row.subject_id, name);
  });

  let subjects: ReportSubject[] = [];
  if (subjectIds.size) {
    const { data, error } = await supabase.from('subjects').select('id, name, coefficient').in('id', Array.from(subjectIds));
    if (error) throw error;
    subjects = (data || [])
      .map((subject: any) => ({
        id: subject.id,
        name: subject.name,
        coefficient: Number(subject.coefficient) || 1,
        teacherName: teacherOf.get(subject.id) || '',
      }))
      .sort((a: ReportSubject, b: ReportSubject) => a.name.localeCompare(b.name, 'fr'));
  }

  const gradesByStudent = new Map<string, ReportGrade[]>(studentIds.map((id) => [id, []]));
  grades.forEach((grade) => gradesByStudent.get(grade.student_id)?.push(grade));

  // Absences : relevées par le suivi journalier. Sans ce module, le champ reste à remplir à la main.
  const absences = new Map<string, { total: number; excused: number }>();
  const [from, to] = termWindow(term);
  for (const chunk of chunks(studentIds)) {
    const { data, error } = await supabase
      .from('student_daily_reports')
      .select('student_id, attendance')
      .in('student_id', chunk)
      .in('attendance', ['absent', 'excused'])
      .gte('report_date', from)
      .lte('report_date', to);
    if (error) break;
    (data || []).forEach((row: any) => {
      const current = absences.get(row.student_id) || { total: 0, excused: 0 };
      absences.set(row.student_id, {
        total: current.total + 1,
        excused: current.excused + (row.attendance === 'excused' ? 1 : 0),
      });
    });
  }

  return { subjects, gradesByStudent, absences };
};

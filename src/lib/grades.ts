import { t, locale } from '../i18n';
export const GRADE_TYPES: { value: string; label: string }[] = [
  { value: 'CC1', label: t("CC1 (Contrôle Continu 1)") },
  { value: 'CC2', label: t("CC2 (Contrôle Continu 2)") },
  { value: 'CC3', label: t("CC3 (Contrôle Continu 3)") },
  { value: 'E.Théorique', label: t("Examen Théorique") },
  { value: 'E.Pratique', label: t("Examen Pratique") },
];

export interface GradeRow {
  id: string;
  student_id: string;
  subject_id: string;
  grade_value: number;
  grade_type: string;
  coefficient: number;
  exam_date?: string | null;
  comment?: string | null;
  subjects?: { name: string; code?: string; coefficient?: number | null } | null;
  teachers?: { profiles?: { first_name: string; last_name: string } | null } | null;
}

type Weighted = Pick<GradeRow, 'grade_value' | 'coefficient'> & {
  subjects?: { coefficient?: number | null } | null;
};

// Le coefficient officiel est celui de la matière : celui stocké sur la note
// peut être obsolète si la matière a été modifiée depuis.
export const effectiveCoefficient = (grade: Weighted): number =>
  Number(grade.subjects?.coefficient || grade.coefficient || 1);

export const weightedAverage = (grades: Weighted[]): number | null => {
  const totalCoefficient = grades.reduce((sum, g) => sum + effectiveCoefficient(g), 0);
  if (totalCoefficient === 0) return null;
  return grades.reduce((sum, g) => sum + Number(g.grade_value) * effectiveCoefficient(g), 0) / totalCoefficient;
};

export const formatGrade = (value: number | null | undefined): string =>
  value === null || value === undefined ? '-' : Number(value).toFixed(2);

export const gradeToneClass = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'text-gray-500';
  if (value >= 15) return 'text-green-600';
  if (value >= 10) return 'text-blue-600';
  return 'text-red-600';
};

export const formatDate = (date?: string | null): string =>
  date ? new Date(date).toLocaleDateString(locale()) : '-';

export const teacherNameOf = (grade: GradeRow): string => {
  const profile = grade.teachers?.profiles;
  return profile ? `${profile.first_name} ${profile.last_name}`.trim() : '-';
};

export interface SubjectGroup {
  subjectId: string;
  name: string;
  coefficient: number;
  average: number | null;
  grades: GradeRow[];
}

export const groupBySubject = (grades: GradeRow[]): SubjectGroup[] => {
  const groups = new Map<string, GradeRow[]>();
  grades.forEach((grade) => {
    groups.set(grade.subject_id, [...(groups.get(grade.subject_id) || []), grade]);
  });

  return Array.from(groups.entries())
    .map(([subjectId, rows]) => ({
      subjectId,
      name: rows[0].subjects?.name || t("Matière inconnue"),
      coefficient: effectiveCoefficient(rows[0]),
      average: weightedAverage(rows),
      grades: [...rows].sort((a, b) => (b.exam_date || '').localeCompare(a.exam_date || '')),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
};

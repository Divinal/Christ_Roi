import { t, locale } from '../i18n';
import { SchoolCycle } from './levels';

// Les valeurs (« Devoir », « CC1 »…) sont enregistrées telles quelles en base et
// contrôlées par le déclencheur check_grade_scheme : ne pas les traduire.
export interface GradeType {
  value: string;
  label: string;
}

// Pré-scolaire et primaire : uniquement des compositions, une par trimestre.
// Collège et lycée : devoirs (nombre libre), devoir départemental et composition, par trimestre.
// Supérieur : contrôles continus et examens, sans trimestre.
export type GradeScheme = 'composition' | 'secondaire' | 'superieur';

const TYPES_BY_SCHEME: Record<GradeScheme, GradeType[]> = {
  composition: [{ value: 'Composition', label: t("Composition") }],
  secondaire: [
    { value: 'Devoir', label: t("Devoir") },
    { value: 'Devoir départemental', label: t("Devoir départemental") },
    { value: 'Composition', label: t("Composition") },
  ],
  superieur: [
    { value: 'CC1', label: t("CC1 (Contrôle Continu 1)") },
    { value: 'CC2', label: t("CC2 (Contrôle Continu 2)") },
    { value: 'CC3', label: t("CC3 (Contrôle Continu 3)") },
    { value: 'E.Théorique', label: t("Examen Théorique") },
    { value: 'E.Pratique', label: t("Examen Pratique") },
  ],
};

export const gradeSchemeOf = (cycle?: SchoolCycle | null): GradeScheme =>
  cycle === 'superieur' ? 'superieur' : cycle === 'college' || cycle === 'lycee' ? 'secondaire' : 'composition';

// Sans cycle connu (étudiant sans niveau), tous les types restent proposés.
export const gradeTypesFor = (cycle?: SchoolCycle | null): GradeType[] =>
  cycle
    ? TYPES_BY_SCHEME[gradeSchemeOf(cycle)]
    : [...TYPES_BY_SCHEME.secondaire, ...TYPES_BY_SCHEME.superieur];

export const gradeTypeLabel = (value: string): string =>
  [...TYPES_BY_SCHEME.secondaire, ...TYPES_BY_SCHEME.superieur].find((type) => type.value === value)?.label || value;

export const usesTerms = (cycle?: SchoolCycle | null): boolean => Boolean(cycle) && gradeSchemeOf(cycle) !== 'superieur';

// Une seule note de ce type par élève, matière et trimestre (index unique en base).
export const SINGLE_PER_TERM = ['Composition', 'Devoir départemental'];

// Notes qui forment la « moyenne de classe » du bulletin.
export const HOMEWORK_TYPES = ['Devoir', 'Devoir départemental'];

export type Term = 1 | 2 | 3;
export const TERMS: Term[] = [1, 2, 3];

export const termLabel = (term?: number | null): string =>
  term === 1 ? t("1er trimestre") : term === 2 ? t("2e trimestre") : term === 3 ? t("3e trimestre") : '-';

// Trimestre en cours selon le calendrier scolaire : septembre-décembre, janvier-mars, avril-août.
export const currentTerm = (date = new Date()): Term => {
  const month = date.getMonth() + 1;
  return month >= 9 ? 1 : month <= 3 ? 2 : 3;
};

// Avant la migration des trimestres, la base ne connaît pas les colonnes term et academic_year.
export const isTermsMigrationMissing = (error: { code?: string; message?: string } | null | undefined): boolean =>
  Boolean(error) && (error?.code === 'PGRST204' || error?.code === '42703') && /term|academic_year/.test(error?.message || '');

export const TERMS_MIGRATION_MESSAGE = "La base de données doit être mise à jour (migration des trimestres) avant d'utiliser cette fonction.";

export interface GradeRow {
  id: string;
  student_id: string;
  subject_id: string;
  grade_value: number;
  grade_type: string;
  coefficient: number;
  level_id?: string | null;
  term?: number | null;
  academic_year?: string | null;
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

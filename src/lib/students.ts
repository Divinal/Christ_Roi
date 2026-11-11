import { supabase } from './supabaseClient';
import { fetchAllRows } from './fetchAll';
import { SchoolCycle } from './levels';
import { t } from '../i18n';

export interface StudentOption {
  id: string;
  user_id?: string;
  student_number: string;
  level_id: string | null;
  profiles?: { first_name: string; last_name: string; email?: string } | null;
  levels?: { id: string; name: string; cycle: SchoolCycle } | null;
}

export const studentFullName = (student?: StudentOption | null): string =>
  `${student?.profiles?.first_name || ''} ${student?.profiles?.last_name || ''}`.trim() || t("Sans nom");

// Recherche insensible à la casse et aux accents.
export const normalizeText = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

export const matchesStudent = (student: StudentOption, term: string): boolean =>
  normalizeText(`${student.student_number} ${studentFullName(student)} ${student.profiles?.email || ''}`).includes(
    normalizeText(term.trim()),
  );

// Tous les étudiants visibles selon les droits de la personne connectée, triés par nom.
export const fetchStudentOptions = async (): Promise<StudentOption[]> => {
  const rows = await fetchAllRows<StudentOption>((from, to) =>
    supabase
      .from('students')
      .select('id, user_id, student_number, level_id, profiles(first_name, last_name, email), levels(id, name, cycle)')
      .order('student_number', { ascending: true })
      .range(from, to) as any,
  );
  return rows.sort((a, b) =>
    `${a.profiles?.last_name} ${a.profiles?.first_name}`.localeCompare(
      `${b.profiles?.last_name} ${b.profiles?.first_name}`,
      'fr',
    ),
  );
};

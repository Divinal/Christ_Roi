import { supabase } from './supabaseClient';
import { fetchAllRows } from './fetchAll';
import { fetchProfileNames } from './messages';
import { t } from '../i18n';

export const ATTENDANCE_LABELS: Record<string, string> = {
  present: t("Présent"),
  absent: t("Absent"),
  late: t("En retard"),
  excused: t("Absence justifiée"),
};

export const CONDUCT_LABELS: Record<string, string> = {
  excellent: t("Excellente"),
  good: t("Bonne"),
  fair: t("Passable"),
  concern: t("À surveiller"),
};

export const ATTENDANCE_CLASSES: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  late: 'bg-orange-100 text-orange-700',
  excused: 'bg-blue-100 text-blue-700',
};

export const CONDUCT_CLASSES: Record<string, string> = {
  excellent: 'bg-green-100 text-green-700',
  good: 'bg-blue-100 text-blue-700',
  fair: 'bg-orange-100 text-orange-700',
  concern: 'bg-red-100 text-red-700',
};

export interface DailyReport {
  id: string;
  student_id: string;
  level_id: string | null;
  report_date: string;
  attendance: string | null;
  conduct: string | null;
  activities: string | null;
  observations: string | null;
  author_id: string | null;
  author_name?: string;
  students?: {
    student_number: string;
    profiles?: { first_name: string; last_name: string } | null;
  } | null;
}

export class FollowUpNotActivatedError extends Error {}

// Date du jour à l'heure locale : toISOString() donnerait la veille entre minuit et 1 h à Brazzaville.
export const todayLocal = (): string => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const daysAgoLocal = (days: number): string => {
  const date = new Date(`${todayLocal()}T12:00:00`);
  date.setDate(date.getDate() - days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const CHUNK_SIZE = 100; // garde l'URL de la requête .in() à une taille raisonnable

export const fetchReports = async (studentIds: string[], from: string, to: string): Promise<DailyReport[]> => {
  const rows: DailyReport[] = [];
  try {
    for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
      const chunk = studentIds.slice(i, i + CHUNK_SIZE);
      rows.push(
        ...(await fetchAllRows<DailyReport>((start, end) =>
          supabase
            .from('student_daily_reports')
            .select('*, students(student_number, profiles(first_name, last_name))')
            .in('student_id', chunk)
            .gte('report_date', from)
            .lte('report_date', to)
            .order('id', { ascending: true })
            .range(start, end) as any,
        )),
      );
    }
  } catch (error: any) {
    if (error?.code === 'PGRST205') throw new FollowUpNotActivatedError();
    throw error;
  }

  const names = await fetchProfileNames(rows.map((row) => row.author_id || ''));
  return rows
    .map((row) => ({ ...row, author_name: names.get(row.author_id || '') || t("Compte supprimé") }))
    .sort((a, b) => {
      const byDate = b.report_date.localeCompare(a.report_date);
      if (byDate !== 0) return byDate;
      return `${a.students?.profiles?.last_name} ${a.students?.profiles?.first_name}`.localeCompare(
        `${b.students?.profiles?.last_name} ${b.students?.profiles?.first_name}`,
        'fr',
      );
    });
};

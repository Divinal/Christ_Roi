// Corbeille : ce qui est supprimé y reste 30 jours, restaurable, puis disparaît.
// La capture se fait en base (déclencheurs) ; ici, lecture et actions.
import { supabase } from './supabaseClient';
import { t } from '../i18n';

export const TRASH_DAYS = 30;

export type TrashKind =
  | 'student' | 'teacher' | 'grade' | 'payment' | 'payslip' | 'message' | 'announcement' | 'followup'
  | 'schedule' | 'assignment' | 'subject_level' | 'subject' | 'level' | 'transaction' | 'other';

export interface TrashEntry {
  id: number;
  batch_id: number;
  table_name: string;
  row_id: string;
  kind: TrashKind;
  label: string;
  restore_mode: 'insert' | 'unvoid';
  deleted_by: string | null;
  deleted_at: string;
}

// Une suppression = un lot : l'élément supprimé et ce qui est parti avec lui.
export interface TrashBatch {
  batchId: number;
  root: TrashEntry;
  children: TrashEntry[];
  deletedAt: string;
  deletedBy: string | null;
  daysLeft: number;
}

export const KIND_LABELS: Record<TrashKind, string> = {
  student: t("Étudiant"),
  teacher: t("Enseignant"),
  grade: t("Note"),
  payment: t("Frais de scolarité"),
  payslip: t("Bulletin de paie"),
  message: t("Message"),
  announcement: t("Annonce"),
  followup: t("Suivi journalier"),
  schedule: t("Créneau"),
  assignment: t("Affectation"),
  subject_level: t("Matière d'un niveau"),
  subject: t("Matière"),
  level: t("Niveau"),
  transaction: t("Opération financière"),
  other: t("Autre"),
};

// Même ordre que la base : l'élément principal d'un lot est celui dont les autres dépendent.
const rank = (table: string): number =>
  ['levels', 'subjects'].includes(table) ? 1
    : ['students', 'teachers', 'announcements', 'messages'].includes(table) ? 2 : 3;

export const daysLeft = (deletedAt: string, now = Date.now()): number =>
  Math.max(0, TRASH_DAYS - Math.floor((now - new Date(deletedAt).getTime()) / 86400000));

export const groupTrash = (entries: TrashEntry[], now = Date.now()): TrashBatch[] => {
  const batches = new Map<number, TrashEntry[]>();
  entries.forEach((entry) => batches.set(entry.batch_id, [...(batches.get(entry.batch_id) || []), entry]));
  return Array.from(batches.entries())
    .map(([batchId, rows]) => {
      const sorted = [...rows].sort((a, b) => rank(a.table_name) - rank(b.table_name) || a.id - b.id);
      const deletedAt = rows.reduce((latest, row) => (row.deleted_at > latest ? row.deleted_at : latest), rows[0].deleted_at);
      return {
        batchId,
        root: sorted[0],
        children: sorted.slice(1),
        deletedAt,
        deletedBy: sorted[0].deleted_by,
        daysLeft: daysLeft(deletedAt, now),
      };
    })
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
};

export class TrashNotActivatedError extends Error {}

const NOT_ACTIVATED = "La corbeille n'est pas encore activée : la mise à jour de la base de données doit d'abord être appliquée.";

// Table ou fonction absente : la migration de la corbeille n'est pas encore appliquée.
const isMissing = (error: { code?: string } | null) =>
  ['PGRST205', 'PGRST202', '42P01', '42883'].includes(error?.code || '');

const fail = (error: { code?: string; message: string }): never => {
  if (isMissing(error)) throw new TrashNotActivatedError(t(NOT_ACTIVATED));
  throw new Error(t(error.message));
};

export const fetchTrash = async (): Promise<TrashBatch[]> => {
  // Ce qui a dépassé 30 jours disparaît avant l'affichage (filet si la tâche de nuit n'existe pas).
  await supabase.rpc('purge_expired_trash');
  const { data, error } = await supabase
    .from('trash')
    .select('id, batch_id, table_name, row_id, kind, label, restore_mode, deleted_by, deleted_at')
    .order('deleted_at', { ascending: false })
    .limit(2000);
  if (error) fail(error);
  return groupTrash((data || []) as TrashEntry[]);
};

export const restoreBatch = async (batchId: number): Promise<void> => {
  const { error } = await supabase.rpc('restore_trash', { _batch: batchId });
  if (error) fail(error);
};

export const deleteBatch = async (batchId: number): Promise<void> => {
  const { error } = await supabase.rpc('delete_trash_batch', { _batch: batchId });
  if (error) fail(error);
};

export const emptyTrash = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('empty_trash');
  if (error) fail(error);
  return Number(data) || 0;
};

// Étudiant ou enseignant : fiche et données à la corbeille, compte bloqué 30 jours.
export const trashMember = async (kind: 'student' | 'teacher', memberId: string): Promise<void> => {
  const { error } = await supabase.rpc('trash_member', { _kind: kind, _member_id: memberId });
  if (error) fail(error);
};

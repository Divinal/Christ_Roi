import React, { useEffect, useMemo, useState } from 'react';
import {
  Award, Bell, BookOpen, CalendarClock, ClipboardCheck, DollarSign, FileText, GraduationCap, Layers, Link2,
  LucideIcon, MessageSquare, RotateCcw, Trash2, Users, Wallet,
} from 'lucide-react';
import {
  KIND_LABELS,
  TRASH_DAYS,
  TrashBatch,
  TrashKind,
  TrashNotActivatedError,
  deleteBatch,
  emptyTrash,
  fetchTrash,
  restoreBatch,
} from '../../lib/trash';
import { fetchProfileNames } from '../../lib/messages';
import { confirmDialog, notify } from '../ui/feedback';
import { EmptyState, Panel } from '../ui/primitives';
import { locale, t } from '../../i18n';

interface TrashBinProps {
  // Administration : toute la corbeille ; enseignant : ce qu'il a supprimé.
  isStaff: boolean;
  // Après une restauration, l'espace recharge ses listes.
  onRestored?: () => void;
}

const KIND_ICONS: Record<TrashKind, LucideIcon> = {
  student: GraduationCap,
  teacher: Users,
  grade: FileText,
  payment: DollarSign,
  payslip: Wallet,
  message: MessageSquare,
  announcement: Bell,
  followup: ClipboardCheck,
  schedule: CalendarClock,
  assignment: Link2,
  subject_level: Layers,
  subject: BookOpen,
  level: Award,
  transaction: DollarSign,
  other: Trash2,
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const TrashBin: React.FC<TrashBinProps> = ({ isStaff, onRestored }) => {
  const [batches, setBatches] = useState<TrashBatch[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notActivated, setNotActivated] = useState('');
  const [kindFilter, setKindFilter] = useState<TrashKind | ''>('');
  const [busy, setBusy] = useState<number | 'all' | null>(null);

  const load = async () => {
    try {
      const result = await fetchTrash();
      setBatches(result);
      const authors = Array.from(new Set(result.map((batch) => batch.deletedBy).filter(Boolean))) as string[];
      if (authors.length) setNames(await fetchProfileNames(authors));
    } catch (error: any) {
      if (error instanceof TrashNotActivatedError) setNotActivated(error.message);
      else notify(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kinds = useMemo(
    () => Array.from(new Set(batches.map((batch) => batch.root.kind))).sort((a, b) => KIND_LABELS[a].localeCompare(KIND_LABELS[b])),
    [batches],
  );
  const visible = kindFilter ? batches.filter((batch) => batch.root.kind === kindFilter) : batches;

  const restore = async (batch: TrashBatch) => {
    setBusy(batch.batchId);
    try {
      await restoreBatch(batch.batchId);
      setBatches((previous) => previous.filter((item) => item.batchId !== batch.batchId));
      notify(t("✅ Restauré : {0}", [batch.root.label]));
      onRestored?.();
    } catch (error: any) {
      notify(`❌ ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (batch: TrashBatch) => {
    const account = batch.root.kind === 'student' || batch.root.kind === 'teacher'
      ? `\n\n${t("Son compte de connexion sera supprimé lui aussi.")}`
      : '';
    const confirmed = await confirmDialog(
      t("⚠️ Supprimer définitivement « {0} » ?\n\nCette action est irréversible.", [batch.root.label]) + account,
      { title: t("Supprimer définitivement"), confirmLabel: t("Supprimer"), danger: true },
    );
    if (!confirmed) return;
    setBusy(batch.batchId);
    try {
      await deleteBatch(batch.batchId);
      setBatches((previous) => previous.filter((item) => item.batchId !== batch.batchId));
      notify(t("✅ Supprimé définitivement"));
    } catch (error: any) {
      notify(`❌ ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  const empty = async () => {
    const confirmed = await confirmDialog(
      t("⚠️ Vider la corbeille ?\n\nLes {0} élément(s) seront supprimés définitivement. Cette action est irréversible.", [batches.length]),
      { title: t("Vider la corbeille"), confirmLabel: t("Vider"), danger: true },
    );
    if (!confirmed) return;
    setBusy('all');
    try {
      await emptyTrash();
      setBatches([]);
      notify(t("✅ Corbeille vidée"));
    } catch (error: any) {
      notify(`❌ ${error.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title={t("Corbeille")}
      description={
        isStaff
          ? t("Tout ce qui est supprimé reste ici {0} jours : vous pouvez le restaurer. Ensuite, c'est effacé définitivement.", [TRASH_DAYS])
          : t("Ce que vous supprimez reste ici {0} jours : vous pouvez le restaurer. Ensuite, c'est effacé définitivement.", [TRASH_DAYS])
      }
      actions={
        batches.length > 0 ? (
          <>
            <select
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value as TrashKind | '')}
              aria-label={t("Type d'élément")}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">{t("Tous les types")} ({batches.length})</option>
              {kinds.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind]} ({batches.filter((batch) => batch.root.kind === kind).length})
                </option>
              ))}
            </select>
            <button
              onClick={empty}
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> {t("Vider la corbeille")}
            </button>
          </>
        ) : undefined
      }
    >
      {loading ? (
        <p className="py-8 text-center text-gray-500">{t("Chargement...")}</p>
      ) : notActivated ? (
        <p className="rounded-lg bg-orange-50 p-4 text-sm text-orange-800">{notActivated}</p>
      ) : visible.length === 0 ? (
        <EmptyState icon={Trash2} title={t("La corbeille est vide")} hint={t("Les éléments supprimés apparaîtront ici pendant {0} jours.", [TRASH_DAYS])} />
      ) : (
        <ul className="space-y-3">
          {visible.map((batch) => {
            const Icon = KIND_ICONS[batch.root.kind] || Trash2;
            const author = batch.deletedBy ? names.get(batch.deletedBy) : '';
            return (
              <li key={batch.batchId} className="rounded-lg border p-4" data-testid="trash-item">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-lg bg-gray-100 p-2 text-gray-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500" data-testid="trash-kind">
                        {KIND_LABELS[batch.root.kind] || batch.root.kind}
                      </p>
                      <p className="break-words font-semibold text-gray-900" data-testid="trash-label">{batch.root.label}</p>
                      <p className="mt-1 text-xs text-gray-600">
                        {author
                          ? t("Supprimé le {0} par {1}", [formatDateTime(batch.deletedAt), author])
                          : t("Supprimé le {0}", [formatDateTime(batch.deletedAt)])}
                      </p>
                      <p className={`mt-1 text-xs font-medium ${batch.daysLeft <= 3 ? 'text-red-600' : 'text-gray-500'}`} data-testid="trash-days">
                        {batch.daysLeft === 0
                          ? t("Effacé définitivement aujourd'hui")
                          : t("Effacé définitivement dans {0} jour(s)", [batch.daysLeft])}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => restore(batch)}
                      disabled={busy !== null}
                      className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" /> {busy === batch.batchId ? t("Restauration...") : t("Restaurer")}
                    </button>
                    <button
                      onClick={() => remove(batch)}
                      disabled={busy !== null}
                      title={t("Supprimer définitivement")}
                      aria-label={t("Supprimer définitivement « {0} »", [batch.root.label])}
                      className="rounded-lg border p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {batch.children.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-gray-600">
                      {t("Avec {0} élément(s) lié(s), restauré(s) ensemble", [batch.children.length])}
                    </summary>
                    <ul className="mt-2 space-y-1 ps-4">
                      {batch.children.map((child) => (
                        <li key={child.id} className="text-gray-700">
                          <span className="text-gray-500">{KIND_LABELS[child.kind] || child.kind} :</span> {child.label}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
};

export default TrashBin;

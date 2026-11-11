import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Edit, Plus, Search } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { CYCLES, Level, SchoolCycle, fetchLevels, levelsOfCycle } from '../../lib/levels';
import { ACADEMIC_MONTHS, TuitionPayment } from './financeTypes';
import { formatFCFA, generateReceiptNumber } from './financeUtils';
import ReceiptPrintable from './ReceiptPrintable';
import TuitionHistoryTable from './TuitionHistoryTable';
import { confirmDialog, notify } from '../ui/feedback';
import { fetchAllRows } from '../../lib/fetchAll';
import { t } from '../../i18n';

type PaymentStatus = 'paid' | 'partial' | 'unpaid' | 'no_fee';

const STATUS: Record<PaymentStatus, { label: string; className: string }> = {
  paid: { label: t("Soldé"), className: 'bg-green-100 text-green-700' },
  partial: { label: t("Partiel"), className: 'bg-orange-100 text-orange-700' },
  unpaid: { label: t("Aucun paiement"), className: 'bg-red-100 text-red-700' },
  no_fee: { label: t("Frais non défini"), className: 'bg-gray-100 text-gray-700' },
};

interface StudentRow {
  id: string;
  student_number: string;
  annual_tuition_fee: number | null;
  level_id: string | null;
  profiles?: { first_name: string; last_name: string };
  paid: number;
  paymentCount: number;
  remaining: number;
  status: PaymentStatus;
}

interface TuitionByLevelProps {
  academicYear: string;
}

const UNENROLLED = 'unenrolled';

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const statusOf = (fee: number, paid: number): PaymentStatus => {
  if (fee <= 0) return 'no_fee';
  if (paid >= fee) return 'paid';
  return paid > 0 ? 'partial' : 'unpaid';
};

const TuitionByLevel: React.FC<TuitionByLevelProps> = ({ academicYear }) => {
  const [levels, setLevels] = useState<Level[]>([]);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [cycleFilter, setCycleFilter] = useState<SchoolCycle | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [openLevels, setOpenLevels] = useState<Set<string>>(new Set());
  const [expandedStudent, setExpandedStudent] = useState('');

  const [feeEdit, setFeeEdit] = useState<{ studentId: string; value: number | '' } | null>(null);
  const [collecting, setCollecting] = useState<StudentRow | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    month: new Date().getMonth() + 1,
    amount: '' as number | '',
    date: todayISO(),
  });
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ payment: TuitionPayment; cumulativePaid: number; fee: number } | null>(null);

  useEffect(() => {
    fetchLevels().then(setLevels);
  }, []);

  useEffect(() => {
    loadRows();
  }, [academicYear]);

  const loadRows = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [students, payments] = await Promise.all([
        fetchAllRows((from, to) =>
          supabase
            .from('students')
            .select('id, student_number, annual_tuition_fee, level_id, profiles(first_name, last_name)')
            .order('student_number', { ascending: true })
            .range(from, to)
        ),
        fetchAllRows((from, to) =>
          supabase
            .from('tuition_fee_payments')
            .select('student_id, amount')
            .eq('academic_year', academicYear)
            .is('voided_at', null)
            .order('id', { ascending: true })
            .range(from, to)
        ),
      ]);

      const totals = new Map<string, { paid: number; count: number }>();
      payments.forEach((p: { student_id: string; amount: number }) => {
        const current = totals.get(p.student_id) || { paid: 0, count: 0 };
        totals.set(p.student_id, { paid: current.paid + Number(p.amount), count: current.count + 1 });
      });

      setRows(
        students.map((s: any) => {
          const fee = Number(s.annual_tuition_fee) || 0;
          const { paid, count } = totals.get(s.id) || { paid: 0, count: 0 };
          return {
            ...s,
            paid,
            paymentCount: count,
            remaining: Math.max(fee - paid, 0),
            status: statusOf(fee, paid),
          };
        })
      );
    } catch (error: any) {
      console.error('Erreur chargement scolarité:', error);
      setLoadError(error.message || t("Erreur de chargement"));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!term) return true;
      return (
        row.student_number.toLowerCase().includes(term) ||
        (row.profiles?.first_name || '').toLowerCase().includes(term) ||
        (row.profiles?.last_name || '').toLowerCase().includes(term)
      );
    });
  }, [rows, statusFilter, search]);

  const visibleCycles = CYCLES.filter((c) => cycleFilter === 'all' || c.id === cycleFilter);
  const visibleLevelIds = new Set(visibleCycles.flatMap((c) => levelsOfCycle(levels, c.id).map((l) => l.id)));
  // Les étudiants sans niveau restent visibles : leurs paiements comptent.
  const showUnenrolled = cycleFilter === 'all';
  const inScope = filtered.filter((r) => (r.level_id ? visibleLevelIds.has(r.level_id) : showUnenrolled));

  const summarize = (list: StudentRow[]) => ({
    expected: list.reduce((sum, r) => sum + (Number(r.annual_tuition_fee) || 0), 0),
    paid: list.reduce((sum, r) => sum + r.paid, 0),
    remaining: list.reduce((sum, r) => sum + r.remaining, 0),
  });
  const totals = summarize(inScope);

  const toggleLevel = (id: string) => {
    setOpenLevels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveFee = async () => {
    if (!feeEdit) return;
    const { data, error } = await supabase
      .from('students')
      .update({ annual_tuition_fee: feeEdit.value === '' ? null : feeEdit.value })
      .eq('id', feeEdit.studentId)
      .select('id');

    if (error) {
      notify(`❌ Erreur: ${error.message}`);
      return;
    }
    if (!data?.length) {
      notify(t("❌ Modification refusée : vous n'avez pas les droits nécessaires."));
      return;
    }
    setFeeEdit(null);
    loadRows();
  };

  const openPaymentForm = (row: StudentRow) => {
    setPaymentForm({ month: new Date().getMonth() + 1, amount: '', date: todayISO() });
    setCollecting(row);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collecting || !paymentForm.amount) return;

    const fee = Number(collecting.annual_tuition_fee) || 0;
    if (fee > 0 && paymentForm.amount > collecting.remaining) {
      const proceed = await confirmDialog(
        t("⚠️ Ce montant dépasse le reste à payer ({0}). Enregistrer quand même ?", [formatFCFA(collecting.remaining)])
      );
      if (!proceed) return;
    }

    setSubmitting(true);
    const { data, error } = await supabase
      .from('tuition_fee_payments')
      .insert({
        student_id: collecting.id,
        month: paymentForm.month,
        academic_year: academicYear,
        amount: paymentForm.amount,
        payment_date: paymentForm.date,
        receipt_number: generateReceiptNumber(academicYear, paymentForm.month),
      })
      .select('*, students(student_number, profiles(first_name, last_name), levels(name))')
      .single();
    setSubmitting(false);

    if (error) {
      notify(`❌ Erreur: ${error.message}`);
      return;
    }
    setReceipt({ payment: data as TuitionPayment, cumulativePaid: collecting.paid + Number(paymentForm.amount), fee });
    setCollecting(null);
    loadRows();
  };

  const renderTable = (list: StudentRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-3 py-2 text-start">{t("Matricule")}</th>
            <th className="px-3 py-2 text-start">{t("Étudiant")}</th>
            <th className="px-3 py-2 text-end">{t("Frais annuel")}</th>
            <th className="px-3 py-2 text-end">{t("Déjà payé")}</th>
            <th className="px-3 py-2 text-end">{t("Reste")}</th>
            <th className="px-3 py-2 text-start">{t("Statut")}</th>
            <th className="px-3 py-2 text-center">{t("Actions")}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row) => {
            const fullName = `${row.profiles?.first_name || ''} ${row.profiles?.last_name || ''}`.trim();
            const isExpanded = expandedStudent === row.id;
            const isEditingFee = feeEdit?.studentId === row.id;
            return (
              <React.Fragment key={row.id}>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{row.student_number}</td>
                  <td className="px-3 py-2">{fullName}</td>
                  <td className="px-3 py-2 text-end">
                    {isEditingFee ? (
                      <div className="flex justify-end gap-1">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          autoFocus
                          value={feeEdit.value}
                          onChange={(e) => setFeeEdit({ studentId: row.id, value: e.target.value === '' ? '' : Number(e.target.value) })}
                          aria-label={t("Frais annuel de {0}", [fullName])}
                          className="border rounded px-2 py-1 w-28 text-end"
                        />
                        <button onClick={handleSaveFee} className="bg-indigo-600 text-white rounded px-2 text-xs hover:bg-indigo-700">{t("OK")}</button>
                        <button onClick={() => setFeeEdit(null)} className="border rounded px-2 text-xs hover:bg-gray-100">×</button>
                      </div>
                    ) : row.annual_tuition_fee ? (
                      formatFCFA(row.annual_tuition_fee)
                    ) : (
                      <span className="text-gray-500">{t("Non défini")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-end font-semibold text-green-600">{formatFCFA(row.paid)}</td>
                  <td className={`px-3 py-2 text-end font-semibold ${row.remaining > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {row.status === 'no_fee' ? '-' : formatFCFA(row.remaining)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${STATUS[row.status].className}`}>
                      {STATUS[row.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center items-center gap-1">
                      <button
                        onClick={() => openPaymentForm(row)}
                        className="text-green-600 hover:bg-green-50 p-2 rounded"
                        title={t("Encaisser un paiement")}
                        aria-label={t("Encaisser un paiement pour {0}", [fullName])}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setFeeEdit({ studentId: row.id, value: row.annual_tuition_fee ?? '' })}
                        className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                        title={t("Modifier le frais annuel")}
                        aria-label={t("Modifier le frais annuel de {0}", [fullName])}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setExpandedStudent(isExpanded ? '' : row.id)}
                        className="text-gray-700 hover:bg-gray-100 px-2 py-1 rounded text-xs flex items-center gap-1 whitespace-nowrap"
                        aria-expanded={isExpanded}
                        title={t("Voir, modifier ou supprimer les paiements")}
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="rtl:-scale-x-100 w-3 h-3" />}
                        {t("Paiements (")}{row.paymentCount})
                      </button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b">
                    <td colSpan={7} className="px-3 py-4 bg-gray-50">
                      <TuitionHistoryTable
                        studentId={row.id}
                        annualFee={row.annual_tuition_fee}
                        academicYear={academicYear}
                        showStudentName={false}
                        canManage
                        onChanged={loadRows}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderLevelSection = (id: string, title: string, list: StudentRow[]) => {
    const summary = summarize(list);
    // Une recherche ou un filtre doit montrer ses résultats sans clic de plus.
    const isOpen = openLevels.has(id) || search.trim() !== '' || statusFilter !== 'all';
    return (
      <div key={id} className="border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleLevel(id)}
          aria-expanded={isOpen}
          className="w-full flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 md:p-4 text-start hover:bg-gray-50"
        >
          <span className="flex items-center gap-2 font-bold">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="rtl:-scale-x-100 w-4 h-4" />}
            {title}
            <span className="text-xs font-normal text-gray-500">{list.length} {t("étudiant(s)")}</span>
          </span>
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs md:text-sm">
            <span className="text-gray-600">{t("Attendu :")} {formatFCFA(summary.expected)}</span>
            <span className="text-green-600">{t("Payé :")} {formatFCFA(summary.paid)}</span>
            <span className="text-red-600">{t("Reste :")} {formatFCFA(summary.remaining)}</span>
          </span>
        </button>
        {isOpen && <div className="border-t">{renderTable(list)}</div>}
      </div>
    );
  };

  const unenrolledRows = inScope.filter((r) => !r.level_id);

  return (
    <div>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">{t("Total attendu")}</p>
          <p className="text-2xl font-bold text-blue-600">{formatFCFA(totals.expected)}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-800">{t("Total encaissé")}</p>
          <p className="text-2xl font-bold text-green-600">{formatFCFA(totals.paid)}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-sm text-red-800">{t("Reste à encaisser")}</p>
          <p className="text-2xl font-bold text-red-600">{formatFCFA(totals.remaining)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="relative md:col-span-2">
          <Search className="w-5 h-5 absolute start-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Rechercher un étudiant (nom, matricule)...")}
            aria-label={t("Rechercher un étudiant")}
            className="w-full border rounded-lg px-3 py-2 ps-10"
          />
        </div>
        <select
          value={cycleFilter}
          onChange={(e) => setCycleFilter(e.target.value as SchoolCycle | 'all')}
          aria-label={t("Filtrer par cycle")}
          className="border rounded-lg px-3 py-2"
        >
          <option value="all">{t("Tous les cycles")}</option>
          {CYCLES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'all')}
          aria-label={t("Filtrer par statut de paiement")}
          className="border rounded-lg px-3 py-2"
        >
          <option value="all">{t("Tous les statuts")}</option>
          {(Object.keys(STATUS) as PaymentStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS[s].label}</option>
          ))}
        </select>
      </div>

      {loadError && (
        <p className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {t("Impossible de charger les paiements :")} {loadError}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-center py-8">{t("Chargement...")}</p>
      ) : (
        <div className="space-y-6">
          {visibleCycles.map((cycle) => {
            const sections = levelsOfCycle(levels, cycle.id)
              .map((level) => ({ level, list: inScope.filter((r) => r.level_id === level.id) }))
              .filter((s) => s.list.length > 0);
            if (sections.length === 0) return null;
            return (
              <section key={cycle.id}>
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">{cycle.label}</h4>
                <div className="space-y-2">
                  {sections.map(({ level, list }) => renderLevelSection(level.id, level.name, list))}
                </div>
              </section>
            );
          })}

          {unenrolledRows.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">{t("Sans niveau")}</h4>
              {renderLevelSection(UNENROLLED, t("Étudiants à inscrire"), unenrolledRows)}
            </section>
          )}

          {inScope.length === 0 && !loading && (
            <p className="text-center py-8 text-gray-500">{t("Aucun étudiant ne correspond à ces critères")}</p>
          )}
        </div>
      )}

      {collecting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{t("Encaisser un paiement")}</h3>
              <button onClick={() => setCollecting(null)} className="text-3xl hover:text-red-600" aria-label={t("Fermer")}>×</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {collecting.profiles?.first_name} {collecting.profiles?.last_name} ({collecting.student_number})
              {collecting.status !== 'no_fee' && ` • Reste : ${formatFCFA(collecting.remaining)}`}
            </p>
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label htmlFor="payment-month" className="block text-sm font-medium mb-2">{t("Mois payé *")}</label>
                <select
                  id="payment-month"
                  value={paymentForm.month}
                  onChange={(e) => setPaymentForm({ ...paymentForm, month: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                >
                  {ACADEMIC_MONTHS.map((m) => (
                    <option key={m.month} value={m.month}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="payment-amount" className="block text-sm font-medium mb-2">{t("Montant (FCFA) *")}</label>
                  <input
                    id="payment-amount"
                    type="number"
                    min="1"
                    step="1"
                    autoFocus
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="payment-date" className="block text-sm font-medium mb-2">{t("Date *")}</label>
                  <input
                    id="payment-date"
                    type="date"
                    value={paymentForm.date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? t("Enregistrement...") : t("Enregistrer et générer le reçu")}
              </button>
            </form>
          </div>
        </div>
      )}

      {receipt && (
        <ReceiptPrintable
          payment={receipt.payment}
          annualFee={receipt.fee}
          cumulativePaid={receipt.cumulativePaid}
          remainingBalance={receipt.fee - receipt.cumulativePaid}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
};

export default TuitionByLevel;

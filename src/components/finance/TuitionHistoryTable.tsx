import React, { useEffect, useState } from 'react';
import { Check, Edit, Printer, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { ACADEMIC_MONTHS, monthLabel, TuitionPayment } from './financeTypes';
import { formatFCFA } from './financeUtils';
import ReceiptPrintable from './ReceiptPrintable';

interface TuitionHistoryTableProps {
  studentId: string;
  annualFee: number | null | undefined;
  academicYear: string;
  showStudentName?: boolean;
  // Vue administration : modification et suppression des paiements. Le résumé
  // est alors masqué, la ligne de l'étudiant affichant déjà ces montants.
  canManage?: boolean;
  onChanged?: () => void;
}

const TuitionHistoryTable: React.FC<TuitionHistoryTableProps> = ({
  studentId,
  annualFee,
  academicYear,
  showStudentName = true,
  canManage = false,
  onChanged,
}) => {
  const [payments, setPayments] = useState<TuitionPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState<{ payment: TuitionPayment; cumulativePaid: number } | null>(null);
  const [editing, setEditing] = useState<{ id: string; month: number; amount: number | ''; date: string } | null>(null);

  useEffect(() => {
    loadPayments();
  }, [studentId, academicYear]);

  const loadPayments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tuition_fee_payments')
      .select('*, students(student_number, profiles(first_name, last_name), levels(name))')
      .eq('student_id', studentId)
      .eq('academic_year', academicYear)
      .is('voided_at', null)
      .order('payment_date', { ascending: true });

    if (error) console.error('Erreur chargement paiements:', error);
    else setPayments(data || []);
    setLoading(false);
  };

  const fee = annualFee || 0;
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = fee - totalPaid;

  const handlePrint = (index: number) => {
    const cumulativePaid = payments.slice(0, index + 1).reduce((sum, p) => sum + Number(p.amount), 0);
    setPrinting({ payment: payments[index], cumulativePaid });
  };

  const handleSaveEdit = async () => {
    if (!editing || !editing.amount) return;
    // .select() : sans droit d'écriture, le RLS renvoie 0 ligne et aucune erreur.
    const { data, error } = await supabase
      .from('tuition_fee_payments')
      .update({ month: editing.month, amount: editing.amount, payment_date: editing.date })
      .eq('id', editing.id)
      .select('id');

    if (error) {
      alert(`❌ Erreur: ${error.message}`);
      return;
    }
    if (!data?.length) {
      alert("❌ Modification refusée : vous n'avez pas les droits nécessaires.");
      return;
    }
    setEditing(null);
    await loadPayments();
    onChanged?.();
  };

  // Un reçu a pu être remis à la famille : le paiement est annulé (voided_at)
  // plutôt qu'effacé, ce qui le retire de tous les totaux mais garde la trace.
  const handleDelete = async (payment: TuitionPayment) => {
    const label = `${formatFCFA(payment.amount)} — reçu ${payment.receipt_number}`;
    if (!window.confirm(`⚠️ Supprimer ce paiement ?\n\n${label}\n\nIl sera retiré du solde et de tous les totaux.`)) return;

    const { data, error } = await supabase
      .from('tuition_fee_payments')
      .update({ voided_at: new Date().toISOString(), void_reason: "Supprimé par l'administration" })
      .eq('id', payment.id)
      .select('id');

    if (error) {
      alert(`❌ Erreur: ${error.message}`);
      return;
    }
    if (!data?.length) {
      alert("❌ Suppression refusée : vous n'avez pas les droits nécessaires.");
      return;
    }
    await loadPayments();
    onChanged?.();
  };

  return (
    <div>
      {!canManage && (
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">Frais annuel</p>
            <p className="text-2xl font-bold text-blue-600">{formatFCFA(fee)}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-800">Déjà payé</p>
            <p className="text-2xl font-bold text-green-600">{formatFCFA(totalPaid)}</p>
          </div>
          <div className={`p-4 rounded-lg ${remaining > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <p className={`text-sm ${remaining > 0 ? 'text-red-800' : 'text-gray-600'}`}>Reste à payer</p>
            <p className={`text-2xl font-bold ${remaining > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {formatFCFA(Math.max(remaining, 0))}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center py-8">Chargement...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                {showStudentName && <th className="px-3 py-2 text-left">Étudiant</th>}
                <th className="px-3 py-2 text-left">Mois payé</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">N° Reçu</th>
                <th className="px-3 py-2 text-right">Montant</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, idx) => {
                const isEditing = editing?.id === p.id;
                return (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    {showStudentName && (
                      <td className="px-3 py-2">
                        {p.students?.profiles?.first_name} {p.students?.profiles?.last_name}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          value={editing.month}
                          onChange={(e) => setEditing({ ...editing, month: parseInt(e.target.value) })}
                          aria-label="Mois payé"
                          className="border rounded px-2 py-1"
                        >
                          {ACADEMIC_MONTHS.map((m) => (
                            <option key={m.month} value={m.month}>{m.label}</option>
                          ))}
                        </select>
                      ) : (
                        `${monthLabel(p.month)} ${p.academic_year}`
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editing.date}
                          onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                          aria-label="Date du paiement"
                          className="border rounded px-2 py-1"
                        />
                      ) : (
                        new Date(p.payment_date).toLocaleDateString('fr-FR')
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{p.receipt_number}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={editing.amount}
                          onChange={(e) => setEditing({ ...editing, amount: e.target.value === '' ? '' : Number(e.target.value) })}
                          aria-label="Montant"
                          className="border rounded px-2 py-1 w-28 text-right"
                        />
                      ) : (
                        formatFCFA(p.amount)
                      )}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {isEditing ? (
                        <>
                          <button onClick={handleSaveEdit} className="text-green-600 hover:bg-green-50 p-1 rounded" title="Enregistrer" aria-label="Enregistrer">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditing(null)} className="text-gray-500 hover:bg-gray-100 p-1 rounded" title="Annuler" aria-label="Annuler">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handlePrint(idx)} className="text-blue-600 hover:bg-blue-50 p-1 rounded" title="Réimprimer" aria-label={`Réimprimer le reçu ${p.receipt_number}`}>
                            <Printer className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => setEditing({ id: p.id, month: p.month, amount: Number(p.amount), date: p.payment_date })}
                                className="text-blue-600 hover:bg-blue-50 p-1 rounded"
                                title="Modifier"
                                aria-label={`Modifier le paiement ${p.receipt_number}`}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(p)}
                                className="text-red-600 hover:bg-red-50 p-1 rounded"
                                title="Supprimer"
                                aria-label={`Supprimer le paiement ${p.receipt_number}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={showStudentName ? 6 : 5} className="text-center text-gray-500 py-6">
                    Aucun paiement enregistré
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {printing && (
        <ReceiptPrintable
          payment={printing.payment}
          annualFee={fee}
          cumulativePaid={printing.cumulativePaid}
          remainingBalance={fee - printing.cumulativePaid}
          onClose={() => setPrinting(null)}
        />
      )}
    </div>
  );
};

export default TuitionHistoryTable;

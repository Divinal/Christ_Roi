import React, { useEffect, useState } from 'react';
import { Printer, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { monthLabel, TeacherPayslip } from './financeTypes';
import { formatFCFA } from './financeUtils';
import PayslipPrintable from './PayslipPrintable';
import { confirmDialog, notify } from '../ui/feedback';
import { t, locale } from '../../i18n';

interface PayslipHistoryTableProps {
  teacherId: string;
  academicYear: string;
  showTeacherName?: boolean;
  // Administration : un bulletin peut être supprimé (annulé, il va à la corbeille).
  canDelete?: boolean;
}

const PayslipHistoryTable: React.FC<PayslipHistoryTableProps> = ({
  teacherId,
  academicYear,
  showTeacherName = true,
  canDelete = false,
}) => {
  const [payslips, setPayslips] = useState<TeacherPayslip[]>([]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState<TeacherPayslip | null>(null);

  useEffect(() => {
    loadPayslips();
  }, [teacherId, academicYear]);

  const loadPayslips = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('teacher_payslips')
      .select('*, teachers(teacher_number, profiles(first_name, last_name))')
      .eq('teacher_id', teacherId)
      .eq('academic_year', academicYear)
      .is('voided_at', null)
      .order('payment_date', { ascending: false });

    if (error) console.error('Erreur chargement bulletins de paie:', error);
    else setPayslips(data || []);
    setLoading(false);
  };

  // Comme un paiement de scolarité : annulé (voided_at) plutôt qu'effacé, il quitte
  // les totaux et va à la corbeille, d'où il peut être restauré pendant 30 jours.
  const handleDelete = async (payslip: TeacherPayslip) => {
    const label = t("{0} — bulletin {1}", [formatFCFA(payslip.gross_amount), payslip.payslip_number]);
    if (!await confirmDialog(t("⚠️ Supprimer ce bulletin de paie ?\n\n{0}\n\nIl sera retiré des totaux et placé dans la corbeille pendant 30 jours.", [label]))) return;

    const { data, error } = await supabase
      .from('teacher_payslips')
      .update({ voided_at: new Date().toISOString(), void_reason: "Supprimé par l'administration" })
      .eq('id', payslip.id)
      .select('id');
    if (error) {
      notify(`❌ Erreur: ${error.message}`);
      return;
    }
    if (!data?.length) {
      notify(t("❌ Suppression refusée : vous n'avez pas les droits nécessaires."));
      return;
    }
    notify(t("✅ Bulletin de paie mis à la corbeille"));
    await loadPayslips();
  };

  const totalPaid = payslips.reduce((sum, p) => sum + Number(p.gross_amount), 0);

  if (loading) return <p className="text-center py-8">{t("Chargement...")}</p>;

  return (
    <div>
      <div className="bg-green-50 p-4 rounded-lg mb-6 inline-block">
        <p className="text-sm text-green-800">{t("Total perçu (")}{academicYear})</p>
        <p className="text-2xl font-bold text-green-600">{formatFCFA(totalPaid)}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {showTeacherName && <th className="px-3 py-2 text-start">{t("Enseignant")}</th>}
              <th className="px-3 py-2 text-start">{t("Période")}</th>
              <th className="px-3 py-2 text-start">{t("Heures")}</th>
              <th className="px-3 py-2 text-start">{t("Taux")}</th>
              <th className="px-3 py-2 text-start">{t("Date")}</th>
              <th className="px-3 py-2 text-end">{t("Montant brut")}</th>
              <th className="px-3 py-2 text-center">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {payslips.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                {showTeacherName && (
                  <td className="px-3 py-2">
                    {p.teachers?.profiles?.first_name} {p.teachers?.profiles?.last_name}
                  </td>
                )}
                <td className="px-3 py-2">{monthLabel(p.month)} {p.academic_year}</td>
                <td className="px-3 py-2">{p.hours_worked} h</td>
                <td className="px-3 py-2">{formatFCFA(p.hourly_rate)}</td>
                <td className="px-3 py-2">{new Date(p.payment_date).toLocaleDateString(locale())}</td>
                <td className="px-3 py-2 text-end font-semibold">{formatFCFA(p.gross_amount)}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => setPrinting(p)} className="text-blue-600 hover:bg-blue-50 p-1 rounded" title={t("Réimprimer")}>
                    <Printer className="w-4 h-4" />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(p)}
                      className="text-red-600 hover:bg-red-50 p-1 rounded"
                      title={t("Supprimer")}
                      aria-label={t("Supprimer le bulletin {0}", [p.payslip_number])}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {payslips.length === 0 && (
              <tr>
                <td colSpan={showTeacherName ? 7 : 6} className="text-center text-gray-500 py-6">
                  {t("Aucun bulletin de paie enregistré")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {printing && <PayslipPrintable payslip={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
};

export default PayslipHistoryTable;

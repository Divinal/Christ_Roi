import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { monthLabel, TuitionPayment } from './financeTypes';
import { formatFCFA } from './financeUtils';
import ReceiptPrintable from './ReceiptPrintable';

interface TuitionHistoryTableProps {
  studentId: string;
  annualFee: number | null | undefined;
  academicYear: string;
  showStudentName?: boolean;
}

const TuitionHistoryTable: React.FC<TuitionHistoryTableProps> = ({
  studentId,
  annualFee,
  academicYear,
  showStudentName = true,
}) => {
  const [payments, setPayments] = useState<TuitionPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState<{ payment: TuitionPayment; cumulativePaid: number } | null>(null);

  useEffect(() => {
    loadPayments();
  }, [studentId, academicYear]);

  const loadPayments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tuition_fee_payments')
      .select('*, students(student_number, users(first_name, last_name), classes(name))')
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

  return (
    <div>
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
              {payments.map((p, idx) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  {showStudentName && (
                    <td className="px-3 py-2">
                      {p.students?.users?.first_name} {p.students?.users?.last_name}
                    </td>
                  )}
                  <td className="px-3 py-2">{monthLabel(p.month)} {p.academic_year}</td>
                  <td className="px-3 py-2">{new Date(p.payment_date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-3 py-2 text-gray-500">{p.receipt_number}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatFCFA(p.amount)}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => handlePrint(idx)} className="text-blue-600 hover:bg-blue-50 p-1 rounded" title="Réimprimer">
                      <Printer className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
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

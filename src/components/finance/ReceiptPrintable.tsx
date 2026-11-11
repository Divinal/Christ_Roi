import React from 'react';
import { X } from 'lucide-react';
import { monthLabel, TuitionPayment } from './financeTypes';
import { formatFCFA } from './financeUtils';
import { t, locale } from '../../i18n';

interface ReceiptPrintableProps {
  payment: TuitionPayment;
  annualFee: number;
  cumulativePaid: number;
  remainingBalance: number;
  onClose: () => void;
}

const ReceiptPrintable: React.FC<ReceiptPrintableProps> = ({
  payment,
  annualFee,
  cumulativePaid,
  remainingBalance,
  onClose,
}) => {
  const studentName = `${payment.students?.profiles?.first_name || ''} ${payment.students?.profiles?.last_name || ''}`.trim();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 end-4 text-gray-400 hover:text-gray-600 no-print">
          <X className="w-6 h-6" />
        </button>

        <div id="printable-area" className="space-y-4">
          <h2 className="text-xl font-bold text-center">{t("Reçu de Frais de Scolarité")}</h2>
          <p className="text-center text-sm text-gray-500">N° {payment.receipt_number}</p>

          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Étudiant")}</span>
              <span className="font-medium">{studentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Matricule")}</span>
              <span className="font-medium">{payment.students?.student_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Niveau")}</span>
              <span className="font-medium">{payment.students?.levels?.name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Mois payé")}</span>
              <span className="font-medium">{monthLabel(payment.month)} {payment.academic_year}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Date de paiement")}</span>
              <span className="font-medium">{new Date(payment.payment_date).toLocaleDateString(locale())}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>{t("Montant payé")}</span>
              <span>{formatFCFA(payment.amount)}</span>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2 text-sm bg-gray-50 -mx-6 px-6 py-4">
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Frais annuel")}</span>
              <span className="font-medium">{formatFCFA(annualFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Sommes déjà payées (cumul)")}</span>
              <span className="font-medium">{formatFCFA(cumulativePaid)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>{t("Reste annuel à payer")}</span>
              <span className={remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatFCFA(Math.max(remainingBalance, 0))}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="no-print w-full mt-6 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
        >
          {t("Imprimer")}
        </button>
      </div>
    </div>
  );
};

export default ReceiptPrintable;

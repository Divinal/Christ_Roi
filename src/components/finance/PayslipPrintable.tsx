import React from 'react';
import { X } from 'lucide-react';
import { monthLabel, TeacherPayslip } from './financeTypes';
import { formatFCFA } from './financeUtils';
import { t, locale } from '../../i18n';

interface PayslipPrintableProps {
  payslip: TeacherPayslip;
  onClose: () => void;
}

const PayslipPrintable: React.FC<PayslipPrintableProps> = ({ payslip, onClose }) => {
  const teacherName = `${payslip.teachers?.profiles?.first_name || ''} ${payslip.teachers?.profiles?.last_name || ''}`.trim();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 end-4 text-gray-400 hover:text-gray-600 no-print">
          <X className="w-6 h-6" />
        </button>

        <div id="printable-area" className="space-y-4">
          <h2 className="text-xl font-bold text-center">{t("Bulletin de Paie")}</h2>
          <p className="text-center text-sm text-gray-500">N° {payslip.payslip_number}</p>

          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Enseignant")}</span>
              <span className="font-medium">{teacherName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Matricule")}</span>
              <span className="font-medium">{payslip.teachers?.teacher_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Période")}</span>
              <span className="font-medium">{monthLabel(payslip.month)} {payslip.academic_year}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Date de paiement")}</span>
              <span className="font-medium">{new Date(payslip.payment_date).toLocaleDateString(locale())}</span>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2 text-sm bg-gray-50 -mx-6 px-6 py-4">
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Heures effectuées")}</span>
              <span className="font-medium">{payslip.hours_worked} h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Taux horaire")}</span>
              <span className="font-medium">{formatFCFA(payslip.hourly_rate)} / h</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>{t("Montant brut")}</span>
              <span>{formatFCFA(payslip.gross_amount)}</span>
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

export default PayslipPrintable;

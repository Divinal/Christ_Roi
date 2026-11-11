import React from 'react';
import { X } from 'lucide-react';
import { FinancialTransaction, monthLabel } from './financeTypes';
import { formatFCFA } from './financeUtils';
import { t, locale } from '../../i18n';

interface VoucherPrintableProps {
  transaction: FinancialTransaction;
  categoryName: string;
  onClose: () => void;
}

const VoucherPrintable: React.FC<VoucherPrintableProps> = ({ transaction, categoryName, onClose }) => {
  const isExpense = transaction.financial_categories?.kind !== 'revenue';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 end-4 text-gray-400 hover:text-gray-600 no-print">
          <X className="w-6 h-6" />
        </button>

        <div id="printable-area" className="space-y-4">
          <h2 className="text-xl font-bold text-center">
            {isExpense ? t("Bon de dépense") : t("Justificatif de recette")}
          </h2>
          <p className="text-center text-sm text-gray-500">N° {transaction.id.slice(0, 8).toUpperCase()}</p>

          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Catégorie")}</span>
              <span className="font-medium">{categoryName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Période")}</span>
              <span className="font-medium">
                {monthLabel(transaction.month)} {transaction.academic_year}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("Date")}</span>
              <span className="font-medium">
                {new Date(transaction.transaction_date).toLocaleDateString(locale())}
              </span>
            </div>
            {transaction.description && (
              <div className="flex justify-between">
                <span className="text-gray-600">{t("Description")}</span>
                <span className="font-medium text-end">{transaction.description}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>{t("Montant")}</span>
              <span>{formatFCFA(transaction.amount)}</span>
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

export default VoucherPrintable;

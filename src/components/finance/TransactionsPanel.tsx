import React, { useEffect, useState } from 'react';
import { Printer, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { ACADEMIC_MONTHS, FinancialCategory, FinancialKind, FinancialTransaction, monthLabel } from './financeTypes';
import { formatFCFA } from './financeUtils';
import VoucherPrintable from './VoucherPrintable';
import { confirmDialog, notify } from '../ui/feedback';
import { t as tr, locale } from '../../i18n';

interface TransactionsPanelProps {
  kind: FinancialKind;
  academicYear: string;
  categories: FinancialCategory[];
}

const currentAcademicMonth = (): number => {
  const m = new Date().getMonth() + 1;
  return m;
};

const TransactionsPanel: React.FC<TransactionsPanelProps> = ({ kind, academicYear, categories }) => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [month, setMonth] = useState<number>(currentAcademicMonth());
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [printing, setPrinting] = useState<FinancialTransaction | null>(null);

  const relevantCategories = categories.filter((c) => c.kind === kind && c.is_active && !c.is_system);

  useEffect(() => {
    loadTransactions();
  }, [academicYear, kind]);

  const loadTransactions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('financial_transactions')
      .select('*, financial_categories(name, kind)')
      .eq('academic_year', academicYear)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Erreur chargement transactions:', error);
    } else {
      setTransactions((data || []).filter((t: any) => t.financial_categories?.kind === kind));
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !amount) {
      notify(tr("Veuillez sélectionner une catégorie et un montant"));
      return;
    }

    const { error } = await supabase.from('financial_transactions').insert({
      category_id: categoryId,
      month,
      academic_year: academicYear,
      amount,
      transaction_date: transactionDate,
      description: description || null,
    });

    if (error) {
      notify(`❌ Erreur: ${error.message}`);
    } else {
      setAmount('');
      setDescription('');
      loadTransactions();
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDialog(tr("Supprimer cette opération ?"))) return;
    const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
    if (error) notify(`❌ Erreur: ${error.message}`);
    else loadTransactions();
  };

  const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-5 gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="border rounded px-3 py-2"
          required
        >
          <option value="">{tr("Catégorie...")}</option>
          {relevantCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="border rounded px-3 py-2">
          {ACADEMIC_MONTHS.map((m) => (
            <option key={m.month} value={m.month}>{m.label}</option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder={tr("Montant")}
          value={amount}
          onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : '')}
          className="border rounded px-3 py-2"
          required
        />
        <input
          type="date"
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <input
          type="text"
          placeholder={tr("Description (optionnel)")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button type="submit" className="md:col-span-5 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">
          {tr("Enregistrer")}
        </button>
      </form>

      {loading ? (
        <p className="text-center py-8">{tr("Chargement...")}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-start">{tr("Catégorie")}</th>
                  <th className="px-3 py-2 text-start">{tr("Période")}</th>
                  <th className="px-3 py-2 text-start">{tr("Date")}</th>
                  <th className="px-3 py-2 text-start">{tr("Description")}</th>
                  <th className="px-3 py-2 text-end">{tr("Montant")}</th>
                  <th className="px-3 py-2 text-center">{tr("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{t.financial_categories?.name}</td>
                    <td className="px-3 py-2">{monthLabel(t.month)} {t.academic_year}</td>
                    <td className="px-3 py-2">{new Date(t.transaction_date).toLocaleDateString(locale())}</td>
                    <td className="px-3 py-2 text-gray-600">{t.description || '-'}</td>
                    <td className="px-3 py-2 text-end font-semibold">{formatFCFA(t.amount)}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => setPrinting(t)} className="text-blue-600 hover:bg-blue-50 p-1 rounded" title={tr("Imprimer")}>
                          <Printer className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:bg-red-50 p-1 rounded" title={tr("Supprimer")}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-500 py-6">{tr("Aucune opération enregistrée")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-end font-bold mt-3">{tr("Total")} {kind === 'expense' ? tr("dépenses") : 'recettes'} : {formatFCFA(total)}</p>
        </>
      )}

      {printing && (
        <VoucherPrintable
          transaction={printing}
          categoryName={printing.financial_categories?.name || ''}
          onClose={() => setPrinting(null)}
        />
      )}
    </div>
  );
};

export default TransactionsPanel;

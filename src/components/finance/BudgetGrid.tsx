import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ACADEMIC_MONTHS, FinancialCategory, FinancialKind } from './financeTypes';
import { formatFCFA } from './financeUtils';
import { notify } from '../ui/feedback';

interface BudgetGridProps {
  kind: FinancialKind;
  academicYear: string;
  categories: FinancialCategory[];
}

type AmountsByCategory = Record<string, Record<number, number>>;

const BudgetGrid: React.FC<BudgetGridProps> = ({ kind, academicYear, categories }) => {
  const [amounts, setAmounts] = useState<AmountsByCategory>({});
  const [loading, setLoading] = useState(false);

  const relevantCategories = categories.filter((c) => c.kind === kind && c.is_active);

  useEffect(() => {
    loadBudgets();
  }, [academicYear, categories]);

  const loadBudgets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('financial_budgets')
      .select('category_id, month, estimated_amount')
      .eq('academic_year', academicYear);

    if (error) {
      console.error('Erreur chargement budget:', error);
    } else {
      const grouped: AmountsByCategory = {};
      (data || []).forEach((row) => {
        if (!grouped[row.category_id]) grouped[row.category_id] = {};
        grouped[row.category_id][row.month] = Number(row.estimated_amount);
      });
      setAmounts(grouped);
    }
    setLoading(false);
  };

  const saveCell = async (categoryId: string, month: number, value: number) => {
    const { error } = await supabase
      .from('financial_budgets')
      .upsert(
        { category_id: categoryId, month, academic_year: academicYear, estimated_amount: value },
        { onConflict: 'category_id,month,academic_year' }
      );
    if (error) {
      notify(`❌ Erreur d'enregistrement: ${error.message}`);
    }
  };

  const updateLocal = (categoryId: string, month: number, value: number) => {
    setAmounts((prev) => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [month]: value },
    }));
  };

  const rowTotal = (categoryId: string) =>
    ACADEMIC_MONTHS.reduce((sum, m) => sum + (amounts[categoryId]?.[m.month] || 0), 0);

  const columnTotal = (month: number) =>
    relevantCategories.reduce((sum, c) => sum + (amounts[c.id]?.[month] || 0), 0);

  const grandTotal = relevantCategories.reduce((sum, c) => sum + rowTotal(c.id), 0);

  if (loading) return <p className="text-center py-8">Chargement...</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-3 py-2 text-left sticky left-0 bg-gray-100">Catégorie</th>
            {ACADEMIC_MONTHS.map((m) => (
              <th key={m.month} className="border px-2 py-2 text-center whitespace-nowrap">
                {m.label}
              </th>
            ))}
            <th className="border px-3 py-2 text-center font-bold">Total annuel</th>
          </tr>
        </thead>
        <tbody>
          {relevantCategories.map((cat) => (
            <tr key={cat.id} className="hover:bg-gray-50">
              <td className="border px-3 py-2 font-medium sticky left-0 bg-white">{cat.name}</td>
              {ACADEMIC_MONTHS.map((m) => (
                <td key={m.month} className="border px-1 py-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amounts[cat.id]?.[m.month] ?? ''}
                    onChange={(e) => updateLocal(cat.id, m.month, parseFloat(e.target.value) || 0)}
                    onBlur={(e) => saveCell(cat.id, m.month, parseFloat(e.target.value) || 0)}
                    className="w-24 border rounded px-2 py-1 text-right"
                  />
                </td>
              ))}
              <td className="border px-3 py-2 text-right font-semibold">{formatFCFA(rowTotal(cat.id))}</td>
            </tr>
          ))}
          {relevantCategories.length === 0 && (
            <tr>
              <td colSpan={ACADEMIC_MONTHS.length + 2} className="text-center text-gray-500 py-6">
                Aucune catégorie {kind === 'expense' ? 'de dépense' : 'de recette'} pour l'instant
              </td>
            </tr>
          )}
        </tbody>
        {relevantCategories.length > 0 && (
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td className="border px-3 py-2 sticky left-0 bg-gray-100">Total mensuel</td>
              {ACADEMIC_MONTHS.map((m) => (
                <td key={m.month} className="border px-2 py-2 text-center">
                  {formatFCFA(columnTotal(m.month))}
                </td>
              ))}
              <td className="border px-3 py-2 text-right">{formatFCFA(grandTotal)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default BudgetGrid;

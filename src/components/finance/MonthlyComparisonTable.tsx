import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ACADEMIC_MONTHS } from './financeTypes';
import { formatFCFA } from './financeUtils';

interface MonthRow {
  month: number;
  prevRevenue: number;
  realRevenue: number;
  prevExpense: number;
  realExpense: number;
}

interface MonthlyComparisonTableProps {
  academicYear: string;
}

const emptyRows = (): Record<number, MonthRow> => {
  const rows: Record<number, MonthRow> = {};
  ACADEMIC_MONTHS.forEach((m) => {
    rows[m.month] = { month: m.month, prevRevenue: 0, realRevenue: 0, prevExpense: 0, realExpense: 0 };
  });
  return rows;
};

const MonthlyComparisonTable: React.FC<MonthlyComparisonTableProps> = ({ academicYear }) => {
  const [rows, setRows] = useState<Record<number, MonthRow>>(emptyRows());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [academicYear]);

  const loadData = async () => {
    setLoading(true);
    const next = emptyRows();

    const [budgetsRes, transactionsRes, tuitionRes, payslipsRes] = await Promise.all([
      supabase
        .from('financial_budgets')
        .select('month, estimated_amount, financial_categories(kind)')
        .eq('academic_year', academicYear),
      supabase
        .from('financial_transactions')
        .select('month, amount, financial_categories(kind)')
        .eq('academic_year', academicYear),
      supabase
        .from('tuition_fee_payments')
        .select('month, amount')
        .eq('academic_year', academicYear)
        .is('voided_at', null),
      supabase
        .from('teacher_payslips')
        .select('month, gross_amount')
        .eq('academic_year', academicYear)
        .is('voided_at', null),
    ]);

    (budgetsRes.data || []).forEach((row: any) => {
      const kind = row.financial_categories?.kind;
      if (!next[row.month]) return;
      if (kind === 'revenue') next[row.month].prevRevenue += Number(row.estimated_amount);
      if (kind === 'expense') next[row.month].prevExpense += Number(row.estimated_amount);
    });

    (transactionsRes.data || []).forEach((row: any) => {
      const kind = row.financial_categories?.kind;
      if (!next[row.month]) return;
      if (kind === 'revenue') next[row.month].realRevenue += Number(row.amount);
      if (kind === 'expense') next[row.month].realExpense += Number(row.amount);
    });

    (tuitionRes.data || []).forEach((row: any) => {
      if (next[row.month]) next[row.month].realRevenue += Number(row.amount);
    });

    (payslipsRes.data || []).forEach((row: any) => {
      if (next[row.month]) next[row.month].realExpense += Number(row.gross_amount);
    });

    setRows(next);
    setLoading(false);
  };

  if (loading) return <p className="text-center py-8">Chargement...</p>;

  const ordered = ACADEMIC_MONTHS.map((m) => rows[m.month]);
  const totals = ordered.reduce(
    (acc, r) => ({
      prevRevenue: acc.prevRevenue + r.prevRevenue,
      realRevenue: acc.realRevenue + r.realRevenue,
      prevExpense: acc.prevExpense + r.prevExpense,
      realExpense: acc.realExpense + r.realExpense,
    }),
    { prevRevenue: 0, realRevenue: 0, prevExpense: 0, realExpense: 0 }
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-3 py-2 text-left">Mois</th>
            <th className="px-3 py-2 text-right">Prév. Recettes</th>
            <th className="px-3 py-2 text-right">Réal. Recettes</th>
            <th className="px-3 py-2 text-right">Prév. Dépenses</th>
            <th className="px-3 py-2 text-right">Réal. Dépenses</th>
            <th className="px-3 py-2 text-right">Solde Prév.</th>
            <th className="px-3 py-2 text-right">Solde Réal.</th>
          </tr>
        </thead>
        <tbody>
          {ACADEMIC_MONTHS.map((m, idx) => {
            const r = ordered[idx];
            const solPrev = r.prevRevenue - r.prevExpense;
            const solReal = r.realRevenue - r.realExpense;
            return (
              <tr key={m.month} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{m.label}</td>
                <td className="px-3 py-2 text-right">{formatFCFA(r.prevRevenue)}</td>
                <td className="px-3 py-2 text-right">{formatFCFA(r.realRevenue)}</td>
                <td className="px-3 py-2 text-right">{formatFCFA(r.prevExpense)}</td>
                <td className="px-3 py-2 text-right">{formatFCFA(r.realExpense)}</td>
                <td className={`px-3 py-2 text-right font-medium ${solPrev >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatFCFA(solPrev)}
                </td>
                <td className={`px-3 py-2 text-right font-medium ${solReal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatFCFA(solReal)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 font-bold">
            <td className="px-3 py-2">Total annuel</td>
            <td className="px-3 py-2 text-right">{formatFCFA(totals.prevRevenue)}</td>
            <td className="px-3 py-2 text-right">{formatFCFA(totals.realRevenue)}</td>
            <td className="px-3 py-2 text-right">{formatFCFA(totals.prevExpense)}</td>
            <td className="px-3 py-2 text-right">{formatFCFA(totals.realExpense)}</td>
            <td className="px-3 py-2 text-right">
              {formatFCFA(totals.prevRevenue - totals.prevExpense)}
            </td>
            <td className="px-3 py-2 text-right">
              {formatFCFA(totals.realRevenue - totals.realExpense)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default MonthlyComparisonTable;

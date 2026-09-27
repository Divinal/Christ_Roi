import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { FinancialCategory } from './financeTypes';
import BudgetGrid from './BudgetGrid';
import CategoryQuickAdd from './CategoryQuickAdd';
import TransactionsPanel from './TransactionsPanel';
import TuitionPaymentFlow from './TuitionPaymentFlow';
import PayrollFlow from './PayrollFlow';
import MonthlyComparisonTable from './MonthlyComparisonTable';

interface ClassOption {
  id: string;
  name: string;
  academic_year: string;
}

interface TeacherOption {
  id: string;
  teacher_number: string;
  hourly_rate: number | null;
  profiles?: { first_name: string; last_name: string };
}

const FinanceManagement: React.FC = () => {
  const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>([]);
  const [financeSubTab, setFinanceSubTab] = useState<'budget' | 'revenue' | 'expense' | 'comparison'>('budget');
  const [financeAcademicYear, setFinanceAcademicYear] = useState<string>('2026-2027');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  useEffect(() => {
    loadFinancialCategories();
    loadClasses();
    loadTeachers();
  }, []);

  const loadFinancialCategories = async () => {
    const { data, error } = await supabase
      .from('financial_categories')
      .select('*')
      .order('kind', { ascending: true })
      .order('name', { ascending: true });

    if (error) console.error('Erreur chargement catégories financières:', error);
    else setFinancialCategories(data || []);
  };

  const loadClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, academic_year')
      .order('name', { ascending: true });

    if (error) console.error('Erreur chargement classes:', error);
    else setClasses(data || []);
  };

  const loadTeachers = async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, teacher_number, hourly_rate, profiles(first_name, last_name)')
      .order('teacher_number', { ascending: true });

    if (error) console.error('Erreur chargement enseignants:', error);
    else setTeachers((data as unknown as TeacherOption[]) || []);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h2 className="text-xl md:text-2xl font-bold">Gestion Financière</h2>
        <select
          value={financeAcademicYear}
          onChange={(e) => setFinanceAcademicYear(e.target.value)}
          className="border rounded px-3 py-2"
        >
          {Array.from(new Set([...classes.map((c) => c.academic_year), '2026-2027'])).map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto border-b">
        {[
          { id: 'budget', label: 'Budget Prévisionnel' },
          { id: 'revenue', label: 'Recettes' },
          { id: 'expense', label: 'Dépenses' },
          { id: 'comparison', label: 'Comparaison' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFinanceSubTab(tab.id as typeof financeSubTab)}
            className={`px-4 py-2 font-medium whitespace-nowrap border-b-2 transition ${
              financeSubTab === tab.id
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {financeSubTab === 'budget' && (
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-bold mb-3">Recettes prévisionnelles</h3>
            <CategoryQuickAdd kind="revenue" categories={financialCategories} onChanged={loadFinancialCategories} />
            <BudgetGrid kind="revenue" academicYear={financeAcademicYear} categories={financialCategories} />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3">Dépenses prévisionnelles</h3>
            <CategoryQuickAdd kind="expense" categories={financialCategories} onChanged={loadFinancialCategories} />
            <BudgetGrid kind="expense" academicYear={financeAcademicYear} categories={financialCategories} />
          </div>
        </div>
      )}

      {financeSubTab === 'revenue' && (
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-bold mb-3">Frais de scolarité</h3>
            <TuitionPaymentFlow classes={classes} academicYear={financeAcademicYear} />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3">Autres recettes (subventions, etc.)</h3>
            <TransactionsPanel kind="revenue" academicYear={financeAcademicYear} categories={financialCategories} />
          </div>
        </div>
      )}

      {financeSubTab === 'expense' && (
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-bold mb-3">Paie des enseignants</h3>
            <PayrollFlow teachers={teachers} academicYear={financeAcademicYear} onTeacherRateUpdated={loadTeachers} />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3">Autres dépenses (loyer, déplacements, etc.)</h3>
            <TransactionsPanel kind="expense" academicYear={financeAcademicYear} categories={financialCategories} />
          </div>
        </div>
      )}

      {financeSubTab === 'comparison' && (
        <MonthlyComparisonTable academicYear={financeAcademicYear} />
      )}
    </div>
  );
};

export default FinanceManagement;

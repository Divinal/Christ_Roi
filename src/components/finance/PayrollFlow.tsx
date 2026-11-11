import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ACADEMIC_MONTHS } from './financeTypes';
import { generatePayslipNumber } from './financeUtils';
import PayslipHistoryTable from './PayslipHistoryTable';
import PayslipPrintable from './PayslipPrintable';
import { notify } from '../ui/feedback';
import { t as tr, locale } from '../../i18n';

interface TeacherOption {
  id: string;
  teacher_number: string;
  hourly_rate?: number | null;
  profiles?: { first_name: string; last_name: string };
}

interface PayrollFlowProps {
  teachers: TeacherOption[];
  academicYear: string;
  onTeacherRateUpdated?: () => void;
}

const currentAcademicMonth = (): number => new Date().getMonth() + 1;

const PayrollFlow: React.FC<PayrollFlowProps> = ({ teachers, academicYear, onTeacherRateUpdated }) => {
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [month, setMonth] = useState<number>(currentAcademicMonth());
  const [hours, setHours] = useState<number | ''>('');
  const [hourlyRate, setHourlyRate] = useState<number | ''>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [justPrinted, setJustPrinted] = useState<any | null>(null);

  const teacher = teachers.find((t) => t.id === selectedTeacher);

  const handleSelectTeacher = (id: string) => {
    setSelectedTeacher(id);
    const t = teachers.find((x) => x.id === id);
    setHourlyRate(t?.hourly_rate || '');
  };

  const grossAmount = hours && hourlyRate ? Number(hours) * Number(hourlyRate) : 0;

  const handleSaveDefaultRate = async () => {
    if (!selectedTeacher || !hourlyRate) return;
    const { error } = await supabase
      .from('teachers')
      .update({ hourly_rate: hourlyRate })
      .eq('id', selectedTeacher);

    if (error) notify(`❌ Erreur: ${error.message}`);
    else onTeacherRateUpdated?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher || !hours || !hourlyRate) {
      notify(tr("Veuillez sélectionner un enseignant, les heures et le taux horaire"));
      return;
    }

    const payslipNumber = generatePayslipNumber(academicYear, month);
    const { data, error } = await supabase
      .from('teacher_payslips')
      .insert({
        teacher_id: selectedTeacher,
        month,
        academic_year: academicYear,
        hours_worked: hours,
        hourly_rate: hourlyRate,
        gross_amount: grossAmount,
        payslip_number: payslipNumber,
      })
      .select('*, teachers(teacher_number, profiles(first_name, last_name))')
      .single();

    if (error) {
      notify(`❌ Erreur: ${error.message}`);
      return;
    }

    setHours('');
    setRefreshKey((k) => k + 1);
    setJustPrinted(data);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-5 gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
        <select value={selectedTeacher} onChange={(e) => handleSelectTeacher(e.target.value)} className="border rounded px-3 py-2" required>
          <option value="">{tr("Enseignant...")}</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.profiles?.first_name} {t.profiles?.last_name} ({t.teacher_number})
            </option>
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
          step="0.5"
          placeholder={tr("Heures effectuées")}
          value={hours}
          onChange={(e) => setHours(e.target.value ? parseFloat(e.target.value) : '')}
          className="border rounded px-3 py-2"
          required
        />
        <div className="flex gap-1">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={tr("Taux horaire (FCFA)")}
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value ? parseFloat(e.target.value) : '')}
            className="border rounded px-3 py-2 w-full"
            required
          />
          {selectedTeacher && hourlyRate !== teacher?.hourly_rate && (
            <button
              type="button"
              onClick={handleSaveDefaultRate}
              title={tr("Enregistrer comme taux par défaut de cet enseignant")}
              className="text-xs bg-gray-200 hover:bg-gray-300 rounded px-2"
            >
              {tr("Définir")}
            </button>
          )}
        </div>
        <div className="flex items-center px-3 py-2 bg-white border rounded text-sm font-semibold">
          {tr("Brut :")} {grossAmount.toLocaleString(locale())} {tr("FCFA")}
        </div>
        <button type="submit" className="md:col-span-5 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">
          {tr("Enregistrer le paiement et générer le bulletin")}
        </button>
      </form>

      {selectedTeacher && (
        <PayslipHistoryTable key={refreshKey} teacherId={selectedTeacher} academicYear={academicYear} showTeacherName={false} />
      )}

      {justPrinted && <PayslipPrintable payslip={justPrinted} onClose={() => setJustPrinted(null)} />}
    </div>
  );
};

export default PayrollFlow;

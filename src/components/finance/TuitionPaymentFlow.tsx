import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ACADEMIC_MONTHS } from './financeTypes';
import { generateReceiptNumber } from './financeUtils';
import TuitionHistoryTable from './TuitionHistoryTable';
import ReceiptPrintable from './ReceiptPrintable';

interface ClassOption {
  id: string;
  name: string;
}

interface RosterStudent {
  id: string;
  student_number: string;
  annual_tuition_fee: number | null;
  profiles?: { first_name: string; last_name: string };
}

interface TuitionPaymentFlowProps {
  classes: ClassOption[];
  academicYear: string;
}

const currentAcademicMonth = (): number => new Date().getMonth() + 1;

const TuitionPaymentFlow: React.FC<TuitionPaymentFlowProps> = ({ classes, academicYear }) => {
  const [selectedClass, setSelectedClass] = useState('');
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [month, setMonth] = useState<number>(currentAcademicMonth());
  const [amount, setAmount] = useState<number | ''>('');
  const [feeInput, setFeeInput] = useState<number | ''>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [justPrinted, setJustPrinted] = useState<any | null>(null);

  useEffect(() => {
    setSelectedStudent('');
    if (selectedClass) loadRoster(selectedClass);
    else setRoster([]);
  }, [selectedClass, academicYear]);

  const handleSelectStudent = (id: string) => {
    setSelectedStudent(id);
    const s = roster.find((x) => x.id === id);
    setFeeInput(s?.annual_tuition_fee ?? '');
  };

  const handleSaveFee = async () => {
    if (!selectedStudent || feeInput === '') return;
    const { error } = await supabase
      .from('students')
      .update({ annual_tuition_fee: feeInput })
      .eq('id', selectedStudent);

    if (error) {
      alert(`❌ Erreur: ${error.message}`);
    } else {
      setRoster((prev) => prev.map((s) => (s.id === selectedStudent ? { ...s, annual_tuition_fee: Number(feeInput) } : s)));
    }
  };

  const loadRoster = async (classId: string) => {
    const { data, error } = await supabase
      .from('student_classes')
      .select('students(id, student_number, annual_tuition_fee, profiles(first_name, last_name))')
      .eq('class_id', classId)
      .eq('academic_year', academicYear);

    if (error) {
      console.error('Erreur chargement étudiants de la classe:', error);
      setRoster([]);
    } else {
      setRoster((data || []).map((row: any) => row.students).filter(Boolean));
    }
  };

  const student = roster.find((s) => s.id === selectedStudent);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !amount) {
      alert('Veuillez sélectionner un étudiant et un montant');
      return;
    }

    const receiptNumber = generateReceiptNumber(academicYear, month);
    const { data, error } = await supabase
      .from('tuition_fee_payments')
      .insert({
        student_id: selectedStudent,
        month,
        academic_year: academicYear,
        amount,
        receipt_number: receiptNumber,
      })
      .select('*, students(student_number, annual_tuition_fee, profiles(first_name, last_name), classes(name))')
      .single();

    if (error) {
      alert(`❌ Erreur: ${error.message}`);
      return;
    }

    setAmount('');
    setRefreshKey((k) => k + 1);

    // Calcule le cumul à date pour le reçu affiché immédiatement
    const { data: history } = await supabase
      .from('tuition_fee_payments')
      .select('amount')
      .eq('student_id', selectedStudent)
      .eq('academic_year', academicYear)
      .is('voided_at', null);

    const cumulativePaid = (history || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const fee = student?.annual_tuition_fee || 0;
    setJustPrinted({ payment: data, cumulativePaid, fee });
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="border rounded px-3 py-2" required>
          <option value="">Classe...</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={selectedStudent} onChange={(e) => handleSelectStudent(e.target.value)} className="border rounded px-3 py-2" required disabled={!selectedClass}>
          <option value="">Étudiant...</option>
          {roster.map((s) => (
            <option key={s.id} value={s.id}>
              {s.profiles?.first_name} {s.profiles?.last_name} ({s.student_number})
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
          step="0.01"
          placeholder="Montant"
          value={amount}
          onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : '')}
          className="border rounded px-3 py-2"
          required
        />
        {selectedStudent && (
          <div className="flex gap-1 md:col-span-4">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Frais annuel de l'étudiant (FCFA)"
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value ? parseFloat(e.target.value) : '')}
              className="border rounded px-3 py-2 flex-1"
            />
            {feeInput !== (student?.annual_tuition_fee ?? '') && (
              <button type="button" onClick={handleSaveFee} className="text-xs bg-gray-200 hover:bg-gray-300 rounded px-3">
                Définir le frais annuel
              </button>
            )}
          </div>
        )}
        <button type="submit" className="md:col-span-4 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
          Enregistrer le paiement et générer le reçu
        </button>
      </form>

      {selectedStudent && (
        <TuitionHistoryTable
          key={refreshKey}
          studentId={selectedStudent}
          annualFee={student?.annual_tuition_fee}
          academicYear={academicYear}
          showStudentName={false}
        />
      )}

      {justPrinted && (
        <ReceiptPrintable
          payment={justPrinted.payment}
          annualFee={justPrinted.fee}
          cumulativePaid={justPrinted.cumulativePaid}
          remainingBalance={justPrinted.fee - justPrinted.cumulativePaid}
          onClose={() => setJustPrinted(null)}
        />
      )}
    </div>
  );
};

export default TuitionPaymentFlow;

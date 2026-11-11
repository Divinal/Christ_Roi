import { t } from '../../i18n';
export type FinancialKind = 'expense' | 'revenue';

export interface FinancialCategory {
  id: string;
  kind: FinancialKind;
  name: string;
  is_system: boolean;
  is_active: boolean;
}

export interface FinancialBudget {
  id: string;
  category_id: string;
  month: number;
  academic_year: string;
  estimated_amount: number;
}

export interface FinancialTransaction {
  id: string;
  category_id: string;
  month: number;
  academic_year: string;
  amount: number;
  transaction_date: string;
  description?: string | null;
  financial_categories?: { name: string; kind: FinancialKind };
}

export interface TuitionPayment {
  id: string;
  student_id: string;
  month: number;
  academic_year: string;
  amount: number;
  payment_date: string;
  receipt_number: string;
  voided_at?: string | null;
  void_reason?: string | null;
  students?: {
    student_number: string;
    profiles?: { first_name: string; last_name: string };
    levels?: { name: string };
  };
}

export interface TeacherPayslip {
  id: string;
  teacher_id: string;
  month: number;
  academic_year: string;
  hours_worked: number;
  hourly_rate: number;
  gross_amount: number;
  payslip_number: string;
  payment_date: string;
  voided_at?: string | null;
  void_reason?: string | null;
  teachers?: {
    teacher_number: string;
    profiles?: { first_name: string; last_name: string };
  };
}

// Ordre d'affichage de l'année scolaire : Septembre -> Août
export const ACADEMIC_MONTHS: { month: number; label: string }[] = [
  { month: 9, label: t("Septembre") },
  { month: 10, label: t("Octobre") },
  { month: 11, label: t("Novembre") },
  { month: 12, label: t("Décembre") },
  { month: 1, label: t("Janvier") },
  { month: 2, label: t("Février") },
  { month: 3, label: t("Mars") },
  { month: 4, label: t("Avril") },
  { month: 5, label: t("Mai") },
  { month: 6, label: t("Juin") },
  { month: 7, label: t("Juillet") },
  { month: 8, label: t("Août") },
];

export const monthLabel = (month: number): string =>
  ACADEMIC_MONTHS.find((m) => m.month === month)?.label || String(month);

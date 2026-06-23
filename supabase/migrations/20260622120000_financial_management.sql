-- ============================================================
-- GESTION FINANCIÈRE: catégories, budget prévisionnel, transactions
-- réelles, paiements de scolarité, bulletins de paie enseignants
-- ============================================================

CREATE TYPE public.financial_kind AS ENUM ('expense', 'revenue');

-- ---------- Catégories (admin-extensibles) ----------
CREATE TABLE public.financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.financial_kind NOT NULL,
  name TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, name)
);

-- ---------- Budget prévisionnel mensuel, par année scolaire ----------
CREATE TABLE public.financial_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.financial_categories(id) ON DELETE RESTRICT,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  academic_year TEXT NOT NULL,
  estimated_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, month, academic_year)
);
CREATE INDEX idx_financial_budgets_year ON public.financial_budgets(academic_year);
CREATE INDEX idx_financial_budgets_category ON public.financial_budgets(category_id);

-- ---------- Transactions réelles génériques ----------
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.financial_categories(id) ON DELETE RESTRICT,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  academic_year TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_financial_transactions_year_month ON public.financial_transactions(academic_year, month);
CREATE INDEX idx_financial_transactions_category ON public.financial_transactions(category_id);

-- ---------- Nouvelles colonnes ----------
ALTER TABLE public.teachers ADD COLUMN hourly_rate NUMERIC(10,2);
ALTER TABLE public.students ADD COLUMN annual_tuition_fee NUMERIC(12,2);

-- ---------- Frais de scolarité (flux dédié, par étudiant) ----------
CREATE TABLE public.tuition_fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  academic_year TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_number TEXT NOT NULL UNIQUE,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tuition_payments_student_year ON public.tuition_fee_payments(student_id, academic_year);
CREATE INDEX idx_tuition_payments_year_month ON public.tuition_fee_payments(academic_year, month);

-- ---------- Masse salariale (flux dédié, par enseignant) ----------
CREATE TABLE public.teacher_payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  academic_year TEXT NOT NULL,
  hours_worked NUMERIC(6,2) NOT NULL CHECK (hours_worked > 0),
  hourly_rate NUMERIC(10,2) NOT NULL CHECK (hourly_rate >= 0),
  gross_amount NUMERIC(12,2) NOT NULL CHECK (gross_amount >= 0),
  payslip_number TEXT NOT NULL UNIQUE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, month, academic_year)
);
CREATE INDEX idx_teacher_payslips_teacher_year ON public.teacher_payslips(teacher_id, academic_year);
CREATE INDEX idx_teacher_payslips_year_month ON public.teacher_payslips(academic_year, month);

CREATE TRIGGER update_financial_budgets_updated_at
BEFORE UPDATE ON public.financial_budgets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuition_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view financial categories" ON public.financial_categories
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage financial categories" ON public.financial_categories
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage financial budgets" ON public.financial_budgets
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage financial transactions" ON public.financial_transactions
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage tuition payments" ON public.tuition_fee_payments
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view their own tuition payments" ON public.tuition_fee_payments
FOR SELECT USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can manage teacher payslips" ON public.teacher_payslips
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can view their own payslips" ON public.teacher_payslips
FOR SELECT USING (
  teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
);

-- ============================================================
-- Catégories de départ
-- ============================================================
INSERT INTO public.financial_categories (kind, name, is_system) VALUES
  ('expense', 'Masse salariale', true),
  ('expense', 'Loyer', false),
  ('expense', 'Déplacements', false),
  ('expense', 'Frais divers', false),
  ('expense', 'Communication', false),
  ('revenue', 'Frais de scolarité', true),
  ('revenue', 'Subventions', false);

-- ============================================================
-- RÔLE "FINANCE ADMIN" : accès dédié à la gestion financière
-- ============================================================

-- Permet à PostgREST d'embarquer profiles(...) depuis students/teachers
-- (jusqu'ici ces deux tables ne référençaient que auth.users, jamais profiles)
ALTER TABLE public.students
  ADD CONSTRAINT students_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);

ALTER TABLE public.teachers
  ADD CONSTRAINT teachers_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);

-- Accès complet aux tables financières
CREATE POLICY "Finance admins can manage financial categories" ON public.financial_categories
FOR ALL USING (public.has_role(auth.uid(), 'finance_admin'));

CREATE POLICY "Finance admins can manage financial budgets" ON public.financial_budgets
FOR ALL USING (public.has_role(auth.uid(), 'finance_admin'));

CREATE POLICY "Finance admins can manage financial transactions" ON public.financial_transactions
FOR ALL USING (public.has_role(auth.uid(), 'finance_admin'));

CREATE POLICY "Finance admins can manage tuition payments" ON public.tuition_fee_payments
FOR ALL USING (public.has_role(auth.uid(), 'finance_admin'));

CREATE POLICY "Finance admins can manage teacher payslips" ON public.teacher_payslips
FOR ALL USING (public.has_role(auth.uid(), 'finance_admin'));

-- Lecture des élèves (pour les facturer) + écriture du frais annuel
CREATE POLICY "Finance admins can view all students" ON public.students
FOR SELECT USING (public.has_role(auth.uid(), 'finance_admin'));

CREATE POLICY "Finance admins can update student tuition fee" ON public.students
FOR UPDATE USING (public.has_role(auth.uid(), 'finance_admin'));

-- "classes" et "teachers" sont déjà lisibles par tout utilisateur authentifié
-- (policies "Everyone can view classes/teachers" existantes). Il reste à
-- autoriser la mise à jour du taux horaire des enseignants.
CREATE POLICY "Finance admins can update teacher hourly rate" ON public.teachers
FOR UPDATE USING (public.has_role(auth.uid(), 'finance_admin'));

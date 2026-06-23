-- ============================================================
-- Restauration de subject_classes : table légitime du schéma
-- d'origine (migration du 2026-01-27), absente de la base actuelle.
-- ============================================================
CREATE TABLE public.subject_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    UNIQUE (subject_id, class_id)
);
ALTER TABLE public.subject_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view subject classes" ON public.subject_classes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage subject classes" ON public.subject_classes
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- ADMIN PÉDAGOGIQUE (academic_admin) : tout sauf les finances
-- et la gestion des rôles/comptes (user_roles reste admin-only)
-- ============================================================
CREATE POLICY "Academic admins can manage classes" ON public.classes
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Academic admins can manage subjects" ON public.subjects
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Academic admins can manage subject classes" ON public.subject_classes
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Academic admins can manage students" ON public.students
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Academic admins can manage teachers" ON public.teachers
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Academic admins can manage teacher subjects" ON public.teacher_subjects
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Academic admins can manage teacher classes" ON public.teacher_classes
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Academic admins can manage schedules" ON public.schedules
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Academic admins can manage grades" ON public.grades
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Academic admins can manage courses" ON public.courses
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Academic admins can manage messages" ON public.messages
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

-- ============================================================
-- FINANCE ADMIN (extension) : inscriptions élèves + enseignants,
-- et affectation de classe pour les élèves uniquement (déjà
-- couvert par la policy UPDATE existante sur students)
-- ============================================================
CREATE POLICY "Finance admins can register students" ON public.students
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'finance_admin'));

CREATE POLICY "Finance admins can register teachers" ON public.teachers
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'finance_admin'));

-- ============================================================
-- ADMIN SECRÉTAIRE : inscriptions (élèves + enseignants),
-- affectation des classes (élèves + enseignants), emplois du
-- temps, matières et cours
-- ============================================================
CREATE POLICY "Secretaries can view all students" ON public.students
FOR SELECT USING (public.has_role(auth.uid(), 'admin_secretaire'));

CREATE POLICY "Secretaries can register students" ON public.students
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin_secretaire'));

CREATE POLICY "Secretaries can update student class" ON public.students
FOR UPDATE USING (public.has_role(auth.uid(), 'admin_secretaire'));

CREATE POLICY "Secretaries can register teachers" ON public.teachers
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin_secretaire'));

CREATE POLICY "Secretaries can manage teacher classes" ON public.teacher_classes
FOR ALL USING (public.has_role(auth.uid(), 'admin_secretaire'));

CREATE POLICY "Secretaries can manage schedules" ON public.schedules
FOR ALL USING (public.has_role(auth.uid(), 'admin_secretaire'));

CREATE POLICY "Secretaries can manage subjects" ON public.subjects
FOR ALL USING (public.has_role(auth.uid(), 'admin_secretaire'));

CREATE POLICY "Secretaries can manage courses" ON public.courses
FOR ALL USING (public.has_role(auth.uid(), 'admin_secretaire'));

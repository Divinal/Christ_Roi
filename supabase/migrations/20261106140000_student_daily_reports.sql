-- Suivi administratif : un rapport par étudiant, par jour et par auteur, pour que
-- plusieurs enseignants puissent écrire sur le même étudiant sans s'écraser.
CREATE TABLE IF NOT EXISTS public.student_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  level_id UUID REFERENCES public.levels(id) ON DELETE SET NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  attendance TEXT CHECK (attendance IN ('present', 'absent', 'late', 'excused')),
  conduct TEXT CHECK (conduct IN ('excellent', 'good', 'fair', 'concern')),
  activities TEXT,
  observations TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_daily_reports_one_per_author UNIQUE (student_id, report_date, author_id),
  CONSTRAINT student_daily_reports_not_empty CHECK (
    attendance IS NOT NULL OR conduct IS NOT NULL OR activities IS NOT NULL OR observations IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_student_daily_reports_date ON public.student_daily_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_daily_reports_student ON public.student_daily_reports(student_id, report_date DESC);

DROP TRIGGER IF EXISTS update_student_daily_reports_updated_at ON public.student_daily_reports;
CREATE TRIGGER update_student_daily_reports_updated_at
BEFORE UPDATE ON public.student_daily_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_daily_reports ENABLE ROW LEVEL SECURITY;

-- Lecture : l'administration voit tout, un enseignant ses propres rapports.
-- Les étudiants n'y ont pas accès : c'est un suivi interne.
DROP POLICY IF EXISTS "Staff and authors can read daily reports" ON public.student_daily_reports;
CREATE POLICY "Staff and authors can read daily reports" ON public.student_daily_reports
FOR SELECT TO authenticated USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'academic_admin')
  OR public.has_role(auth.uid(), 'admin_secretaire')
);

-- Écriture : toujours en son propre nom ; un enseignant seulement sur les niveaux qui lui sont affectés.
DROP POLICY IF EXISTS "Staff and teachers can write daily reports" ON public.student_daily_reports;
CREATE POLICY "Staff and teachers can write daily reports" ON public.student_daily_reports
FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'academic_admin')
    OR public.has_role(auth.uid(), 'admin_secretaire')
    OR EXISTS (
      SELECT 1
      FROM public.teachers t
      JOIN public.teacher_levels tl ON tl.teacher_id = t.id
      JOIN public.students s ON s.level_id = tl.level_id
      WHERE t.user_id = auth.uid() AND s.id = student_id
    )
  )
);

DROP POLICY IF EXISTS "Authors can update their daily reports" ON public.student_daily_reports;
CREATE POLICY "Authors can update their daily reports" ON public.student_daily_reports
FOR UPDATE TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Authors and admins can delete daily reports" ON public.student_daily_reports;
CREATE POLICY "Authors and admins can delete daily reports" ON public.student_daily_reports
FOR DELETE TO authenticated USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'academic_admin')
);

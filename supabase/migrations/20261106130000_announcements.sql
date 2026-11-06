-- La table announcements est utilisée par l'application mais n'avait jamais été
-- créée : l'onglet Annonces échouait en production. Sans risque si elle existe.
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('students', 'teachers', 'all')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements(published_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read all announcements" ON public.announcements;
CREATE POLICY "Staff can read all announcements" ON public.announcements
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'academic_admin')
  OR public.has_role(auth.uid(), 'finance_admin')
  OR public.has_role(auth.uid(), 'admin_secretaire')
);

DROP POLICY IF EXISTS "Audience can read its announcements" ON public.announcements;
CREATE POLICY "Audience can read its announcements" ON public.announcements
FOR SELECT TO authenticated USING (
  target_audience = 'all'
  OR (target_audience = 'students' AND public.has_role(auth.uid(), 'student'))
  OR (target_audience = 'teachers' AND public.has_role(auth.uid(), 'teacher'))
);

DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements" ON public.announcements
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'academic_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'academic_admin'));

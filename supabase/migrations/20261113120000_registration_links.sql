-- Inscription en ligne par lien : l'administration crée un lien (étudiants ou
-- enseignants) et l'envoie à qui elle veut. La personne remplit elle-même sa
-- fiche ; le compte est créé par la fonction serveur admin-users, qui vérifie
-- le lien et attribue le matricule. Le navigateur d'un visiteur n'a aucun accès
-- direct à cette table.

CREATE TABLE IF NOT EXISTS public.registration_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE CHECK (length(token) >= 24),
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  label TEXT,
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_links_role ON public.registration_links(role, created_at DESC);

ALTER TABLE public.registration_links ENABLE ROW LEVEL SECURITY;

-- Mêmes personnes que celles qui peuvent créer des comptes étudiants et enseignants.
DROP POLICY IF EXISTS "Staff manage registration links" ON public.registration_links;
CREATE POLICY "Staff manage registration links" ON public.registration_links
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'academic_admin')
  OR public.has_role(auth.uid(), 'finance_admin') OR public.has_role(auth.uid(), 'admin_secretaire')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'academic_admin')
  OR public.has_role(auth.uid(), 'finance_admin') OR public.has_role(auth.uid(), 'admin_secretaire')
);

REVOKE ALL ON public.registration_links FROM anon;

-- Nouveau type de notification : une inscription arrivée par lien.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('message', 'payment', 'payslip', 'grade', 'exam', 'announcement', 'schedule', 'followup', 'registration')
);

-- Appelée par la fonction serveur après une inscription réussie.
CREATE OR REPLACE FUNCTION public.notify_registration(_role TEXT, _name TEXT, _number TEXT) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_users(
    public.notification_staff(ARRAY['admin', 'academic_admin', 'admin_secretaire']),
    'registration',
    CASE WHEN _role = 'teacher' THEN 'Nouvel enseignant inscrit' ELSE 'Nouvel étudiant inscrit' END,
    _name || ' — ' || _number,
    CASE WHEN _role = 'teacher' THEN 'teachers' ELSE 'students' END
  );
END $$;

REVOKE ALL ON FUNCTION public.notify_registration(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_registration(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_users(UUID[], TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.notification_staff(TEXT[]) TO service_role;

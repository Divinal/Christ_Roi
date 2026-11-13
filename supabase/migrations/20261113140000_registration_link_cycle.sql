-- Lien d'inscription étudiant réservé à un cycle : la page d'inscription ne
-- propose que les niveaux de ce cycle, et la fonction serveur refuse les autres.
-- Les liens créés avant cette mise à jour (cycle vide) restent valables pour tous les niveaux.

ALTER TABLE public.registration_links ADD COLUMN IF NOT EXISTS cycle TEXT;

DO $$ BEGIN
  ALTER TABLE public.registration_links ADD CONSTRAINT registration_links_cycle_check CHECK (
    cycle IS NULL OR (role = 'student' AND cycle IN ('prescolaire', 'primaire', 'college', 'lycee', 'superieur'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

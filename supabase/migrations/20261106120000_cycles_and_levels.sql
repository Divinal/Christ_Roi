-- ============================================================
-- CYCLES & NIVEAUX : remplace la notion de "classe".
--
-- Un étudiant est désormais inscrit directement dans un niveau, lui-même
-- rattaché à un cycle (Pré-scolaire, Primaire, Collège, Lycée, Supérieur).
--
-- Cette migration ne supprime aucune donnée : les tables classes,
-- teacher_classes, subject_classes et courses, ainsi que les colonnes
-- class_id, restent en place mais ne sont plus utilisées par l'application.
-- ============================================================

CREATE TYPE public.school_cycle AS ENUM ('prescolaire', 'primaire', 'college', 'lycee', 'superieur');

CREATE TABLE public.levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle public.school_cycle NOT NULL,
  name TEXT NOT NULL UNIQUE,
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_levels_cycle ON public.levels(cycle, position);

INSERT INTO public.levels (cycle, name, position) VALUES
  ('prescolaire', 'Petite Section', 1),
  ('prescolaire', 'Moyenne Section', 2),
  ('prescolaire', 'Grande Section', 3),
  ('primaire', 'CP1', 1),
  ('primaire', 'CP2', 2),
  ('primaire', 'CE1', 3),
  ('primaire', 'CE2', 4),
  ('primaire', 'CM1', 5),
  ('primaire', 'CM2', 6),
  ('college', '6ème', 1),
  ('college', '5ème', 2),
  ('college', '4ème', 3),
  ('college', '3ème', 4),
  ('lycee', 'Seconde', 1),
  ('lycee', 'Première', 2),
  ('lycee', 'Terminale', 3),
  ('superieur', 'Technicien', 1),
  ('superieur', 'Technicien Supérieur 1', 2),
  ('superieur', 'Technicien Supérieur 2', 3),
  ('superieur', 'Bachelor', 4),
  ('superieur', 'Master 1', 5),
  ('superieur', 'Master 2', 6);

-- ---------- Rattachement des données au niveau ----------
-- RESTRICT sur students : un niveau qui a encore des inscrits ne peut pas
-- être supprimé. SET NULL sur grades : une note survit à son niveau.
ALTER TABLE public.students
  ADD COLUMN level_id UUID REFERENCES public.levels(id) ON DELETE RESTRICT;
CREATE INDEX idx_students_level ON public.students(level_id);

ALTER TABLE public.grades
  ADD COLUMN level_id UUID REFERENCES public.levels(id) ON DELETE SET NULL;
CREATE INDEX idx_grades_level ON public.grades(level_id);

ALTER TABLE public.schedules
  ADD COLUMN level_id UUID REFERENCES public.levels(id) ON DELETE CASCADE;
CREATE INDEX idx_schedules_level ON public.schedules(level_id);

-- Les nouvelles notes et les nouveaux créneaux n'ont plus de classe.
ALTER TABLE public.grades ALTER COLUMN class_id DROP NOT NULL;
ALTER TABLE public.schedules ALTER COLUMN class_id DROP NOT NULL;

-- Ces clés supprimaient en cascade notes et créneaux avec leur classe :
-- on les neutralise pour qu'un futur nettoyage de "classes" ne les efface pas.
ALTER TABLE public.grades DROP CONSTRAINT IF EXISTS grades_class_id_fkey;
ALTER TABLE public.grades
  ADD CONSTRAINT grades_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;

ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_class_id_fkey;
ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;

-- ---------- Tables de liaison par niveau ----------
CREATE TABLE public.teacher_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  UNIQUE (teacher_id, level_id, subject_id)
);
CREATE INDEX idx_teacher_levels_level ON public.teacher_levels(level_id);

CREATE TABLE public.subject_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
  UNIQUE (subject_id, level_id)
);
CREATE INDEX idx_subject_levels_level ON public.subject_levels(level_id);

-- ---------- Téléphone enseignant ----------
-- Jusqu'ici saisi à la création mais conservé seulement dans les métadonnées
-- du compte : il est nécessaire sur la fiche enseignant.
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS phone TEXT;
UPDATE public.teachers t
SET phone = u.raw_user_meta_data->>'phone'
FROM auth.users u
WHERE u.id = t.user_id AND t.phone IS NULL;

-- ============================================================
-- REPRISE DES DONNÉES EXISTANTES
-- Chaque classe est rattachée à un niveau quand la correspondance est sûre.
-- Sinon elle reste sans niveau : ses étudiants apparaissent dans
-- "À inscrire" et l'école les place à la main. Rien n'est deviné.
-- ============================================================
ALTER TABLE public.classes
  ADD COLUMN level_id UUID REFERENCES public.levels(id) ON DELETE SET NULL;

WITH mapping AS (
  SELECT c.id,
    CASE
      -- 1. Valeurs exactes de l'ancien sélecteur "Niveau"
      WHEN c.level ILIKE 'Technicien' THEN 'Technicien'
      WHEN c.level ILIKE 'TS1' THEN 'Technicien Supérieur 1'
      WHEN c.level ILIKE 'TS2' THEN 'Technicien Supérieur 2'
      WHEN c.level ILIKE 'Bachelor' THEN 'Bachelor'
      WHEN c.level ILIKE 'Master 1' THEN 'Master 1'
      WHEN c.level ILIKE 'Master 2' THEN 'Master 2'
      -- 2. Nom de la classe, pour les anciens niveaux trop larges
      WHEN c.name ~* '(petite\s+section|^PS\y)' THEN 'Petite Section'
      WHEN c.name ~* '(moyenne\s+section|^MS\y)' THEN 'Moyenne Section'
      WHEN c.name ~* '(grande\s+section|^GS\y)' THEN 'Grande Section'
      WHEN c.name ~* '\yCP\s*1\y' THEN 'CP1'
      WHEN c.name ~* '\yCP\s*2\y' THEN 'CP2'
      WHEN c.name ~* '\yCE\s*1\y' THEN 'CE1'
      WHEN c.name ~* '\yCE\s*2\y' THEN 'CE2'
      WHEN c.name ~* '\yCM\s*1\y' THEN 'CM1'
      WHEN c.name ~* '\yCM\s*2\y' THEN 'CM2'
      -- Un chiffre seul n'a de sens que dans un ancien niveau "Collège"
      -- (sinon "3" dans "Licence 3" serait pris pour la 3ème).
      WHEN c.level ILIKE 'Coll%' AND c.name ~ '^\s*6' THEN '6ème'
      WHEN c.level ILIKE 'Coll%' AND c.name ~ '^\s*5' THEN '5ème'
      WHEN c.level ILIKE 'Coll%' AND c.name ~ '^\s*4' THEN '4ème'
      WHEN c.level ILIKE 'Coll%' AND c.name ~ '^\s*3' THEN '3ème'
      WHEN c.level ILIKE 'Lyc%' AND c.name ~* '(seconde|^\s*2\s*n?de)' THEN 'Seconde'
      WHEN c.level ILIKE 'Lyc%' AND c.name ~* '(premi[eè]re|^\s*1\s*[eè]re)' THEN 'Première'
      WHEN c.level ILIKE 'Lyc%' AND c.name ~* '(terminale|^\s*tle\y)' THEN 'Terminale'
    END AS level_name
  FROM public.classes c
)
UPDATE public.classes c
SET level_id = l.id
FROM mapping m
JOIN public.levels l ON l.name = m.level_name
WHERE c.id = m.id;

UPDATE public.students s SET level_id = c.level_id
FROM public.classes c WHERE s.class_id = c.id AND c.level_id IS NOT NULL;

UPDATE public.grades g SET level_id = c.level_id
FROM public.classes c WHERE g.class_id = c.id AND c.level_id IS NOT NULL;

UPDATE public.schedules sc SET level_id = c.level_id
FROM public.classes c WHERE sc.class_id = c.id AND c.level_id IS NOT NULL;

INSERT INTO public.teacher_levels (teacher_id, level_id, subject_id)
SELECT tc.teacher_id, c.level_id, tc.subject_id
FROM public.teacher_classes tc
JOIN public.classes c ON c.id = tc.class_id
WHERE c.level_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.subject_levels (subject_id, level_id)
SELECT sc.subject_id, c.level_id
FROM public.subject_classes sc
JOIN public.classes c ON c.id = sc.class_id
WHERE c.level_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view levels" ON public.levels
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage levels" ON public.levels
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Academic admins can manage levels" ON public.levels
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Everyone can view teacher levels" ON public.teacher_levels
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage teacher levels" ON public.teacher_levels
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Academic admins can manage teacher levels" ON public.teacher_levels
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Secretaries can manage teacher levels" ON public.teacher_levels
FOR ALL USING (public.has_role(auth.uid(), 'admin_secretaire'));

CREATE POLICY "Everyone can view subject levels" ON public.subject_levels
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage subject levels" ON public.subject_levels
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Academic admins can manage subject levels" ON public.subject_levels
FOR ALL USING (public.has_role(auth.uid(), 'academic_admin'));

CREATE POLICY "Secretaries can manage subject levels" ON public.subject_levels
FOR ALL USING (public.has_role(auth.uid(), 'admin_secretaire'));

-- Un enseignant voit les étudiants des niveaux où il intervient. L'ancienne
-- policy par classe est retirée : teacher_classes n'est plus mis à jour, elle
-- laisserait un enseignant retiré d'un niveau voir ses anciens étudiants.
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON public.students;

CREATE POLICY "Teachers can view students in their levels" ON public.students
FOR SELECT USING (
  public.has_role(auth.uid(), 'teacher') AND
  level_id IN (
    SELECT tl.level_id FROM public.teacher_levels tl
    JOIN public.teachers t ON t.id = tl.teacher_id
    WHERE t.user_id = auth.uid()
  )
);

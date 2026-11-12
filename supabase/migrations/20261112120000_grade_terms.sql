-- Trimestres et types d'évaluation selon le cycle.
--   Pré-scolaire et primaire : uniquement des compositions, une par trimestre.
--   Collège et lycée : devoirs (nombre libre), devoir départemental et composition, par trimestre.
--   Supérieur : CC1, CC2, CC3, examen théorique et examen pratique, sans trimestre.
-- Le bulletin trimestriel se calcule à partir de term et academic_year.
-- Les notes déjà saisies ne sont pas modifiées : le contrôle ne porte que sur
-- les nouvelles notes et sur un changement de type, de trimestre ou de niveau.

ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS term SMALLINT;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS academic_year TEXT;

DO $$ BEGIN
  ALTER TABLE public.grades ADD CONSTRAINT grades_term_range CHECK (term BETWEEN 1 AND 3);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_grades_year_term ON public.grades(academic_year, term);

-- Une seule composition et un seul devoir départemental par élève, matière et trimestre.
CREATE UNIQUE INDEX IF NOT EXISTS grades_one_per_term
  ON public.grades(student_id, subject_id, academic_year, term, grade_type)
  WHERE grade_type IN ('Composition', 'Devoir départemental') AND term IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_grade_scheme() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _level UUID;
  _cycle TEXT;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.grade_type IS NOT DISTINCT FROM OLD.grade_type
     AND NEW.term IS NOT DISTINCT FROM OLD.term
     AND NEW.level_id IS NOT DISTINCT FROM OLD.level_id
     AND NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id THEN
    RETURN NEW;
  END IF;

  _level := COALESCE(NEW.level_id, (SELECT level_id FROM public.students WHERE id = NEW.student_id));
  SELECT cycle INTO _cycle FROM public.levels WHERE id = _level;

  -- Un enseignant ne note que dans les niveaux et les matières qui lui sont affectés.
  IF public.has_role(auth.uid(), 'teacher')
     AND NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.has_role(auth.uid(), 'academic_admin')
     AND NOT EXISTS (
       SELECT 1 FROM public.teacher_levels tl
       JOIN public.teachers t ON t.id = tl.teacher_id
       WHERE t.user_id = auth.uid() AND tl.level_id = _level AND tl.subject_id = NEW.subject_id
     ) THEN
    RAISE EXCEPTION 'Vous n''êtes pas affecté à ce niveau pour cette matière.' USING ERRCODE = '42501';
  END IF;

  IF _cycle IN ('prescolaire', 'primaire') AND NEW.grade_type <> 'Composition' THEN
    RAISE EXCEPTION 'Au pré-scolaire et au primaire, seules les compositions sont notées.' USING ERRCODE = '23514';
  ELSIF _cycle IN ('college', 'lycee') AND NEW.grade_type NOT IN ('Devoir', 'Devoir départemental', 'Composition') THEN
    RAISE EXCEPTION 'Au collège et au lycée, les notes sont des devoirs, devoirs départementaux ou compositions.' USING ERRCODE = '23514';
  ELSIF _cycle = 'superieur' AND NEW.grade_type NOT IN ('CC1', 'CC2', 'CC3', 'E.Théorique', 'E.Pratique') THEN
    RAISE EXCEPTION 'Au supérieur, les notes sont des contrôles continus ou des examens.' USING ERRCODE = '23514';
  END IF;

  IF _cycle IN ('prescolaire', 'primaire', 'college', 'lycee') AND NEW.term IS NULL THEN
    RAISE EXCEPTION 'Précisez le trimestre de la note.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS check_grade_scheme ON public.grades;
CREATE TRIGGER check_grade_scheme BEFORE INSERT OR UPDATE ON public.grades
FOR EACH ROW EXECUTE FUNCTION public.check_grade_scheme();

-- Notification : compositions et devoirs départementaux comptent comme examens ; le trimestre est indiqué.
CREATE OR REPLACE FUNCTION public.notify_on_grade() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _student RECORD;
  _subject TEXT;
  _is_exam BOOLEAN;
  _title TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.grade_value IS NOT DISTINCT FROM OLD.grade_value THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _student FROM public.notification_student(NEW.student_id);
  SELECT name INTO _subject FROM public.subjects WHERE id = NEW.subject_id;
  _is_exam := NEW.grade_type ILIKE 'E.%' OR NEW.grade_type ILIKE 'exam%'
    OR NEW.grade_type IN ('Composition', 'Devoir départemental');
  _title := CASE
    WHEN TG_OP = 'UPDATE' THEN 'Note modifiée'
    WHEN _is_exam THEN 'Résultat d''examen'
    ELSE 'Nouvelle note'
  END;

  PERFORM public.notify_users(
    ARRAY[_student.user_id], CASE WHEN _is_exam THEN 'exam' ELSE 'grade' END, _title,
    COALESCE(_subject, 'Matière') || ' — ' || NEW.grade_type
      || CASE WHEN NEW.term IS NOT NULL THEN ' (T' || NEW.term || ')' ELSE '' END
      || ' : ' || rtrim(rtrim(to_char(NEW.grade_value, 'FM990.00'), '0'), '.') || '/20',
    'grades'
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification note : %', SQLERRM;
  RETURN NULL;
END $$;

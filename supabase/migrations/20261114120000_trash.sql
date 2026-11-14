-- Corbeille : tout ce que l'administration ou un enseignant supprime y reste
-- 30 jours, restaurable, puis disparaît définitivement.
--
-- Principe : un déclencheur copie chaque ligne supprimée dans public.trash.
-- Les lignes supprimées en cascade (notes et paiements d'un étudiant…) sont
-- rangées avec l'élément supprimé grâce au numéro de transaction (batch_id).
-- Les frais de scolarité et bulletins de paie ne sont jamais effacés : leur
-- annulation (voided_at) passe aussi par la corbeille, la restauration les réactive.
-- Un étudiant ou un enseignant supprimé voit son compte de connexion bloqué ;
-- le compte n'est effacé qu'à l'expiration des 30 jours.

CREATE TABLE IF NOT EXISTS public.trash (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  row_data JSONB NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  restore_mode TEXT NOT NULL DEFAULT 'insert' CHECK (restore_mode IN ('insert', 'unvoid')),
  extra JSONB,
  deleted_by UUID,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trash_batch ON public.trash(batch_id);
CREATE INDEX IF NOT EXISTS idx_trash_deleted_at ON public.trash(deleted_at);
CREATE INDEX IF NOT EXISTS idx_trash_deleted_by ON public.trash(deleted_by, deleted_at DESC);

ALTER TABLE public.trash ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('admin', 'academic_admin', 'finance_admin', 'admin_secretaire')
  );
$$;

-- L'administration voit toute la corbeille ; un enseignant, ce qu'il a supprimé lui-même.
DROP POLICY IF EXISTS "Trash visible to staff or its author" ON public.trash;
CREATE POLICY "Trash visible to staff or its author" ON public.trash
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR deleted_by = auth.uid());

-- Aucune écriture directe : tout passe par les fonctions ci-dessous.
REVOKE ALL ON public.trash FROM anon, authenticated;
GRANT SELECT ON public.trash TO authenticated;

-- ---------- Description lisible de ce qui a été supprimé ----------

CREATE OR REPLACE FUNCTION public.trash_person(_user_id UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NULLIF(trim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  FROM public.profiles WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.trash_student_name(_student_id UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.trash_person(user_id) FROM public.students WHERE id = _student_id;
$$;

CREATE OR REPLACE FUNCTION public.trash_teacher_name(_teacher_id UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.trash_person(user_id) FROM public.teachers WHERE id = _teacher_id;
$$;

CREATE OR REPLACE FUNCTION public.trash_amount(_value TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT replace(to_char(_value::numeric, 'FM999,999,999,990'), ',', ' ') || ' FCFA';
$$;

-- Type et libellé : le type est traduit à l'écran, le libellé est fait de données.
CREATE OR REPLACE FUNCTION public.trash_describe(_table TEXT, r JSONB, OUT kind TEXT, OUT label TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _subject TEXT := (SELECT name FROM public.subjects WHERE id = (r->>'subject_id')::uuid);
  _level TEXT := (SELECT name FROM public.levels WHERE id = (r->>'level_id')::uuid);
BEGIN
  CASE _table
    WHEN 'students' THEN
      kind := 'student';
      label := concat_ws(' — ', public.trash_person((r->>'user_id')::uuid), r->>'student_number');
    WHEN 'teachers' THEN
      kind := 'teacher';
      label := concat_ws(' — ', public.trash_person((r->>'user_id')::uuid), r->>'teacher_number');
    WHEN 'grades' THEN
      kind := 'grade';
      label := concat_ws(' — ', _subject,
        concat_ws(' ', r->>'grade_type', rtrim(rtrim(r->>'grade_value', '0'), '.') || '/20'),
        public.trash_student_name((r->>'student_id')::uuid));
    WHEN 'tuition_fee_payments' THEN
      kind := 'payment';
      label := concat_ws(' — ', public.trash_amount(r->>'amount'), r->>'receipt_number',
        public.trash_student_name((r->>'student_id')::uuid));
    WHEN 'teacher_payslips' THEN
      kind := 'payslip';
      label := concat_ws(' — ', r->>'payslip_number', public.trash_amount(r->>'gross_amount'),
        public.trash_teacher_name((r->>'teacher_id')::uuid));
    WHEN 'messages' THEN
      kind := 'message';
      label := r->>'subject';
    WHEN 'announcements' THEN
      kind := 'announcement';
      label := r->>'title';
    WHEN 'student_daily_reports' THEN
      kind := 'followup';
      label := concat_ws(' — ', to_char((r->>'report_date')::date, 'DD/MM/YYYY'),
        public.trash_student_name((r->>'student_id')::uuid));
    WHEN 'schedules' THEN
      kind := 'schedule';
      label := concat_ws(' — ', _subject, _level, left(r->>'start_time', 5));
    WHEN 'teacher_levels' THEN
      kind := 'assignment';
      label := concat_ws(' — ', public.trash_teacher_name((r->>'teacher_id')::uuid), _subject, _level);
    WHEN 'subject_levels' THEN
      kind := 'subject_level';
      label := concat_ws(' — ', _subject, _level);
    WHEN 'subjects' THEN
      kind := 'subject';
      label := r->>'name';
    WHEN 'levels' THEN
      kind := 'level';
      label := r->>'name';
    WHEN 'financial_transactions' THEN
      kind := 'transaction';
      label := concat_ws(' — ', (SELECT name FROM public.financial_categories WHERE id = (r->>'category_id')::uuid),
        public.trash_amount(r->>'amount'), r->>'description');
    ELSE
      kind := 'other';
      label := _table;
  END CASE;
  label := COALESCE(NULLIF(label, ''), _table);
END $$;

-- Auteur de la suppression : la personne connectée, ou celle transmise par une fonction.
CREATE OR REPLACE FUNCTION public.trash_actor() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.actor', true), '')::uuid, auth.uid());
$$;

-- Ordre de restauration : ce dont les autres dépendent d'abord.
CREATE OR REPLACE FUNCTION public.trash_rank(_table TEXT) RETURNS INT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _table IN ('levels', 'subjects') THEN 1
    WHEN _table IN ('students', 'teachers', 'announcements', 'messages') THEN 2
    ELSE 3
  END;
$$;

-- ---------- Capture des suppressions ----------

CREATE OR REPLACE FUNCTION public.trash_capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row JSONB;
  _mode TEXT := 'insert';
  _description RECORD;
BEGIN
  -- Effacement définitif en cours (corbeille vidée) : rien à remettre à la corbeille.
  IF current_setting('app.purging', true) = 'on' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    _row := to_jsonb(NEW);
    _mode := 'unvoid';
  ELSE
    _row := to_jsonb(OLD);
  END IF;

  -- Retirer un niveau à une matière en la modifiant n'est pas une suppression :
  -- seule une liaison emportée par la suppression de la matière ou du niveau est gardée.
  IF TG_TABLE_NAME = 'subject_levels'
     AND EXISTS (SELECT 1 FROM public.subjects WHERE id = (_row->>'subject_id')::uuid)
     AND EXISTS (SELECT 1 FROM public.levels WHERE id = (_row->>'level_id')::uuid) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _description FROM public.trash_describe(TG_TABLE_NAME, _row);
  INSERT INTO public.trash (batch_id, table_name, row_id, row_data, kind, label, restore_mode, deleted_by)
  VALUES (txid_current(), TG_TABLE_NAME, _row->>'id', _row, _description.kind, _description.label, _mode, public.trash_actor());
  RETURN NULL;
END $$;

DO $$
DECLARE
  _table TEXT;
BEGIN
  FOREACH _table IN ARRAY ARRAY[
    'students', 'teachers', 'levels', 'subjects', 'grades', 'messages', 'announcements',
    'student_daily_reports', 'schedules', 'teacher_levels', 'subject_levels',
    'financial_transactions', 'tuition_fee_payments', 'teacher_payslips'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trash_on_delete ON public.%I', _table);
    EXECUTE format('CREATE TRIGGER trash_on_delete AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trash_capture()', _table);
  END LOOP;

  FOREACH _table IN ARRAY ARRAY['tuition_fee_payments', 'teacher_payslips'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trash_on_void ON public.%I', _table);
    EXECUTE format(
      'CREATE TRIGGER trash_on_void AFTER UPDATE OF voided_at ON public.%I FOR EACH ROW '
      'WHEN (OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL) EXECUTE FUNCTION public.trash_capture()',
      _table
    );
  END LOOP;
END $$;

-- ---------- Restauration : pas de nouvelle notification, pas de contrôle sur l'existant ----------

CREATE OR REPLACE FUNCTION public.notify_users(
  _user_ids UUID[], _type TEXT, _title TEXT, _body TEXT, _link_tab TEXT, _dedupe BOOLEAN DEFAULT false
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Une restauration remet l'existant : elle ne doit pas annoncer une « nouvelle » note ou un « nouveau » paiement.
  IF current_setting('app.restoring', true) = 'on' THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link_tab)
  SELECT DISTINCT target, _type, _title, _body, _link_tab
  FROM unnest(_user_ids) AS target
  WHERE target IS NOT NULL
    AND target IS DISTINCT FROM auth.uid()
    AND (NOT _dedupe OR NOT EXISTS (
      SELECT 1 FROM public.notifications existing
      WHERE existing.user_id = target AND existing.type = _type
        AND existing.body IS NOT DISTINCT FROM _body AND NOT existing.is_read
    ));
END $$;

CREATE OR REPLACE FUNCTION public.check_grade_scheme() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _level UUID;
  _cycle TEXT;
BEGIN
  -- Une note restaurée depuis la corbeille revient telle qu'elle était (même ancienne).
  IF current_setting('app.restoring', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.grade_type IS NOT DISTINCT FROM OLD.grade_type
     AND NEW.term IS NOT DISTINCT FROM OLD.term
     AND NEW.level_id IS NOT DISTINCT FROM OLD.level_id
     AND NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id THEN
    RETURN NEW;
  END IF;

  _level := COALESCE(NEW.level_id, (SELECT level_id FROM public.students WHERE id = NEW.student_id));
  SELECT cycle INTO _cycle FROM public.levels WHERE id = _level;

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

-- ---------- Étudiants et enseignants ----------

-- Met un étudiant ou un enseignant à la corbeille : sa fiche et tout ce qui en
-- dépend, son rôle, et le blocage de son compte (sauf s'il a un autre rôle).
CREATE OR REPLACE FUNCTION public.trash_member(_kind TEXT, _member_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _caller UUID := auth.uid();
  _user UUID;
  _role public.app_role;
  _relink JSONB := '[]'::jsonb;
  _banned BOOLEAN := false;
BEGIN
  IF _kind = 'student' THEN
    IF NOT (public.has_role(_caller, 'admin') OR public.has_role(_caller, 'academic_admin')) THEN
      RAISE EXCEPTION 'Vous n''avez pas les droits pour cette action.' USING ERRCODE = '42501';
    END IF;
    SELECT user_id INTO _user FROM public.students WHERE id = _member_id;
    _role := 'student';
  ELSIF _kind = 'teacher' THEN
    IF NOT public.has_role(_caller, 'admin') THEN
      RAISE EXCEPTION 'Vous n''avez pas les droits pour cette action.' USING ERRCODE = '42501';
    END IF;
    SELECT user_id INTO _user FROM public.teachers WHERE id = _member_id;
    _role := 'teacher';
    -- Notes et créneaux perdent leur enseignant (SET NULL) : on note lesquels pour les lui rendre.
    _relink := jsonb_build_array(
      jsonb_build_object('table', 'grades', 'column', 'teacher_id',
        'ids', COALESCE((SELECT jsonb_agg(id) FROM public.grades WHERE teacher_id = _member_id), '[]'::jsonb)),
      jsonb_build_object('table', 'schedules', 'column', 'teacher_id',
        'ids', COALESCE((SELECT jsonb_agg(id) FROM public.schedules WHERE teacher_id = _member_id), '[]'::jsonb))
    );
  ELSE
    RAISE EXCEPTION 'Action inconnue.';
  END IF;

  IF _user IS NULL THEN
    RAISE EXCEPTION 'Fiche introuvable.';
  END IF;
  IF _user = _caller THEN
    RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte.';
  END IF;

  PERFORM set_config('app.actor', _caller::text, true);
  IF _kind = 'student' THEN
    DELETE FROM public.students WHERE id = _member_id;
  ELSE
    DELETE FROM public.teachers WHERE id = _member_id;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user AND role = _role;

  -- Compte bloqué pendant le séjour en corbeille ; une personne qui garde un autre rôle reste active.
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user) THEN
    BEGIN
      UPDATE auth.users SET banned_until = now() + interval '100 years' WHERE id = _user;
      _banned := true;
    EXCEPTION WHEN insufficient_privilege THEN
      _banned := false;
    END;
  END IF;

  UPDATE public.trash
  SET extra = jsonb_build_object('user_id', _user, 'role', _role, 'banned', _banned, 'relink', _relink)
  WHERE batch_id = txid_current()
    AND table_name = CASE WHEN _kind = 'student' THEN 'students' ELSE 'teachers' END
    AND row_id = _member_id::text;

  RETURN jsonb_build_object('batch_id', txid_current(), 'banned', _banned);
END $$;

-- ---------- Restauration et effacement définitif ----------

CREATE OR REPLACE FUNCTION public.trash_assert_can_manage(_batch BIGINT) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trash WHERE batch_id = _batch) THEN
    RAISE EXCEPTION 'Cet élément n''est plus dans la corbeille.';
  END IF;
  IF NOT public.is_staff(auth.uid())
     AND EXISTS (SELECT 1 FROM public.trash WHERE batch_id = _batch AND deleted_by IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Vous ne pouvez gérer que ce que vous avez supprimé.' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.restore_trash(_batch BIGINT) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _entry RECORD;
  _link JSONB;
  _count INT := 0;
BEGIN
  PERFORM public.trash_assert_can_manage(_batch);
  PERFORM set_config('app.restoring', 'on', true);

  FOR _entry IN
    SELECT * FROM public.trash WHERE batch_id = _batch ORDER BY public.trash_rank(table_name), id
  LOOP
    IF _entry.restore_mode = 'unvoid' THEN
      EXECUTE format('UPDATE public.%I SET voided_at = NULL, void_reason = NULL WHERE id = $1', _entry.table_name)
        USING (_entry.row_id)::uuid;
    ELSE
      EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)',
        _entry.table_name, _entry.table_name)
        USING _entry.row_data;
    END IF;

    IF _entry.extra ? 'user_id' THEN
      INSERT INTO public.user_roles (user_id, role)
      SELECT (_entry.extra->>'user_id')::uuid, (_entry.extra->>'role')::public.app_role
      WHERE NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = (_entry.extra->>'user_id')::uuid AND role = (_entry.extra->>'role')::public.app_role
      );
      IF (_entry.extra->>'banned')::boolean THEN
        UPDATE auth.users SET banned_until = NULL WHERE id = (_entry.extra->>'user_id')::uuid;
      END IF;
      FOR _link IN SELECT * FROM jsonb_array_elements(COALESCE(_entry.extra->'relink', '[]'::jsonb)) LOOP
        EXECUTE format('UPDATE public.%I SET %I = $1 WHERE id IN (SELECT jsonb_array_elements_text($2)::uuid) AND %I IS NULL',
          _link->>'table', _link->>'column', _link->>'column')
          USING (_entry.row_id)::uuid, _link->'ids';
      END LOOP;
    END IF;
    _count := _count + 1;
  END LOOP;

  DELETE FROM public.trash WHERE batch_id = _batch;
  RETURN _count;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Impossible de restaurer : un élément identique existe déjà (même matricule, même numéro ou même note).';
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'Impossible de restaurer : un élément dont il dépend a été supprimé (étudiant, enseignant, niveau ou matière). Restaurez-le d''abord.';
END $$;

-- Effacement définitif d'un lot : le compte bloqué d'un étudiant ou d'un enseignant est supprimé.
CREATE OR REPLACE FUNCTION public.trash_purge_batch(_batch BIGINT) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _entry RECORD;
BEGIN
  PERFORM set_config('app.purging', 'on', true);
  FOR _entry IN
    SELECT extra FROM public.trash
    WHERE batch_id = _batch AND extra ? 'user_id' AND COALESCE((extra->>'banned')::boolean, false)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (_entry.extra->>'user_id')::uuid) THEN
      BEGIN
        DELETE FROM auth.users WHERE id = (_entry.extra->>'user_id')::uuid;
      EXCEPTION WHEN insufficient_privilege THEN
        NULL; -- le compte reste bloqué et sans rôle
      END;
    END IF;
  END LOOP;
  DELETE FROM public.trash WHERE batch_id = _batch;
  PERFORM set_config('app.purging', 'off', true);
END $$;

CREATE OR REPLACE FUNCTION public.delete_trash_batch(_batch BIGINT) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.trash_assert_can_manage(_batch);
  PERFORM public.trash_purge_batch(_batch);
END $$;

-- Vide la corbeille visible par la personne connectée.
CREATE OR REPLACE FUNCTION public.empty_trash() RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _batch BIGINT;
  _count INT := 0;
BEGIN
  FOR _batch IN
    SELECT batch_id FROM public.trash
    GROUP BY batch_id
    HAVING public.is_staff(auth.uid()) OR bool_and(deleted_by IS NOT DISTINCT FROM auth.uid())
  LOOP
    PERFORM public.trash_purge_batch(_batch);
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $$;

-- Efface ce qui a passé 30 jours en corbeille. Appelée à l'ouverture de la
-- corbeille et, si pg_cron est activé, chaque nuit.
CREATE OR REPLACE FUNCTION public.purge_expired_trash() RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _batch BIGINT;
  _count INT := 0;
BEGIN
  FOR _batch IN
    SELECT batch_id FROM public.trash GROUP BY batch_id HAVING max(deleted_at) < now() - interval '30 days'
  LOOP
    PERFORM public.trash_purge_batch(_batch);
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $$;

REVOKE ALL ON FUNCTION public.trash_purge_batch(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trash_capture() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trash_member(TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_trash(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_trash_batch(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.empty_trash() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purge_expired_trash() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trash_member(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_trash(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_trash_batch(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.empty_trash() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_trash() TO authenticated;

-- Effacement automatique chaque nuit si l'extension pg_cron est activée.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-expired-trash';
    PERFORM cron.schedule('purge-expired-trash', '17 3 * * *', 'SELECT public.purge_expired_trash()');
  END IF;
END $$;

-- Cloche de notifications : les lignes sont créées uniquement par les déclencheurs
-- ci-dessous, jamais par le navigateur. Une personne ne peut donc ni en inventer
-- ni en envoyer à quelqu'un d'autre.
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'payment', 'payslip', 'grade', 'exam', 'announcement', 'schedule', 'followup')),
  title TEXT NOT NULL,
  body TEXT,
  link_tab TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_date ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE NOT is_read;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their notifications" ON public.notifications;
CREATE POLICY "Users read their notifications" ON public.notifications
FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users mark their notifications" ON public.notifications;
CREATE POLICY "Users mark their notifications" ON public.notifications
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Seul le statut "lu" est modifiable depuis le navigateur.
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

-- Temps réel : la cloche se met à jour sans recharger la page.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ---------- Outils internes ----------
-- _dedupe : n'ajoute rien si la personne a déjà la même notification non lue,
-- pour qu'un emploi du temps saisi en 30 créneaux ne fasse pas 30 alertes.
-- La personne à l'origine de l'action n'est pas notifiée.
CREATE OR REPLACE FUNCTION public.notify_users(
  _user_ids UUID[], _type TEXT, _title TEXT, _body TEXT, _link_tab TEXT, _dedupe BOOLEAN DEFAULT false
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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

CREATE OR REPLACE FUNCTION public.notification_staff(_roles TEXT[]) RETURNS UUID[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(user_id), '{}') FROM public.user_roles WHERE role::text = ANY(_roles);
$$;

CREATE OR REPLACE FUNCTION public.notification_fcfa(_amount NUMERIC) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT replace(to_char(_amount, 'FM999,999,999,990'), ',', ' ') || ' FCFA';
$$;

CREATE OR REPLACE FUNCTION public.notification_student(_student_id UUID, OUT user_id UUID, OUT full_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.user_id, trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))
  FROM public.students s LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE s.id = _student_id;
$$;

-- Aucune de ces fonctions ne doit être appelable depuis l'API.
REVOKE ALL ON FUNCTION public.notify_users(UUID[], TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notification_staff(TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notification_student(UUID) FROM PUBLIC, anon, authenticated;

-- ---------- Messages ----------
CREATE OR REPLACE FUNCTION public.notify_on_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _targets UUID[];
BEGIN
  _targets := CASE NEW.recipient_type
    WHEN 'individual' THEN ARRAY[NEW.recipient_id]
    WHEN 'all_students' THEN public.notification_staff(ARRAY['student'])
    WHEN 'all_teachers' THEN public.notification_staff(ARRAY['teacher'])
    WHEN 'all' THEN public.notification_staff(ARRAY['student', 'teacher'])
    ELSE '{}'::UUID[]
  END;
  PERFORM public.notify_users(_targets, 'message', 'Nouveau message', NEW.subject, 'messages');
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification message : %', SQLERRM;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS notify_on_message ON public.messages;
CREATE TRIGGER notify_on_message AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- ---------- Paiements de scolarité ----------
CREATE OR REPLACE FUNCTION public.notify_on_tuition_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _title TEXT;
  _student RECORD;
  _detail TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _title := 'Paiement enregistré';
  ELSIF NEW.voided_at IS NOT NULL AND OLD.voided_at IS NULL THEN
    _title := 'Paiement annulé';
  ELSIF NEW.amount IS DISTINCT FROM OLD.amount THEN
    _title := 'Paiement modifié';
  ELSE
    RETURN NULL;
  END IF;

  SELECT * INTO _student FROM public.notification_student(NEW.student_id);
  _detail := public.notification_fcfa(NEW.amount) || ' — reçu ' || NEW.receipt_number;

  PERFORM public.notify_users(ARRAY[_student.user_id], 'payment', _title, _detail, 'payments');
  PERFORM public.notify_users(
    public.notification_staff(ARRAY['admin', 'finance_admin']), 'payment', _title,
    _student.full_name || ' : ' || _detail, 'finance'
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification paiement : %', SQLERRM;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS notify_on_tuition_payment ON public.tuition_fee_payments;
CREATE TRIGGER notify_on_tuition_payment AFTER INSERT OR UPDATE ON public.tuition_fee_payments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_tuition_payment();

-- ---------- Bulletins de paie ----------
CREATE OR REPLACE FUNCTION public.notify_on_payslip() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _title TEXT;
  _teacher_user UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _title := 'Bulletin de paie disponible';
  ELSIF NEW.voided_at IS NOT NULL AND OLD.voided_at IS NULL THEN
    _title := 'Bulletin de paie annulé';
  ELSIF NEW.gross_amount IS DISTINCT FROM OLD.gross_amount THEN
    _title := 'Bulletin de paie modifié';
  ELSE
    RETURN NULL;
  END IF;

  SELECT user_id INTO _teacher_user FROM public.teachers WHERE id = NEW.teacher_id;
  PERFORM public.notify_users(
    ARRAY[_teacher_user], 'payslip', _title,
    public.notification_fcfa(NEW.gross_amount) || ' — ' || NEW.payslip_number, 'payslips'
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification paie : %', SQLERRM;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS notify_on_payslip ON public.teacher_payslips;
CREATE TRIGGER notify_on_payslip AFTER INSERT OR UPDATE ON public.teacher_payslips
FOR EACH ROW EXECUTE FUNCTION public.notify_on_payslip();

-- ---------- Notes et examens ----------
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
  _is_exam := NEW.grade_type ILIKE 'E.%' OR NEW.grade_type ILIKE 'exam%';
  _title := CASE
    WHEN TG_OP = 'UPDATE' THEN 'Note modifiée'
    WHEN _is_exam THEN 'Résultat d''examen'
    ELSE 'Nouvelle note'
  END;

  PERFORM public.notify_users(
    ARRAY[_student.user_id], CASE WHEN _is_exam THEN 'exam' ELSE 'grade' END, _title,
    COALESCE(_subject, 'Matière') || ' — ' || NEW.grade_type || ' : '
      || rtrim(rtrim(to_char(NEW.grade_value, 'FM990.00'), '0'), '.') || '/20',
    'grades'
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification note : %', SQLERRM;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS notify_on_grade ON public.grades;
CREATE TRIGGER notify_on_grade AFTER INSERT OR UPDATE OF grade_value ON public.grades
FOR EACH ROW EXECUTE FUNCTION public.notify_on_grade();

-- ---------- Annonces ----------
CREATE OR REPLACE FUNCTION public.notify_on_announcement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _roles TEXT[];
BEGIN
  _roles := CASE NEW.target_audience
    WHEN 'students' THEN ARRAY['student']
    WHEN 'teachers' THEN ARRAY['teacher']
    ELSE ARRAY['student', 'teacher']
  END;
  PERFORM public.notify_users(
    public.notification_staff(_roles), 'announcement',
    CASE WHEN NEW.priority = 'urgent' THEN 'Annonce urgente' ELSE 'Nouvelle annonce' END,
    NEW.title, 'announcements'
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification annonce : %', SQLERRM;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS notify_on_announcement ON public.announcements;
CREATE TRIGGER notify_on_announcement AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_on_announcement();

-- ---------- Emplois du temps ----------
CREATE OR REPLACE FUNCTION public.notify_on_schedule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _level_ids UUID[];
  _teacher_ids UUID[];
  _targets UUID[];
BEGIN
  _level_ids := CASE TG_OP
    WHEN 'INSERT' THEN ARRAY[NEW.level_id]
    WHEN 'DELETE' THEN ARRAY[OLD.level_id]
    ELSE ARRAY[NEW.level_id, OLD.level_id]
  END;
  _teacher_ids := CASE TG_OP
    WHEN 'INSERT' THEN ARRAY[NEW.teacher_id]
    WHEN 'DELETE' THEN ARRAY[OLD.teacher_id]
    ELSE ARRAY[NEW.teacher_id, OLD.teacher_id]
  END;

  SELECT array_agg(user_id) INTO _targets FROM (
    SELECT user_id FROM public.students WHERE level_id = ANY(_level_ids)
    UNION
    SELECT user_id FROM public.teachers WHERE id = ANY(_teacher_ids)
  ) AS concerned;

  PERFORM public.notify_users(
    COALESCE(_targets, '{}'), 'schedule', 'Emploi du temps modifié',
    'Consultez votre emploi du temps à jour.', 'schedule', true
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification emploi du temps : %', SQLERRM;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS notify_on_schedule ON public.schedules;
CREATE TRIGGER notify_on_schedule AFTER INSERT OR UPDATE OR DELETE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.notify_on_schedule();

-- ---------- Suivi des étudiants (comportement, absences) ----------
-- Réservé à l'administration : le suivi est interne, l'étudiant n'est pas notifié.
-- Absence, retard et conduite à surveiller : une alerte par étudiant.
-- Le reste du suivi : une seule alerte non lue par niveau et par jour.
CREATE OR REPLACE FUNCTION public.notify_on_daily_report() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _student RECORD;
  _level TEXT;
  _staff UUID[];
  _day TEXT;
  _previous_attendance TEXT;
  _previous_conduct TEXT;
  _previous_observations TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    _previous_attendance := OLD.attendance;
    _previous_conduct := OLD.conduct;
    _previous_observations := OLD.observations;
  END IF;

  SELECT * INTO _student FROM public.notification_student(NEW.student_id);
  SELECT name INTO _level FROM public.levels WHERE id = NEW.level_id;
  _staff := public.notification_staff(ARRAY['admin', 'academic_admin', 'admin_secretaire']);
  _day := to_char(NEW.report_date, 'DD/MM/YYYY');

  IF NEW.attendance IS DISTINCT FROM _previous_attendance AND NEW.attendance IN ('absent', 'late') THEN
    PERFORM public.notify_users(
      _staff, 'followup', CASE NEW.attendance WHEN 'absent' THEN 'Absence signalée' ELSE 'Retard signalé' END,
      _student.full_name || ' (' || COALESCE(_level, 'sans niveau') || ') — ' || _day, 'followup'
    );
  END IF;

  IF NEW.conduct IS DISTINCT FROM _previous_conduct AND NEW.conduct = 'concern' THEN
    PERFORM public.notify_users(
      _staff, 'followup', 'Comportement à surveiller',
      _student.full_name || ' (' || COALESCE(_level, 'sans niveau') || ') — ' || _day, 'followup'
    );
  ELSIF (NEW.conduct IS DISTINCT FROM _previous_conduct AND NEW.conduct IS NOT NULL)
     OR (NEW.observations IS DISTINCT FROM _previous_observations AND NEW.observations IS NOT NULL) THEN
    PERFORM public.notify_users(
      _staff, 'followup', 'Suivi des comportements mis à jour',
      COALESCE(_level, 'Sans niveau') || ' — ' || _day, 'followup', true
    );
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification suivi : %', SQLERRM;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS notify_on_daily_report ON public.student_daily_reports;
CREATE TRIGGER notify_on_daily_report AFTER INSERT OR UPDATE ON public.student_daily_reports
FOR EACH ROW EXECUTE FUNCTION public.notify_on_daily_report();

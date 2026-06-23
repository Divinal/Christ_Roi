-- Permet à PostgREST d'embarquer profiles(...) depuis user_roles,
-- pour afficher nom/email dans l'onglet "Comptes Admin"
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);

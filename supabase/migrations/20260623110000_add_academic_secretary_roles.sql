-- Deux nouveaux rôles : admin pédagogique (tout sauf finances) et
-- admin secrétaire (inscriptions, affectations, emplois du temps, matières/cours)
ALTER TYPE public.app_role ADD VALUE 'academic_admin';
ALTER TYPE public.app_role ADD VALUE 'admin_secretaire';

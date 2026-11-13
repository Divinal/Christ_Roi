// Inscription en ligne par lien : gestion des liens (administration) et appels
// de la page publique. Le compte est créé par la fonction serveur admin-users.
import { supabase } from './supabaseClient';
import { callAdminUsers } from './adminUsers';
import { SchoolCycle } from './levels';
import { t } from '../i18n';

export type RegistrationRole = 'student' | 'teacher';

export interface RegistrationLink {
  id: string;
  token: string;
  role: RegistrationRole;
  label: string | null;
  // Lien étudiant réservé à un cycle ; nul : tous les niveaux (anciens liens).
  cycle?: SchoolCycle | null;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export type LinkStatus = 'active' | 'expired' | 'full' | 'disabled';

export const REGISTRATION_PATH = '/inscription/';

export const registrationUrl = (token: string): string => `${window.location.origin}${REGISTRATION_PATH}${token}`;

export const tokenFromPath = (pathname: string): string =>
  pathname.startsWith(REGISTRATION_PATH) ? decodeURIComponent(pathname.slice(REGISTRATION_PATH.length).split('/')[0]) : '';

export const linkStatus = (link: RegistrationLink, now = Date.now()): LinkStatus => {
  if (!link.is_active) return 'disabled';
  if (link.expires_at && new Date(link.expires_at).getTime() <= now) return 'expired';
  if (link.max_uses !== null && link.use_count >= link.max_uses) return 'full';
  return 'active';
};

// 24 octets aléatoires → 32 caractères sûrs dans une adresse.
export const generateToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export class RegistrationNotActivatedError extends Error {}

const isMissingTable = (error: { code?: string } | null) => error?.code === 'PGRST205' || error?.code === '42P01';

export const fetchRegistrationLinks = async (role: RegistrationRole): Promise<RegistrationLink[]> => {
  // Toutes les colonnes : la liste s'affiche aussi avant la migration qui ajoute « cycle ».
  const { data, error } = await supabase
    .from('registration_links')
    .select('*')
    .eq('role', role)
    .order('created_at', { ascending: false });
  if (isMissingTable(error)) throw new RegistrationNotActivatedError();
  if (error) throw error;
  return (data || []) as RegistrationLink[];
};

export const createRegistrationLink = async (link: {
  role: RegistrationRole;
  label: string | null;
  cycle?: SchoolCycle | null;
  maxUses: number | null;
  validityDays: number | null;
}): Promise<RegistrationLink> => {
  const expiresAt = link.validityDays ? new Date(Date.now() + link.validityDays * 86400000).toISOString() : null;
  const { data, error } = await supabase
    .from('registration_links')
    .insert({
      token: generateToken(),
      role: link.role,
      label: link.label,
      max_uses: link.maxUses,
      expires_at: expiresAt,
      ...(link.cycle ? { cycle: link.cycle } : {}),
    })
    .select('*')
    .single();
  if (isMissingTable(error)) throw new RegistrationNotActivatedError();
  // Colonne « cycle » absente : la migration correspondante n'est pas encore appliquée.
  if (error && (error.code === 'PGRST204' || error.code === '42703') && /cycle/.test(error.message || '')) {
    throw new Error(t("La base de données doit être mise à jour (cycle des liens d'inscription) avant de créer ce lien."));
  }
  if (error) throw error;
  return data as RegistrationLink;
};

export const setRegistrationLinkActive = async (id: string, isActive: boolean): Promise<void> => {
  const { data, error } = await supabase.from('registration_links').update({ is_active: isActive }).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error(t("Modification refusée : vous n'avez pas les droits nécessaires."));
};

// ---------- Page publique ----------

export interface RegistrationLevel {
  id: string;
  name: string;
  cycle: SchoolCycle;
  position: number;
  number_prefix: string;
}

export interface RegistrationInfo {
  role: RegistrationRole;
  label: string | null;
  expires_at: string | null;
  cycle?: SchoolCycle | null;
  levels?: RegistrationLevel[];
  number_prefix?: string;
}

export const fetchRegistrationInfo = (token: string) =>
  callAdminUsers<RegistrationInfo>('registration_info', { token });

export const submitRegistration = (token: string, fields: Record<string, string>) =>
  callAdminUsers<{ role: RegistrationRole; email: string; number: string }>('register', { token, ...fields });

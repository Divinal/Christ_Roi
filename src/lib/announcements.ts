import { supabase } from './supabaseClient';
import { t } from '../i18n';

export interface Announcement {
  id: string;
  author_id?: string;
  title: string;
  content: string;
  target_audience: 'students' | 'teachers' | 'all';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  published_at: string;
  expires_at?: string | null;
}

export const PRIORITY_LABELS: Record<Announcement['priority'], string> = {
  low: t("Basse"),
  normal: t("Normale"),
  high: t("Élevée"),
  urgent: t("Urgente"),
};

export const PRIORITY_CLASSES: Record<Announcement['priority'], string> = {
  low: 'bg-gray-100 text-gray-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export const AUDIENCE_LABELS: Record<Announcement['target_audience'], string> = {
  all: t("Tous"),
  students: t("Étudiants"),
  teachers: t("Enseignants"),
};

// Une annonce reste visible toute la journée de sa date d'expiration.
const isActive = (announcement: Announcement, today: string): boolean =>
  !announcement.expires_at || announcement.expires_at.slice(0, 10) >= today;

export const fetchActiveAnnouncements = async (audience: 'students' | 'teachers'): Promise<Announcement[]> => {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .in('target_audience', [audience, 'all'])
    .order('published_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Erreur chargement annonces:', error);
    return [];
  }
  const today = new Date().toISOString().slice(0, 10);
  return ((data || []) as Announcement[]).filter((a) => isActive(a, today));
};

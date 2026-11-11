import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { notify } from '../components/ui/feedback';
import { t, locale } from '../i18n';

export type NotificationType =
  | 'message' | 'payment' | 'payslip' | 'grade' | 'exam' | 'announcement' | 'schedule' | 'followup';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link_tab: string | null;
  is_read: boolean;
  created_at: string;
}

// Signale aux autres écrans qu'une notification vient d'arriver (ex. la messagerie se recharge).
export const NOTIFICATION_EVENT = 'app:notification';

const POLL_MS = 60000; // filet de sécurité si le temps réel est coupé
const DEBOUNCE_MS = 300;

export const useNotifications = (userId: string | undefined) => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [available, setAvailable] = useState(true);
  // null tant que le premier chargement n'a pas eu lieu : l'existant ne doit pas s'annoncer.
  const knownIds = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, link_tab, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      // Table pas encore créée sur le serveur : pas de cloche, plutôt qu'une erreur.
      if (error.code === 'PGRST205') setAvailable(false);
      else console.error('Erreur chargement notifications:', error);
      return;
    }

    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    const rows = (data || []) as AppNotification[];
    if (knownIds.current) {
      const fresh = rows.filter((row) => !row.is_read && !knownIds.current?.has(row.id));
      if (fresh.length === 1) {
        notify(fresh[0].body ? `${t(fresh[0].title)}\n${t(fresh[0].body)}` : t(fresh[0].title), 'info');
      } else if (fresh.length > 1) {
        notify(t("{0} nouvelles notifications", [fresh.length]), 'info');
      }
      if (fresh.length > 0) {
        window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: { types: fresh.map((row) => row.type) } }));
      }
    }
    knownIds.current = new Set(rows.map((row) => row.id));
    setItems(rows);
    setUnreadCount(count ?? rows.filter((row) => !row.is_read).length);
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    knownIds.current = null;
    load();

    // Une action peut créer plusieurs lignes d'un coup : un seul rechargement suffit.
    let timer: number | undefined;
    const scheduleLoad = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(load, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        scheduleLoad,
      )
      .subscribe();

    const interval = window.setInterval(load, POLL_MS);
    window.addEventListener('focus', load);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener('focus', load);
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (!userId || ids.length === 0) return;
      setItems((previous) => previous.map((row) => (ids.includes(row.id) ? { ...row, is_read: true } : row)));
      setUnreadCount((previous) => Math.max(0, previous - ids.length));
      const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', ids).eq('user_id', userId);
      if (error) {
        console.error('Erreur marquage notifications:', error);
        load();
      }
    },
    [userId, load],
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setItems((previous) => previous.map((row) => ({ ...row, is_read: true })));
    setUnreadCount(0);
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) {
      console.error('Erreur marquage notifications:', error);
      load();
    }
  }, [userId, load]);

  return { items, unreadCount, available, markRead, markAllRead };
};

export const relativeTime = (iso: string): string => {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return t("à l'instant");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return format.format(days, 'day');
  return new Date(iso).toLocaleDateString(locale());
};

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export interface InboxMessage {
  id: string;
  subject: string;
  content: string;
  sent_at: string;
  sender_name: string;
  is_read: boolean;
}

const COLLECTIVE_TYPE = { students: 'all_students', teachers: 'all_teachers' } as const;

// Les expéditeurs sont lus à part : messages référence auth.users, qui n'est
// pas exposée par l'API (pas de jointure possible).
export const fetchProfileNames = async (userIds: string[]): Promise<Map<string, string>> => {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const { data } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', ids);
  return new Map(
    (data || []).map((profile) => [profile.user_id, `${profile.first_name} ${profile.last_name}`.trim()]),
  );
};

// Boîte de réception d'un étudiant ou d'un enseignant. À l'ouverture de la
// messagerie (active), les messages personnels passent à "lu" ; les messages
// collectifs n'ont pas de statut par destinataire.
export const useInbox = (userId: string | undefined, audience: 'students' | 'teachers', active: boolean) => {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, subject, content, sent_at, sender_id, is_read, recipient_type')
      .or(`recipient_type.eq.${COLLECTIVE_TYPE[audience]},recipient_type.eq.all,and(recipient_type.eq.individual,recipient_id.eq.${userId})`)
      .order('sent_at', { ascending: false })
      .limit(50);
    setLoading(false);

    if (error) {
      console.error('Erreur chargement messages:', error);
      return;
    }
    const names = await fetchProfileNames((data || []).map((message) => message.sender_id));
    setMessages(
      (data || []).map((message) => ({
        id: message.id,
        subject: message.subject,
        content: message.content,
        sent_at: message.sent_at,
        sender_name: names.get(message.sender_id) || 'Administration',
        is_read: message.recipient_type !== 'individual' || Boolean(message.is_read),
      })),
    );
  }, [userId, audience]);

  useEffect(() => {
    load();
    // Rouvrir la messagerie affiche aussi ce qui est arrivé entre-temps.
  }, [load, active]);

  // Un message arrivé pendant qu'on regarde l'écran apparaît sans recharger la page.
  useEffect(() => {
    const onNotification = (event: Event) => {
      if ((event as CustomEvent<{ types: string[] }>).detail.types.includes('message')) load();
    };
    window.addEventListener('app:notification', onNotification);
    return () => window.removeEventListener('app:notification', onNotification);
  }, [load]);

  useEffect(() => {
    if (!active || !userId) return;
    const unreadIds = messages.filter((m) => !m.is_read && !seenIds.has(m.id)).map((m) => m.id);
    if (unreadIds.length === 0) return;

    setSeenIds((previous) => new Set([...previous, ...unreadIds]));
    supabase
      .from('messages')
      .update({ is_read: true })
      .in('id', unreadIds)
      .eq('recipient_id', userId)
      .then(({ error }) => {
        if (error) console.error('Erreur marquage messages lus:', error);
      });
  }, [active, messages, seenIds, userId]);

  const unreadCount = messages.filter((m) => !m.is_read && !seenIds.has(m.id)).length;
  return { messages, unreadCount, loading };
};

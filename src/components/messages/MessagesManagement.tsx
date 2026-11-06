import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock3, MessageSquare, Search, Send, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { Level } from '../../lib/levels';
import { fetchProfileNames } from '../../lib/messages';
import { normalizeText } from '../../lib/students';
import LevelSelect from '../levels/LevelSelect';
import { confirmDialog, notify } from '../ui/feedback';
import { EmptyState, Panel } from '../ui/primitives';

export type RecipientKind = 'student' | 'teacher';

export interface MessageRecipientTarget {
  kind: RecipientKind;
  userId: string;
}

interface Person {
  user_id: string;
  level_id?: string | null;
  student_number?: string;
  teacher_number?: string;
  profiles?: { first_name: string; last_name: string; email?: string } | null;
  levels?: { name: string } | null;
}

interface SentMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  content: string;
  is_read: boolean;
  sent_at: string;
}

interface MessagesManagementProps {
  levels: Level[];
  students: Person[];
  teachers: Person[];
  currentUserId?: string;
  canDeleteAny: boolean;
  initialRecipient?: MessageRecipientTarget | null;
}

const nameOf = (person?: Person): string =>
  `${person?.profiles?.first_name || ''} ${person?.profiles?.last_name || ''}`.trim() || 'Sans nom';

const numberOf = (person: Person): string => person.student_number || person.teacher_number || '';

const MessagesManagement: React.FC<MessagesManagementProps> = ({
  levels,
  students,
  teachers,
  currentUserId,
  canDeleteAny,
  initialRecipient,
}) => {
  const [kind, setKind] = useState<RecipientKind>(initialRecipient?.kind || 'student');
  const [levelId, setLevelId] = useState('');
  const [search, setSearch] = useState('');
  const [recipientId, setRecipientId] = useState(initialRecipient?.userId || '');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const [sent, setSent] = useState<SentMessage[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loadingSent, setLoadingSent] = useState(true);
  const [sentSearch, setSentSearch] = useState('');

  const people = kind === 'student' ? students : teachers;
  const peopleByUser = useMemo(() => {
    const map = new Map<string, { person: Person; kind: RecipientKind }>();
    students.forEach((person) => map.set(person.user_id, { person, kind: 'student' }));
    teachers.forEach((person) => map.set(person.user_id, { person, kind: 'teacher' }));
    return map;
  }, [students, teachers]);

  const options = useMemo(() => {
    const term = normalizeText(search.trim());
    return people
      .filter((person) => kind !== 'student' || !levelId || person.level_id === levelId)
      .filter((person) =>
        !term || normalizeText(`${nameOf(person)} ${numberOf(person)} ${person.profiles?.email || ''}`).includes(term),
      )
      .sort((a, b) =>
        `${a.profiles?.last_name} ${a.profiles?.first_name}`.localeCompare(
          `${b.profiles?.last_name} ${b.profiles?.first_name}`,
          'fr',
        ),
      );
  }, [people, kind, levelId, search]);

  const recipient = people.find((person) => person.user_id === recipientId);

  // Un filtre ne doit pas laisser un destinataire invisible à l'écran : on
  // enverrait le message à quelqu'un qui n'est plus affiché dans la liste.
  useEffect(() => {
    if (recipientId && !options.some((person) => person.user_id === recipientId)) {
      setRecipientId('');
    }
  }, [options, recipientId]);

  const loadSent = useCallback(async () => {
    setLoadingSent(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, subject, content, is_read, sent_at')
      .eq('recipient_type', 'individual')
      .order('sent_at', { ascending: false })
      .limit(100);

    if (error) {
      notify(`❌ Erreur: ${error.message}`);
      setLoadingSent(false);
      return;
    }
    const rows = (data || []) as SentMessage[];
    setNames(await fetchProfileNames(rows.flatMap((row) => [row.sender_id, row.recipient_id])));
    setSent(rows);
    setLoadingSent(false);
  }, []);

  useEffect(() => {
    loadSent();
  }, [loadSent]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recipient) {
      notify('⚠️ Choisissez le destinataire du message.');
      return;
    }

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      recipient_type: 'individual',
      recipient_id: recipient.user_id,
      subject: subject.trim(),
      content: content.trim(),
    });
    setSending(false);

    if (error) {
      notify(`❌ Erreur: ${error.message}`);
      return;
    }
    notify(`✅ Message envoyé à ${nameOf(recipient)}`);
    setSubject('');
    setContent('');
    setRecipientId('');
    loadSent();
  };

  const remove = async (message: SentMessage) => {
    const confirmed = await confirmDialog(
      `⚠️ Supprimer le message « ${message.subject} » ?\n\nIl disparaîtra aussi de la messagerie du destinataire.`,
      { title: 'Supprimer le message', confirmLabel: 'Supprimer' },
    );
    if (!confirmed) return;

    const { data, error } = await supabase.from('messages').delete().eq('id', message.id).select('id');
    if (error) {
      notify(`❌ Erreur: ${error.message}`);
    } else if (!data?.length) {
      notify("❌ Suppression refusée : vous n'avez pas les droits nécessaires.");
    } else {
      notify('✅ Message supprimé');
      loadSent();
    }
  };

  const recipientName = (message: SentMessage): string =>
    names.get(message.recipient_id) || nameOf(peopleByUser.get(message.recipient_id)?.person);

  const visibleSent = sent.filter((message) => {
    const term = normalizeText(sentSearch.trim());
    return !term || normalizeText(`${recipientName(message)} ${message.subject} ${message.content}`).includes(term);
  });

  return (
    <div className="grid items-start gap-4 md:gap-6 xl:grid-cols-5">
      <Panel
        className="xl:col-span-2"
        title="Nouveau message"
        description="Le message est envoyé à une seule personne et apparaît dans sa messagerie."
      >
        <form onSubmit={send} className="space-y-4">
          <fieldset>
            <legend className="mb-2 block text-sm font-medium">Destinataire</legend>
            <div className="grid grid-cols-2 gap-2">
              {([['student', 'Un étudiant'], ['teacher', 'Un enseignant']] as [RecipientKind, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={kind === value}
                  onClick={() => {
                    setKind(value);
                    setRecipientId('');
                    setSearch('');
                    setLevelId('');
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    kind === value ? 'border-indigo-600 bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {kind === 'student' && (
            <div>
              <label htmlFor="message-level" className="mb-2 block text-sm font-medium">Niveau (facultatif)</label>
              <LevelSelect
                id="message-level"
                levels={levels}
                value={levelId}
                onChange={setLevelId}
                placeholder="Tous les niveaux"
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
          )}

          <div>
            <label htmlFor="message-search" className="mb-2 block text-sm font-medium">Rechercher</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                id="message-search"
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom, matricule, email..."
                className="w-full rounded-lg border py-2 pl-10 pr-3"
              />
            </div>
          </div>

          <div>
            <label htmlFor="message-recipient" className="mb-2 block text-sm font-medium">
              {kind === 'student' ? 'Étudiant' : 'Enseignant'} * ({options.length})
            </label>
            <select
              id="message-recipient"
              required
              value={recipientId}
              onChange={(event) => setRecipientId(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="">Choisir...</option>
              {options.map((person) => (
                <option key={person.user_id} value={person.user_id}>
                  {person.profiles?.last_name} {person.profiles?.first_name} — {numberOf(person)}
                  {kind === 'student' && person.levels?.name ? ` (${person.levels.name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="message-subject" className="mb-2 block text-sm font-medium">Objet *</label>
            <input
              id="message-subject"
              type="text"
              required
              maxLength={200}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="message-content" className="mb-2 block text-sm font-medium">Message *</label>
            <textarea
              id="message-content"
              required
              rows={6}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Envoi...' : recipient ? `Envoyer à ${nameOf(recipient)}` : 'Envoyer'}
          </button>
        </form>
      </Panel>

      <Panel className="min-w-0 xl:col-span-3" title={`Messages envoyés (${visibleSent.length})`}>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            aria-label="Rechercher dans les messages envoyés"
            value={sentSearch}
            onChange={(event) => setSentSearch(event.target.value)}
            placeholder="Destinataire, objet, contenu..."
            className="w-full rounded-lg border py-2 pl-10 pr-3"
          />
        </div>
        {loadingSent && sent.length === 0 ? (
          <p className="py-8 text-center text-gray-500">Chargement...</p>
        ) : visibleSent.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Aucun message envoyé" />
        ) : (
          <ul className="space-y-3">
            {visibleSent.map((message) => (
              <li key={message.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      À : {recipientName(message)}
                      {peopleByUser.get(message.recipient_id) && (
                        <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600">
                          {peopleByUser.get(message.recipient_id)?.kind === 'student' ? 'Étudiant' : 'Enseignant'}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 font-medium text-gray-800">{message.subject}</p>
                  </div>
                  {(canDeleteAny) && (
                    <button
                      onClick={() => remove(message)}
                      title="Supprimer"
                      aria-label={`Supprimer le message ${message.subject}`}
                      className="shrink-0 rounded p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700">{message.content}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>{new Date(message.sent_at).toLocaleString('fr-FR')}</span>
                  {message.sender_id !== currentUserId && <span>Par {names.get(message.sender_id) || 'un autre compte'}</span>}
                  {message.is_read ? (
                    <span className="flex items-center gap-1 text-green-600"><Check className="h-3.5 w-3.5" /> Lu</span>
                  ) : (
                    <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Non lu</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default MessagesManagement;

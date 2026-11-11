import React from 'react';
import { MessageSquare } from 'lucide-react';
import { InboxMessage } from '../../lib/messages';
import { EmptyState, Panel } from '../ui/primitives';
import { t, locale } from '../../i18n';

const MessageInbox: React.FC<{ messages: InboxMessage[]; loading: boolean }> = ({ messages, loading }) => (
  <Panel title={t("Mes messages ({0})", [messages.length])}>
    {messages.length === 0 ? (
      loading ? (
        <p className="py-8 text-center text-gray-500">{t("Chargement...")}</p>
      ) : (
        <EmptyState icon={MessageSquare} title={t("Aucun message")} hint={t("Les messages de l'administration apparaîtront ici.")} />
      )
    ) : (
      <ul className="space-y-3">
        {messages.map((message) => (
          <li key={message.id} className="rounded-lg border p-4">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{message.subject}</p>
                <p className="text-xs text-gray-500">
                  {t("De :")} {message.sender_name} • {new Date(message.sent_at).toLocaleString(locale())}
                </p>
              </div>
              {!message.is_read && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{t("Nouveau")}</span>
              )}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm text-gray-700">{message.content}</p>
          </li>
        ))}
      </ul>
    )}
  </Panel>
);

export default MessageInbox;

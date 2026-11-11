import React, { useEffect, useRef, useState } from 'react';
import {
  Award, Bell, BellOff, Calendar, CheckCheck, ClipboardCheck, DollarSign, FileText, LucideIcon, Megaphone, MessageSquare, Wallet,
} from 'lucide-react';
import { AppNotification, NotificationType, relativeTime, useNotifications } from '../../lib/notifications';
import { t } from '../../i18n';

const TYPE_STYLES: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  message: { icon: MessageSquare, className: 'bg-indigo-100 text-indigo-600' },
  payment: { icon: DollarSign, className: 'bg-green-100 text-green-600' },
  payslip: { icon: Wallet, className: 'bg-green-100 text-green-600' },
  grade: { icon: FileText, className: 'bg-blue-100 text-blue-600' },
  exam: { icon: Award, className: 'bg-blue-100 text-blue-600' },
  announcement: { icon: Megaphone, className: 'bg-orange-100 text-orange-600' },
  schedule: { icon: Calendar, className: 'bg-indigo-100 text-indigo-600' },
  followup: { icon: ClipboardCheck, className: 'bg-red-100 text-red-600' },
};

interface NotificationBellProps {
  userId?: string;
  activeTab: string;
  onNavigate: (tab: string) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId, activeTab, onNavigate }) => {
  const { items, unreadCount, available, markRead, markAllRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ouvrir une rubrique vaut lecture de ses notifications : la cloche et le
  // contenu affiché restent cohérents.
  useEffect(() => {
    const seen = items.filter((item) => !item.is_read && item.link_tab === activeTab).map((item) => item.id);
    if (seen.length > 0) markRead(seen);
  }, [activeTab, items, markRead]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openItem = (item: AppNotification) => {
    if (!item.is_read) markRead([item.id]);
    if (item.link_tab) onNavigate(item.link_tab);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unreadCount > 0 ? t("Notifications : {0} non lues", [unreadCount]) : t("Notifications")}
        className="relative rounded-lg p-2 text-gray-700 hover:bg-gray-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label={t("Notifications")}
          className="fixed inset-x-3 top-[4.25rem] z-30 flex max-h-[75vh] flex-col rounded-xl bg-white shadow-lg sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">{t("Notifications")}</h2>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
              >
                <CheckCheck className="h-4 w-4" /> {t("Tout marquer comme lu")}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <BellOff className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              <p className="text-sm text-gray-500">
                {available
                  ? t("Aucune notification pour le moment")
                  : t("Les notifications ne sont pas encore activées sur le serveur.")}
              </p>
            </div>
          ) : (
            <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
              {items.map((item) => {
                const { icon: Icon, className } = TYPE_STYLES[item.type] || TYPE_STYLES.message;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => openItem(item)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-start hover:bg-gray-100 ${item.is_read ? '' : 'bg-gray-50'}`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${className}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm text-gray-900 ${item.is_read ? '' : 'font-semibold'}`}>{t(item.title)}</span>
                        {item.body && <span className="block break-words text-xs text-gray-600">{t(item.body)}</span>}
                        <span className="mt-0.5 block text-xs text-gray-500">{relativeTime(item.created_at)}</span>
                      </span>
                      {!item.is_read && (
                        <span aria-label={t("Non lue")} className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

import React, { useMemo, useState } from 'react';
import { KeyRound, LogOut, LucideIcon, Menu, X } from 'lucide-react';
import { siteConfig } from '../../config/site.config';
import { CURRENT_ACADEMIC_YEAR } from '../../lib/levels';
import { confirmDialog } from './feedback';
import NotificationBell from './NotificationBell';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface AppShellProps {
  spaceLabel: string;
  userId?: string;
  groups: NavGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  userName: string;
  roleLabel: string;
  onLogout: () => void;
  onChangePassword: () => void;
  children: React.ReactNode;
}

const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';

// Gabarit commun aux espaces admin, enseignant et étudiant : même menu latéral,
// même barre supérieure, même comportement sur mobile.
const AppShell: React.FC<AppShellProps> = ({
  spaceLabel,
  userId,
  groups,
  activeId,
  onSelect,
  userName,
  roleLabel,
  onLogout,
  onChangePassword,
  children,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const visibleGroups = useMemo(() => groups.filter((group) => group.items.length > 0), [groups]);

  const activeGroup = visibleGroups.find((group) => group.items.some((item) => item.id === activeId));
  const activeItem = activeGroup?.items.find((item) => item.id === activeId);

  return (
    <div className="min-h-screen bg-gray-50">
      {drawerOpen && (
        <div className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden" onClick={() => setDrawerOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-white transition-transform duration-200 lg:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
          <img
            src={siteConfig.logoUrl}
            alt=""
            className="h-9 w-9 shrink-0 object-contain"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{siteConfig.schoolName}</p>
            <p className="truncate text-xs text-gray-500">{spaceLabel}</p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Fermer le menu"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Menu principal" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === activeId;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          onSelect(item.id);
                          setDrawerOpen(false);
                        }}
                        aria-current={active ? 'page' : undefined}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                          active
                            ? 'bg-indigo-100 font-medium text-indigo-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {Boolean(item.badge) && (
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t p-3">
          <div className="flex items-center gap-3 px-1">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white"
            >
              {initialsOf(userName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{userName || 'Utilisateur'}</p>
              <p className="truncate text-xs text-gray-500">{roleLabel}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={onChangePassword}
              className="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
            >
              <KeyRound className="h-3.5 w-3.5" /> Mot de passe
            </button>
            <button
              onClick={async () => {
                const confirmed = await confirmDialog('Voulez-vous vous déconnecter ?', {
                  title: 'Déconnexion',
                  confirmLabel: 'Se déconnecter',
                });
                if (confirmed) onLogout();
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
            >
              <LogOut className="h-3.5 w-3.5" /> Déconnexion
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white px-4 md:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            {activeGroup && <p className="truncate text-xs text-gray-500">{activeGroup.label}</p>}
            <h1 className="truncate text-base font-semibold text-gray-900">{activeItem?.label}</h1>
          </div>
          <NotificationBell
            userId={userId}
            activeTab={activeId}
            onNavigate={(tab) => {
              // Un lien vers une rubrique que ce rôle n'a pas ne doit rien afficher de vide.
              if (visibleGroups.some((group) => group.items.some((item) => item.id === tab))) onSelect(tab);
            }}
          />
          <span className="hidden whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 sm:inline">
            Année {CURRENT_ACADEMIC_YEAR}
          </span>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-7xl p-3 md:p-6">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;

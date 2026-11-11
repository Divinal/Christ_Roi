import React from 'react';
import {
  AlertTriangle, Bell, BookOpen, Clock, FileText, GraduationCap, Plus, UserPlus, Users,
} from 'lucide-react';
import { CYCLES, Level } from '../../lib/levels';
import { Announcement, PRIORITY_CLASSES, PRIORITY_LABELS } from '../../lib/announcements';
import { formatDate } from '../../lib/grades';
import { Panel, StatTile } from '../ui/primitives';
import { t } from '../../i18n';

export type QuickAddType = 'student' | 'teacher' | 'subject' | 'schedule' | 'announcement';

interface AdminHomeProps {
  students: { level_id?: string | null }[];
  teacherCount: number;
  subjectCount: number;
  levels: Level[];
  announcements: Announcement[];
  allowedTabs: string[];
  onNavigate: (tab: string) => void;
  onQuickAdd: (type: QuickAddType) => void;
}

const QUICK_ACTIONS: { label: string; icon: React.ElementType; tab: string; type: QuickAddType }[] = [
  { label: t("Ajouter un étudiant"), icon: UserPlus, tab: 'students', type: 'student' },
  { label: t("Ajouter un enseignant"), icon: UserPlus, tab: 'teachers', type: 'teacher' },
  { label: t("Créer une matière"), icon: Plus, tab: 'subjects', type: 'subject' },
  { label: t("Ajouter un créneau"), icon: Clock, tab: 'schedules', type: 'schedule' },
  { label: t("Publier une annonce"), icon: Bell, tab: 'announcements', type: 'announcement' },
];

const AdminHome: React.FC<AdminHomeProps> = ({
  students,
  teacherCount,
  subjectCount,
  levels,
  announcements,
  allowedTabs,
  onNavigate,
  onQuickAdd,
}) => {
  const unenrolled = students.filter((student) => !student.level_id).length;
  const enrolledOf = (cycle: string): number => {
    const ids = new Set(levels.filter((level) => level.cycle === cycle).map((level) => level.id));
    return students.filter((student) => student.level_id && ids.has(student.level_id)).length;
  };
  const largestCycle = Math.max(1, ...CYCLES.map((cycle) => enrolledOf(cycle.id)));
  const actions = QUICK_ACTIONS.filter((action) => allowedTabs.includes(action.tab));

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatTile icon={Users} tone="blue" label={t("Étudiants")} value={students.length} />
        <StatTile icon={BookOpen} tone="green" label={t("Enseignants")} value={teacherCount} />
        <StatTile icon={GraduationCap} tone="indigo" label={t("Niveaux")} value={levels.length} />
        <StatTile icon={FileText} tone="orange" label={t("Matières")} value={subjectCount} />
      </div>

      {unenrolled > 0 && (
        <button
          onClick={() => onNavigate('levels')}
          className="flex w-full items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-start hover:bg-orange-100"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-600" />
          <span className="text-sm text-orange-700">
            <strong>{unenrolled} {t("étudiant(s)")}</strong> {t("ne sont inscrits dans aucun niveau. Cliquez pour les inscrire.")}
          </span>
        </button>
      )}

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Panel title={t("Effectifs par cycle")}>
          <ul className="space-y-3">
            {CYCLES.map((cycle) => {
              const count = enrolledOf(cycle.id);
              return (
                <li key={cycle.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-gray-700">{cycle.label}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-indigo-600"
                      style={{ width: `${(count / largestCycle) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        {actions.length > 0 && (
          <Panel title={t("Actions rapides")}>
            <div className="grid gap-2 sm:grid-cols-2">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.type}
                    onClick={() => {
                      onNavigate(action.tab);
                      onQuickAdd(action.type);
                    }}
                    className="flex items-center gap-3 rounded-lg border p-3 text-start text-sm hover:bg-gray-100"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-indigo-600" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </Panel>
        )}
      </div>

      {allowedTabs.includes('announcements') && (
        <Panel
          title={t("Dernières annonces")}
          actions={
            <button onClick={() => onNavigate('announcements')} className="text-sm text-indigo-600 hover:underline">
              {t("Tout voir")}
            </button>
          }
        >
          {announcements.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">{t("Aucune annonce publiée")}</p>
          ) : (
            <ul className="divide-y">
              {announcements.slice(0, 3).map((announcement) => (
                <li key={announcement.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{announcement.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(announcement.published_at)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_CLASSES[announcement.priority]}`}>
                    {PRIORITY_LABELS[announcement.priority]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
};

export default AdminHome;

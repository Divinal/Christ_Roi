import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarCheck, CalendarX, ClipboardCheck, Clock3, Printer } from 'lucide-react';
import {
  DailyReport,
  FollowUpNotActivatedError,
  daysAgoLocal,
  fetchReports,
  todayLocal,
} from '../../lib/followup';
import { formatDate } from '../../lib/grades';
import { NOTIFICATION_EVENT } from '../../lib/notifications';
import { notify } from '../ui/feedback';
import { EmptyState, Panel, StatTile } from '../ui/primitives';
import FollowUpPrint from './FollowUpPrint';
import { ReportsTable } from './StudentFollowUp';
import { t } from '../../i18n';

interface MyFollowUpProps {
  studentId: string;
  studentName: string;
}

// Le suivi vu par l'étudiant et ses parents : lecture seule, imprimable.
const MyFollowUp: React.FC<MyFollowUpProps> = ({ studentId, studentName }) => {
  const [from, setFrom] = useState(daysAgoLocal(30));
  const [to, setTo] = useState(todayLocal());
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [notActivated, setNotActivated] = useState(false);
  const [printing, setPrinting] = useState(false);
  const request = useRef(0);

  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    try {
      const rows = await fetchReports([studentId], from, to);
      if (current === request.current) setReports(rows);
    } catch (error) {
      if (current !== request.current) return;
      if (error instanceof FollowUpNotActivatedError) setNotActivated(true);
      else notify(`❌ Erreur: ${(error as Error).message}`);
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [studentId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // Un rapport saisi pendant qu'on regarde l'écran apparaît sans recharger la page.
  useEffect(() => {
    const onNotification = (event: Event) => {
      if ((event as CustomEvent<{ types: string[] }>).detail.types.includes('followup')) load();
    };
    window.addEventListener(NOTIFICATION_EVENT, onNotification);
    return () => window.removeEventListener(NOTIFICATION_EVENT, onNotification);
  }, [load]);

  if (notActivated) {
    return (
      <Panel>
        <EmptyState icon={ClipboardCheck} title={t("Le suivi n'est pas encore disponible")} />
      </Panel>
    );
  }

  const absences = reports.filter((report) => report.attendance === 'absent').length;
  const lateness = reports.filter((report) => report.attendance === 'late').length;
  const concerns = reports.filter((report) => report.conduct === 'concern').length;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatTile icon={CalendarCheck} tone="blue" label={t("Jours renseignés")} value={new Set(reports.map((r) => r.report_date)).size} />
        <StatTile icon={CalendarX} tone="red" label={t("Absences")} value={absences} />
        <StatTile icon={Clock3} tone="orange" label={t("Retards")} value={lateness} />
        <StatTile icon={AlertTriangle} tone="red" label={t("Conduite à surveiller")} value={concerns} />
      </div>

      <Panel
        title={t("Mon suivi")}
        description={t("Les rapports de vos enseignants et de l'administration. Vous pouvez les imprimer pour vos parents.")}
        actions={
          <button
            onClick={() => setPrinting(true)}
            disabled={reports.length === 0}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Printer className="h-4 w-4" /> {t("Imprimer")}
          </button>
        }
      >
        <div className="mb-4 grid max-w-md grid-cols-2 gap-3">
          <div>
            <label htmlFor="my-followup-from" className="mb-2 block text-sm font-medium">{t("Du")}</label>
            <input
              id="my-followup-from"
              type="date"
              value={from}
              max={to}
              onChange={(event) => event.target.value && setFrom(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="my-followup-to" className="mb-2 block text-sm font-medium">{t("Au")}</label>
            <input
              id="my-followup-to"
              type="date"
              value={to}
              min={from}
              max={todayLocal()}
              onChange={(event) => event.target.value && setTo(event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
        </div>

        {loading && reports.length === 0 ? (
          <p className="py-8 text-center text-gray-500">{t("Chargement...")}</p>
        ) : reports.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title={t("Aucun rapport sur cette période")} />
        ) : (
          <ReportsTable reports={reports} hideStudent />
        )}
      </Panel>

      {printing && (
        <FollowUpPrint
          title={t("Suivi administratif")}
          subtitle={studentName}
          meta={[
            [t("Période"), `${formatDate(from)} - ${formatDate(to)}`],
            [t("Absences"), absences],
            [t("Retards"), lateness],
          ]}
          reports={reports}
          onClose={() => setPrinting(false)}
        />
      )}
    </div>
  );
};

export default MyFollowUp;

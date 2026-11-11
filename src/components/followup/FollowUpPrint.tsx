import React from 'react';
import PrintPreview, { DocumentHeader } from '../print/PrintPreview';
import { ATTENDANCE_LABELS, CONDUCT_LABELS, DailyReport } from '../../lib/followup';
import { formatDate } from '../../lib/grades';
import { t, isolate } from '../../i18n';

interface FollowUpPrintProps {
  title: string;
  subtitle: string;
  meta: [string, React.ReactNode][];
  reports: DailyReport[];
  onClose: () => void;
}

const FollowUpPrint: React.FC<FollowUpPrintProps> = ({ title, subtitle, meta, reports, onClose }) => (
  <PrintPreview title={`${isolate(title)} — ${isolate(subtitle)}`} onClose={onClose}>
    <DocumentHeader title={title} subtitle={subtitle} meta={meta} />
    {reports.length === 0 ? (
      <p className="print-doc-empty">{t("Aucun rapport sur cette période.")}</p>
    ) : (
      <table>
        <thead>
          <tr>
            <th>{t("Date")}</th>
            <th>{t("Étudiant")}</th>
            <th>{t("Présence")}</th>
            <th>{t("Conduite")}</th>
            <th>{t("Activités")}</th>
            <th>{t("Observations")}</th>
            <th>{t("Auteur")}</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>{formatDate(report.report_date)}</td>
              <td>
                {report.students?.profiles?.last_name} {report.students?.profiles?.first_name}
              </td>
              <td>{report.attendance ? ATTENDANCE_LABELS[report.attendance] : '-'}</td>
              <td>{report.conduct ? CONDUCT_LABELS[report.conduct] : '-'}</td>
              <td>{report.activities || '-'}</td>
              <td>{report.observations || '-'}</td>
              <td>{report.author_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
    <p className="print-doc-sign">{t("Signature et cachet de l'établissement")}</p>
  </PrintPreview>
);

export default FollowUpPrint;

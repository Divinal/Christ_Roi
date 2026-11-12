import React, { useEffect, useMemo, useRef, useState } from 'react';
import PrintPreview from '../print/PrintPreview';
import { siteConfig } from '../../config/site.config';
import { CURRENT_ACADEMIC_YEAR, Level } from '../../lib/levels';
import { StudentOption, studentFullName } from '../../lib/students';
import { TERMS, Term, currentTerm, formatDate, formatGrade, gradeSchemeOf, termLabel } from '../../lib/grades';
import {
  ReportCardData,
  ReportCardResult,
  computeReportCard,
  formatRank,
  loadReportCardData,
  rankOf,
} from '../../lib/reportCard';
import { todayLocal } from '../../lib/followup';
import { isolate, t } from '../../i18n';

interface ReportCardPrintProps {
  level: Level;
  // Tous les élèves du niveau : ils servent au classement.
  levelStudents: StudentOption[];
  // Élèves dont on imprime le bulletin (un seul, ou tout le niveau).
  printIds: string[];
  onClose: () => void;
}

interface SheetProps {
  student: StudentOption;
  level: Level;
  term: Term;
  result: ReportCardResult;
  rank: number | null;
  classSize: number;
  absences: string;
  observation: string;
  issueDate: string;
  showHomework: boolean;
}

const config = siteConfig.reportCard;

const ReportCardSheet: React.FC<SheetProps> = ({
  student, level, term, result, rank, classSize, absences, observation, issueDate, showHomework,
}) => (
  <section className="report-card" data-testid="report-card">
    <div className="rc-head">
      <div>
        {config.authorityLines.map((line) => (
          <React.Fragment key={line}>
            <p>{line}</p>
            <p className="rc-sep">------------------</p>
          </React.Fragment>
        ))}
        <p className="rc-school">{siteConfig.schoolName}</p>
        <p>{t("Adresse")} : {config.address}</p>
      </div>
      <div>
        <p>{config.country}</p>
        <p>{config.countryMotto}</p>
        <p className="rc-title">{t("BULLETIN DE NOTES")}</p>
        <p className="rc-motto">{config.schoolMotto}</p>
        <p className="rc-year">{t("Année académique")} : {isolate(CURRENT_ACADEMIC_YEAR)}</p>
        <img
          src={siteConfig.logoUrl}
          alt=""
          className="rc-logo"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      </div>
    </div>

    <div className="rc-identity">
      <p>
        <strong>{t("NOM(S) ET PRÉNOM(S) DE L'ÉLÈVE")}</strong> : {studentFullName(student)}
      </p>
      <p>
        <span>{t("CLASSE")} : <strong>{level.name}</strong></span>
        <span>{t("MATRICULE")} : <strong>{student.student_number}</strong></span>
        <span><strong>{termLabel(term)}</strong></span>
      </p>
    </div>

    <table className="rc-table">
      <thead>
        <tr>
          <th>{t("Discipline")}</th>
          {showHomework && <th>{t("Moyenne de classe")}</th>}
          <th>{t("Moyenne de composition")}</th>
          {showHomework && <th>{t("Total")}</th>}
          <th>{t("Coefficient")}</th>
          <th>{t("Moyenne générale")}</th>
          <th>{t("Nom et prénoms du professeur et signature")}</th>
          <th>{t("Appréciation du professeur")}</th>
        </tr>
      </thead>
      <tbody>
        {result.lines.map((line) => (
          <tr key={line.subject.id}>
            <td>{line.subject.name}</td>
            {showHomework && <td>{formatGrade(line.classAverage)}</td>}
            <td>{formatGrade(line.compositionAverage)}</td>
            {showHomework && <td>{formatGrade(line.total)}</td>}
            <td>{line.subject.coefficient}</td>
            <td>{formatGrade(line.points)}</td>
            <td className="rc-teacher">{line.subject.teacherName}</td>
            <td>{line.appreciation}</td>
          </tr>
        ))}
        <tr className="rc-total">
          <td>{t("TOTAL")}</td>
          {showHomework && <td />}
          <td />
          {showHomework && <td />}
          <td>{result.totalCoefficient || '-'}</td>
          <td>{result.totalCoefficient ? formatGrade(result.totalPoints) : '-'}</td>
          <td />
          <td />
        </tr>
      </tbody>
    </table>

    <div className="rc-foot">
      <div>
        <p>{t("Moyenne trimestrielle")} : <strong>{formatGrade(result.termAverage)}</strong> / 20</p>
        <p>
          {t("Classement")} : <strong>{formatRank(rank)}</strong> {t("sur {0} élèves", [classSize])}
        </p>
        <p>{t("Nombre d'absences")} : <strong>{absences}</strong></p>
        <p className="rc-parent">{t("Signature du parent")}</p>
      </div>
      <div className="rc-head-sign">
        <p>{t("Observation du chef d'établissement")}</p>
        <p className="rc-observation">{observation}</p>
        <p>{t("Fait à {0}, le {1}", [config.city, formatDate(issueDate)])}</p>
        <p className="rc-head-title">{t("Le chef d'établissement")}</p>
        <p className="rc-head-name">{config.headName}</p>
      </div>
    </div>
  </section>
);

const ReportCardPrint: React.FC<ReportCardPrintProps> = ({ level, levelStudents, printIds, onClose }) => {
  const [term, setTerm] = useState<Term>(currentTerm());
  const [data, setData] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [absenceOverride, setAbsenceOverride] = useState('');
  const [observation, setObservation] = useState('');
  const [issueDate, setIssueDate] = useState(todayLocal());
  const request = useRef(0);

  const single = printIds.length === 1;
  const showHomework = gradeSchemeOf(level.cycle) === 'secondaire';
  const studentIdsKey = levelStudents.map((student) => student.id).join(',');

  useEffect(() => {
    const id = ++request.current;
    setLoading(true);
    setError('');
    loadReportCardData(level.id, studentIdsKey ? studentIdsKey.split(',') : [], term)
      .then((result) => {
        if (id !== request.current) return;
        setData(result);
        setAbsenceOverride('');
      })
      .catch((reason: any) => {
        if (id === request.current) setError(reason?.message || String(reason));
      })
      .finally(() => {
        if (id === request.current) setLoading(false);
      });
  }, [level.id, studentIdsKey, term]);

  const results = useMemo(() => {
    const map = new Map<string, ReportCardResult>();
    if (!data) return map;
    levelStudents.forEach((student) => {
      map.set(student.id, computeReportCard(data.subjects, data.gradesByStudent.get(student.id) || []));
    });
    return map;
  }, [data, levelStudents]);

  const averages = useMemo(
    () => new Map(Array.from(results.entries()).map(([id, result]) => [id, result.termAverage])),
    [results],
  );

  const absencesOf = (studentId: string): string => {
    if (single && absenceOverride !== '') return absenceOverride;
    const counted = data?.absences.get(studentId);
    if (!counted) return '0';
    return counted.excused
      ? t("{0} (dont {1} justifiée(s))", [counted.total, counted.excused])
      : String(counted.total);
  };

  const title = single
    ? t("Bulletin de notes — {0}", [studentFullName(levelStudents.find((s) => s.id === printIds[0]))])
    : t("Bulletins de notes — {0}", [level.name]);

  const controls = (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="block font-medium">
        {t("Trimestre")}
        <select
          value={term}
          onChange={(event) => setTerm(Number(event.target.value) as Term)}
          className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
          data-testid="report-term"
        >
          {TERMS.map((value) => (
            <option key={value} value={value}>{termLabel(value)}</option>
          ))}
        </select>
      </label>
      <label className="block font-medium">
        {t("Fait le")}
        <input
          type="date"
          value={issueDate}
          onChange={(event) => setIssueDate(event.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
        />
      </label>
      {single && (
        <label className="block font-medium">
          {t("Nombre d'absences")}
          <input
            type="number"
            min="0"
            value={absenceOverride}
            placeholder={absencesOf(printIds[0])}
            onChange={(event) => setAbsenceOverride(event.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
          />
        </label>
      )}
      {single && (
        <label className="block font-medium md:col-span-3">
          {t("Observation du chef d'établissement")}
          <textarea
            rows={2}
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
          />
        </label>
      )}
      <p className="text-xs text-gray-500 md:col-span-3">
        {t("Moyenne de classe = somme des devoirs ÷ nombre de devoirs. Moyenne de la discipline = (moyenne de classe + composition) ÷ 2, multipliée par le coefficient dans la colonne « Moyenne générale ».")}
      </p>
    </div>
  );

  return (
    <PrintPreview title={title} onClose={onClose} controls={controls}>
      {loading ? (
        <p className="print-doc-empty">{t("Chargement du bulletin...")}</p>
      ) : error ? (
        <p className="print-doc-empty">{error}</p>
      ) : (
        printIds.map((id) => {
          const student = levelStudents.find((candidate) => candidate.id === id);
          const result = results.get(id);
          if (!student || !result) return null;
          return (
            <ReportCardSheet
              key={id}
              student={student}
              level={level}
              term={term}
              result={result}
              rank={rankOf(averages, id)}
              classSize={levelStudents.length}
              absences={absencesOf(id)}
              observation={single ? observation : ''}
              issueDate={issueDate}
              showHomework={showHomework}
            />
          );
        })
      )}
    </PrintPreview>
  );
};

export default ReportCardPrint;

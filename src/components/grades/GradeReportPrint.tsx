import React from 'react';
import PrintPreview, { DocumentHeader } from '../print/PrintPreview';
import { CURRENT_ACADEMIC_YEAR } from '../../lib/levels';
import {
  GradeRow,
  effectiveCoefficient,
  formatDate,
  formatGrade,
  groupBySubject,
  teacherNameOf,
  weightedAverage,
} from '../../lib/grades';
import { t, locale } from '../../i18n';

interface GradeReportPrintProps {
  studentName: string;
  studentNumber: string;
  levelName?: string;
  grades: GradeRow[];
  onClose: () => void;
}

const GradeReportPrint: React.FC<GradeReportPrintProps> = ({
  studentName,
  studentNumber,
  levelName,
  grades,
  onClose,
}) => (
  <PrintPreview title={t("Relevé de notes — {0}", [studentName])} onClose={onClose}>
    <DocumentHeader
      title={t("Relevé de notes")}
      subtitle={studentName}
      meta={[
        [t("Matricule"), studentNumber],
        [t("Niveau"), levelName || t("Non inscrit")],
        [t("Année scolaire"), CURRENT_ACADEMIC_YEAR],
        [t("Édité le"), new Date().toLocaleDateString(locale())],
      ]}
    />
    <table>
      <thead>
        <tr>
          <th>{t("Matière")}</th>
          <th>{t("Évaluation")}</th>
          <th>{t("Note /20")}</th>
          <th>{t("Coef.")}</th>
          <th>{t("Date")}</th>
          <th>{t("Enseignant")}</th>
        </tr>
      </thead>
      {groupBySubject(grades).map((group) => (
        <tbody key={group.subjectId}>
          {group.grades.map((grade, index) => (
            <tr key={grade.id}>
              {index === 0 && <td rowSpan={group.grades.length + 1}>{group.name}</td>}
              <td>{grade.grade_type}</td>
              <td>{formatGrade(grade.grade_value)}</td>
              <td>{effectiveCoefficient(grade)}</td>
              <td>{formatDate(grade.exam_date)}</td>
              <td>{teacherNameOf(grade)}</td>
            </tr>
          ))}
          <tr className="print-doc-subtotal">
            <td>{t("Moyenne")}</td>
            <td>{formatGrade(group.average)}</td>
            <td colSpan={3} />
          </tr>
        </tbody>
      ))}
    </table>
    <p className="print-doc-total">
      {t("Moyenne générale :")} <strong>{formatGrade(weightedAverage(grades))} / 20</strong>
    </p>
    <p className="print-doc-sign">{t("Signature et cachet de l'établissement")}</p>
  </PrintPreview>
);

export default GradeReportPrint;

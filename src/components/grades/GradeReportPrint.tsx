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
  <PrintPreview title={`Relevé de notes — ${studentName}`} onClose={onClose}>
    <DocumentHeader
      title="Relevé de notes"
      subtitle={studentName}
      meta={[
        ['Matricule', studentNumber],
        ['Niveau', levelName || 'Non inscrit'],
        ['Année scolaire', CURRENT_ACADEMIC_YEAR],
        ['Édité le', new Date().toLocaleDateString('fr-FR')],
      ]}
    />
    <table>
      <thead>
        <tr>
          <th>Matière</th>
          <th>Évaluation</th>
          <th>Note /20</th>
          <th>Coef.</th>
          <th>Date</th>
          <th>Enseignant</th>
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
            <td>Moyenne</td>
            <td>{formatGrade(group.average)}</td>
            <td colSpan={3} />
          </tr>
        </tbody>
      ))}
    </table>
    <p className="print-doc-total">
      Moyenne générale : <strong>{formatGrade(weightedAverage(grades))} / 20</strong>
    </p>
    <p className="print-doc-sign">Signature et cachet de l'établissement</p>
  </PrintPreview>
);

export default GradeReportPrint;

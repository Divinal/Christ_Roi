import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import {
  GradeRow,
  effectiveCoefficient,
  formatDate,
  formatGrade,
  gradeToneClass,
  groupBySubject,
  teacherNameOf,
} from '../../lib/grades';
import { t } from '../../i18n';

interface StudentGradesTableProps {
  grades: GradeRow[];
  onEdit?: (grade: GradeRow) => void;
  onDelete?: (grade: GradeRow) => void;
}

// Le tableau de notes d'un étudiant : une section par matière, avec sa moyenne.
const StudentGradesTable: React.FC<StudentGradesTableProps> = ({ grades, onEdit, onDelete }) => {
  const canAct = Boolean(onEdit || onDelete);
  const columnCount = canAct ? 7 : 6;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-gray-100 text-start text-xs uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-3 py-2">{t("Évaluation")}</th>
            <th className="px-3 py-2 text-center">{t("Note /20")}</th>
            <th className="px-3 py-2 text-center">{t("Coef.")}</th>
            <th className="px-3 py-2">{t("Date")}</th>
            <th className="px-3 py-2">{t("Enseignant")}</th>
            <th className="px-3 py-2">{t("Commentaire")}</th>
            {canAct && <th className="px-3 py-2">{t("Actions")}</th>}
          </tr>
        </thead>
        {groupBySubject(grades).map((group) => (
          <tbody key={group.subjectId}>
            <tr className="border-t bg-gray-50">
              <th scope="colgroup" colSpan={columnCount} className="px-3 py-2 text-start">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900">
                    {group.name}
                    <span className="ms-2 text-xs font-normal text-gray-500">{t("coef.")} {group.coefficient}</span>
                  </span>
                  <span className="text-xs font-normal text-gray-600">
                    {t("Moyenne :")}{' '}
                    <span className={`text-sm font-bold ${gradeToneClass(group.average)}`}>
                      {formatGrade(group.average)}
                    </span>
                  </span>
                </div>
              </th>
            </tr>
            {group.grades.map((grade) => (
              <tr key={grade.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">{grade.grade_type}</td>
                <td className={`px-3 py-2 text-center text-base font-bold ${gradeToneClass(grade.grade_value)}`}>
                  {formatGrade(grade.grade_value)}
                </td>
                <td className="px-3 py-2 text-center">{effectiveCoefficient(grade)}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatDate(grade.exam_date)}</td>
                <td className="px-3 py-2">{teacherNameOf(grade)}</td>
                <td className="px-3 py-2 text-gray-600">{grade.comment || '-'}</td>
                {canAct && (
                  <td className="whitespace-nowrap px-3 py-2">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(grade)}
                        title={t("Modifier")}
                        aria-label={t("Modifier la note {0} de {1}", [grade.grade_type, group.name])}
                        className="rounded p-2 text-blue-600 hover:bg-blue-50"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(grade)}
                        title={t("Supprimer")}
                        aria-label={t("Supprimer la note {0} de {1}", [grade.grade_type, group.name])}
                        className="rounded p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
};

export default StudentGradesTable;

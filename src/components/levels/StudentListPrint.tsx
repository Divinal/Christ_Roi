import React, { useMemo, useState } from 'react';
import PrintPreview, { DocumentHeader } from '../print/PrintPreview';
import { CURRENT_ACADEMIC_YEAR, Level, cycleLabel } from '../../lib/levels';
import { formatDate } from '../../lib/grades';

export interface PrintableStudent {
  id: string;
  student_number: string;
  level_id?: string | null;
  date_of_birth?: string | null;
  parent_phone?: string | null;
  profiles?: { first_name: string; last_name: string; email: string } | null;
}

type OptionalColumn = 'birth' | 'phone' | 'email' | 'signature';

const COLUMN_LABELS: Record<OptionalColumn, string> = {
  birth: 'Date de naissance',
  phone: 'Téléphone',
  email: 'Email',
  signature: 'Colonne vide (émargement)',
};

interface StudentListPrintProps {
  level: Level;
  students: PrintableStudent[];
  onClose: () => void;
}

const StudentListPrint: React.FC<StudentListPrintProps> = ({ level, students, onClose }) => {
  const [columns, setColumns] = useState<Record<OptionalColumn, boolean>>({
    birth: true,
    phone: true,
    email: false,
    signature: false,
  });

  // Toujours la liste complète du niveau, triée par nom : la pagination et la
  // recherche de l'écran ne doivent pas tronquer un document imprimé.
  const rows = useMemo(
    () =>
      students
        .filter((student) => student.level_id === level.id)
        .sort((a, b) =>
          `${a.profiles?.last_name} ${a.profiles?.first_name}`.localeCompare(
            `${b.profiles?.last_name} ${b.profiles?.first_name}`,
            'fr',
          ),
        ),
    [students, level.id],
  );

  return (
    <PrintPreview
      title={`Liste des étudiants — ${level.name}`}
      onClose={onClose}
      controls={
        <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
          <legend className="sr-only">Colonnes à imprimer</legend>
          {(Object.keys(COLUMN_LABELS) as OptionalColumn[]).map((column) => (
            <label key={column} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={columns[column]}
                onChange={(event) => setColumns({ ...columns, [column]: event.target.checked })}
              />
              {COLUMN_LABELS[column]}
            </label>
          ))}
        </fieldset>
      }
    >
      <DocumentHeader
        title="Liste des étudiants"
        subtitle={`${level.name} — ${cycleLabel(level.cycle)}`}
        meta={[
          ['Année scolaire', CURRENT_ACADEMIC_YEAR],
          ['Effectif', rows.length],
          ['Édité le', new Date().toLocaleDateString('fr-FR')],
        ]}
      />
      {rows.length === 0 ? (
        <p className="print-doc-empty">Aucun étudiant inscrit dans ce niveau.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th className="print-doc-narrow">N°</th>
              <th>Matricule</th>
              <th>Nom</th>
              <th>Prénom</th>
              {columns.birth && <th>Date de naissance</th>}
              {columns.phone && <th>Téléphone</th>}
              {columns.email && <th>Email</th>}
              {columns.signature && <th className="print-doc-signature">Émargement</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((student, index) => (
              <tr key={student.id}>
                <td className="print-doc-narrow">{index + 1}</td>
                <td>{student.student_number}</td>
                <td>{student.profiles?.last_name}</td>
                <td>{student.profiles?.first_name}</td>
                {columns.birth && <td>{formatDate(student.date_of_birth)}</td>}
                {columns.phone && <td>{student.parent_phone || '-'}</td>}
                {columns.email && <td>{student.profiles?.email}</td>}
                {columns.signature && <td />}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PrintPreview>
  );
};

export default StudentListPrint;

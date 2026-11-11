import React, { useState } from 'react';
import { AlertTriangle, Edit, Plus, Printer, Trash2, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { CYCLES, Level, SchoolCycle, levelsOfCycle } from '../../lib/levels';
import { confirmDialog, notify, promptDialog } from '../ui/feedback';
import LevelSelect from './LevelSelect';
import StudentListPrint from './StudentListPrint';
import { t } from '../../i18n';

export interface EnrollableStudent {
  id: string;
  student_number: string;
  level_id?: string | null;
  date_of_birth?: string | null;
  parent_phone?: string | null;
  profiles?: { first_name: string; last_name: string; email: string };
}

interface LevelsManagementProps {
  levels: Level[];
  students: EnrollableStudent[];
  canManageLevels: boolean;
  onLevelsChanged: () => void;
  onStudentsChanged: () => void;
}

const LevelsManagement: React.FC<LevelsManagementProps> = ({
  levels,
  students,
  canManageLevels,
  onLevelsChanged,
  onStudentsChanged,
}) => {
  const [activeCycle, setActiveCycle] = useState<SchoolCycle>('prescolaire');
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [newLevelName, setNewLevelName] = useState<string>('');
  const [printLevelId, setPrintLevelId] = useState<string>('');

  const studentsOfLevel = (levelId: string) => students.filter((s) => s.level_id === levelId);
  const cycleLevels = levelsOfCycle(levels, activeCycle);
  const unenrolled = students.filter((s) => !s.level_id);
  const selectedLevel = cycleLevels.find((l) => l.id === selectedLevelId);
  const levelToPrint = levels.find((l) => l.id === printLevelId);

  const enroll = async (studentId: string, levelId: string | null) => {
    const { data, error } = await supabase
      .from('students')
      .update({ level_id: levelId })
      .eq('id', studentId)
      .select('id');

    if (error) {
      notify(`❌ Erreur: ${error.message}`);
    } else if (!data?.length) {
      notify(t("❌ Modification refusée : vous n'avez pas les droits nécessaires."));
    } else {
      onStudentsChanged();
    }
  };

  const handleAddLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newLevelName.trim();
    if (!name) return;

    const position = cycleLevels.reduce((max, l) => Math.max(max, l.position), 0) + 1;
    const { error } = await supabase.from('levels').insert({ cycle: activeCycle, name, position });

    if (error) {
      notify(error.code === '23505' ? t("⚠️ Le niveau « {0} » existe déjà.", [name]) : `❌ Erreur: ${error.message}`);
      return;
    }
    setNewLevelName('');
    onLevelsChanged();
  };

  const handleRenameLevel = async (level: Level) => {
    const name = await promptDialog({
      title: t("Modifier le niveau"),
      inputLabel: t("Nom du niveau"),
      defaultValue: level.name,
      confirmLabel: t("Enregistrer"),
    });
    if (!name || name === level.name) return;

    const { error } = await supabase.from('levels').update({ name }).eq('id', level.id);
    if (error) {
      notify(error.code === '23505' ? t("⚠️ Le niveau « {0} » existe déjà.", [name]) : `❌ Erreur: ${error.message}`);
      return;
    }
    onLevelsChanged();
  };

  const handleDeleteLevel = async (level: Level) => {
    const enrolled = studentsOfLevel(level.id).length;
    if (enrolled > 0) {
      notify(t("⚠️ Impossible : {0} étudiant(s) sont inscrits en {1}. Changez-les de niveau d'abord.", [enrolled, level.name]));
      return;
    }
    if (!await confirmDialog(t("⚠️ Supprimer le niveau « {0} » et ses créneaux d'emploi du temps ?", [level.name]))) return;

    const { error } = await supabase.from('levels').delete().eq('id', level.id);
    if (error) {
      notify(`❌ Erreur: ${error.message}`);
      return;
    }
    if (selectedLevelId === level.id) setSelectedLevelId('');
    onLevelsChanged();
  };

  return (
    <div className="bg-white rounded-xl shadow p-4 md:p-6">
      <h2 className="text-xl md:text-2xl font-bold mb-1">{t("Cycles & Niveaux")}</h2>
      <p className="text-sm text-gray-600 mb-6">
        {t("Chaque étudiant est inscrit directement dans son niveau.")} {students.length} {t("étudiant(s) au total.")}
      </p>

      {unenrolled.length > 0 && (
        <div className="mb-6 border border-orange-200 bg-orange-50 rounded-lg p-4">
          <h3 className="font-semibold text-orange-700 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5" />
            {unenrolled.length} {t("étudiant(s) à inscrire")}
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {unenrolled.map((student) => (
              <div key={student.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-sm">
                  {student.student_number} — {student.profiles?.first_name} {student.profiles?.last_name}
                </span>
                <LevelSelect
                  levels={levels}
                  value=""
                  onChange={(levelId) => levelId && enroll(student.id, levelId)}
                  placeholder={t("Inscrire en...")}
                  className="border rounded px-3 py-1.5 text-sm sm:w-56"
                  ariaLabel={t("Niveau de {0} {1}", [student.profiles?.first_name, student.profiles?.last_name])}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 overflow-x-auto border-b">
        {CYCLES.map((cycle) => {
          const count = students.filter((s) =>
            levelsOfCycle(levels, cycle.id).some((l) => l.id === s.level_id)
          ).length;
          return (
            <button
              key={cycle.id}
              onClick={() => {
                setActiveCycle(cycle.id);
                setSelectedLevelId('');
              }}
              className={`px-4 py-2 font-medium whitespace-nowrap border-b-2 transition ${
                activeCycle === cycle.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {cycle.label} <span className="text-xs text-gray-500">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
        {cycleLevels.map((level) => {
          const count = studentsOfLevel(level.id).length;
          const isSelected = selectedLevelId === level.id;
          return (
            <div
              key={level.id}
              className={`border rounded-lg p-3 md:p-4 ${isSelected ? 'border-indigo-600 bg-indigo-50' : ''}`}
            >
              <div className="flex justify-between items-start gap-2">
                <button
                  onClick={() => setSelectedLevelId(isSelected ? '' : level.id)}
                  className="text-start flex-1 min-w-0"
                  aria-expanded={isSelected}
                >
                  <h3 className="font-bold text-base md:text-lg">{level.name}</h3>
                  <p className="text-xs md:text-sm text-gray-600 flex items-center gap-1 mt-1">
                    <Users className="w-4 h-4" /> {count} {t("étudiant(s)")}
                  </p>
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPrintLevelId(level.id)}
                    className="text-gray-700 hover:bg-gray-100 p-2 rounded"
                    title={t("Imprimer la liste")}
                    aria-label={t("Imprimer la liste de {0}", [level.name])}
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  {canManageLevels && (
                    <>
                      <button
                        onClick={() => handleRenameLevel(level)}
                        className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                        title={t("Modifier")}
                        aria-label={t("Modifier {0}", [level.name])}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLevel(level)}
                        className="text-red-600 hover:bg-red-50 p-2 rounded"
                        title={t("Supprimer")}
                        aria-label={t("Supprimer {0}", [level.name])}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {canManageLevels && (
        <form onSubmit={handleAddLevel} className="flex flex-col sm:flex-row gap-2 mb-6">
          <input
            type="text"
            value={newLevelName}
            onChange={(e) => setNewLevelName(e.target.value)}
            placeholder={t("Ajouter un niveau en {0}...", [CYCLES.find((c) => c.id === activeCycle)?.label])}
            aria-label={t("Nom du nouveau niveau")}
            className="border rounded-lg px-3 py-2 flex-1"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> {t("Ajouter")}
          </button>
        </form>
      )}

      {selectedLevel && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-lg font-bold">{t("Étudiants inscrits en")} {selectedLevel.name}</h3>
            <button
              onClick={() => setPrintLevelId(selectedLevel.id)}
              className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm hover:bg-gray-100"
            >
              <Printer className="w-4 h-4" /> {t("Imprimer la liste")}
            </button>
          </div>
          {studentsOfLevel(selectedLevel.id).length === 0 ? (
            <p className="text-center py-6 text-gray-500">{t("Aucun étudiant inscrit dans ce niveau")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-start">{t("Matricule")}</th>
                    <th className="px-3 py-2 text-start">{t("Nom")}</th>
                    <th className="px-3 py-2 text-start">{t("Changer de niveau")}</th>
                    <th className="px-3 py-2 text-start">{t("Retirer")}</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsOfLevel(selectedLevel.id).map((student) => (
                    <tr key={student.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{student.student_number}</td>
                      <td className="px-3 py-2">{student.profiles?.first_name} {student.profiles?.last_name}</td>
                      <td className="px-3 py-2">
                        <LevelSelect
                          levels={levels}
                          value={selectedLevel.id}
                          onChange={(levelId) => levelId && enroll(student.id, levelId)}
                          className="border rounded px-2 py-1"
                          ariaLabel={t("Niveau de {0} {1}", [student.profiles?.first_name, student.profiles?.last_name])}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={async () => {
                            if (await confirmDialog(t("⚠️ Retirer cet étudiant du niveau {0} ?", [selectedLevel.name]))) {
                              enroll(student.id, null);
                            }
                          }}
                          className="text-red-600 hover:bg-red-50 p-2 rounded"
                          title={t("Retirer du niveau")}
                          aria-label={t("Retirer {0} {1} du niveau", [student.profiles?.first_name, student.profiles?.last_name])}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {levelToPrint && (
        <StudentListPrint level={levelToPrint} students={students} onClose={() => setPrintLevelId('')} />
      )}
    </div>
  );
};

export default LevelsManagement;

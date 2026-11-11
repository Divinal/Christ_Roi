import { supabase } from './supabaseClient';
import { t } from '../i18n';

export type SchoolCycle = 'prescolaire' | 'primaire' | 'college' | 'lycee' | 'superieur';

export interface Level {
  id: string;
  cycle: SchoolCycle;
  name: string;
  position: number;
}

// Ordre d'affichage : du plus jeune au plus âgé.
export const CYCLES: { id: SchoolCycle; label: string }[] = [
  { id: 'prescolaire', label: t("Pré-scolaire") },
  { id: 'primaire', label: t("Primaire") },
  { id: 'college', label: t("Collège") },
  { id: 'lycee', label: t("Lycée") },
  { id: 'superieur', label: t("Supérieur") },
];

export const CURRENT_ACADEMIC_YEAR = '2026-2027';

export const cycleLabel = (cycle: SchoolCycle): string =>
  CYCLES.find((c) => c.id === cycle)?.label || cycle;

export const levelsOfCycle = (levels: Level[], cycle: SchoolCycle): Level[] =>
  levels.filter((l) => l.cycle === cycle).sort((a, b) => a.position - b.position);

export const fetchLevels = async (): Promise<Level[]> => {
  const { data, error } = await supabase
    .from('levels')
    .select('id, cycle, name, position')
    .order('position', { ascending: true });

  if (error) {
    console.error('Erreur chargement niveaux:', error);
    return [];
  }
  return (data || []) as Level[];
};

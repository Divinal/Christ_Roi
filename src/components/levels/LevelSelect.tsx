import React from 'react';
import { CYCLES, Level, SchoolCycle, levelsOfCycle } from '../../lib/levels';

interface LevelSelectProps {
  levels: Level[];
  value: string;
  onChange: (levelId: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  // Limite le choix à un cycle (filtre "Cycle" puis "Niveau").
  cycle?: SchoolCycle | 'all';
  ariaLabel?: string;
}

const LevelSelect: React.FC<LevelSelectProps> = ({
  levels,
  value,
  onChange,
  placeholder = 'Sélectionner un niveau...',
  required,
  disabled,
  className = 'w-full border rounded px-3 py-2',
  cycle = 'all',
  ariaLabel,
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    required={required}
    disabled={disabled}
    className={className}
    aria-label={ariaLabel}
  >
    <option value="">{placeholder}</option>
    {CYCLES.filter((c) => cycle === 'all' || c.id === cycle).map((c) => (
      <optgroup key={c.id} label={c.label}>
        {levelsOfCycle(levels, c.id).map((level) => (
          <option key={level.id} value={level.id}>{level.name}</option>
        ))}
      </optgroup>
    ))}
  </select>
);

export default LevelSelect;

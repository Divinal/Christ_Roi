import React from 'react';
import { Languages } from 'lucide-react';
import { LANGUAGES, Language, language, setLanguage, t } from '../../i18n';

// Choix de la langue : toute la plateforme bascule (la page se recharge).
const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => (
  <label className={`relative flex shrink-0 items-center ${className}`}>
    <span className="sr-only">{t('Langue')}</span>
    <Languages className="pointer-events-none absolute start-2 h-4 w-4 text-gray-500" aria-hidden />
    <select
      value={language}
      onChange={(event) => setLanguage(event.target.value as Language)}
      aria-label={t('Langue')}
      data-testid="language-switcher"
      className="appearance-none rounded-lg border bg-white py-1.5 pe-3 ps-8 text-sm text-gray-700 hover:bg-gray-100"
    >
      {LANGUAGES.map((option) => (
        <option key={option.id} value={option.id} lang={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

export default LanguageSwitcher;

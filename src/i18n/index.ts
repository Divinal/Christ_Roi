import en from './en';
import ar from './ar';

// Le français est la langue de base : c'est aussi la clé de chaque traduction.
// Un texte absent d'un dictionnaire s'affiche en français, jamais vide.
export type Language = 'fr' | 'en' | 'ar';

export const LANGUAGES: { id: Language; label: string; short: string }[] = [
  { id: 'fr', label: 'Français', short: 'FR' },
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'ar', label: 'العربية', short: 'ع' },
];

const STORAGE_KEY = 'app.language';
const DICTIONARIES: Record<Exclude<Language, 'fr'>, Record<string, string>> = { en, ar };

const detectLanguage = (): Language => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'fr' || saved === 'en' || saved === 'ar') return saved;
  } catch {
    // Stockage indisponible (navigation privée stricte) : langue de base.
  }
  return 'fr';
};

// Lue une fois au chargement : changer de langue recharge la page, ce qui
// retraduit aussi les libellés définis au niveau des modules (menus, tables…).
export const language: Language = detectLanguage();
export const isRtl = language === 'ar';

export const t = (text: string, values?: (string | number | null | undefined)[]): string => {
  const translated = language === 'fr' ? text : DICTIONARIES[language][text] ?? text;
  if (!values) return translated;
  return translated.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? ''));
};

// Dates et nombres : chiffres latins aussi en arabe, comme dans les montants FCFA.
// Isole un fragment (nom de niveau, date) pour qu'il garde son ordre au milieu d'un texte arabe.
export const isolate = (text: string | number | null | undefined): string =>
  isRtl ? `⁨${text ?? ''}⁩` : String(text ?? '');

export const locale =(): string => ({ fr: 'fr-FR', en: 'en-GB', ar: 'ar-u-nu-latn' })[language];

export const setLanguage = (next: Language) => {
  if (next === language) return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    return;
  }
  window.location.reload();
};

export const applyDocumentLanguage = () => {
  document.documentElement.lang = language;
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
};

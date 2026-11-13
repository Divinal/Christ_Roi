import { PublicPage } from '../components/PublicHeader';

// Chemins réels des pages publiques : ils rendent chaque page indexable et
// partageable individuellement (au lieu d'un état interne invisible dans
// l'URL). Synchronisés avec l'historique du navigateur depuis App.tsx.
export const PUBLIC_PATHS: Record<PublicPage, string> = {
  home: '/',
  contact: '/contact',
  privacy: '/confidentialite',
  // Suivi du jeton du lien : /inscription/<jeton>.
  register: '/inscription',
};

export const pathToPublicPage = (pathname: string): PublicPage => {
  if (pathname.startsWith(`${PUBLIC_PATHS.register}/`)) return 'register';
  const match = (Object.entries(PUBLIC_PATHS) as [PublicPage, string][]).find(
    ([, path]) => path === pathname
  );
  return match ? match[0] : 'home';
};

import { PublicPage } from '../components/PublicHeader';

// Chemins réels des pages publiques : ils rendent chaque page indexable et
// partageable individuellement (au lieu d'un état interne invisible dans
// l'URL). Synchronisés avec l'historique du navigateur depuis App.tsx.
export const PUBLIC_PATHS: Record<PublicPage, string> = {
  home: '/',
  contact: '/contact',
  privacy: '/confidentialite',
};

export const pathToPublicPage = (pathname: string): PublicPage => {
  const match = (Object.entries(PUBLIC_PATHS) as [PublicPage, string][]).find(
    ([, path]) => path === pathname
  );
  return match ? match[0] : 'home';
};

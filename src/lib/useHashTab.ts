import { useCallback, useEffect, useState } from 'react';

const readTab = (allowed: string[], fallback: string): string => {
  const tab = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));
  return allowed.includes(tab) ? tab : fallback;
};

// L'onglet actif vit dans l'adresse (#/notes) : une page rechargée reste au
// même endroit et les boutons précédent/suivant du navigateur fonctionnent.
export const useHashTab = (allowed: string[], fallback: string): [string, (tab: string) => void] => {
  const [tab, setTab] = useState<string>(() => readTab(allowed, fallback));
  const allowedKey = allowed.join('|');

  useEffect(() => {
    const sync = () => setTab(readTab(allowed, fallback));
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedKey, fallback]);

  const navigate = useCallback((next: string) => {
    window.location.hash = `/${next}`;
    setTab(next);
    window.scrollTo(0, 0);
  }, []);

  return [tab, navigate];
};

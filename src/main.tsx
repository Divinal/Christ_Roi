import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyDocumentLanguage } from './i18n'

// Langue et sens d'écriture (arabe : de droite à gauche) avant le premier rendu.
applyDocumentLanguage();

// Restaure le chemin mémorisé par public/404.html (nécessaire sur GitHub
// Pages, qui n'a pas de routage serveur) avant que l'app ne lise l'URL.
const redirectPath = sessionStorage.getItem('redirectPath');
if (redirectPath) {
  sessionStorage.removeItem('redirectPath');
  window.history.replaceState({}, '', redirectPath);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>,
)

// Après une première visite, l'application s'ouvre même si le DNS du Wi-Fi ne
// trouve plus le site (voir public/sw.js). Production uniquement.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

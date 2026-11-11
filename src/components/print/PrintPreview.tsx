import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { siteConfig } from '../../config/site.config';
import { t } from '../../i18n';

interface PrintPreviewProps {
  title: string;
  onClose: () => void;
  controls?: React.ReactNode;
  children: React.ReactNode;
}

// Aperçu à l'écran + copie directement sous <body> pour l'impression : une
// fenêtre modale limite sa hauteur, ce qui couperait une liste longue à la
// première page. Voir la règle #print-root dans index.css.
const PrintPreview: React.FC<PrintPreviewProps> = ({ title, onClose, controls, children }) => (
  <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-2 md:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[95vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Printer className="h-4 w-4" /> {t("Imprimer")}
            </button>
            <button
              onClick={onClose}
              aria-label={t("Fermer l'aperçu")}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {controls && <div className="border-b p-4 text-sm text-gray-700">{controls}</div>}
        <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-2 md:p-4">
          <div className="print-doc mx-auto min-w-[640px] max-w-3xl rounded p-6 shadow">{children}</div>
        </div>
      </div>
    </div>
    {createPortal(
      <div id="print-root">
        <div className="print-doc">{children}</div>
      </div>,
      document.body,
    )}
  </>
);

export const DocumentHeader: React.FC<{ title: string; subtitle?: string; meta: [string, React.ReactNode][] }> = ({
  title,
  subtitle,
  meta,
}) => (
  <header className="print-doc-header">
    <div className="print-doc-school">
      <img
        src={siteConfig.logoUrl}
        alt=""
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
      <div>
        <strong>{t(siteConfig.schoolName)}</strong>
        <div>{siteConfig.contact.phone}</div>
      </div>
    </div>
    <h1>{title}</h1>
    {subtitle && <p className="print-doc-subtitle">{subtitle}</p>}
    <dl className="print-doc-meta">
      {meta.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  </header>
);

export default PrintPreview;

import React from 'react';
import { siteConfig } from '../config/site.config';
import { PublicPage } from './PublicHeader';
import { PUBLIC_PATHS } from '../lib/publicRoutes';
import { t } from '../i18n';

interface PublicFooterProps {
  onNavigate: (page: PublicPage) => void;
  onLoginClick: () => void;
}

const PublicFooter: React.FC<PublicFooterProps> = ({ onNavigate, onLoginClick }) => {
  const navigate = (page: PublicPage) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(page);
  };

  return (
    <footer className="bg-white border-t mt-auto">
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-gray-900 mb-4 text-lg">{t(siteConfig.about.title)}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{t(siteConfig.about.description)}</p>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-4 text-lg">{t("Liens rapides")}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href={PUBLIC_PATHS.home} onClick={navigate('home')} className="text-gray-600 hover:text-blue-600 transition">
                  {t("Accueil")}
                </a>
              </li>
              <li>
                <a href={PUBLIC_PATHS.contact} onClick={navigate('contact')} className="text-gray-600 hover:text-blue-600 transition">
                  {t("Contact")}
                </a>
              </li>
              <li>
                <a href={PUBLIC_PATHS.privacy} onClick={navigate('privacy')} className="text-gray-600 hover:text-blue-600 transition">
                  {t("Confidentialité")}
                </a>
              </li>
              <li>
                <button onClick={onLoginClick} className="text-gray-600 hover:text-blue-600 transition">
                  {t("Connexion")}
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-4 text-lg">{t("Ressources")}</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-600 hover:text-blue-600 transition">{t("Aide")}</a></li>
              <li><a href="#" className="text-gray-600 hover:text-blue-600 transition">{t("Guide d'utilisation")}</a></li>
              <li><a href="#" className="text-gray-600 hover:text-blue-600 transition">{t("FAQ")}</a></li>
              <li><a href="#" className="text-gray-600 hover:text-blue-600 transition">{t("Support")}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-4 text-lg">{t("Contact")}</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              {siteConfig.contact.addressLines.map((line) => (
                <li key={line}>{t(line)}</li>
              ))}
              <li>
                <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-blue-600 transition">
                  {siteConfig.contact.email}
                </a>
              </li>
              <li>
                <a href={`tel:${siteConfig.contact.phone.replace(/\s/g, '')}`} className="hover:text-blue-600 transition">
                  {siteConfig.contact.phone}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} {t(siteConfig.copyrightOwner)}{t(". Tous droits réservés.")}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;

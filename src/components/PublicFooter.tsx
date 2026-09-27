import React from 'react';
import { siteConfig } from '../config/site.config';
import { PublicPage } from './PublicHeader';
import { PUBLIC_PATHS } from '../lib/publicRoutes';

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
            <h3 className="font-bold text-gray-900 mb-4 text-lg">{siteConfig.about.title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{siteConfig.about.description}</p>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-4 text-lg">Liens rapides</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href={PUBLIC_PATHS.home} onClick={navigate('home')} className="text-gray-600 hover:text-blue-600 transition">
                  Accueil
                </a>
              </li>
              <li>
                <a href={PUBLIC_PATHS.contact} onClick={navigate('contact')} className="text-gray-600 hover:text-blue-600 transition">
                  Contact
                </a>
              </li>
              <li>
                <a href={PUBLIC_PATHS.privacy} onClick={navigate('privacy')} className="text-gray-600 hover:text-blue-600 transition">
                  Confidentialité
                </a>
              </li>
              <li>
                <button onClick={onLoginClick} className="text-gray-600 hover:text-blue-600 transition">
                  Connexion
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-4 text-lg">Ressources</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-600 hover:text-blue-600 transition">Aide</a></li>
              <li><a href="#" className="text-gray-600 hover:text-blue-600 transition">Guide d'utilisation</a></li>
              <li><a href="#" className="text-gray-600 hover:text-blue-600 transition">FAQ</a></li>
              <li><a href="#" className="text-gray-600 hover:text-blue-600 transition">Support</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-4 text-lg">Contact</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              {siteConfig.contact.addressLines.map((line) => (
                <li key={line}>{line}</li>
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
            © {new Date().getFullYear()} {siteConfig.copyrightOwner}. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;

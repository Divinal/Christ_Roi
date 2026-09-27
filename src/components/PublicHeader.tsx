import React, { useState } from 'react';
import { Menu, X as CloseIcon } from 'lucide-react';
import { siteConfig } from '../config/site.config';
import { PUBLIC_PATHS } from '../lib/publicRoutes';

export type PublicPage = 'home' | 'contact' | 'privacy';

interface PublicHeaderProps {
  currentPage: PublicPage;
  onNavigate: (page: PublicPage) => void;
  onLoginClick: () => void;
}

const navItems: { id: PublicPage; label: string }[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'contact', label: 'Contact' },
  { id: 'privacy', label: 'Confidentialité' },
];

const PublicHeader: React.FC<PublicHeaderProps> = ({ currentPage, onNavigate, onLoginClick }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // De vrais liens <a href> (plutôt que des <button onClick>) pour que les
  // pages publiques soient explorables par les moteurs de recherche et
  // ouvrables dans un nouvel onglet / avec clic molette.
  const navigate = (page: PublicPage) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <nav className="container mx-auto px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <a href={PUBLIC_PATHS.home} onClick={navigate('home')} className="flex items-center gap-3">
            <img
              src={siteConfig.logoUrl}
              alt={`Logo ${siteConfig.schoolName}`}
              className="h-10 w-10 object-contain"
              onError={(e) => {
                e.currentTarget.src = `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%233b82f6" width="40" height="40" rx="8"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="20" font-weight="bold"%3E${siteConfig.logoFallbackInitials}%3C/text%3E%3C/svg%3E`;
              }}
            />
            <h1 className="text-xl md:text-2xl font-bold text-blue-600">{siteConfig.schoolName}</h1>
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={PUBLIC_PATHS[item.id]}
                onClick={navigate(item.id)}
                className={`transition ${
                  currentPage === item.id ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                {item.label}
              </a>
            ))}
            <button
              onClick={onLoginClick}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition shadow-md"
            >
              Connexion
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600 hover:text-blue-600"
          >
            {mobileMenuOpen ? <CloseIcon className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 space-y-3 border-t pt-4">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={PUBLIC_PATHS[item.id]}
                onClick={navigate(item.id)}
                className={`block w-full text-left py-2 transition ${
                  currentPage === item.id ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                {item.label}
              </a>
            ))}
            <button
              onClick={() => {
                onLoginClick();
                setMobileMenuOpen(false);
              }}
              className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Connexion
            </button>
          </div>
        )}
      </nav>
    </header>
  );
};

export default PublicHeader;

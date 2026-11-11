import React from 'react';
import PublicLayout from '../components/PublicLayout';
import { PublicPage } from '../components/PublicHeader';
import { siteConfig } from '../config/site.config';
import { t, locale } from '../i18n';

interface PrivacyPageProps {
  onNavigate: (page: PublicPage) => void;
  onLoginClick: () => void;
}

const sections = [
  {
    title: t("1. Données collectées"),
    body:
      t("Lors de votre inscription et de votre utilisation de la plateforme, nous collectons : votre nom, prénom, adresse email, numéro de téléphone, ainsi que les données pédagogiques liées à votre scolarité (notes, emploi du temps, présences)."),
  },
  {
    title: t("2. Utilisation des données"),
    body:
      t("Ces données sont utilisées exclusivement pour assurer le fonctionnement de la plateforme : gestion des comptes, suivi pédagogique, communication entre étudiants, enseignants et administration."),
  },
  {
    title: t("3. Partage des données"),
    body:
      t("Vos données ne sont jamais vendues ni partagées avec des tiers à des fins commerciales. Elles ne sont accessibles qu'au personnel autorisé de l'établissement et aux prestataires techniques nécessaires au fonctionnement du service."),
  },
  {
    title: t("4. Sécurité"),
    body:
      t("Les données sont stockées sur des infrastructures sécurisées et l'accès est protégé par authentification. Des mesures techniques raisonnables sont mises en place pour prévenir tout accès non autorisé."),
  },
  {
    title: t("5. Vos droits"),
    body:
      t("Vous pouvez à tout moment demander l'accès, la rectification ou la suppression de vos données personnelles en contactant l'administration via les coordonnées ci-dessous."),
  },
  {
    title: '6. Cookies',
    body:
      t("La plateforme utilise uniquement les cookies strictement nécessaires à votre connexion et à la sécurité de votre session."),
  },
];

const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigate, onLoginClick }) => {
  return (
    <PublicLayout currentPage="privacy" onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <section className="container mx-auto px-4 lg:px-8 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">
            {t("Politique de confidentialité")}
          </h2>
          <p className="text-gray-600 text-center mb-12">
            {t("Dernière mise à jour :")} {new Date().toLocaleDateString(locale(), { year: 'numeric', month: 'long' })}
          </p>

          <div className="space-y-8">
            {sections.map((section) => (
              <div key={section.title}>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{section.title}</h3>
                <p className="text-gray-600 leading-relaxed">{section.body}</p>
              </div>
            ))}

            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t("7. Contact")}</h3>
              <p className="text-gray-600 leading-relaxed">
                {t("Pour toute question relative à cette politique de confidentialité, contactez")}{' '}
                {t(siteConfig.schoolName)} {t("à l'adresse")}{' '}
                <a href={`mailto:${siteConfig.contact.email}`} className="text-blue-600 hover:underline">
                  {siteConfig.contact.email}
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default PrivacyPage;

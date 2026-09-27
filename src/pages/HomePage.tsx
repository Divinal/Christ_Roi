import React from 'react';
import PublicLayout from '../components/PublicLayout';
import { PublicPage } from '../components/PublicHeader';
import { siteConfig } from '../config/site.config';
import { PUBLIC_PATHS } from '../lib/publicRoutes';

interface HomePageProps {
  onNavigate: (page: PublicPage) => void;
  onLoginClick: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigate, onLoginClick }) => {
  return (
    <PublicLayout currentPage="home" onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <section className="container mx-auto px-4 lg:px-8 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6">
            <span className="bg-blue-100 text-blue-600 px-4 py-2 rounded-full text-sm font-medium">
              {siteConfig.tagline}
            </span>
          </div>

          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            {siteConfig.hero.title}
          </h2>

          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            {siteConfig.hero.description}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={onLoginClick}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-lg text-lg w-full sm:w-auto"
            >
              Commencer maintenant
            </button>
            <a
              href={PUBLIC_PATHS.contact}
              onClick={(e) => {
                e.preventDefault();
                onNavigate('contact');
              }}
              className="bg-white text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition border border-gray-300 text-lg w-full sm:w-auto text-center"
            >
              En savoir plus
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16">
            {siteConfig.stats.map((stat) => (
              <div key={stat.label} className="bg-white p-6 rounded-xl shadow-md">
                <div className="text-3xl font-bold text-blue-600 mb-2">{stat.value}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default HomePage;
